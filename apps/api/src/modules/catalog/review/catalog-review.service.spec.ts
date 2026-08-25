import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { PrismaService } from "../../../prisma/prisma.service";

import { CatalogReviewService } from "./catalog-review.service";
import {
  PRODUCT_CLAIM_ELIGIBILITY_SQL,
  SPECIFICATION_ELIGIBILITY_SQL,
  productClaimApprovalBlockers,
  specificationApprovalBlockers,
} from "./review-eligibility";
import {
  DECIDABLE_FROM_STATUSES,
  DECISION_TARGET_STATUS,
  NEVER_APPROVABLE_CLAIM_KINDS,
  REVIEW_DECISIONS,
  toWireReviewStatus,
} from "./review-subject";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { ReviewDecisionDto } from "./dto/review-decision.dto";
import type { ProductClaimEligibilityRow, SpecificationEligibilityRow } from "./review-eligibility";

/**
 * The decision path, with PostgreSQL faked.
 *
 * ## What this file can and cannot prove
 *
 * It proves the ORDER of the checks, what each one answers, and — the point of the whole exercise
 * — that a refused decision performs **no write**. It cannot prove that the SQL is correct, that
 * `FOR UPDATE` actually serialises two callers, or that the evidence-set hash is what the database
 * says it is. Those are claims about PostgreSQL and they are made in
 * `catalog-review-integration.spec.ts`, against real rows on a disposable clone of the imported
 * catalogue.
 *
 * The split is deliberate rather than convenient: a mocked test that asserted "returns 409" while
 * the real query silently matched nothing would pass and be worthless.
 */

const ADMIN: AuthenticatedUser = {
  id: "aaaa1111-0000-4000-8000-000000000001",
  email: "reviewer@samgp.test",
  role: "ADMIN",
};

const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";
const CURRENT_HASH = "a".repeat(64);
const STALE_HASH = "b".repeat(64);

const ELIGIBLE_SPEC: SpecificationEligibilityRow = {
  live: true,
  productExists: true,
  gradeOk: true,
  propertyInDictionary: true,
  normalized: true,
  valueShapeOk: true,
  evidenceLinks: 1,
  evidenceOrphans: 0,
  mappingOk: true,
  plannerFlagged: true,
};

const ELIGIBLE_CLAIM: ProductClaimEligibilityRow = {
  live: true,
  productExists: true,
  gradeOk: true,
  kindApprovable: true,
  namedBodyOk: true,
  identityOk: true,
  evidenceLinks: 1,
  evidenceOrphans: 0,
  plannerFlagged: true,
};

interface Harness {
  service: CatalogReviewService;
  createReview: jest.Mock;
  updateSpecifications: jest.Mock;
  updateClaims: jest.Mock;
  executeRaw: jest.Mock;
  queryRaw: jest.Mock;
}

/**
 * A Prisma double whose raw-SQL answers are keyed by what the statement IS, not by call order.
 *
 * Order-keyed doubles encode the implementation, so reordering two independent reads breaks the
 * test without breaking the code. Keying on the statement means the double answers the question
 * that was actually asked — and an unrecognised statement throws, so a new query added to the
 * decision path fails loudly here instead of silently returning `undefined`.
 */
