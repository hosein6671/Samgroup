import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { assertDryRunOnly, DryRunRequiredError, main, OFFLINE_DATABASE, parseArgs } from "./cli";
import { DryRunWroteDataError, renderSummary, runDryRun, WATCHED_TABLES } from "./dry-run";
import { buildImportPlan } from "./import-planner";
import { buildManifest } from "./manifest";
import { simulatePlannerReplay } from "./planner-replay";

import type { DryRunDatabase } from "./dry-run";
import type { IdentityLedger } from "./identity-ledger";
import type { Manifest } from "./manifest";

const PLAN_INPUT = {
  workbook: WORKBOOK_FIXTURE,
  workbookFileName: "workbook.xlsx",
  workbookSha256: "0".repeat(64),
  workbookByteSize: 1,
  existingSlugKeys: new Set<string>(),
};

/** A database that records every call, so the test can assert what the run touched. */
function stubDatabase(
  counts: Record<string, number> = {},
  slugKeys: readonly string[] = [],
  sourceRefs: readonly string[] = [],
): DryRunDatabase & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    countRows(tables) {
      calls.push("countRows");
      return Promise.resolve(new Map(tables.map((table) => [table, counts[table] ?? 0])));
    },
    listSlugKeys() {
      calls.push("listSlugKeys");
      return Promise.resolve(new Set(slugKeys));
    },
    listProductSourceRefs() {
      calls.push("listProductSourceRefs");
      return Promise.resolve(new Set(sourceRefs));
    },
  };
}

describe("the dry run writes nothing", () => {
  it("only reads: row counts, the slug namespace and the persisted references", async () => {
    const database = stubDatabase();
    await runDryRun(database, (keys) => buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }));
    expect(database.calls).toEqual([
      "countRows",
      "listSlugKeys",
      "listProductSourceRefs",
      "countRows",
    ]);
  });

  it("reports every watched table unchanged", async () => {
    const before = { products: 10, categories: 6, segments: 8, product_slug_claims: 16 };
    const result = await runDryRun(stubDatabase(before), (keys) =>
      buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }),
    );
    expect(result.wroteNothing).toBe(true);
    expect(result.changedTables).toEqual([]);
    expect(result.countsBefore.get("products")).toBe(10);
    expect(result.countsAfter.get("products")).toBe(10);
  });

  it("watches the demo Products so their deletion could not go unnoticed", () => {
    expect(WATCHED_TABLES).toContain("products");
    expect(WATCHED_TABLES).toContain("specifications");
    expect(WATCHED_TABLES).toContain("product_grades");
    expect(WATCHED_TABLES).toContain("source_facts");
  });

  it("FAILS the run if any count moved, rather than reporting success", async () => {
    let call = 0;
    const drifting: DryRunDatabase = {
      countRows(tables) {
        call++;
        return Promise.resolve(
          new Map(tables.map((table) => [table, table === "products" && call > 1 ? 110 : 10])),
        );
      },
      listSlugKeys: () => Promise.resolve(new Set<string>()),
      listProductSourceRefs: () => Promise.resolve(new Set<string>()),
    };
    await expect(
      runDryRun(drifting, (keys) => buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys })),
    ).rejects.toBeInstanceOf(DryRunWroteDataError);
  });
});

describe("the summary", () => {
  it("is a pure function of the plan: two runs render identically", async () => {
    const first = await runDryRun(stubDatabase(), (keys) =>
      buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }),
    );
    const second = await runDryRun(stubDatabase(), (keys) =>
      buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }),
    );
    expect(renderSummary(first)).toBe(renderSummary(second));
    expect(buildManifest(first.plan).manifestHash).toBe(buildManifest(second.plan).manifestHash);
  });

  it("states the ratified counts", async () => {
    const result = await runDryRun(stubDatabase(), (keys) =>
      buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }),
    );
    const summary = renderSummary(result);
    expect(summary).toContain("rows parsed                   100");
    expect(summary).toContain("zero-grade products           56");
    expect(summary).toContain("single-grade products         5");
    expect(summary).toContain("multi-grade products          39");
    expect(summary).toContain("ProductGrade candidates       134");
    expect(summary).toContain("WROTE NOTHING                 yes");
  });

  it("separates raw SourceFacts from valid Specification candidates", async () => {
    const result = await runDryRun(stubDatabase(), (keys) =>
      buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }),
    );
    const summary = renderSummary(result);
    expect(summary).toContain("raw technical SourceFacts     1528");
    expect(summary).toContain("valid Specification cands     1398");
    expect(summary).toContain("withheld from Specification   130");
  });

  it("reports the live before/after counts as its only database evidence", async () => {
    const result = await runDryRun(stubDatabase({ products: 4 }), (keys) =>
      buildImportPlan({ ...PLAN_INPUT, existingSlugKeys: keys }),
    );
    const summary = renderSummary(result);
    expect(summary).toContain("DATABASE (live, before -> after)");
    expect(summary).toContain("products                     4 ->     4");
  });
});

