/**
 * The CLI → runner → transaction → executor connection, and the conditional that guards it.
 *
 * ── What this file exists because of ────────────────────────────────────────
 *
 * PRODUCT-DATA-2C-B2A shipped a complete, reviewed writer and a complete, reviewed
 * confirmation contract, and never connected them. `APPLY_EXECUTION_ENABLED` was exported and
 * never read; the `--apply` branch ended in an unconditional `throw`; `cli.ts` held no
 * reference to the writer at all. Flipping the constant would have enabled nothing, and the
 * only test watching it asserted it was false — which stayed true either way.
 *
 * So the tests here are deliberately about WIRING rather than about writing. They prove the
 * conditional exists, that it is the constant that drives it, that the runner is reached
 * exactly once and only after every gate, and that no confirmation failure can reach it. What
 * the writer then does is `apply-engine.spec.ts` and `apply-integration.spec.ts`.
 *
 * ── No database, no workbook ────────────────────────────────────────────────
 *
 * Everything here runs on a machine with neither. The dispatcher is a pure function, and the
 * wiring assertions read source text. The end-to-end CLI proof against a real clone is
 * `apply-cli-integration.spec.ts`, which skips by name when it is not configured.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  APPLY_EXECUTION_ENABLED,
  ApplyRunnerMissingError,
  dispatchApply,
  renderApplyResult,
} from "./cli";

import type { ApplyRunner, ApplyRunnerRequest } from "./cli";
import type { ApplyResult } from "./apply/executor";

/* -------------------------------------------------------------------------- */
/* Sources, read once. The wiring assertions are about text, not behaviour.    */
/* -------------------------------------------------------------------------- */

const HERE = __dirname;
const cliSource = readFileSync(join(HERE, "cli.ts"), "utf8");
const runSource = readFileSync(join(HERE, "catalog-import.run.ts"), "utf8");

/* -------------------------------------------------------------------------- */
/* Test doubles                                                                */
/* -------------------------------------------------------------------------- */

/** A request shaped like the real one. Its contents never reach a database here. */
const REQUEST = {
  plan: { marker: "plan" },
  writePlan: { marker: "write-plan" },
  manifestHash: "a".repeat(64),
  workbookSha256: "b".repeat(64),
  ledgerSha256: "c".repeat(64),
  expectedDatabaseName: "sam_platform",
  demoReplacementAuthorized: true,
} as unknown as ApplyRunnerRequest;

function applyResult(overrides: Partial<ApplyResult> = {}): ApplyResult {
  return {
    mode: "FIRST_APPLY",
    databaseName: "sam_platform",
    manifestHash: "a".repeat(64),
    demoProductsDeleted: 10,
    importRunCreated: true,
    importRunId: "11111111-1111-1111-1111-111111111111",
    tables: { products: { inserted: 100, skipped: 0 } },
    verification: { checks: [{ name: "products", observed: "100" }], counts: { products: 100 } },
    stepsCompleted: ["advisory-lock"],
    ...overrides,
  } as ApplyResult;
}

/** Records every invocation, so "exactly once" and "never" are both provable. */
function spyRunner(
  result: ApplyResult = applyResult(),
): ApplyRunner & { calls: ApplyRunnerRequest[] } {
  const calls: ApplyRunnerRequest[] = [];
  const runner = (request: ApplyRunnerRequest): Promise<ApplyResult> => {
    calls.push(request);
    return Promise.resolve(result);
  };
  return Object.assign(runner, { calls });
}

/* -------------------------------------------------------------------------- */
/* The committed constant                                                      */
/* -------------------------------------------------------------------------- */

