/**
 * `pnpm catalog:import --dry-run`
 *
 * ── The safety contract ─────────────────────────────────────────────────────
 *
 * `--dry-run` is REQUIRED. Without it the command refuses and exits non-zero; it does not
 * "default to dry run", because a default is something a future edit can change by accident
 * and a required flag is not.
 *
 * There is no apply flag, no `--force`, no `--yes`, no environment variable and no hidden
 * argument that makes this write. `assertDryRunOnly` rejects anything that looks like one by
 * name, so a half-finished apply path cannot be reached from the command line even if
 * somebody adds one later without wiring it up deliberately.
 *
 * There is likewise no approval flag and no ratification flag. Both are recorded human
 * decisions with an identity attached; a command-line switch is not that.
 *
 * ── Where the workbook comes from ───────────────────────────────────────────
 *
 * The authoritative workbook is NOT in version control — it was supplied as a file — so the
 * path must be given explicitly with `--workbook`, or in `CATALOG_WORKBOOK`. There is no
 * default, no search path and no developer-specific fallback: a missing workbook fails loudly.
 *
 * `--fixture` builds the plan from the frozen 100-row fixture instead. That exists so CI can
 * produce and compare the review artefacts on a machine that does not have the workbook. It
 * is NOT the authoritative source, every artefact it produces is stamped `FROZEN_FIXTURE`,
 * and the two flags are mutually exclusive so a run can never be half of each.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { renderSummary, runDryRun, WATCHED_TABLES } from "./dry-run";
import { buildImportPlan } from "./import-planner";
import { buildLedger, buildManifest, renderLedgerJson, renderManifestJson } from "./manifest";
import { renderReviewSummary } from "./review-summary";
import { parseCatalogWorkbook } from "./workbook-parser";

import type { DryRunDatabase } from "./dry-run";
import type { IdentityLedger, LedgerEntry } from "./identity-ledger";
import type { ParsedWorkbook } from "./workbook-parser";

/** Arguments that would mean "write". Refused by name, whether or not one is implemented. */
const FORBIDDEN_ARGS: readonly string[] = [
  "--apply",
  "--commit",
  "--write",
  "--execute",
  "--persist",
  "--force",
  "--yes",
  "-y",
  "--approve",
  "--approved",
  "--ratify",
  "--review-status",
  "--no-dry-run",
];

export class DryRunRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DryRunRequiredError";
  }
}

export interface CliOptions {
  /** Absolute path to the authoritative workbook, or null when `--fixture` was given. */
  readonly workbookPath: string | null;
  readonly useFixture: boolean;
  readonly ledgerPath: string | null;
  readonly manifestPath: string | null;
  readonly summaryPath: string | null;
  readonly ledgerOutPath: string | null;
}

/**
 * Refuses anything that is not an explicit dry run. Exported so the guarantee is tested
 * directly rather than inferred from the fact that no apply code exists.
 */
export function assertDryRunOnly(argv: readonly string[]): void {
  for (const arg of argv) {
    const name = arg.split("=")[0] ?? arg;
    if (FORBIDDEN_ARGS.includes(name)) {
      throw new DryRunRequiredError(
        `"${name}" is not a supported argument. This importer is dry-run only: there is no ` +
          `apply mode, no approval flag and no ratification flag, and a persistent catalog ` +
          `import is a separate gate with its own approval.`,
      );
    }
  }
  if (!argv.includes("--dry-run")) {
    throw new DryRunRequiredError(
      "Refusing to run: --dry-run is required.\n" +
        "  pnpm catalog:import --dry-run --workbook <path to the authoritative workbook>\n" +
        "There is no other mode. The importer performs no database writes.",
    );
  }
}

export function parseArgs(argv: readonly string[]): CliOptions {
  assertDryRunOnly(argv);
  const read = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    if (index >= 0) return argv[index + 1] ?? null;
    const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
    return inline ? inline.slice(flag.length + 1) || null : null;
  };

  const useFixture = argv.includes("--fixture");
  const workbookPath = read("--workbook") ?? process.env["CATALOG_WORKBOOK"] ?? null;

  if (useFixture && read("--workbook") !== null) {
    throw new DryRunRequiredError(
      "--fixture and --workbook are mutually exclusive. One run is either built from the " +
        "authoritative workbook or from the frozen fixture; it cannot be half of each.",
    );
  }
  if (!useFixture && !workbookPath) {
    throw new DryRunRequiredError(
      "No workbook given. Pass --workbook <path>, or set CATALOG_WORKBOOK. The authoritative " +
        "workbook is not in version control, so the importer cannot guess where it is. Pass " +
        "--fixture to build the plan from the frozen 100-row fixture instead, which is a CI " +
        "aid and NOT the authoritative source.",
    );
  }

  return {
    workbookPath: useFixture || !workbookPath ? null : resolve(workbookPath),
    useFixture,
    ledgerPath: read("--ledger"),
    manifestPath: read("--manifest-out"),
    summaryPath: read("--summary-out"),
    ledgerOutPath: read("--ledger-out"),
  };
}

