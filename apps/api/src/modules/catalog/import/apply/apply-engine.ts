/**
 * The guarded, transactional catalog apply.
 *
 * ── What this file may do, and what it may not ──────────────────────────────
 *
 * It may insert the ratified catalogue and delete the ten audited demo Products, once every
 * confirmation and every guard has passed. It may not: write `product_slug_claims` (ADR-011
 * maintains that registry by trigger, and a writer that touched it would be asserting the
 * invariant instead of being subject to it), set any review status to APPROVED (ADR-014 §8
 * defers that to the review service), import a withheld fact as a Specification, or store a
 * single byte of a TDS, image or workbook.
 *
 * ── One transaction, no partial catalogue ───────────────────────────────────
 *
 * SERIALIZABLE, one advisory lock so two imports cannot interleave, a lock and statement
 * timeout so a stuck import cannot hold the catalogue hostage, and every check re-run INSIDE
 * the transaction. A half-imported catalogue is worse than no catalogue: it looks complete.
 */

import { TechnicalReviewStatus } from "../../../../prisma/generated/enums";

import { sourceFactKey } from "../import-planner";

import { assertDemoReplacementAllowed } from "./demo-guard";
import * as ids from "./identities";
import { specPropertyMappingRows, specPropertyRows } from "./reference-data";

import type { ImportPlan, PlannedProduct } from "../catalog-import.types";
import type { DemoProductRow } from "./demo-guard";

/**
 * The advisory lock key. A single fixed key, so any two catalog imports contend even across
 * machines and connections. `pg_advisory_xact_lock` releases with the transaction, so a
 * crashed importer cannot leave the lock held.
 */
export const CATALOG_IMPORT_ADVISORY_LOCK_KEY = 8_531_207_411_002_003n;

/** Bounded by design: an import that cannot make progress must fail, not wait forever. */
export const APPLY_LOCK_TIMEOUT_MS = 15_000;
export const APPLY_STATEMENT_TIMEOUT_MS = 600_000;

/** The ratified plan shape. An apply that does not match it exactly is refused. */
export const APPROVED_PLAN_EXPECTATIONS = {
  products: 100,
  ratifiedIdentities: 100,
  productGrades: 134,
  distinctSourceFacts: 1661,
  specifications: 1402,
  productLevelSpecifications: 491,
  gradeLevelSpecifications: 911,
  productClaims: 148,
  specificationEvidence: 1402,
  claimEvidence: 148,
  sourceAssets: 53,
  sourceDocuments: 69,
} as const;

export class ApplyPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyPreflightError";
  }
}

/* -------------------------------------------------------------------------- */
/* Preflight                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Re-checks the plan immediately before the write transaction opens.
 *
 * `persistedSourceRefs` is what the database already holds, so the same plan is applicable
 * both on a first apply (nothing persisted, 100 INSERTs) and on an identical replay
 * (everything persisted, 100 SKIPs). Anything between the two is a reconciliation, not an
 * import, and is refused.
 */