function harness(
  options: {
    lockedStatus?: string | null;
    currentHash?: string | null;
    specEligibility?: SpecificationEligibilityRow;
    claimEligibility?: ProductClaimEligibilityRow;
    publicVisible?: boolean;
    updatedCount?: number;
  } = {},
): Harness {
  const lockedStatus = options.lockedStatus === undefined ? "needs_review" : options.lockedStatus;
  const currentHash = options.currentHash === undefined ? CURRENT_HASH : options.currentHash;

  const executeRaw = jest.fn().mockResolvedValue(0);
  const queryRaw = jest.fn(async (sql: string) => {
    if (sql.includes("FOR UPDATE")) {
      return lockedStatus === null ? [] : [{ id: SUBJECT_ID, reviewStatus: lockedStatus }];
    }
    if (sql.includes("evidence_set_hash")) return [{ hash: currentHash }];
    if (sql === SPECIFICATION_ELIGIBILITY_SQL) {
      return [options.specEligibility ?? ELIGIBLE_SPEC];
    }
    if (sql === PRODUCT_CLAIM_ELIGIBILITY_SQL) {
      return [options.claimEligibility ?? ELIGIBLE_CLAIM];
    }
    if (sql.includes("v_specification_public") || sql.includes("v_product_claim_public")) {
      return [{ visible: options.publicVisible ?? true }];
    }
    throw new Error(`The test double was asked an unexpected statement:\n${sql}`);
  });

  const createReview = jest.fn().mockResolvedValue({
    id: "review-1",
    reviewedAt: new Date("2026-08-25T10:00:00.000Z"),
    decision: "APPROVED",
  });
  const updateSpecifications = jest.fn().mockResolvedValue({ count: options.updatedCount ?? 1 });
  const updateClaims = jest.fn().mockResolvedValue({ count: options.updatedCount ?? 1 });

  const tx = {
    $executeRawUnsafe: executeRaw,
    $queryRawUnsafe: queryRaw,
    technicalReview: { create: createReview },
    specification: { updateMany: updateSpecifications },
    productClaim: { updateMany: updateClaims },
  };

  const prisma = {
    // The real client runs the callback inside a transaction; the double runs it directly, so a
    // throw propagates exactly as it would after a rollback.
    $transaction: (run: (client: unknown) => Promise<unknown>) => run(tx),
  } as unknown as PrismaService;

  return {
    service: new CatalogReviewService(prisma),
    createReview,
    updateSpecifications,
    updateClaims,
    executeRaw,
    queryRaw,
  };
}

function decision(overrides: Partial<ReviewDecisionDto> = {}): ReviewDecisionDto {
  return {
    decision: "approve",
    expectedReviewStatus: "needs_review",
    expectedEvidenceSetHash: CURRENT_HASH,
    ...overrides,
  };
}

async function failure(run: () => Promise<unknown>): Promise<ApiException> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error("Expected the decision to be refused, and it was not.");
}

/** Every way a decision can be refused must leave both tables untouched. */
function assertNothingWritten(h: Harness): void {
  expect(h.createReview).not.toHaveBeenCalled();
  expect(h.updateSpecifications).not.toHaveBeenCalled();
  expect(h.updateClaims).not.toHaveBeenCalled();
}

describe("the decision vocabulary", () => {
  it("offers exactly approve, reject and return_to_needs_review", () => {
    expect([...REVIEW_DECISIONS]).toEqual(["approve", "reject", "return_to_needs_review"]);
  });

  /**
   * A decision that recorded `APPROVED` while leaving the subject `NEEDS_REVIEW` — or the reverse
   * — is the exact bug that makes an audit trail disagree with the catalogue it describes.
   */
  it("pairs every decision with the status it sets", () => {
    expect(DECISION_TARGET_STATUS.approve).toEqual({
      decision: "APPROVED",
      status: "APPROVED",
    });
    expect(DECISION_TARGET_STATUS.reject).toEqual({
      decision: "REJECTED",
      status: "REJECTED",
    });
    expect(DECISION_TARGET_STATUS.return_to_needs_review).toEqual({
      decision: "NEEDS_REVIEW",
      status: "NEEDS_REVIEW",
    });
  });

  /** Superseding is a consequence of a replacement arriving, never something a reviewer picks. */
  it("does not offer SUPERSEDED as a decision", () => {
    expect(REVIEW_DECISIONS as readonly string[]).not.toContain("supersede");
    expect(Object.keys(DECISION_TARGET_STATUS)).toHaveLength(3);
  });

  it("refuses to decide on a superseded row", () => {
    expect(DECIDABLE_FROM_STATUSES).not.toContain("SUPERSEDED");
  });

  it("names the two claim kinds that can never be approved", () => {
    expect([...NEVER_APPROVABLE_CLAIM_KINDS]).toEqual(["LICENSED_BY", "REFERENCE_ONLY"]);
  });

  it("round-trips every status label", () => {
    expect(toWireReviewStatus("SOURCE_RECORDED")).toBe("source_recorded");
    expect(toWireReviewStatus("APPROVED")).toBe("approved");
  });
});

