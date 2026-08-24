/**
 * `pnpm catalog:import --dry-run`
 *
 * ── The safety contract ─────────────────────────────────────────────────────
 *
 * `--dry-run` is REQUIRED. Without it the command refuses and exits non-zero; it does not
 * "default to dry run", because a default is something a future edit can change by accident
 * and a required flag is not.
 *
 * There is one other mode, `--apply`, and it is not a shortcut past this one: it demands nine
 * separate confirmations (`apply/confirmations.ts`), every one checked against what the
 * machine actually found. There is still no `--force`, no `--yes`, no environment variable
 * and no hidden argument, and `assertDryRunOnly` rejects anything that looks like one by name.
 *
 * `APPLY_EXECUTION_ENABLED` is TRUE in this build, and that constant is the ONLY thing
 * standing between `--apply` and a real write. `--apply` runs the whole contract — the
 * confirmations, the custody check, the plan, the preflight and the guards — and then asks
 * `dispatchApply` whether execution is enabled. Enabled, it hands the validated write plan to
 * the injected apply runner, which opens the reviewed SERIALIZABLE transaction and calls
 * `executeCatalogApply`. Disabled, it stops there and reports that nothing was written.
 *
 * The runner is INJECTED rather than constructed here, so this file opens no connection, holds
 * no global Prisma state and stays testable without a database. The production runner is built
 * in `catalog-import.run.ts`; the disposable integration suites supply their own. Neither is
 * reachable from the command line: there is no flag and no environment variable that selects,
 * enables or replaces one.
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
import { assertRatifiedWorkbookCustody, parseRatifiedLedger } from "./identity-ledger";
import { buildImportPlan } from "./import-planner";
import { buildLedger, buildManifest, renderLedgerJson, renderManifestJson } from "./manifest";
import {
  allWriteRows,
  assertNothingApproved,
  assertPlanApplicable,
  assertWritePlanIdentitiesDistinct,
  buildWritePlan,
} from "./apply/apply-engine";
import { assertApplyConfirmations, readApplyConfirmations } from "./apply/confirmations";
import { assertReferenceDataSafe } from "./apply/reference-data";
import { renderReviewSummary } from "./review-summary";
import { WORKBOOK_LINEAGE } from "./source-ref";
import { parseCatalogWorkbook } from "./workbook-parser";

import type { ImportPlan } from "./catalog-import.types";
import type { DryRunDatabase } from "./dry-run";
import type { LedgerEntry } from "./identity-ledger";
import type { WritePlan } from "./apply/apply-engine";
import type { ApplyResult } from "./apply/executor";
import type { ParsedWorkbook } from "./workbook-parser";

/**
 * Arguments that would mean "write without being asked properly". Refused by name.
 *
 * `--apply` is NOT on this list any more: it is a real mode with a nine-part confirmation
 * contract (`apply/confirmations.ts`). Every SHORTCUT past that contract still is, and always
 * must be — a `--force` is precisely the thing the contract exists to make impossible.
 */
const FORBIDDEN_ARGS: readonly string[] = [
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

/**
 * Whether this build may open a write transaction.
 *
 * TRUE, and deliberately a constant rather than a flag. Three reviewed gates got it here:
 * PRODUCT-DATA-2C-B1 built and verified the apply machinery and was explicitly not permitted
 * to run it; PRODUCT-DATA-2C-B2A-H1 made this constant the sole input to `dispatchApply` and
 * wired the production path behind that branch; PRODUCT-DATA-2C-B2B is the approved gate that
 * set it to `true`, against a fresh verified backup, a proven restore, a matching manifest
 * hash and the nine confirmations. Enabling the import is a committed, reviewed source change
 * with an owner decision behind it — never a runtime one.
 *
 * Being enabled shortens the contract by nothing. `--apply` still performs every confirmation,
 * every preflight and every guard before `dispatchApply` is so much as asked, and the executor
 * re-checks the target database from inside the transaction it opens.
 *
 * That is the ONLY enablement mechanism. There is no environment variable, no hidden flag, no
 * test-only argument and no dynamic import that can turn execution on or off: `assertDryRunOnly`
 * refuses every shortcut by name, and the enabled/disabled decision is not reachable from
 * `argv` or `process.env` at all.
 */
export const APPLY_EXECUTION_ENABLED = true;

export class ApplyNotEnabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyNotEnabledError";
  }
}

