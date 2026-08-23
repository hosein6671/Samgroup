/**
 * The guard that stands in front of deleting the ten demo Products.
 *
 * ── Why a guard and not a DELETE ────────────────────────────────────────────
 *
 * The owner authorized removing TEN AUDITED ROWS — not "everything matching sam-demo-%".
 * Those are different statements, and only the first is safe: a prefix delete would take any
 * future row that happened to be named that way, including one somebody had since attached
 * real data to.
 *
 * Two of the three technical child tables make this sharper. `specifications.product_id` and
 * `product_claims.product_id` are ON DELETE **CASCADE**, so the database will NOT stop a
 * delete that would take reviewed technical data with it — it will do it silently. Only
 * `product_grades` is RESTRICT. Every count below is therefore checked HERE, because for two
 * of them the database has already agreed not to.
 *
 * ── Every check runs inside the import transaction ──────────────────────────
 *
 * Not before it. A check that passes in one transaction and deletes in another is a check
 * that was true once, and the rows can change in between.
 */

/** The exact ten Products `prisma/seed-products-demo.ts` creates. An allowlist, not a pattern. */
export const AUDITED_DEMO_SLUGS: readonly string[] = [
  "sam-demo-antifreeze-coolant-a",
  "sam-demo-base-oil-a",
  "sam-demo-base-oil-b",
  "sam-demo-engine-oil-a",
  "sam-demo-engine-oil-b",
  "sam-demo-engine-oil-c",
  "sam-demo-industrial-oil-a",
  "sam-demo-industrial-oil-b",
  "sam-demo-lubricant-additive-a",
  "sam-demo-marine-oil-a",
];

/** The slug prefix and name marker the seed puts on every row it writes. */
export const DEMO_SLUG_PREFIX = "sam-demo-";
export const DEMO_NAME_MARKER = "SAM Demo ";

/** The audited dependency state, recorded when the ten rows were reviewed. */
export const AUDITED_DEMO_PRODUCT_COUNT = 10;
export const AUDITED_DEMO_PRODUCT_SEGMENT_COUNT = 18;

export class DemoReplacementGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoReplacementGuardError";
  }
}

/** One candidate row, as read inside the transaction. */
export interface DemoProductRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sourceRef: string | null;
  readonly gradeCount: number;
  readonly specificationCount: number;
  readonly claimCount: number;
  readonly sourceFactCount: number;
  readonly inquiryCount: number;
  readonly segmentCount: number;
}

export interface DemoGuardInput {
  /** Every Product whose slug starts with the demo prefix, read inside the transaction. */
  readonly candidates: readonly DemoProductRow[];
  /** `product_slug_claims` rows owned by those Products. */
  readonly slugClaimCount: number;
  /** Whether the operator authorized replacement. */
  readonly authorized: boolean;
  /**
   * Whether an Inquiry pointing at a demo Product may be accepted. The foreign key is
   * ON DELETE SET NULL, so a delete would silently detach a real lead from its product.
   * That is a separately reviewed decision and defaults to refusing.
   */
  readonly acceptInquirySetNull?: boolean;
}

/**
 * Decides whether the ten demo Products may be deleted. Returns the ids to delete, or throws.
 * Pure: it reads no database and writes nothing, so the whole matrix is testable directly.
 */
export function assertDemoReplacementAllowed(input: DemoGuardInput): readonly string[] {
  const fail = (message: string): never => {
    throw new DemoReplacementGuardError(message);
  };

  if (!input.authorized) {
    fail("Demo replacement was not authorized. Nothing is deleted.");
  }

  const candidates = [...input.candidates].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const allowed = new Set(AUDITED_DEMO_SLUGS);

  if (candidates.length !== AUDITED_DEMO_PRODUCT_COUNT) {
    fail(
      `Expected exactly ${String(AUDITED_DEMO_PRODUCT_COUNT)} demo Products; found ` +
        `${String(candidates.length)}. The authorization covers an audited set of ten rows, ` +
        `not whatever currently matches the prefix.`,
    );
  }

  const unexpected = candidates.filter((row) => !allowed.has(row.slug)).map((row) => row.slug);
  if (unexpected.length > 0) {
    fail(`Not in the audited allowlist: ${unexpected.join(", ")}. Refusing to delete.`);
  }

  const missing = AUDITED_DEMO_SLUGS.filter((slug) => !candidates.some((row) => row.slug === slug));
  if (missing.length > 0) {
    fail(
      `Audited demo Products are absent: ${missing.join(", ")}. The database is not in the ` +
        `state that was reviewed, so the review does not describe it.`,
    );
  }

  for (const row of candidates) {
    const where = `${row.slug} (${row.id})`;
    if (!row.slug.startsWith(DEMO_SLUG_PREFIX)) {
      fail(`${where} does not carry the ${DEMO_SLUG_PREFIX} slug prefix.`);
    }
    if (!row.name.startsWith(DEMO_NAME_MARKER)) {
      fail(`${where} is named "${row.name}", which lacks the "${DEMO_NAME_MARKER}" marker.`);
    }
    // A demo row that acquired a ratified identity is not a demo row any more.
    if (row.sourceRef !== null) {
      fail(`${where} carries source_ref ${row.sourceRef}. A ratified Product is never deleted.`);
    }
    if (row.gradeCount !== 0) fail(`${where} has ${String(row.gradeCount)} ProductGrade rows.`);
    // CASCADE: the database would delete these silently. That is why this is checked here.
    if (row.specificationCount !== 0) {
      fail(
        `${where} has ${String(row.specificationCount)} Specification rows, which would ` +
          `CASCADE. Reviewed technical data is never removed as a side effect.`,
      );
    }
    if (row.claimCount !== 0) {
      fail(`${where} has ${String(row.claimCount)} ProductClaim rows, which would CASCADE.`);
    }
    if (row.sourceFactCount !== 0) {
      fail(`${where} is cited by ${String(row.sourceFactCount)} SourceFacts.`);
    }
    if (row.inquiryCount !== 0 && input.acceptInquirySetNull !== true) {
      fail(
        `${where} is referenced by ${String(row.inquiryCount)} Inquiry rows. The foreign key ` +
          `is ON DELETE SET NULL, so deleting would silently detach a real lead from the ` +
          `product it asked about. That needs its own review.`,
      );
    }
  }

  const segmentTotal = candidates.reduce((total, row) => total + row.segmentCount, 0);
  if (segmentTotal !== AUDITED_DEMO_PRODUCT_SEGMENT_COUNT) {
    fail(
      `Expected ${String(AUDITED_DEMO_PRODUCT_SEGMENT_COUNT)} ProductSegment rows across the ` +
        `ten demo Products; found ${String(segmentTotal)}. An unexpected dependent row means ` +
        `the audited state has moved.`,
    );
  }

  if (input.slugClaimCount !== AUDITED_DEMO_PRODUCT_COUNT) {
    fail(
      `Expected ${String(AUDITED_DEMO_PRODUCT_COUNT)} trigger-managed slug claims for the ` +
        `demo Products; found ${String(input.slugClaimCount)}.`,
    );
  }

  return candidates.map((row) => row.id);
}