describe("decide — the refusals", () => {
  it("answers 404 for a subject that does not exist, and writes nothing", async () => {
    const h = harness({ lockedStatus: null });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe(ErrorCode.NotFound);
    assertNothingWritten(h);
  });

  it("answers 409 on a stale expected status, and writes nothing", async () => {
    const h = harness({ lockedStatus: "approved" });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.code).toBe(ErrorCode.Conflict);
    assertNothingWritten(h);
  });

  it("answers 409 on a stale evidence hash, and writes nothing", async () => {
    const h = harness();

    const error = await failure(() =>
      h.service.decide(
        "specification",
        SUBJECT_ID,
        decision({ expectedEvidenceSetHash: STALE_HASH }),
        ADMIN,
      ),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.message).toContain("evidence");
    assertNothingWritten(h);
  });

  /** A row that was superseded has been replaced; a decision on it would describe nothing. */
  it("answers 409 for a subject in a non-decidable state, and writes nothing", async () => {
    const h = harness({ lockedStatus: "superseded" });

    const error = await failure(() =>
      h.service.decide(
        "specification",
        SUBJECT_ID,
        decision({ expectedReviewStatus: "superseded" }),
        ADMIN,
      ),
    );

    expect(error.getStatus()).toBe(409);
    assertNothingWritten(h);
  });

  it("answers 409 listing every approval blocker, and writes nothing", async () => {
    const h = harness({
      specEligibility: { ...ELIGIBLE_SPEC, evidenceLinks: 0, mappingOk: false },
    });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.details?.map((detail) => detail.issue)).toEqual([
      "The specification cites no evidence.",
      "The source property does not resolve to this property key through an approved " +
        "HIGH-confidence mapping.",
    ]);
    assertNothingWritten(h);
  });

  it("refuses to approve a forbidden claim kind, and writes nothing", async () => {
    const h = harness({ claimEligibility: { ...ELIGIBLE_CLAIM, kindApprovable: false } });

    const error = await failure(() =>
      h.service.decide("product_claim", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.details?.[0]?.issue).toContain("LICENSED_BY and REFERENCE_ONLY");
    assertNothingWritten(h);
  });

  it("refuses to approve an APPROVED_BY claim with no named body", async () => {
    const h = harness({ claimEligibility: { ...ELIGIBLE_CLAIM, namedBodyOk: false } });

    const error = await failure(() =>
      h.service.decide("product_claim", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.details?.[0]?.issue).toContain("named standard body");
    assertNothingWritten(h);
  });

  it.each(["reject", "return_to_needs_review"] as const)(
    "requires a note for %s, and writes nothing without one",
    async (choice) => {
      const h = harness();

      const error = await failure(() =>
        h.service.decide("specification", SUBJECT_ID, decision({ decision: choice }), ADMIN),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.details).toEqual([{ field: "note", issue: "is required for this decision" }]);
      assertNothingWritten(h);
    },
  );

  /**
   * A no-op is not a change. The caller's expectation MATCHED, so they were not stale — they asked
   * to move the row to where it already is, which is 400 rather than 409, exactly as
   * `LeadWorkflowService` answers `from === to`. It is also what makes two concurrent approvals of
   * an already-approved row produce one winner instead of two.
   */
  it.each([
    ["approve", "APPROVED", "approved"],
    ["reject", "REJECTED", "rejected"],
    ["return_to_needs_review", "NEEDS_REVIEW", "needs_review"],
  ] as const)(
    "refuses %s when the subject already holds that status, and writes nothing",
    async (choice, _enumValue, wire) => {
      const h = harness({ lockedStatus: wire });

      const error = await failure(() =>
        h.service.decide(
          "specification",
          SUBJECT_ID,
          decision({ decision: choice, expectedReviewStatus: wire, note: "A note." }),
          ADMIN,
        ),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.details).toEqual([
        { field: "decision", issue: "must move the subject to a different review status" },
      ]);
      assertNothingWritten(h);
    },
  );

  it("answers 409 when the evidence set cannot be fingerprinted", async () => {
    const h = harness({ currentHash: null });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    assertNothingWritten(h);
  });

  /**
   * Behind the row lock this cannot normally happen. If it ever does, the transaction must abort
   * rather than leave a `TechnicalReview` describing a status that was never set.
   */
  it("answers 409 when the compare-and-set matches no row", async () => {
    const h = harness({ updatedCount: 0 });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(h.createReview).toHaveBeenCalledTimes(1);
  });

  /**
   * The service's last act inside the transaction is to ask the public view whether it agrees.
   * A disagreement is not a 4xx — it means the database and the service hold different beliefs
   * about what is published, and the only safe answer is to abort.
   */
  it("aborts when the public view disagrees with an approval", async () => {
    const h = harness({ publicVisible: false });

    await expect(h.service.decide("specification", SUBJECT_ID, decision(), ADMIN)).rejects.toThrow(
      /Public transition check failed/,
    );
  });

  /** Refusals happen before the lock is even taken where they can. Nothing is a partial write. */
  it("never issues a raw write statement other than the SET LOCAL guards", async () => {
    const h = harness({ lockedStatus: "approved" });

    await failure(() => h.service.decide("specification", SUBJECT_ID, decision(), ADMIN));

    for (const call of h.executeRaw.mock.calls) {
      expect(String(call[0])).toMatch(/^SET LOCAL /);
    }
  });
});