/**
 * Raised when execution is enabled but no runner was supplied. A configuration failure, and
 * loudly not a silent no-op: an enabled build that quietly wrote nothing is exactly the
 * failure this whole gate exists because of.
 */
export class ApplyRunnerMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyRunnerMissingError";
  }
}

/**
 * Everything the runner needs, and nothing it could use to reach a different database or a
 * different plan. Assembled ONLY after all nine confirmations and every preflight have passed,
 * so a runner cannot be handed an unvalidated plan by construction.
 */
export interface ApplyRunnerRequest {
  /** The plan built from the authoritative workbook in THIS run, never a remembered one. */
  readonly plan: ImportPlan;
  /** The deterministic write plan, already proven to carry distinct identities. */
  readonly writePlan: WritePlan;
  readonly manifestHash: string;
  readonly workbookSha256: string;
  readonly ledgerSha256: string;
  /** The database the operator named with `--target-database`, already matched against
   *  `SELECT current_database()` on the live connection. The executor checks it AGAIN inside
   *  the transaction, so a connection that changed underneath is still refused. */
  readonly expectedDatabaseName: string;
  /** Always true by the time this is built — `assertApplyConfirmations` refuses otherwise. */
  readonly demoReplacementAuthorized: boolean;
}

/**
 * Opens the reviewed transaction and runs the writer. Injected, never constructed here.
 *
 * The CLI deliberately does not know what a database is: the production implementation lives
 * in `catalog-import.run.ts` and the integration suites supply their own against explicitly
 * named disposable clones. No command-line argument and no environment variable selects one.
 */
export type ApplyRunner = (request: ApplyRunnerRequest) => Promise<ApplyResult>;

/**
 * How `main` is allowed to execute. Both fields are function parameters and neither is
 * reachable from `argv` or `process.env`.
 */
export interface ApplyExecution {
  /**
   * Defaults to `APPLY_EXECUTION_ENABLED`. Overridden ONLY by the disposable integration
   * suites, which need to prove the enabled path works while the committed constant is still
   * false — the alternative being to ship the flip untested, which is worse. It is a
   * parameter of an exported function, not a flag: nothing a command line or an environment
   * can say reaches it, and `catalog-import.run.ts` never sets it.
   */
  readonly enabled?: boolean;
  readonly runner?: ApplyRunner;
}

/**
 * The conditional that used to be missing.
 *
 * Returns null when execution is disabled — the caller turns that into `ApplyNotEnabledError`
 * — and otherwise invokes the runner exactly once and returns its typed result. It never
 * catches: a runner that throws propagates, so a failed transaction can never be reported as
 * a success.
 */
