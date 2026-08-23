/**
 * PLANNER REPLAY SIMULATION — and the reason it is not called a re-import.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 *
 * The importer has no apply path, so no catalogue row has ever been written and every
 * technical table is empty. "Re-import the workbook and see that all 100 rows come back as
 * SKIP" is therefore impossible to perform: there is nothing in the database to re-import
 * against.
 *
 * What CAN be performed, and is, is a replay of the PLANNER against a ledger the planner
 * itself produced: build the plan, derive the ledger from it, feed that ledger back in, and
 * check that the second plan re-identifies the same rows instead of minting new references.
 * That exercises identity resolution, evidence hashing and action selection — and nothing
 * else. It says nothing about how PostgreSQL would behave, because PostgreSQL was not
 * involved.
 *
 * ── What it must never be reported as ───────────────────────────────────────
 *
 * Not "a re-import", not "idempotency verified against the database", not "the second import
 * produced 100 SKIP". The only live database evidence this gate has is the dry run's own
 * before/after row counts, which prove that nothing was written — a different claim, kept in
 * `dry-run.ts` and reported separately.
 */

import { buildImportPlan } from "./import-planner";
import { buildLedger } from "./manifest";

import type { EntityActionCounts, ImportPlan } from "./catalog-import.types";
import type { PlanInput } from "./import-planner";

export interface PlannerReplaySimulation {
  /** Names itself, so a caller cannot report it as something stronger by accident. */
  readonly kind: "PLANNER_REPLAY_SIMULATION";
  readonly productActions: EntityActionCounts;
  /** References minted on the replay. Zero is the property the ledger exists to give. */
  readonly mintedIdentities: number;
  /** References that changed between the two plans. Must always be zero. */
  readonly reassignedIdentities: number;
  readonly identityRatifiable: boolean;
  readonly firstManifestRows: number;
  readonly note: string;
}

/**
 * Builds the plan, derives a ledger from it, and replays the planner against that ledger.
 *
 * No database is touched, opened or consulted.
 */
export function simulatePlannerReplay(input: PlanInput): {
  first: ImportPlan;
  second: ImportPlan;
  simulation: PlannerReplaySimulation;
} {
  const first = buildImportPlan(input);
  const ledger = buildLedger(first);
  const second = buildImportPlan({ ...input, ledger: ledger.entries });

  const firstRefByRow = new Map(
    first.products.map((product) => [product.rowNumber, product.sourceRef]),
  );
  let reassigned = 0;
  let minted = 0;
  const ledgerRefs = new Set(ledger.entries.map((entry) => entry.sourceRef));
  for (const product of second.products) {
    if (firstRefByRow.get(product.rowNumber) !== product.sourceRef) reassigned++;
    if (!ledgerRefs.has(product.sourceRef)) minted++;
  }

  return {
    first,
    second,
    simulation: {
      kind: "PLANNER_REPLAY_SIMULATION",
      productActions: second.counts.products,
      mintedIdentities: minted,
      reassignedIdentities: reassigned,
      identityRatifiable: second.identityRatifiable,
      firstManifestRows: first.products.length,
      note:
        "Planner replayed against a ledger it produced itself. No database was involved, no " +
        "row was ever written, and this is not evidence of database idempotency.",
    },
  };
}