export function assertPlanApplicable(
  plan: ImportPlan,
  persistedSourceRefs: ReadonlySet<string>,
): "FIRST_APPLY" | "IDENTICAL_REPLAY" {
  const fail = (message: string): never => {
    throw new ApplyPreflightError(message);
  };
  const counts = plan.counts;

  const ratified = plan.products.filter((p) => p.identityState === "RATIFIED").length;
  if (ratified !== APPROVED_PLAN_EXPECTATIONS.ratifiedIdentities) {
    fail(
      `Apply requires ${String(APPROVED_PLAN_EXPECTATIONS.ratifiedIdentities)} RATIFIED ` +
        `identities; the plan carries ${String(ratified)}. An inferred or proposed identity ` +
        `is never applied.`,
    );
  }
  if (counts.products.conflict !== 0) {
    fail(
      `Apply requires 0 blocking conflicts; the plan carries ${String(counts.products.conflict)}.`,
    );
  }
  if (!plan.identityRatifiable) fail("The plan is not ratifiable.");
  if (plan.unmatchedLedgerEntries.length !== 0) {
    fail(
      `${String(plan.unmatchedLedgerEntries.length)} ratified identities are claimed by no ` +
        `row. A removed workbook row is a reconciliation for the owner, never a deletion.`,
    );
  }

  const expect = (label: string, actual: number, wanted: number): void => {
    if (actual !== wanted)
      fail(`Approved count mismatch: ${label} is ${String(actual)}, expected ${String(wanted)}.`);
  };
  expect("products", counts.rowsParsed, APPROVED_PLAN_EXPECTATIONS.products);
  expect("ProductGrades", counts.gradeRecords, APPROVED_PLAN_EXPECTATIONS.productGrades);
  expect("SourceFacts", counts.sourceFacts, APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts);
  expect(
    "Specifications",
    counts.technical.validSpecificationCandidates,
    APPROVED_PLAN_EXPECTATIONS.specifications,
  );
  expect(
    "Product-level Specifications",
    counts.technical.productLevelCandidates,
    APPROVED_PLAN_EXPECTATIONS.productLevelSpecifications,
  );
  expect(
    "Grade-level Specifications",
    counts.technical.gradeLevelCandidates,
    APPROVED_PLAN_EXPECTATIONS.gradeLevelSpecifications,
  );
  expect("ProductClaims", counts.claims, APPROVED_PLAN_EXPECTATIONS.productClaims);
  expect(
    "SpecificationEvidence",
    counts.specificationEvidenceLinks,
    APPROVED_PLAN_EXPECTATIONS.specificationEvidence,
  );
  expect("ClaimEvidence", counts.claimEvidenceLinks, APPROVED_PLAN_EXPECTATIONS.claimEvidence);

  const planned = plan.products.map((p) => p.sourceRef);
  const persistedHere = planned.filter((ref) => persistedSourceRefs.has(ref)).length;

  if (persistedHere === 0) {
    if (counts.products.insert !== APPROVED_PLAN_EXPECTATIONS.products) {
      fail(
        `Nothing is persisted, so all ${String(APPROVED_PLAN_EXPECTATIONS.products)} rows ` +
          `must be INSERT; the plan says ${String(counts.products.insert)}.`,
      );
    }
    return "FIRST_APPLY";
  }
  if (persistedHere === planned.length) {
    if (counts.products.skip !== APPROVED_PLAN_EXPECTATIONS.products) {
      fail(
        `Every ratified identity is already persisted, so an identical replay must be ` +
          `${String(APPROVED_PLAN_EXPECTATIONS.products)} SKIP; the plan says ` +
          `${String(counts.products.skip)}. Something about the source changed and this is ` +
          `a reconciliation, not a replay.`,
      );
    }
    return "IDENTICAL_REPLAY";
  }
  return fail(
    `${String(persistedHere)} of ${String(planned.length)} ratified identities are already ` +
      `persisted. A partial catalogue is neither a first apply nor a replay, and is never ` +
      `completed automatically.`,
  );
}

/* -------------------------------------------------------------------------- */
/* The write plan                                                              */
/* -------------------------------------------------------------------------- */

export interface WriteRow {
  readonly table: string;
  readonly id: string | null;
  readonly identity: string;
}

export interface WritePlan {
  readonly productTypes: readonly WriteRow[];
  readonly specProperties: readonly WriteRow[];
  readonly specPropertyMappings: readonly WriteRow[];
  readonly sourceAssets: readonly WriteRow[];
  readonly sourceDocuments: readonly WriteRow[];
  readonly products: readonly WriteRow[];
  readonly productSegments: readonly WriteRow[];
  readonly productGrades: readonly WriteRow[];
  readonly sourceFacts: readonly WriteRow[];
  readonly specifications: readonly WriteRow[];
  readonly productClaims: readonly WriteRow[];
  readonly specificationEvidence: readonly WriteRow[];
  readonly claimEvidence: readonly WriteRow[];
}