describe("the committed enablement constant", () => {
  it("is true: PRODUCT-DATA-2C-B2B opened the path this gate wired", () => {
    expect(APPLY_EXECUTION_ENABLED).toBe(true);
  });

  it("is declared as a literal, not derived from the environment or an argument", () => {
    // Asserted on the source rather than the value: a value read twice proves nothing about
    // where it came from, and "where it came from" is the whole property.
    expect(cliSource).toMatch(/export const APPLY_EXECUTION_ENABLED = (true|false);/);
    const declaration = /export const APPLY_EXECUTION_ENABLED = .*/.exec(cliSource)?.[0] ?? "";
    expect(declaration).not.toMatch(/process\.env|argv|require|import\(/);
  });
});

/* -------------------------------------------------------------------------- */
/* The conditional dispatcher                                                  */
/* -------------------------------------------------------------------------- */

describe("dispatchApply — the conditional that used to be missing", () => {
  it("disabled, with a runner present: never calls it, and reports nothing to render", async () => {
    const runner = spyRunner();
    await expect(dispatchApply(false, runner, REQUEST)).resolves.toBeNull();
    expect(runner.calls).toHaveLength(0);
  });

  it("enabled, with a valid plan: invokes the runner exactly once", async () => {
    const runner = spyRunner();
    await dispatchApply(true, runner, REQUEST);
    expect(runner.calls).toHaveLength(1);
  });

  it("hands the runner the validated request unchanged", async () => {
    const runner = spyRunner();
    await dispatchApply(true, runner, REQUEST);
    expect(runner.calls[0]).toBe(REQUEST);
    expect(runner.calls[0]?.expectedDatabaseName).toBe("sam_platform");
    expect(runner.calls[0]?.demoReplacementAuthorized).toBe(true);
  });

  it("enabled with no runner: an explicit configuration failure, never a silent no-op", async () => {
    await expect(dispatchApply(true, undefined, REQUEST)).rejects.toBeInstanceOf(
      ApplyRunnerMissingError,
    );
    await expect(dispatchApply(true, undefined, REQUEST)).rejects.toThrow(/no apply runner/i);
  });

  it("disabled with no runner: still just null, because nothing was going to run", async () => {
    await expect(dispatchApply(false, undefined, REQUEST)).resolves.toBeNull();
  });

  it("returns the runner's typed result on success", async () => {
    const result = applyResult({ mode: "IDENTICAL_REPLAY", demoProductsDeleted: 0 });
    await expect(dispatchApply(true, spyRunner(result), REQUEST)).resolves.toBe(result);
  });

  it("propagates a runner failure rather than reporting a success that did not happen", async () => {
    const boom = new Error("serialization failure");
    const failing: ApplyRunner = () => Promise.reject(boom);
    await expect(dispatchApply(true, failing, REQUEST)).rejects.toBe(boom);
  });

  it("never swallows: a runner that throws synchronously still fails the run", async () => {
    const throwing: ApplyRunner = () => {
      throw new Error("connection refused");
    };
    await expect(dispatchApply(true, throwing, REQUEST)).rejects.toThrow(/connection refused/);
  });
});

/* -------------------------------------------------------------------------- */
/* What a committed apply prints                                               */
/* -------------------------------------------------------------------------- */

describe("renderApplyResult", () => {
  const rendered = renderApplyResult(applyResult());

  it("reports mode, target, manifest, demo deletions, ImportRun and verification", () => {
    expect(rendered).toContain("FIRST_APPLY");
    expect(rendered).toContain("sam_platform");
    expect(rendered).toContain("a".repeat(64));
    expect(rendered).toContain("demo Products deleted       10");
    expect(rendered).toContain("created 11111111-1111-1111-1111-111111111111");
    expect(rendered).toContain("POST-WRITE VERIFICATION");
    expect(rendered).toContain("COMMITTED                   yes");
  });

  it("reports inserted and skipped per table", () => {
    expect(rendered).toMatch(/products\s+100\s+0/);
  });

  it("prints no connection string, credential or URL", () => {
    expect(rendered).not.toMatch(/postgres(ql)?:\/\//i);
    expect(rendered).not.toMatch(/password/i);
    expect(rendered).not.toMatch(/@[\w.-]+:\d+/);
  });
});

/* -------------------------------------------------------------------------- */
/* Production entry-point wiring, proven at source level                       */
/* -------------------------------------------------------------------------- */

describe("the production entry point is wired to the reviewed writer", () => {
  it("imports the reviewed executor", () => {
    expect(runSource).toMatch(
      /import\s*\{\s*executeCatalogApply\s*\}\s*from\s*"\.\/apply\/executor"/,
    );
  });

  it("calls the executor rather than reimplementing it", () => {
    expect(runSource).toContain("executeCatalogApply(");
  });

  it("opens a Prisma interactive transaction at SERIALIZABLE", () => {
    expect(runSource).toContain("$transaction(");
    expect(runSource).toContain('isolationLevel: "Serializable"');
  });

  it("gives Prisma a transaction timeout longer than the engine's statement timeout", () => {
    expect(runSource).toContain("APPLY_STATEMENT_TIMEOUT_MS + 300_000");
  });

  it("passes the expected database name and the demo authorization into the executor", () => {
    expect(runSource).toContain("expectedDatabaseName: request.expectedDatabaseName");
    expect(runSource).toContain("demoReplacementAuthorized: request.demoReplacementAuthorized");
  });

  it("passes the authoritative hashes into the executor", () => {
    expect(runSource).toContain("manifestHash: request.manifestHash");
    expect(runSource).toContain("workbookSha256: request.workbookSha256");
    expect(runSource).toContain("ledgerSha256: request.ledgerSha256");
  });

  it("supplies the runner to the CLI", () => {
    expect(runSource).toMatch(/runner:\s*productionApplyRunner\(client\)/);
  });

  it("never sets `enabled`: the committed constant is the only production switch", () => {
    expect(runSource).not.toMatch(/enabled\s*:/);
  });

  it("disconnects Prisma on success and on failure", () => {
    expect(runSource).toMatch(/finally\s*\{\s*await client\.\$disconnect\(\)/);
  });

  it("never imports the disposable test harness", () => {
    expect(runSource).not.toContain("disposable-harness");
    expect(runSource).not.toContain("__tests__");
  });

  it("pins production to sam_platform and can never be pointed at sam_cms", () => {
    expect(runSource).toContain('const PRODUCTION_TARGET_DATABASE = "sam_platform"');
    expect(runSource).toMatch(/request\.expectedDatabaseName !== PRODUCTION_TARGET_DATABASE/);
  });
});

describe("the CLI holds the decision and not the connection", () => {
  it("reads the committed constant in the dispatch call", () => {
    expect(cliSource).toContain("execution.enabled ?? APPLY_EXECUTION_ENABLED");
  });

  it("no longer ends every apply path in an unconditional throw", () => {
    const applyBranch = cliSource.slice(cliSource.indexOf("if (options.apply) {"));
    const throwIndex = applyBranch.indexOf("throw new ApplyNotEnabledError");
    const dispatchIndex = applyBranch.indexOf("await dispatchApply(");
    expect(dispatchIndex).toBeGreaterThan(-1);
    // The dispatch happens BEFORE the throw, and the throw is now inside a null check.
    expect(dispatchIndex).toBeLessThan(throwIndex);
    expect(applyBranch).toContain("if (applyResult === null) {");
  });

  it("dispatches only after every confirmation and preflight", () => {
    const branch = cliSource.slice(cliSource.indexOf("if (options.apply) {"));
    const order = [
      "assertApplyConfirmations(",
      "assertNothingApproved(",
      "assertReferenceDataSafe(",
      "assertPlanApplicable(",
      "buildWritePlan(",
      "assertWritePlanIdentitiesDistinct(",
      "await dispatchApply(",
    ].map((needle) => branch.indexOf(needle));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("constructs no Prisma client and imports no database driver", () => {
    expect(cliSource).not.toContain("new PrismaClient");
    expect(cliSource).not.toContain("@prisma/adapter-pg");
    expect(cliSource).not.toContain("$transaction");
  });

  it("reaches the executor only as an erased type import", () => {
    expect(cliSource).toContain('import type { ApplyResult } from "./apply/executor"');
    expect(cliSource).not.toMatch(/^import \{[^}]*executeCatalogApply/m);
  });

  it("never imports the disposable test harness", () => {
    expect(cliSource).not.toContain("disposable-harness");
  });

  it("exposes no flag or environment variable that enables execution", () => {
    const branch = cliSource.slice(cliSource.indexOf("export async function main("));
    expect(branch).not.toMatch(/process\.env\[[^\]]*ENABL/i);
    expect(branch).not.toMatch(/readFlag\("--enable/);
    expect(branch).not.toMatch(/argv\.includes\("--enable/);
  });
});
