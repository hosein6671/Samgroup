/**
 * The post-write verification, run INSIDE the apply transaction and before the ImportRun is
 * marked successful.
 *
 * ── Why it is in the transaction ────────────────────────────────────────────
 *
 * A verification that runs after COMMIT can only report a catalogue that is already live. In
 * here, a failed assertion rolls the whole apply back — the ten demo Products come back, the
 * ADR-011 triggers re-claim their slugs, and nothing was published. That is the difference
 * between a check and a post-mortem.
 *
 * ── Why it re-reads instead of trusting the writer ──────────────────────────
 *
 * Every count below is a `SELECT`, not an accumulator the writer incremented. The writer
 * believing it inserted 1,398 Specifications is precisely the thing under test; a trigger, a
 * cascade, a partial-index predicate or a `DO NOTHING` that quietly matched would all leave
 * the accumulator right and the table wrong.
 */

import { TechnicalReviewStatus } from "../../../../prisma/generated/enums";

import { APPROVED_PLAN_EXPECTATIONS, type ApplyTransaction } from "./apply-engine";
import { AUDITED_DEMO_PRODUCT_COUNT, DEMO_SLUG_PREFIX } from "./demo-guard";

import type { ImportPlan } from "../catalog-import.types";
import type { ApplyRows } from "./rows";

/** The frozen reference vocabulary an import reconciles and never creates. */
export const EXPECTED_CATEGORY_COUNT = 6;
export const EXPECTED_SEGMENT_COUNT = 8;
export const EXPECTED_PRODUCT_TYPE_COUNT = 8;
export const EXPECTED_SPEC_PROPERTY_COUNT = 26;

export class PostWriteVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostWriteVerificationError";
  }
}

export interface VerificationReport {
  readonly checks: readonly { readonly name: string; readonly observed: string }[];
  readonly counts: Readonly<Record<string, number>>;
}

export interface VerificationInput {
  readonly rows: ApplyRows;
  readonly plan: ImportPlan;
  readonly manifestHash: string;
  readonly workbookSha256: string;
  readonly ledgerSha256: string;
  readonly mode: "FIRST_APPLY" | "IDENTICAL_REPLAY";
}

async function scalar(tx: ApplyTransaction, sql: string, ...params: unknown[]): Promise<number> {
  const found = await tx.query<{ n: number | bigint }>(sql, ...params);
  return Number(found[0]?.n ?? 0);
}