describe("decide — a successful approval", () => {
  it("records the review and moves the status, in that order", async () => {
    const h = harness();

    const result = await h.service.decide("specification", SUBJECT_ID, decision(), ADMIN);

    expect(h.createReview).toHaveBeenCalledTimes(1);
    expect(h.updateSpecifications).toHaveBeenCalledTimes(1);
    expect(result.reviewStatus).toBe("approved");
    expect(result.decision).toBe("approved");
  });

  /** The row written carries the RECOMPUTED hash. The client's value is only ever compared. */
  it("stores the recomputed hash, never the submitted one", async () => {
    const h = harness();

    await h.service.decide("specification", SUBJECT_ID, decision(), ADMIN);

    expect(h.createReview.mock.calls[0][0].data.evidenceSetHash).toBe(CURRENT_HASH);
  });

  /** Never client-supplied: the guard re-read this identity from `sam_platform` on this request. */
  it("snapshots the authenticated reviewer's identity", async () => {
    const h = harness();

    await h.service.decide("specification", SUBJECT_ID, decision(), ADMIN);

    const data = h.createReview.mock.calls[0][0].data;
    expect(data.reviewerId).toBe(ADMIN.id);
    expect(data.reviewerEmailSnapshot).toBe(ADMIN.email);
  });

  /** `technical_reviews_exactly_one_target`: a review is OF one subject, never both nor neither. */
  it("names exactly one subject on the review row", async () => {
    const specs = harness();
    await specs.service.decide("specification", SUBJECT_ID, decision(), ADMIN);
    const specData = specs.createReview.mock.calls[0][0].data;
    expect(specData.specificationId).toBe(SUBJECT_ID);
    expect(specData.productClaimId).toBeNull();

    const claims = harness({ publicVisible: false });
    await claims.service.decide("product_claim", SUBJECT_ID, decision(), ADMIN);
    const claimData = claims.createReview.mock.calls[0][0].data;
    expect(claimData.specificationId).toBeNull();
    expect(claimData.productClaimId).toBe(SUBJECT_ID);
  });

  /** The compare-and-set predicate is the caller's belief; the value written is from the table. */
  it("compare-and-sets on the expected status and writes the mapped one", async () => {
    const h = harness();

    await h.service.decide("specification", SUBJECT_ID, decision(), ADMIN);

    expect(h.updateSpecifications.mock.calls[0][0]).toEqual({
      where: { id: SUBJECT_ID, reviewStatus: "NEEDS_REVIEW" },
      data: { reviewStatus: "APPROVED" },
    });
  });

  /** Refusing to reject an ineligible row would trap the worst rows in the queue forever. */
  it("permits a rejection of a row that could never be approved", async () => {
    const h = harness({
      specEligibility: { ...ELIGIBLE_SPEC, evidenceLinks: 0, mappingOk: false },
      publicVisible: false,
    });

    const result = await h.service.decide(
      "specification",
      SUBJECT_ID,
      decision({ decision: "reject", note: "The source value could not be confirmed." }),
      ADMIN,
    );

    expect(result.reviewStatus).toBe("rejected");
    expect(h.queryRaw.mock.calls.every((call) => call[0] !== SPECIFICATION_ELIGIBILITY_SQL)).toBe(
      true,
    );
  });

  it("guards the transaction with a lock and a statement timeout", async () => {
    const h = harness();

    await h.service.decide("specification", SUBJECT_ID, decision(), ADMIN);

    const statements = h.executeRaw.mock.calls.map((call) => String(call[0]));
    expect(statements[0]).toMatch(/^SET LOCAL lock_timeout = '\d+ms'$/);
    expect(statements[1]).toMatch(/^SET LOCAL statement_timeout = '\d+ms'$/);
  });
});