describe("the command line refuses anything but a dry run", () => {
  it("requires --dry-run", () => {
    expect(() => assertDryRunOnly(["--workbook", "x.xlsx"])).toThrow(DryRunRequiredError);
    expect(() => assertDryRunOnly(["--dry-run"])).not.toThrow();
  });

  it("refuses every argument that would mean write", () => {
    for (const arg of [
      "--apply",
      "--commit",
      "--write",
      "--execute",
      "--persist",
      "--force",
      "--yes",
      "-y",
      "--no-dry-run",
    ]) {
      expect(() => assertDryRunOnly(["--dry-run", arg])).toThrow(DryRunRequiredError);
    }
  });

  it("refuses every argument that would mean approve", () => {
    for (const arg of ["--approve", "--approved", "--review-status=APPROVED"]) {
      expect(() => assertDryRunOnly(["--dry-run", arg])).toThrow(DryRunRequiredError);
    }
  });

  it("refuses a forbidden argument even when --dry-run is also present", () => {
    expect(() => assertDryRunOnly(["--dry-run", "--apply"])).toThrow(/no apply mode/);
  });

  it("refuses an argument that would mean ratify", () => {
    expect(() => assertDryRunOnly(["--dry-run", "--ratify"])).toThrow(DryRunRequiredError);
  });

  it("needs to be told where the workbook is, and never guesses", () => {
    const saved = process.env["CATALOG_WORKBOOK"];
    delete process.env["CATALOG_WORKBOOK"];
    try {
      expect(() => parseArgs(["--dry-run"])).toThrow(/No workbook given/);
    } finally {
      if (saved !== undefined) process.env["CATALOG_WORKBOOK"] = saved;
    }
  });

  it("accepts an explicit workbook path and depends on no developer-specific default", () => {
    const saved = process.env["CATALOG_WORKBOOK"];
    delete process.env["CATALOG_WORKBOOK"];
    try {
      const options = parseArgs(["--dry-run", "--workbook", "some/where/wb.xlsx"]);
      expect(options.workbookPath).toContain("wb.xlsx");
      expect(options.useFixture).toBe(false);
    } finally {
      if (saved !== undefined) process.env["CATALOG_WORKBOOK"] = saved;
    }
  });

  it("keeps the fixture run and the authoritative run apart", () => {
    const saved = process.env["CATALOG_WORKBOOK"];
    delete process.env["CATALOG_WORKBOOK"];
    try {
      expect(parseArgs(["--dry-run", "--fixture"]).useFixture).toBe(true);
      expect(() => parseArgs(["--dry-run", "--fixture", "--workbook", "wb.xlsx"])).toThrow(
        /mutually exclusive/,
      );
    } finally {
      if (saved !== undefined) process.env["CATALOG_WORKBOOK"] = saved;
    }
  });
});

