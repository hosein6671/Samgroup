/**
 * The production command path, end to end, against disposable clones.
 *
 * ── Why this is not `apply-integration.spec.ts` ─────────────────────────────
 *
 * That file proves the WRITER: given a plan, the transaction does the right thing. It builds
 * the plan itself and calls the harness directly, so it would still have passed on the day the
 * CLI was not connected to the writer at all — which is exactly what happened.
 *
 * This file starts one step earlier, at `main(argv, …)`, and proves the CHAIN: the arguments
 * an operator actually types, through the nine confirmations, through the preflight, through
 * `dispatchApply`, into a runner that opens the reviewed transaction and calls
 * `executeCatalogApply`. If the wiring regresses, these fail and the writer's own tests do not.
 *
 * ── Enablement here is a function parameter, never a bypass ─────────────────
 *
 * `APPLY_EXECUTION_ENABLED` is committed TRUE as of PRODUCT-DATA-2C-B2B, and this gate still
 * does not read it: every block below passes `enabled` to `main` EXPLICITLY, so each one tests
 * the dispatcher branch it names whatever the committed constant happens to say. That argument
 * belongs to an exported function and is reachable only from code that imports it. No CLI flag,
 * no environment variable and no dynamic import can do the same, and `catalog-import.run.ts`
 * never passes it — the committed constant is still the only production switch.
 *
 * ── Never a real database ───────────────────────────────────────────────────
 *
 * Every database here is `sam_platform_disposable_*`, cloned from the template, dropped
 * afterwards. The runner used here routes through `runApplyOnDisposableDatabase`, which
 * refuses any other name whatever it is handed.
 *
 * ── Skipping ────────────────────────────────────────────────────────────────
 *
 * Without `CATALOG_APPLY_TEST_ADMIN_URL` and `CATALOG_WORKBOOK` the suite skips by name. The
 * workbook is not in version control and CI has never had a copy of it.
 *
 *   NODE_OPTIONS=--experimental-vm-modules \
 *   CATALOG_APPLY_TEST_ADMIN_URL=... CATALOG_WORKBOOK=... \
 *   pnpm --filter @sam-group/api test
 *
 * `--experimental-vm-modules` is not optional and is not about this file: Prisma 7's client
 * engine reaches a dynamic import that Jest's VM refuses without it. Measured, not guessed —
 * the suite fails to start without it, with "A dynamic import callback was invoked without
 * --experimental-vm-modules".
 */

import { randomUUID } from "node:crypto";

import { APPLY_CONFIRMATION_PHRASE } from "./apply/confirmations";
import { runApplyOnDisposableDatabase } from "./apply/disposable-harness";
import { buildPlanFor } from "./apply/__tests__/build-plan";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readCounts,
  readIntegrationConfig,
  withDisposableClient,
} from "./apply/__tests__/disposable-database";
import { ApplyNotEnabledError, main, prismaDryRunDatabase } from "./cli";

import type { ApplyRunner, ApplyRunnerRequest } from "./cli";
import type { ApplyResult } from "./apply/executor";
import type { IntegrationConfig } from "./apply/__tests__/disposable-database";
import type { PlannedInputs } from "./apply/__tests__/build-plan";

const config = readIntegrationConfig();
const suite = config === null ? describe.skip : describe;

const LEDGER_PATH = require.resolve("./data/catalog-identity-ledger.json");
const TIMEOUT_MS = 240_000;
const BACKUP_ATTESTATION = "f".repeat(64);

/** Every clone this file makes, so a failure cannot leak one. */
const created = new Set<string>();