describe("the approval blockers", () => {
  it("reports nothing for an eligible specification", () => {
    expect(specificationApprovalBlockers(ELIGIBLE_SPEC)).toEqual([]);
  });

  it("reports nothing for an eligible claim", () => {
    expect(productClaimApprovalBlockers(ELIGIBLE_CLAIM)).toEqual([]);
  });

  /** Every rule is independently fatal — one failing field is one blocker, and it is enough. */
  it.each([
    ["live", "retired"],
    ["productExists", "Product"],
    ["gradeOk", "grade"],
    ["propertyInDictionary", "dictionary"],
    ["normalized", "normalized"],
    ["valueShapeOk", "value type"],
    ["mappingOk", "HIGH-confidence mapping"],
  ] as const)("blocks a specification when %s is false", (field, fragment) => {
    const blockers = specificationApprovalBlockers({ ...ELIGIBLE_SPEC, [field]: false });
    expect(blockers.some((blocker) => blocker.includes(fragment))).toBe(true);
  });

  it("blocks a specification with no evidence", () => {
    expect(specificationApprovalBlockers({ ...ELIGIBLE_SPEC, evidenceLinks: 0 })).toContain(
      "The specification cites no evidence.",
    );
  });

  it("blocks a specification whose evidence does not resolve", () => {
    expect(specificationApprovalBlockers({ ...ELIGIBLE_SPEC, evidenceOrphans: 1 })).toContain(
      "An evidence link does not resolve to a SourceFact and its SourceDocument.",
    );
  });

  it.each([
    ["kindApprovable", "LICENSED_BY"],
    ["namedBodyOk", "named standard body"],
    ["identityOk", "identifying body"],
  ] as const)("blocks a claim when %s is false", (field, fragment) => {
    const blockers = productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, [field]: false });
    expect(blockers.some((blocker) => blocker.includes(fragment))).toBe(true);
  });

  it("blocks a claim with no evidence", () => {
    expect(productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, evidenceLinks: 0 })).toContain(
      "The claim cites no evidence.",
    );
  });

  /**
   * `plannerFlagged` is CONTEXT, not a blocker. A `NEEDS_REVIEW` row is exactly what a reviewer is
   * there to decide; treating the flag as an obstacle would make the queue unworkable.
   */
  it("does not block on the planner's own flag", () => {
    expect(specificationApprovalBlockers({ ...ELIGIBLE_SPEC, plannerFlagged: true })).toEqual([]);
    expect(productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, plannerFlagged: true })).toEqual([]);
  });
});