describe("the review artefacts", () => {
  const outDir = mkdtempSync(join(tmpdir(), "catalog-import-"));
  const argv = (suffix: string): string[] => [
    "--dry-run",
    "--fixture",
    "--manifest-out",
    join(outDir, `manifest-${suffix}.json`),
    "--summary-out",
    join(outDir, `summary-${suffix}.md`),
    "--ledger-out",
    join(outDir, `ledger-${suffix}.json`),
  ];
  const digest = (path: string): string =>
    createHash("sha256").update(readFileSync(path)).digest("hex");

  it("are emitted outside the source tree and are byte-identical across two runs", async () => {
    await main(argv("a"), OFFLINE_DATABASE, () => undefined);
    await main(argv("b"), OFFLINE_DATABASE, () => undefined);
    for (const name of ["manifest", "summary", "ledger"]) {
      const extension = name === "summary" ? "md" : "json";
      expect(digest(join(outDir, `${name}-a.${extension}`))).toBe(
        digest(join(outDir, `${name}-b.${extension}`)),
      );
    }
  });

  it("contain all 100 products with their identity state and evidence hash", async () => {
    await main(argv("c"), OFFLINE_DATABASE, () => undefined);
    const manifest = JSON.parse(readFileSync(join(outDir, "manifest-c.json"), "utf8")) as Manifest;
    expect(manifest.rows).toHaveLength(100);
    expect(new Set(manifest.rows.map((row) => row.sourceRef)).size).toBe(100);
    expect(new Set(manifest.rows.map((row) => row.proposedSlug)).size).toBe(100);
    for (const row of manifest.rows) {
      expect(row.identityState).toBe("PROPOSED");
      expect(row.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("carry no absolute path, no per-run timestamp and no connection detail", async () => {
    await main(argv("d"), OFFLINE_DATABASE, () => undefined);
    for (const file of ["manifest-d.json", "summary-d.md", "ledger-d.json"]) {
      const text = readFileSync(join(outDir, file), "utf8");
      expect(text).not.toContain(outDir);
      expect(text).not.toContain(process.cwd());
      expect(text).not.toMatch(/postgres(ql)?:\/\//);
      expect(text).not.toContain("DATABASE_URL");
      // The only ISO instants present are the fixed retrieval constants, never `now`.
      const year = new Date().getUTCFullYear();
      const instants = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g) ?? [];
      for (const instant of instants) {
        expect(instant).toBe("2026-08-22T00:00:00");
      }
      expect(String(year).length).toBe(4);
    }
  });

  it("stamps a fixture-sourced artefact as NOT the authoritative workbook", async () => {
    await main(argv("e"), OFFLINE_DATABASE, () => undefined);
    const manifest = JSON.parse(readFileSync(join(outDir, "manifest-e.json"), "utf8")) as Manifest;
    expect(manifest.workbook.provenance).toBe("FROZEN_FIXTURE");
    expect(manifest.workbook.sha256).toBe("0".repeat(64));
  });

  it("emits a ledger whose every entry is PROPOSED, never RATIFIED", async () => {
    await main(argv("f"), OFFLINE_DATABASE, () => undefined);
    const ledger = JSON.parse(
      readFileSync(join(outDir, "ledger-f.json"), "utf8"),
    ) as IdentityLedger;
    expect(ledger.entries).toHaveLength(100);
    for (const entry of ledger.entries) expect(entry.state).toBe("PROPOSED");
  });
});

describe("the planner replay simulation", () => {
  it("is named for what it is, and involves no database", () => {
    const { simulation } = simulatePlannerReplay(PLAN_INPUT);
    expect(simulation.kind).toBe("PLANNER_REPLAY_SIMULATION");
    expect(simulation.note).toContain("not evidence of database idempotency");
  });

  it("re-identifies all 100 rows without minting or reassigning one", () => {
    const { simulation } = simulatePlannerReplay(PLAN_INPUT);
    expect(simulation.firstManifestRows).toBe(100);
    expect(simulation.mintedIdentities).toBe(0);
    expect(simulation.reassignedIdentities).toBe(0);
    expect(simulation.identityRatifiable).toBe(true);
  });

  it("produces no INSERT and no UPDATE for an unchanged workbook", () => {
    // Persisted, because SKIP is a claim about the DATABASE and not about the ledger: a
    // ratified identity that was never written is still an INSERT.
    const { simulation } = simulatePlannerReplay({
      ...PLAN_INPUT,
      existingSourceRefs: new Set(
        WORKBOOK_FIXTURE.rows.map((row) => `SAMCAT-W1-R${String(row.rowNumber).padStart(3, "0")}`),
      ),
    });
    expect(simulation.productActions.insert).toBe(0);
    expect(simulation.productActions.update).toBe(0);
    expect(simulation.productActions.skip + simulation.productActions.conflict).toBe(100);
  });
});

describe("the importer's own source tree", () => {
  const importDir = __dirname;
  const sources = readdirSync(importDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => ({ entry, text: readFileSync(join(importDir, entry), "utf8") }));

  it("contains no write to a catalogue table", () => {
    // Not "an apply mode that is switched off" — no apply code exists to switch on. The
    // pattern requires a Prisma model receiver so that `createHash(...).update(bytes)` —
    // hashing the workbook — is not mistaken for a database write.
    const writePattern =
      /\b(prisma|client|tx|db)\s*\.\s*\w+\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b|\$executeRaw/;
    for (const { entry, text } of sources) {
      if (entry.endsWith(".spec.ts")) continue;
      expect({ entry, writes: writePattern.test(text) }).toEqual({ entry, writes: false });
    }
  });

  it("contains no INSERT, UPDATE or DELETE statement", () => {
    for (const { entry, text } of sources) {
      if (entry.endsWith(".spec.ts")) continue;
      expect({ entry, sql: /\b(INSERT INTO|UPDATE\s+"|DELETE FROM)\b/.test(text) }).toEqual({
        entry,
        sql: false,
      });
    }
  });

  it("stores no TDS bytes, image bytes or downloaded asset", () => {
    const assetExtensions = [".pdf", ".webp", ".jpg", ".jpeg", ".png", ".xlsx"];
    const files = readdirSync(importDir, { recursive: true, encoding: "utf8" });
    for (const file of files) {
      for (const extension of assetExtensions) {
        expect({ file, isAsset: file.toLowerCase().endsWith(extension) }).toEqual({
          file,
          isAsset: false,
        });
      }
    }
  });

  it("never fetches a source document at run time", () => {
    for (const { entry, text } of sources) {
      if (entry.endsWith(".spec.ts")) continue;
      const fetches = /\bfetch\s*\(|node:https?|axios|got\(/.test(text);
      expect({ entry, fetches }).toEqual({ entry, fetches: false });
    }
  });

  it("never reads, writes or names the agent directory", () => {
    // Built rather than written literally, so this assertion does not match itself.
    const forbidden = `.${"claude"}`;
    for (const { entry, text } of sources) {
      if (entry === "dry-run.spec.ts") continue;
      expect({ entry, touches: text.includes(forbidden) }).toEqual({ entry, touches: false });
    }
  });
});