/**
 * The evidence identity of one reading.
 *
 * `sourceFactKey` is the planner's own function and is reused verbatim rather than
 * reimplemented here: two definitions of "the same reading" would eventually drift apart, and
 * the one deciding a permanent database identity has to be the one the plan was built with.
 * It is also exactly the tuple `source_facts_evidence_identity_key` indexes.
 */
const factIdentity = sourceFactKey;

/**
 * Turns the authoritative plan into the exact set of rows an apply would write, with every
 * id derived. Pure and database-free, so the counts and the idempotency can be proven without
 * writing anything — which is the whole point of building it separately from the executor.
 */
export function buildWritePlan(plan: ImportPlan): WritePlan {
  const productTypes = new Map<string, WriteRow>();
  const products: WriteRow[] = [];
  const productSegments: WriteRow[] = [];
  const productGrades: WriteRow[] = [];
  const sourceFacts = new Map<string, WriteRow>();
  const specifications: WriteRow[] = [];
  const productClaims: WriteRow[] = [];
  const specificationEvidence: WriteRow[] = [];
  const claimEvidence: WriteRow[] = [];

  for (const product of plan.products as readonly PlannedProduct[]) {
    const ref = product.sourceRef;
    products.push({ table: "products", id: ids.productId(ref), identity: ref });

    if (product.proposedProductTypeKey !== null) {
      const slug = product.proposedProductTypeKey;
      productTypes.set(slug, {
        table: "product_types",
        id: ids.productTypeId(slug),
        identity: slug,
      });
    }
    for (const segment of product.proposedSegmentKeys) {
      productSegments.push({ table: "product_segments", id: null, identity: `${ref}|${segment}` });
    }
    for (const grade of product.grades) {
      productGrades.push({
        table: "product_grades",
        id: ids.productGradeId(ref, grade.label),
        identity: `${ref}|${grade.label}`,
      });
    }

    for (const item of product.technicalFacts) {
      const identity = factIdentity(item.sourceFact);
      const factId = ids.sourceFactId(identity);
      sourceFacts.set(identity, { table: "source_facts", id: factId, identity });
      if (item.specification === null) continue; // withheld: never becomes a Specification
      const specId = ids.specificationId(ref, item.gradeLabel, item.specification.propertyKey);
      specifications.push({
        table: "specifications",
        id: specId,
        identity: `${ref}|${item.gradeLabel ?? ""}|${item.specification.propertyKey}`,
      });
      specificationEvidence.push({
        table: "specification_evidence",
        id: null,
        identity: `${specId}|${factId}`,
      });
    }

    for (const claim of product.claims) {
      const identity = factIdentity(claim.sourceFact);
      const factId = ids.sourceFactId(identity);
      sourceFacts.set(identity, { table: "source_facts", id: factId, identity });
      // The claim's identity is the STATEMENT it makes. The reading it was found in has its
      // own identity above, and a later revision of that reading attaches as another
      // ClaimEvidence link rather than becoming a second claim.
      const hash = ids.claimIdentityHash(claim.sourceFact.rawValue);
      const claimId = ids.productClaimId(
        ref,
        claim.gradeLabel,
        claim.kind,
        claim.standardBody,
        claim.standardCode,
        hash,
      );
      productClaims.push({
        table: "product_claims",
        id: claimId,
        identity: `${ref}|${claim.gradeLabel ?? ""}|${claim.kind}|${claim.standardBody ?? ""}|${claim.standardCode ?? ""}|${hash}`,
      });
      claimEvidence.push({ table: "claim_evidence", id: null, identity: `${claimId}|${factId}` });
    }
  }

  const sourceAssets: WriteRow[] = [];
  const sourceDocuments: WriteRow[] = [];
  for (const document of plan.documents) {
    const sha = document.sha256;
    if (sha !== null) {
      sourceAssets.push({ table: "source_assets", id: ids.sourceAssetId(sha), identity: sha });
    }
    sourceDocuments.push({
      table: "source_documents",
      id: ids.sourceDocumentId(document.locatorType, document.locatorValue, sha),
      identity: `${document.locatorType}|${document.locatorValue}|${sha ?? ""}`,
    });
  }

  return {
    productTypes: [...productTypes.values()],
    // Reference vocabulary. Reconciled by key, not by id, so the KEY is the identity.
    specProperties: specPropertyRows().map((row) => ({
      table: "spec_properties",
      id: null,
      identity: row.key,
    })),
    specPropertyMappings: specPropertyMappingRows().map((row) => ({
      table: "spec_property_mappings",
      id: row.id,
      identity: ids.identityKey("spec-property-mapping", row.rawProperty, row.rawUnit),
    })),
    sourceAssets,
    sourceDocuments,
    products,
    productSegments,
    productGrades,
    sourceFacts: [...sourceFacts.values()],
    specifications,
    productClaims,
    specificationEvidence,
    claimEvidence,
  };
}