async function clone(suffix: string): Promise<string> {
  const url = await createDisposableDatabase(
    config as IntegrationConfig,
    `${suffix}_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
  );
  created.add(url);
  return url;
}

function databaseNameFrom(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/* -------------------------------------------------------------------------- */
/* The command line an operator would type                                     */
/* -------------------------------------------------------------------------- */

type Overrides = Readonly<Record<string, string | null>>;

/**
 * Builds the full nine-confirmation argv. `null` removes a flag entirely, so "missing" and
 * "wrong" are the same helper with a different value.
 */
function applyArgv(
  url: string,
  planned: PlannedInputs,
  workbookPath: string,
  overrides: Overrides = {},
): string[] {
  const flags: Record<string, string | null> = {
    "--workbook": workbookPath,
    "--ledger": LEDGER_PATH,
    "--expect-workbook-sha256": planned.workbookSha256,
    "--expect-ledger-sha256": planned.ledgerSha256,
    "--expect-manifest-hash": planned.manifestHash,
    "--target-database": databaseNameFrom(url),
    "--replace-demo-products": "yes",
    "--backup-attestation": BACKUP_ATTESTATION,
    "--confirm": APPLY_CONFIRMATION_PHRASE,
    ...overrides,
  };
  const argv = ["--apply"];
  for (const [flag, value] of Object.entries(flags)) {
    if (value === null) continue;
    argv.push(flag, value);
  }
  return argv;
}

/** A runner that records its calls and writes only to the named disposable clone. */
function disposableRunner(
  url: string,
  faultInjector?: (step: string) => void,
): ApplyRunner & { calls: ApplyRunnerRequest[] } {
  const calls: ApplyRunnerRequest[] = [];
  const runner = (request: ApplyRunnerRequest): Promise<ApplyResult> => {
    calls.push(request);
    return runApplyOnDisposableDatabase({
      connectionString: url,
      plan: request.plan,
      manifestHash: request.manifestHash,
      workbookSha256: request.workbookSha256,
      ledgerSha256: request.ledgerSha256,
      demoReplacementAuthorized: request.demoReplacementAuthorized,
      ...(faultInjector === undefined ? {} : { faultInjector }),
    });
  };
  return Object.assign(runner, { calls });
}

interface RunOutcome {
  readonly lines: string[];
  readonly error: Error | null;
  readonly exitCode: number | null;
}

/** Runs the CLI against a clone and captures everything it said. */
async function runCli(
  url: string,
  argv: readonly string[],
  execution: { enabled?: boolean; runner?: ApplyRunner },
): Promise<RunOutcome> {
  const lines: string[] = [];
  return withDisposableClient(url, async (client) => {
    try {
      const exitCode = await main(
        argv,
        prismaDryRunDatabase(client),
        (line) => lines.push(line),
        execution,
      );
      return { lines, error: null, exitCode };
    } catch (error) {
      return { lines, error: error as Error, exitCode: null };
    }
  });
}

/* -------------------------------------------------------------------------- */

suite("the production CLI path, against disposable clones", () => {
  // Read lazily: `describe.skip` still RUNS this callback, so a dereference here would crash
  // the suite on a machine with no configuration instead of skipping it by name.
  const workbook = (): string => (config as IntegrationConfig).workbookPath;

  afterAll(async () => {
    for (const url of created) {
      await dropDisposableDatabase(config as IntegrationConfig, url);
    }
    created.clear();
  }, TIMEOUT_MS);

  /* ---------------------------------------------------------------------- */
  /* Disabled: an explicitly disabled dispatcher stops everything             */
  /* ---------------------------------------------------------------------- */

  describe("with execution explicitly disabled", () => {
    let url = "";
    let planned: PlannedInputs;
    let runner: ReturnType<typeof disposableRunner>;
    let outcome: RunOutcome;
    let before: Record<string, number>;
    let after: Record<string, number>;

    beforeAll(async () => {
      url = await clone("cli_disabled");
      planned = await buildPlanFor(url, workbook());
      before = await readCounts(url);
      runner = disposableRunner(url);
      // `enabled: false` is passed EXPLICITLY rather than inherited. The committed
      // APPLY_EXECUTION_ENABLED is true (PRODUCT-DATA-2C-B2B), and what this block proves is
      // a property of the dispatcher, not of that constant's current value: disabled, the
      // runner is never reached and no row moves. Inheriting the constant would silently
      // convert these assertions into a test of the enabled path the moment it was flipped.
      outcome = await runCli(url, applyArgv(url, planned, workbook()), {
        enabled: false,
        runner,
      });
      after = await readCounts(url);
    }, TIMEOUT_MS);

    it("passes all nine confirmations and the whole preflight", () => {
      expect(outcome.lines.join("\n")).toContain("APPLY PREFLIGHT               passed");
      expect(outcome.lines.join("\n")).toContain("9/9 verified against observed values");
    });

    it("stops with ApplyNotEnabledError and says nothing was written", () => {
      expect(outcome.error).toBeInstanceOf(ApplyNotEnabledError);
      expect(outcome.error?.message).toContain("NOTHING WAS WRITTEN");
    });

    it("never invokes the runner", () => {
      expect(runner.calls).toHaveLength(0);
    });

    it("opens no transaction and changes no row", () => {
      expect(after).toEqual(before);
      expect(after["products"]).toBe(10);
      expect(after["products_demo"]).toBe(10);
      expect(after["import_runs"]).toBe(0);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Confirmation failures never reach the runner                            */
  /* ---------------------------------------------------------------------- */

  describe("no confirmation failure can reach the runner", () => {
    let url = "";
    let planned: PlannedInputs;
    let before: Record<string, number>;

    beforeAll(async () => {
      url = await clone("cli_confirmations");
      planned = await buildPlanFor(url, workbook());
      before = await readCounts(url);
    }, TIMEOUT_MS);

    const wrongHash = "9".repeat(64);
    const cases: readonly (readonly [string, Overrides])[] = [
      ["--workbook missing", { "--workbook": null }],
      ["--ledger missing", { "--ledger": null }],
      ["--expect-workbook-sha256 missing", { "--expect-workbook-sha256": null }],
      ["--expect-workbook-sha256 wrong", { "--expect-workbook-sha256": wrongHash }],
      ["--expect-ledger-sha256 missing", { "--expect-ledger-sha256": null }],
      ["--expect-ledger-sha256 wrong", { "--expect-ledger-sha256": wrongHash }],
      ["--expect-manifest-hash missing", { "--expect-manifest-hash": null }],
      ["--expect-manifest-hash wrong", { "--expect-manifest-hash": wrongHash }],
      ["--target-database missing", { "--target-database": null }],
      ["--target-database wrong", { "--target-database": "sam_platform" }],
      ["--target-database is sam_cms", { "--target-database": "sam_cms" }],
      ["--replace-demo-products missing", { "--replace-demo-products": null }],
      ["--replace-demo-products no", { "--replace-demo-products": "no" }],
      ["--backup-attestation missing", { "--backup-attestation": null }],
      ["--backup-attestation too short", { "--backup-attestation": "short" }],
      ["--confirm missing", { "--confirm": null }],
      ["--confirm wrong phrase", { "--confirm": "apply ratified catalog to sam_platform" }],
    ];

    it.each(cases)(
      "refuses and never calls the runner: %s",
      async (_label, overrides) => {
        const runner = disposableRunner(url);
        const outcome = await runCli(url, applyArgv(url, planned, workbook(), overrides), {
          enabled: true,
          runner,
        });
        expect(outcome.error).not.toBeNull();
        expect(runner.calls).toHaveLength(0);
        expect(await readCounts(url)).toEqual(before);
      },
      TIMEOUT_MS,
    );

    it("refuses --apply together with --dry-run", async () => {
      const runner = disposableRunner(url);
      const outcome = await runCli(url, ["--apply", "--dry-run", "--workbook", workbook()], {
        enabled: true,
        runner,
      });
      expect(outcome.error?.message).toMatch(/mutually exclusive/);
      expect(runner.calls).toHaveLength(0);
    });

    it.each(["--force", "--yes", "-y", "--commit", "--write", "--no-dry-run"])(
      "refuses the shortcut %s",
      async (flag) => {
        const runner = disposableRunner(url);
        const outcome = await runCli(url, [...applyArgv(url, planned, workbook()), flag], {
          enabled: true,
          runner,
        });
        expect(outcome.error?.message).toMatch(/not a supported argument/);
        expect(runner.calls).toHaveLength(0);
      },
      TIMEOUT_MS,
    );

    it("leaves the clone untouched after every refusal", async () => {
      expect(await readCounts(url)).toEqual(before);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* First apply, then identical replay                                      */
  /* ---------------------------------------------------------------------- */

  describe("first apply and identical replay through the CLI", () => {
    let url = "";
    let first: RunOutcome;
    let firstRunner: ReturnType<typeof disposableRunner>;
    let afterFirst: Record<string, number>;
    let afterReplay: Record<string, number>;
    let replayRunner: ReturnType<typeof disposableRunner>;
    let replay: RunOutcome;

    beforeAll(async () => {
      url = await clone("cli_e2e");
      const planned = await buildPlanFor(url, workbook());
      firstRunner = disposableRunner(url);
      first = await runCli(url, applyArgv(url, planned, workbook()), {
        enabled: true,
        runner: firstRunner,
      });
      afterFirst = await readCounts(url);

      // The replay re-plans against the now-populated clone, exactly as a second real run
      // would: same workbook, same ledger, a database that already holds the catalogue.
      const replanned = await buildPlanFor(url, workbook());
      replayRunner = disposableRunner(url);
      replay = await runCli(url, applyArgv(url, replanned, workbook()), {
        enabled: true,
        runner: replayRunner,
      });
      afterReplay = await readCounts(url);
    }, TIMEOUT_MS);

    it("commits the first apply and exits zero", () => {
      expect(first.error).toBeNull();
      expect(first.exitCode).toBe(0);
    });

    it("invoked the runner exactly once", () => {
      expect(firstRunner.calls).toHaveLength(1);
    });

    it("reports the committed result: mode, target, manifest, demos, ImportRun", () => {
      const text = first.lines.join("\n");
      expect(text).toContain("CATALOG IMPORT — APPLIED");
      expect(text).toContain("FIRST_APPLY");
      expect(text).toContain(databaseNameFrom(url));
      expect(text).toContain("demo Products deleted       10");
      expect(text).toContain("POST-WRITE VERIFICATION");
      expect(text).toContain("COMMITTED                   yes");
    });

    it("prints no connection string or credential", () => {
      const text = first.lines.join("\n");
      expect(text).not.toMatch(/postgres(ql)?:\/\//i);
      expect(text).not.toMatch(/password/i);
    });

    it("writes exactly the approved counts", () => {
      expect(afterFirst).toMatchObject({
        products: 100,
        products_demo: 0,
        products_with_source_ref: 100,
        product_types: 8,
        spec_properties: 26,
        spec_property_mappings: 75,
        product_segments: 41,
        product_grades: 134,
        source_facts: 1661,
        specifications: 1402,
        product_claims: 148,
        specification_evidence: 1402,
        claim_evidence: 148,
        source_assets: 53,
        source_documents: 69,
        import_runs_finished: 1,
        product_slug_claims: 106,
        slug_claims_product: 100,
        slug_claims_category: 6,
        slug_claims_demo: 0,
        categories: 6,
        segments: 8,
      });
    });

    it("replays as IDENTICAL_REPLAY and inserts nothing", () => {
      expect(replay.error).toBeNull();
      expect(replayRunner.calls).toHaveLength(1);
      expect(replay.lines.join("\n")).toContain("IDENTICAL_REPLAY");
    });

    it("changes no count on replay", () => {
      expect(afterReplay).toEqual(afterFirst);
    });

    it("records no second successful ImportRun", () => {
      expect(afterReplay["import_runs_finished"]).toBe(1);
    });

    it("deletes no demo on replay: there were none left to delete", () => {
      expect(replay.lines.join("\n")).toContain("demo Products deleted       0");
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Rollback                                                                */
  /* ---------------------------------------------------------------------- */

  describe("a failure inside the transaction restores the baseline", () => {
    let url = "";
    let before: Record<string, number>;
    let after: Record<string, number>;
    let outcome: RunOutcome;
    let runner: ReturnType<typeof disposableRunner>;

    beforeAll(async () => {
      url = await clone("cli_rollback");
      const planned = await buildPlanFor(url, workbook());
      before = await readCounts(url);
      // Fails after the demos are gone and rows are going in — the worst moment to stop.
      runner = disposableRunner(url, (step) => {
        if (step === "products") throw new Error("injected failure at products");
      });
      outcome = await runCli(url, applyArgv(url, planned, workbook()), {
        enabled: true,
        runner,
      });
      after = await readCounts(url);
    }, TIMEOUT_MS);

    it("propagates the failure rather than reporting success", () => {
      expect(outcome.error?.message).toContain("injected failure");
      expect(outcome.lines.join("\n")).not.toContain("COMMITTED                   yes");
    });

    it("did reach the runner: the rollback is the transaction's, not the guard's", () => {
      expect(runner.calls).toHaveLength(1);
    });

    it("restores the ten demo Products and every baseline count", () => {
      expect(after).toEqual(before);
      expect(after["products"]).toBe(10);
      expect(after["products_demo"]).toBe(10);
    });

    it("leaves no ImportRun behind", () => {
      expect(after["import_runs_finished"]).toBe(0);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* The writer's own database-name guard                                    */
  /* ---------------------------------------------------------------------- */

  describe("the in-transaction database check", () => {
    it(
      "refuses when the runner is pointed at a database the operator did not name",
      async () => {
        const url = await clone("cli_name_guard");
        const planned = await buildPlanFor(url, workbook());
        const before = await readCounts(url);

        // The CLI's confirmation passes (argv names this clone), but the runner hands the
        // executor a DIFFERENT expected name, so `current_database()` disagrees in-transaction.
        const runner: ApplyRunner = (request) =>
          runApplyOnDisposableDatabase({
            connectionString: url,
            plan: request.plan,
            manifestHash: request.manifestHash,
            workbookSha256: request.workbookSha256,
            ledgerSha256: request.ledgerSha256,
            demoReplacementAuthorized: request.demoReplacementAuthorized,
            faultInjector: (step) => {
              if (step === "preflight-recheck") throw new Error("unreachable");
            },
          });

        const outcome = await runCli(
          url,
          applyArgv(url, planned, workbook(), { "--target-database": "sam_platform" }),
          { enabled: true, runner },
        );

        expect(outcome.error).not.toBeNull();
        expect(await readCounts(url)).toEqual(before);
      },
      TIMEOUT_MS,
    );
  });
});