export async function dispatchApply(
  enabled: boolean,
  runner: ApplyRunner | undefined,
  request: ApplyRunnerRequest,
): Promise<ApplyResult | null> {
  if (!enabled) return null;
  if (runner === undefined) {
    throw new ApplyRunnerMissingError(
      "APPLY_EXECUTION_ENABLED is true but no apply runner was supplied. The CLI does not " +
        "construct one: `catalog-import.run.ts` builds the production runner and the " +
        "integration suites build their own. Refusing to report success for a write that " +
        "never happened.",
    );
  }
  return runner(request);
}

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
  /** True when --apply was given. The confirmation contract is checked separately. */
  readonly apply: boolean;
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
        `"${name}" is not a supported argument. It is a shortcut past the apply ` +
          `confirmation contract, and there is no shortcut: --apply requires all nine ` +
          `confirmations. There is likewise no approval flag and no ratification flag — both ` +
          `are recorded human decisions, not command-line switches.`,
      );
    }
  }
  if (argv.includes("--apply")) {
    if (argv.includes("--dry-run")) {
      throw new DryRunRequiredError(
        "--dry-run and --apply are mutually exclusive. One run either plans or applies.",
      );
    }
    return;
  }
  if (!argv.includes("--dry-run")) {
    throw new DryRunRequiredError(
      "Refusing to run: --dry-run is required.\n" +
        "  pnpm catalog:import --dry-run --workbook <path to the authoritative workbook>\n" +
        "The only other mode is --apply, which requires its full confirmation contract.",
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
    apply: argv.includes("--apply"),
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
    async databaseName() {
      const rows = await client.$queryRawUnsafe<{ name: string }[]>(
        `SELECT current_database() AS name`,
      );
      return rows[0]?.name ?? "";
    },
    async listSlugKeys() {
      const rows = await client.$queryRawUnsafe<{ slug_key: string }[]>(
        `SELECT slug_key FROM "product_slug_claims"`,
      );
      return new Set(rows.map((row) => row.slug_key));
    },
    async listSlugClaimOwners() {
      // LEFT JOIN, so a claim owned by a Category, a translated slug, or a Product with no
      // ratified identity comes back as null and can never look like self-ownership.
      const rows = await client.$queryRawUnsafe<{ slug_key: string; source_ref: string | null }[]>(
        `SELECT c.slug_key, p.source_ref` +
          ` FROM "product_slug_claims" c` +
          ` LEFT JOIN "products" p ON c.owner_type = 'Product' AND p.id = c.owner_id`,
      );
      return new Map(rows.map((row) => [row.slug_key, row.source_ref ?? null]));
    },
    async listProductSourceRefs() {
      // `products` has no source_ref column yet, and asking for one that does not exist is
      // an error rather than an empty answer. Checking the catalogue first means this
      // reports the truth today — nothing is persisted under a ratified reference — and
      // starts reporting the real set on its own the moment the column is added.
      const present = await client.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns ` +
          `WHERE table_schema = current_schema() AND table_name = 'products' ` +
          `AND column_name = 'source_ref'`,
      );
      if (present.length === 0) return new Set<string>();
      const rows = await client.$queryRawUnsafe<{ source_ref: string | null }[]>(
        `SELECT source_ref FROM "products" WHERE source_ref IS NOT NULL`,
      );
      return new Set(rows.flatMap((row) => (row.source_ref === null ? [] : [row.source_ref])));
    },
  };
}

/** A database stand-in for running the plan with no database available. */
export const OFFLINE_DATABASE: DryRunDatabase = {
  countRows: (tables) => Promise.resolve(new Map(tables.map((table) => [table, 0]))),
  listSlugKeys: () => Promise.resolve(new Set<string>()),
  listSlugClaimOwners: () => Promise.resolve(new Map<string, string | null>()),
  listProductSourceRefs: () => Promise.resolve(new Set<string>()),
  // Never a real database name, so --apply can never match a --target-database against it.
  databaseName: () => Promise.resolve("(offline)"),
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

/**
 * Renders a committed apply. Counts, hashes and outcomes only — never a locator, never a line
 * of third-party source text, never a connection string. The database is named because the
 * operator confirmed that name; nothing else about the connection is printed.
 */
export function renderApplyResult(result: ApplyResult): string {
  const lines = [
    "",
    "CATALOG IMPORT — APPLIED",
    `  mode                        ${result.mode}`,
    `  database                    ${result.databaseName}`,
    `  manifest hash               ${result.manifestHash}`,
    `  demo Products deleted       ${String(result.demoProductsDeleted)}`,
    `  ImportRun                   ${
      result.importRunCreated ? `created ${result.importRunId ?? "(no id)"}` : "not created"
    }`,
    "",
    "  ROWS BY TABLE               inserted   skipped",
  ];
  for (const table of Object.keys(result.tables).sort()) {
    const outcome = result.tables[table];
    if (outcome === undefined) continue;
    lines.push(
      `    ${table.padEnd(26)}${String(outcome.inserted).padStart(6)}${String(
        outcome.skipped,
      ).padStart(10)}`,
    );
  }
  lines.push(
    "",
    `  POST-WRITE VERIFICATION     ${String(result.verification.checks.length)} checks passed`,
  );
  for (const check of result.verification.checks) {
    lines.push(`    ${check.name.padEnd(40)}${check.observed}`);
  }
  lines.push("", "  COMMITTED                   yes");
  return lines.join("\n");
}

export async function main(
  argv: readonly string[],
  database: DryRunDatabase,
  log: (line: string) => void = console.log,
  execution: ApplyExecution = {},
): Promise<number> {
  const options = parseArgs(argv);
  const readFlag = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    if (index >= 0) return argv[index + 1] ?? null;
    const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
    return inline ? inline.slice(flag.length + 1) || null : null;
  };
  const source = loadWorkbook(options);

  // Validated, never repaired: a duplicate reference or an unratified entry is a refusal,
  // and no path here writes the ledger back or promotes a PROPOSED entry to RATIFIED.
  let ledger: readonly LedgerEntry[] = [];
  let ledgerSha256: string | null = null;
  if (options.ledgerPath) {
    const path = resolve(options.ledgerPath);
    const ledgerText = readFileSync(path, "utf8");
    ledgerSha256 = createHash("sha256").update(ledgerText, "utf8").digest("hex");
    const ratified = parseRatifiedLedger(ledgerText, path);

    // Custody, checked HERE — before the plan is built and before the database is opened, so
    // a workbook the owner never approved cannot reach a point where a write is conceivable.
    // The fixture is exempt by construction: it is not a file, it carries the all-zero hash,
    // and `--fixture` is mutually exclusive with `--workbook`.
    if (!options.useFixture) {
      assertRatifiedWorkbookCustody(
        ratified,
        {
          fileName: source.fileName,
          sha256: source.sha256,
          byteSize: source.byteSize,
          sheetName: source.parsed.sheetName,
          identifierColumn: source.parsed.identifierColumn,
          identifierHeader: source.parsed.identifierHeader,
          declaredSourceRefs: source.parsed.declaredSourceRefs,
        },
        WORKBOOK_LINEAGE,
      );
      log(`RATIFIED LEDGER               ${path}`);
      log(`  schema version              ${String(ratified.schemaVersion)}`);
      log(`  ratified identities         ${String(ratified.entries.length)}`);
      log(`  approved master sha256      ${ratified.approvedMasterWorkbook?.sha256 ?? "(none)"}`);
      log(`  workbook custody            verified\n`);
    }
    ledger = ratified.entries;
  }
  if (options.apply && ledgerSha256 === null) {
    throw new DryRunRequiredError(
      "--apply requires --ledger: an apply without a ratified ledger has no identities.",
    );
  }

  const result = await runDryRun(
    database,
    (existingSlugKeys, existingSourceRefs, existingSlugKeyOwners) =>
      buildImportPlan({
        workbook: source.parsed,
        workbookFileName: source.fileName,
        workbookSha256: source.sha256,
        workbookByteSize: source.byteSize,
        workbookProvenance: source.provenance,
        existingSlugKeys,
        existingSourceRefs,
        existingSlugKeyOwners,
        ledger,
      }),
  );

  const manifest = buildManifest(result.plan);

  // ── Apply ─────────────────────────────────────────────────────────────────
  // Every gate, in order, before anything could be written. The plan above was just built
  // from the same inputs, so the preflight below is checking THIS plan and not a remembered
  // one. Only after ALL of them does `dispatchApply` get asked whether to run, and only it
  // can reach the runner — there is no earlier path to one.
  if (options.apply) {
    const confirmations = readApplyConfirmations(readFlag);
    assertApplyConfirmations(confirmations, {
      workbookSha256: source.sha256,
      ledgerSha256: ledgerSha256 ?? "",
      manifestHash: manifest.manifestHash,
      databaseName: await database.databaseName(),
    });
    assertNothingApproved(result.plan);
    assertReferenceDataSafe();
    const mode = assertPlanApplicable(result.plan, await database.listProductSourceRefs());
    const writePlan = buildWritePlan(result.plan);
    assertWritePlanIdentitiesDistinct(writePlan);

    log(`APPLY PREFLIGHT               passed (${mode})`);
    log(`  confirmations               9/9 verified against observed values`);
    log(`  rows the apply would write  ${String(allWriteRows(writePlan).length)}`);

    // The confirmations proved `--target-database` equals `SELECT current_database()` on this
    // connection. That name is what the runner is authorized for, and the executor compares it
    // to `current_database()` a second time INSIDE the transaction.
    const applyResult = await dispatchApply(
      execution.enabled ?? APPLY_EXECUTION_ENABLED,
      execution.runner,
      {
        plan: result.plan,
        writePlan,
        manifestHash: manifest.manifestHash,
        workbookSha256: source.sha256,
        ledgerSha256: ledgerSha256 ?? "",
        expectedDatabaseName: confirmations.targetDatabase,
        demoReplacementAuthorized: confirmations.demoReplacementAuthorized,
      },
    );

    if (applyResult === null) {
      throw new ApplyNotEnabledError(
        "Every apply confirmation, guard and preflight passed, and execution stops here.\n" +
          "  This run's apply dispatcher is disabled, so no write transaction\n" +
          "  was opened. The committed APPLY_EXECUTION_ENABLED is true, so a disabled\n" +
          "  dispatcher means `enabled: false` was passed to `main` explicitly — which\n" +
          "  only importing code can do, and no command line or environment can reach.\n" +
          "  NOTHING WAS WRITTEN.",
      );
    }

    log(renderApplyResult(applyResult));
    return 0;
  }

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