export async function runPostWriteVerification(
  tx: ApplyTransaction,
  input: VerificationInput,
): Promise<VerificationReport> {
  const checks: { name: string; observed: string }[] = [];
  const counts: Record<string, number> = {};
  const failures: string[] = [];

  const record = (name: string, observed: string): void => {
    checks.push({ name, observed });
  };
  const expect = (name: string, actual: number, wanted: number): void => {
    counts[name] = actual;
    record(name, `${String(actual)} (expected ${String(wanted)})`);
    if (actual !== wanted) {
      failures.push(`${name}: found ${String(actual)}, expected ${String(wanted)}`);
    }
  };
  const expectZero = (name: string, actual: number, why: string): void => {
    counts[name] = actual;
    record(name, String(actual));
    if (actual !== 0) failures.push(`${name}: found ${String(actual)}. ${why}`);
  };

  const rows = input.rows;

  // ── 1. Exact row counts, re-read rather than accumulated ────────────────
  expect(
    "products_with_source_ref",
    await scalar(tx, `SELECT count(*)::int AS n FROM products WHERE source_ref IS NOT NULL`),
    APPROVED_PLAN_EXPECTATIONS.products,
  );
  expect(
    "product_types",
    await scalar(tx, `SELECT count(*)::int AS n FROM product_types`),
    EXPECTED_PRODUCT_TYPE_COUNT,
  );
  expect(
    "spec_properties",
    await scalar(tx, `SELECT count(*)::int AS n FROM spec_properties`),
    EXPECTED_SPEC_PROPERTY_COUNT,
  );
  expect(
    "spec_property_mappings",
    await scalar(tx, `SELECT count(*)::int AS n FROM spec_property_mappings`),
    rows.specPropertyMappings.length,
  );
  expect(
    "product_segments",
    await scalar(tx, `SELECT count(*)::int AS n FROM product_segments`),
    rows.productSegments.length,
  );
  expect(
    "product_grades",
    await scalar(tx, `SELECT count(*)::int AS n FROM product_grades`),
    APPROVED_PLAN_EXPECTATIONS.productGrades,
  );
  expect(
    "source_facts",
    await scalar(tx, `SELECT count(*)::int AS n FROM source_facts`),
    APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts,
  );
  expect(
    "specifications",
    await scalar(tx, `SELECT count(*)::int AS n FROM specifications WHERE deleted_at IS NULL`),
    APPROVED_PLAN_EXPECTATIONS.specifications,
  );
  expect(
    "product_claims",
    await scalar(tx, `SELECT count(*)::int AS n FROM product_claims WHERE deleted_at IS NULL`),
    APPROVED_PLAN_EXPECTATIONS.productClaims,
  );
  expect(
    "specification_evidence",
    await scalar(tx, `SELECT count(*)::int AS n FROM specification_evidence`),
    APPROVED_PLAN_EXPECTATIONS.specificationEvidence,
  );
  expect(
    "claim_evidence",
    await scalar(tx, `SELECT count(*)::int AS n FROM claim_evidence`),
    APPROVED_PLAN_EXPECTATIONS.claimEvidence,
  );
  expect(
    "source_assets",
    await scalar(tx, `SELECT count(*)::int AS n FROM source_assets`),
    APPROVED_PLAN_EXPECTATIONS.sourceAssets,
  );
  expect(
    "source_documents",
    await scalar(tx, `SELECT count(*)::int AS n FROM source_documents`),
    APPROVED_PLAN_EXPECTATIONS.sourceDocuments,
  );

  // Reconciled, never created. A missing one means the wrong database.
  expect(
    "categories",
    await scalar(tx, `SELECT count(*)::int AS n FROM categories`),
    EXPECTED_CATEGORY_COUNT,
  );
  expect(
    "segments",
    await scalar(tx, `SELECT count(*)::int AS n FROM segments`),
    EXPECTED_SEGMENT_COUNT,
  );

  // ── 2. Every sourceRef present exactly once, and exactly the ratified set ──
  expect(
    "distinct_source_refs",
    await scalar(
      tx,
      `SELECT count(DISTINCT source_ref)::int AS n FROM products WHERE source_ref IS NOT NULL`,
    ),
    APPROVED_PLAN_EXPECTATIONS.ratifiedIdentities,
  );
  expectZero(
    "source_refs_not_in_plan",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM products
        WHERE source_ref IS NOT NULL AND NOT (source_ref = ANY($1::text[]))`,
      rows.products.map((row) => row.sourceRef),
    ),
    "A persisted Product carries a reference no plan row claims.",
  );
  expectZero(
    "planned_source_refs_missing",
    rows.products.length -
      (await scalar(
        tx,
        `SELECT count(*)::int AS n FROM products WHERE source_ref = ANY($1::text[])`,
        rows.products.map((row) => row.sourceRef),
      )),
    "A planned ratified reference did not reach the database.",
  );

  // ── 3. ADR-011: every slug registered, every demo claim released ────────
  expect(
    "product_slug_claims_product",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_slug_claims WHERE owner_type = 'Product'`,
    ),
    APPROVED_PLAN_EXPECTATIONS.products,
  );
  expect(
    "product_slug_claims_category",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_slug_claims WHERE owner_type = 'Category'`,
    ),
    EXPECTED_CATEGORY_COUNT,
  );
  expect(
    "product_slug_claims_total",
    await scalar(tx, `SELECT count(*)::int AS n FROM product_slug_claims`),
    APPROVED_PLAN_EXPECTATIONS.products + EXPECTED_CATEGORY_COUNT,
  );
  expectZero(
    "products_without_slug_claim",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM products p
        WHERE NOT EXISTS (SELECT 1 FROM product_slug_claims c
                           WHERE c.owner_type = 'Product' AND c.owner_id = p.id)`,
    ),
    "A Product's slug was never registered, so ADR-011 is not enforcing the namespace for it.",
  );
  expectZero(
    "slug_claims_without_owner",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_slug_claims c
        WHERE c.owner_type = 'Product'
          AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = c.owner_id)`,
    ),
    "A slug claim outlived the Product that owned it.",
  );

  // ── 4. No demo remains, in either table ─────────────────────────────────
  expectZero(
    "demo_products_remaining",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM products WHERE slug LIKE $1`,
      `${DEMO_SLUG_PREFIX}%`,
    ),
    `All ${String(AUDITED_DEMO_PRODUCT_COUNT)} audited demo Products must be gone.`,
  );
  expectZero(
    "demo_slug_claims_remaining",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_slug_claims WHERE slug LIKE $1`,
      `${DEMO_SLUG_PREFIX}%`,
    ),
    "A released Product must release its ADR-011 claim through the delete trigger.",
  );

  // ── 5. Every child row belongs where the plan says ──────────────────────
  expectZero(
    "grades_on_unimported_products",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_grades g
         JOIN products p ON p.id = g.product_id
        WHERE p.source_ref IS NULL`,
    ),
    "A ProductGrade hangs off a Product this import did not create.",
  );
  expectZero(
    "grades_not_planned",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_grades g
        WHERE NOT (g.id = ANY($1::uuid[]))`,
      rows.productGrades.map((row) => row.id),
    ),
    "A ProductGrade exists that the plan does not describe.",
  );
  expectZero(
    "specifications_grade_product_mismatch",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM specifications s
         JOIN product_grades g ON g.id = s.product_grade_id
        WHERE g.product_id <> s.product_id`,
    ),
    "A Specification points at a Grade belonging to a different Product.",
  );
  expectZero(
    "claims_grade_product_mismatch",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_claims c
         JOIN product_grades g ON g.id = c.product_grade_id
        WHERE g.product_id <> c.product_id`,
    ),
    "A ProductClaim points at a Grade belonging to a different Product.",
  );
  expectZero(
    "specifications_not_planned",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM specifications s
        WHERE s.deleted_at IS NULL AND NOT (s.id = ANY($1::uuid[]))`,
      rows.specifications.map((row) => row.id),
    ),
    "A live Specification exists that the plan does not describe.",
  );
  expectZero(
    "claims_not_planned",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_claims c
        WHERE c.deleted_at IS NULL AND NOT (c.id = ANY($1::uuid[]))`,
      rows.productClaims.map((row) => row.id),
    ),
    "A live ProductClaim exists that the plan does not describe.",
  );

  // ── 6. Evidence: everything cited, every citation resolvable ────────────
  expectZero(
    "specifications_without_evidence",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM specifications s
        WHERE s.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM specification_evidence e
                           WHERE e.specification_id = s.id)`,
    ),
    "A normalized value with no reading behind it is an unsourced claim about a product.",
  );
  expectZero(
    "claims_without_evidence",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM product_claims c
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM claim_evidence e WHERE e.product_claim_id = c.id)`,
    ),
    "A claim with no reading behind it is an unsourced statement about a product.",
  );
  expectZero(
    "specification_evidence_unresolved",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM specification_evidence e
        WHERE NOT EXISTS (SELECT 1 FROM source_facts f WHERE f.id = e.source_fact_id)
           OR NOT EXISTS (SELECT 1 FROM specifications s WHERE s.id = e.specification_id)`,
    ),
    "An evidence link points at a row that is not there.",
  );
  expectZero(
    "claim_evidence_unresolved",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM claim_evidence e
        WHERE NOT EXISTS (SELECT 1 FROM source_facts f WHERE f.id = e.source_fact_id)
           OR NOT EXISTS (SELECT 1 FROM product_claims c WHERE c.id = e.product_claim_id)`,
    ),
    "An evidence link points at a row that is not there.",
  );
  expectZero(
    "source_facts_without_document",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM source_facts f
        WHERE NOT EXISTS (SELECT 1 FROM source_documents d WHERE d.id = f.source_document_id)`,
    ),
    "Every reading belongs to exactly one document; one belongs to none.",
  );
  expectZero(
    "source_facts_without_run",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM source_facts f
        WHERE NOT EXISTS (SELECT 1 FROM import_runs r WHERE r.id = f.import_run_id)`,
    ),
    "A reading cites an ImportRun that does not exist.",
  );
  expectZero(
    "orphan_source_facts",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM source_facts f
        WHERE NOT (f.id = ANY($1::uuid[]))`,
      rows.sourceFacts.map((row) => row.id),
    ),
    "A SourceFact exists that the plan does not describe.",
  );
  expectZero(
    "orphan_source_documents",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM source_documents d
        WHERE NOT (d.id = ANY($1::uuid[]))`,
      rows.sourceDocuments.map((row) => row.id),
    ),
    "A SourceDocument exists that the plan does not describe.",
  );
  expectZero(
    "orphan_source_assets",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM source_assets a WHERE NOT (a.id = ANY($1::uuid[]))`,
      rows.sourceAssets.map((row) => row.id),
    ),
    "A SourceAsset exists that the plan does not describe.",
  );

  // ── 7. The 130 withheld facts stayed evidence ───────────────────────────
  // The 130 readings the planner withheld are still readings and nothing more: they carry a
  // SourceFact row and no specification_evidence link anywhere points at them.
  const plannedFactsBackingSpecifications = new Set(
    rows.specificationEvidence.map((row) => row.evidenceIdentity),
  ).size;
  expect(
    "facts_backing_a_specification",
    await scalar(
      tx,
      `SELECT count(DISTINCT e.source_fact_id)::int AS n FROM specification_evidence e`,
    ),
    plannedFactsBackingSpecifications,
  );
  expect(
    "facts_backing_no_specification",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM source_facts f
        WHERE NOT EXISTS (SELECT 1 FROM specification_evidence e WHERE e.source_fact_id = f.id)`,
    ),
    APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts - plannedFactsBackingSpecifications,
  );
  expect(
    "withheld_technical_readings",
    input.plan.counts.technical.withheldFromSpecification,
    input.plan.counts.technical.rawTechnicalFacts -
      input.plan.counts.technical.validSpecificationCandidates,
  );
  expectZero(
    "specifications_from_unapproved_mapping",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM specifications s
        WHERE s.deleted_at IS NULL
          AND (s.property_key IS NULL
               OR NOT EXISTS (SELECT 1 FROM spec_properties p WHERE p.key = s.property_key))`,
    ),
    "A Specification names a property the approved dictionary does not carry.",
  );
  expectZero(
    "specifications_from_non_high_mapping",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM specifications s
        WHERE s.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM spec_property_mappings m
                       WHERE m.spec_property_key = s.property_key AND m.confidence <> 'high')
          AND NOT EXISTS (SELECT 1 FROM spec_property_mappings m
                           WHERE m.spec_property_key = s.property_key AND m.confidence = 'high')`,
    ),
    "Only a HIGH-confidence mapping may normalize a reading into a Specification.",
  );

  // ── 8. Nothing is published ─────────────────────────────────────────────
  const approved = await scalar(
    tx,
    `SELECT (SELECT count(*) FROM specifications WHERE review_status = 'approved')
          + (SELECT count(*) FROM product_claims WHERE review_status = 'approved')
          + (SELECT count(*) FROM spec_property_mappings WHERE review_status = 'approved')
          AS n`,
  );
  expectZero(
    "approved_rows",
    approved,
    "Approval is a recorded human decision belonging to the review service (ADR-015 §10).",
  );
  expectZero(
    "review_states_outside_the_two_permitted",
    await scalar(
      tx,
      `SELECT (SELECT count(*) FROM specifications
                WHERE review_status NOT IN ('source_recorded','needs_review'))
            + (SELECT count(*) FROM product_claims
                WHERE review_status NOT IN ('source_recorded','needs_review'))
            + (SELECT count(*) FROM spec_property_mappings
                WHERE review_status NOT IN ('source_recorded','needs_review'))
            AS n`,
    ),
    `Only ${TechnicalReviewStatus.SOURCE_RECORDED} and ${TechnicalReviewStatus.NEEDS_REVIEW} ` +
      `may be written by an import.`,
  );
  expect(
    "technical_reviews",
    await scalar(tx, `SELECT count(*)::int AS n FROM technical_reviews`),
    0,
  );

  // ── 9. No document bytes were stored ────────────────────────────────────
  // The provenance tables are locators, hashes and sizes. A byte column appearing on one of
  // them is how a TDS would end up inside the platform database.
  expectZero(
    "binary_columns_on_provenance_tables",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('source_assets','source_documents','source_facts','import_runs')
          AND data_type IN ('bytea','oid')`,
    ),
    "A provenance table grew a column that can hold document bytes.",
  );

  // ── 10. The inputs are still the ones that were confirmed ───────────────
  if (input.plan.workbook.sha256 !== input.workbookSha256) {
    failures.push("The plan's workbook hash no longer matches the confirmed one.");
  }
  record("workbook_sha256", input.workbookSha256);
  record("ledger_sha256", input.ledgerSha256);
  record("manifest_hash", input.manifestHash);

  // A first apply owns one open run for its own manifest; a replay owns none, because its
  // plan writes nothing and a plan that writes nothing is never an application (ADR-015 §4).
  expect(
    "import_runs_for_this_manifest",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM import_runs WHERE manifest_hash = $1`,
      input.manifestHash,
    ),
    input.mode === "FIRST_APPLY" ? 1 : 0,
  );
  expect(
    "successful_import_runs_for_this_manifest",
    await scalar(
      tx,
      `SELECT count(*)::int AS n FROM import_runs
        WHERE manifest_hash = $1 AND finished_at IS NOT NULL`,
      input.manifestHash,
    ),
    // Zero either way: on a first apply the run is marked successful only AFTER this returns.
    0,
  );
  expect(
    "successful_import_runs_total",
    await scalar(tx, `SELECT count(*)::int AS n FROM import_runs WHERE finished_at IS NOT NULL`),
    input.mode === "FIRST_APPLY" ? 0 : 1,
  );
  expect("import_runs_total", await scalar(tx, `SELECT count(*)::int AS n FROM import_runs`), 1);

  if (failures.length > 0) {
    throw new PostWriteVerificationError(
      `Post-write verification failed with ${String(failures.length)} finding(s); the ` +
        `transaction is rolled back and nothing was published:\n  - ${failures.join("\n  - ")}`,
    );
  }
  return { checks, counts };
}