/** Every row the plan would write, as one flat list. Used by the invariant checks. */
export function allWriteRows(writePlan: WritePlan): readonly WriteRow[] {
  return Object.values(writePlan).flat() as readonly WriteRow[];
}

/**
 * Refuses a write plan whose derived identities collide. A collision would make two logical
 * rows share one database row, which the unique indexes would then hide rather than reveal.
 */
export function assertWritePlanIdentitiesDistinct(writePlan: WritePlan): void {
  for (const [table, rows] of Object.entries(writePlan) as [string, WriteRow[]][]) {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.identity)) {
        throw new ApplyPreflightError(
          `Derived identity collision in ${table}: ${row.identity} appears twice.`,
        );
      }
      seen.add(row.identity);
    }
    const withIds = rows.filter((row) => row.id !== null);
    if (new Set(withIds.map((row) => row.id)).size !== withIds.length) {
      throw new ApplyPreflightError(`Derived id collision in ${table}.`);
    }
  }
}

/**
 * Nothing the importer writes may ever be APPROVED. Asserted rather than trusted: the
 * importer has no code path that produces one, and this is what keeps that true.
 */
export function assertNothingApproved(plan: ImportPlan): void {
  for (const product of plan.products) {
    if ((product.reviewStatus as string) === TechnicalReviewStatus.APPROVED) {
      throw new ApplyPreflightError(
        `${product.sourceRef} is APPROVED. The importer never approves; approval is a ` +
          `recorded human decision made by the review service (ADR-014 §8).`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* The transaction                                                             */
/* -------------------------------------------------------------------------- */

/** The narrow write surface. An interface so the ordering can be tested without a database. */
export interface ApplyTransaction {
  execute(sql: string, ...params: readonly unknown[]): Promise<number>;
  query<T>(sql: string, ...params: readonly unknown[]): Promise<T[]>;
}

export interface ApplyOptions {
  readonly plan: ImportPlan;
  readonly manifestHash: string;
  readonly demoReplacementAuthorized: boolean;
  readonly acceptInquirySetNull?: boolean;
}

/**
 * The ordered write sequence, stated as data so the ordering itself is reviewable and
 * testable rather than being implied by the order of statements in a function body.
 *
 * ── Why the demos go where they do ──────────────────────────────────────────
 *
 * AFTER the reference data and the preflight, BEFORE the 100 Products. ADR-011 forces the
 * choice: `product_slug_claims` is trigger-maintained and keyed on the normalized slug, so
 * the demo claims must be released before any real slug could contend for one. None of the
 * 100 real slugs collides with a demo slug today — measured — so ordering is not load-bearing
 * for correctness, but doing it in the other order would make the import depend on that
 * measurement staying true. Deleting first depends on nothing.
 *
 * The delete is inside the same transaction as every insert, so a failure at any later step
 * restores all ten demo Products and their 18 segment memberships automatically.
 */
export const APPLY_STEP_ORDER: readonly string[] = [
  "advisory-lock",
  "timeouts",
  "preflight-recheck",
  "spec_properties",
  "spec_property_mappings",
  "product_types",
  "demo-guard",
  "demo-delete",
  "import_runs",
  "source_assets",
  "source_documents",
  "products",
  "product_segments",
  "product_grades",
  "source_facts",
  "specifications",
  "product_claims",
  "specification_evidence",
  "claim_evidence",
  "post-write-verification",
];

/**
 * Opens the guarded transaction's preconditions: the advisory lock and the timeouts.
 * Separated so a test can assert they are taken before anything else happens.
 */
export async function beginGuardedTransaction(tx: ApplyTransaction): Promise<void> {
  await tx.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
  await tx.execute(`SET LOCAL lock_timeout = '${String(APPLY_LOCK_TIMEOUT_MS)}ms'`);
  await tx.execute(`SET LOCAL statement_timeout = '${String(APPLY_STATEMENT_TIMEOUT_MS)}ms'`);
  // Transaction-scoped: released on COMMIT or ROLLBACK, including a crash.
  await tx.execute("SELECT pg_advisory_xact_lock($1)", CATALOG_IMPORT_ADVISORY_LOCK_KEY);
}

/**
 * Reads the demo candidates inside the transaction and hands them to the guard. Exported so
 * the guard's inputs come from one place and a test can prove the read happens in-transaction.
 */
export async function readDemoCandidates(tx: ApplyTransaction): Promise<DemoProductRow[]> {
  return tx.query<DemoProductRow>(
    `SELECT p.id, p.slug, p.name, p.source_ref AS "sourceRef",
            (SELECT count(*)::int FROM product_grades g WHERE g.product_id = p.id) AS "gradeCount",
            (SELECT count(*)::int FROM specifications s WHERE s.product_id = p.id) AS "specificationCount",
            (SELECT count(*)::int FROM product_claims c WHERE c.product_id = p.id) AS "claimCount",
            -- Reachable evidence, not a constant. A SourceFact carries no product column:
            -- it reaches a Product only through a Specification or a ProductClaim, so this
            -- is what "a demo row is cited by evidence" actually means. A fact cited by
            -- both is counted twice, which is harmless in a guard that refuses on non-zero.
            ((SELECT count(DISTINCT se.source_fact_id)::int
                FROM specification_evidence se
                JOIN specifications s2 ON s2.id = se.specification_id
               WHERE s2.product_id = p.id)
             + (SELECT count(DISTINCT ce.source_fact_id)::int
                FROM claim_evidence ce
                JOIN product_claims c2 ON c2.id = ce.product_claim_id
               WHERE c2.product_id = p.id)) AS "sourceFactCount",
            (SELECT count(*)::int FROM inquiries i WHERE i.related_product_id = p.id) AS "inquiryCount",
            (SELECT count(*)::int FROM product_segments ps WHERE ps.product_id = p.id) AS "segmentCount"
       FROM products p
      WHERE p.slug LIKE 'sam-demo-%'
      ORDER BY p.slug`,
  );
}

/**
 * Deletes the audited demo Products, guard first. Never called unless the operator authorized
 * replacement, and never with a pattern: the guard returns explicit ids and only those are
 * deleted.
 *
 * `product_slug_claims` is not touched. The ADR-011 delete trigger releases each claim as its
 * Product goes, which is the proof the enforcement is live rather than re-implemented here.
 */
export async function deleteAuditedDemoProducts(
  tx: ApplyTransaction,
  options: { authorized: boolean; acceptInquirySetNull?: boolean },
): Promise<readonly string[]> {
  const candidates = await readDemoCandidates(tx);
  const claims = await tx.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM product_slug_claims
      WHERE owner_type = 'Product' AND slug LIKE 'sam-demo-%'`,
  );
  const ids = assertDemoReplacementAllowed({
    candidates,
    slugClaimCount: claims[0]?.count ?? 0,
    authorized: options.authorized,
    ...(options.acceptInquirySetNull === undefined
      ? {}
      : { acceptInquirySetNull: options.acceptInquirySetNull }),
  });
  const deleted = await tx.execute(`DELETE FROM products WHERE id = ANY($1::uuid[])`, ids);
  if (deleted !== ids.length) {
    throw new ApplyPreflightError(
      `Demo deletion removed ${String(deleted)} rows, expected ${String(ids.length)}.`,
    );
  }
  return ids;
}