/**
 * The Prisma-backed read surface. Deliberately built from raw SELECTs against the table
 * names rather than the client's model API: it reads counts for tables this module has no
 * business modelling, and there is no way to accidentally call a write method through it.
 */
export function prismaDryRunDatabase(client: {
  $queryRawUnsafe: <T>(query: string) => Promise<T>;
}): DryRunDatabase {
  return {
    async countRows(tables) {
      const counts = new Map<string, number>();
      for (const table of tables) {
        if (!/^[a-z_]+$/.test(table)) throw new Error(`Refusing to query table "${table}".`);
        const rows = await client.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*)::bigint AS count FROM "${table}"`,
        );
        counts.set(table, Number(rows[0]?.count ?? 0));
      }
      return counts;
    },
    async listSlugKeys() {
      const rows = await client.$queryRawUnsafe<{ slug_key: string }[]>(
        `SELECT slug_key FROM "product_slug_claims"`,
      );
      return new Set(rows.map((row) => row.slug_key));
    },
  };
}

/** A database stand-in for running the plan with no database available. */
export const OFFLINE_DATABASE: DryRunDatabase = {
  countRows: (tables) => Promise.resolve(new Map(tables.map((table) => [table, 0]))),
  listSlugKeys: () => Promise.resolve(new Set<string>()),
};

/**
 * The fixture's stand-in workbook identity. A fixed name and an all-zero hash, so a fixture
 * artefact can never be mistaken for one produced from the owner's file: the real workbook's
 * SHA-256 is not zero.
 */
export const FIXTURE_WORKBOOK = {
  fileName: "frozen-fixture.workbook",
  sha256: "0".repeat(64),
  byteSize: 0,
} as const;

interface WorkbookSource {
  readonly parsed: ParsedWorkbook;
  readonly fileName: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly provenance: "AUTHORITATIVE_WORKBOOK" | "FROZEN_FIXTURE";
}

function loadWorkbook(options: CliOptions): WorkbookSource {
  if (options.useFixture) {
    return {
      parsed: WORKBOOK_FIXTURE,
      fileName: FIXTURE_WORKBOOK.fileName,
      sha256: FIXTURE_WORKBOOK.sha256,
      byteSize: FIXTURE_WORKBOOK.byteSize,
      provenance: "FROZEN_FIXTURE",
    };
  }
  if (options.workbookPath === null) {
    throw new DryRunRequiredError("No workbook path resolved.");
  }
  const bytes = readFileSync(options.workbookPath);
  return {
    parsed: parseCatalogWorkbook(bytes),
    fileName: options.workbookPath.split(/[\\/]/).pop() ?? "workbook.xlsx",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
    provenance: "AUTHORITATIVE_WORKBOOK",
  };
}

function sha256Of(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function main(
  argv: readonly string[],
  database: DryRunDatabase,
  log: (line: string) => void = console.log,
): Promise<number> {
  const options = parseArgs(argv);
  const source = loadWorkbook(options);

  let ledger: readonly LedgerEntry[] = [];
  if (options.ledgerPath) {
    const raw = JSON.parse(readFileSync(options.ledgerPath, "utf8")) as IdentityLedger;
    ledger = raw.entries;
  }

  const result = await runDryRun(database, (existingSlugKeys) =>
    buildImportPlan({
      workbook: source.parsed,
      workbookFileName: source.fileName,
      workbookSha256: source.sha256,
      workbookByteSize: source.byteSize,
      workbookProvenance: source.provenance,
      existingSlugKeys,
      ledger,
    }),
  );

  const manifest = buildManifest(result.plan);
  log(renderSummary(result));
  log(`MANIFEST HASH                 ${manifest.manifestHash}`);
  if (source.parsed.identifierColumn === null) {
    log(
      "IDENTIFIER COLUMN             absent — identity falls back to matching evidence, and " +
        "every inferred match is reported as a conflict.",
    );
  } else {
    log(`IDENTIFIER COLUMN             column ${String(source.parsed.identifierColumn)}`);
  }

  const write = (path: string | null, contents: string, label: string): void => {
    if (path === null) return;
    writeFileSync(path, contents, "utf8");
    log(`${label.padEnd(30)}${path}`);
    log(`${`${label} sha256`.padEnd(30)}${sha256Of(contents)}`);
  };

  write(options.manifestPath, renderManifestJson(manifest), "manifest json");
  write(options.summaryPath, renderReviewSummary(manifest), "review markdown");
  write(options.ledgerOutPath, renderLedgerJson(buildLedger(result.plan)), "proposed ledger");

  // A conflict is not a failure of the run — the run's job is to find them — but the exit
  // code says one was found so a caller cannot mistake this for a clean plan.
  return result.plan.counts.products.conflict > 0 ? 2 : 0;
}

export { WATCHED_TABLES };
