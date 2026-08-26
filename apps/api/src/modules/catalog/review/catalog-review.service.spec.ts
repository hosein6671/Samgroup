import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { PrismaService } from "../../../prisma/prisma.service";

import { CatalogReviewService } from "./catalog-review.service";
import {
  PRODUCT_CLAIM_ELIGIBILITY_SQL,
  REVIEW_BLOCKER_CODES,
  REVIEW_WARNING_CODES,
  SPECIFICATION_ELIGIBILITY_SQL,
  productClaimApprovalBlockers,
  productClaimApprovalWarnings,
  specificationApprovalBlockers,
  specificationApprovalWarnings,
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
import type {
  ProductClaimEligibilityRow,
  ReviewBlocker,
  ReviewBlockerCode,
  ReviewWarning,
  ReviewWarningCode,
  SpecificationEligibilityRow,
} from "./review-eligibility";

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

/**
 * A Specification that passes every rule.
 *
 * `methodRequirement: "required"` with a normalized method that IS evidenced is the realistic
 * baseline — 1,367 of the 1,398 live Specifications sit on a required-method property — so a rule
 * that fired on the common shape would be caught here rather than only in the integration suite.
 */
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
  methodRequirement: "required",
  normalizedMethodPresent: true,
  rawMethodPresent: true,
  sourceCaptured: true,
  documentDateUnknown: false,
  documentRevisionUnknown: false,
};

const ELIGIBLE_CLAIM: ProductClaimEligibilityRow = {
  live: true,
  productExists: true,
  gradeOk: true,
  kindApprovable: true,
  namedBodyOk: true,
  identityOk: true,
  sourceCaptured: true,
  documentDateUnknown: false,
  documentRevisionUnknown: false,
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
    // The two subject-specific v2 hash functions (ADR-017). Matched on `review_hash_v2` rather
    // than on the old `evidence_set_hash` substring, which named the v1 functions the migration
    // dropped — a double that still answered to the old name would keep passing against a
    // function that no longer exists.
    if (sql.includes("review_hash_v2")) return [{ hash: currentHash }];
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

  /**
   * The refusal carries the STABLE CODES, and that is what makes the boundary real.
   *
   * A caller reaching `decide` directly — a script, a second tab, a retry — rendered no page and
   * knows none of the UI's wording. What it gets back is the same closed vocabulary the UI renders,
   * so the enforcement lives here and the wording is only a rendering of it.
   */
  it("answers 409 carrying the stable blocker code for every refusal", async () => {
    const h = harness({
      specEligibility: { ...ELIGIBLE_SPEC, evidenceLinks: 0, mappingOk: false },
    });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.details?.map((detail) => detail.code)).toEqual([
      "EVIDENCE_ABSENT",
      "PROPERTY_MAPPING_UNRESOLVED",
    ]);
    for (const detail of error.details ?? []) {
      expect(detail.field).toBe("decision");
      expect(REVIEW_BLOCKER_CODES).toContain(detail.code as ReviewBlockerCode);
    }
    assertNothingWritten(h);
  });

  /** The two new fail-closed rules refuse a DIRECT request, not only a rendered one. */
  it.each([
    [
      "a required method that is absent",
      { methodRequirement: "required" as const, normalizedMethodPresent: false },
      "REQUIRED_METHOD_ABSENT",
    ],
    [
      "a normalized method no evidence states",
      { normalizedMethodPresent: true, rawMethodPresent: false },
      "METHOD_NOT_EVIDENCED",
    ],
    ["an uncaptured source", { sourceCaptured: false }, "SOURCE_ASSET_ABSENT"],
  ])("answers 409 with %s, and writes nothing", async (_label, overrides, code) => {
    const h = harness({ specEligibility: { ...ELIGIBLE_SPEC, ...overrides } });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.code).toBe(ErrorCode.Conflict);
    expect(error.details?.map((detail) => detail.code)).toContain(code);
    assertNothingWritten(h);
  });

  /** The same rule on a claim, which has no method rules but the same capture rule. */
  it("answers 409 for a claim whose source is uncaptured, and writes nothing", async () => {
    const h = harness({ claimEligibility: { ...ELIGIBLE_CLAIM, sourceCaptured: false } });

    const error = await failure(() =>
      h.service.decide("product_claim", SUBJECT_ID, decision(), ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(error.details?.map((detail) => detail.code)).toEqual(["SOURCE_ASSET_ABSENT"]);
    assertNothingWritten(h);
  });

  /**
   * A refusal never names a source.
   *
   * `SOURCE_ASSET_ABSENT` is the blocker most likely to want to be helpful about WHICH document is
   * uncaptured, and it must not be. The whole serialized refusal is checked, not only the message.
   */
  it("leaks no locator, URL or asset hash in a refusal", async () => {
    const h = harness({ specEligibility: { ...ELIGIBLE_SPEC, sourceCaptured: false } });

    const error = await failure(() =>
      h.service.decide("specification", SUBJECT_ID, decision(), ADMIN),
    );
    const serialized = JSON.stringify({ message: error.message, details: error.details });

    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/locatorValue|locator_value/);
    expect(serialized).not.toMatch(/\.(pdf|xlsx|xls|docx?|csv)\b/i);
    expect(serialized).not.toMatch(/[0-9a-f]{64}/);
  });

  /**
   * Warnings are not blockers, and the decision path never consults them.
   *
   * A subject carrying all three warnings and no blocker is approved normally. That is the whole
   * reason the two channels are separate: 69 of 69 documents carry both metadata warnings.
   */
  it("approves a subject that carries warnings but no blocker", async () => {
    const h = harness({
      specEligibility: {
        ...ELIGIBLE_SPEC,
        methodRequirement: "not_applicable",
        documentDateUnknown: true,
        documentRevisionUnknown: true,
      },
    });

    const result = await h.service.decide("specification", SUBJECT_ID, decision(), ADMIN);

    expect(result.reviewStatus).toBe("approved");
    expect(h.createReview).toHaveBeenCalledTimes(1);
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

/* ========================================================================== */
/*  Blockers — the structured, coded contract                                  */
/* ========================================================================== */

/** The codes a builder emitted, in order. Order is part of the contract; content is asserted too. */
function codesOf(blockers: readonly ReviewBlocker[]): ReviewBlockerCode[] {
  return blockers.map(({ code }) => code);
}

function warningCodesOf(warnings: readonly ReviewWarning[]): ReviewWarningCode[] {
  return warnings.map(({ code }) => code);
}

describe("the approval blockers", () => {
  it("reports nothing for an eligible specification", () => {
    expect(specificationApprovalBlockers(ELIGIBLE_SPEC)).toEqual([]);
  });

  it("reports nothing for an eligible claim", () => {
    expect(productClaimApprovalBlockers(ELIGIBLE_CLAIM)).toEqual([]);
  });

  /**
   * Every rule is independently fatal, and every one of them now carries a STABLE CODE.
   *
   * The pairs below are the one-to-one mapping from the sentences these replaced — the codes are
   * the contract and the fragments prove the wording still says the same thing, so a rename of one
   * cannot silently change the other.
   */
  it.each([
    ["live", "SUBJECT_RETIRED", "retired"],
    ["productExists", "PRODUCT_UNRESOLVED", "does not resolve to a Product"],
    ["gradeOk", "GRADE_NOT_OF_PRODUCT", "does not belong to this Product"],
    ["propertyInDictionary", "PROPERTY_NOT_IN_DICTIONARY", "controlled dictionary"],
    ["normalized", "SPECIFICATION_NOT_NORMALIZED", "not normalized"],
    ["valueShapeOk", "VALUE_SHAPE_MISMATCH", "declared value type"],
    ["mappingOk", "PROPERTY_MAPPING_UNRESOLVED", "HIGH-confidence mapping"],
  ] as const)("blocks a specification when %s is false, as %s", (field, code, fragment) => {
    const blockers = specificationApprovalBlockers({ ...ELIGIBLE_SPEC, [field]: false });
    const found = blockers.find((entry) => entry.code === code);

    expect(found).toBeDefined();
    expect(found?.message).toContain(fragment);
  });

  it("blocks a specification with no evidence, as EVIDENCE_ABSENT", () => {
    const blockers = specificationApprovalBlockers({ ...ELIGIBLE_SPEC, evidenceLinks: 0 });

    expect(blockers).toContainEqual({
      code: "EVIDENCE_ABSENT",
      message: "The specification cites no evidence.",
    });
  });

  it("blocks a specification whose evidence does not resolve, as EVIDENCE_LINK_UNRESOLVED", () => {
    const blockers = specificationApprovalBlockers({ ...ELIGIBLE_SPEC, evidenceOrphans: 1 });

    expect(blockers).toContainEqual({
      code: "EVIDENCE_LINK_UNRESOLVED",
      message: "An evidence link does not resolve to a SourceFact and its SourceDocument.",
    });
  });

  it.each([
    ["kindApprovable", "CLAIM_KIND_NEVER_APPROVABLE", "LICENSED_BY"],
    ["namedBodyOk", "NAMED_BODY_ABSENT", "named standard body"],
    ["identityOk", "CLAIM_IDENTITY_ABSENT", "identifying body"],
  ] as const)("blocks a claim when %s is false, as %s", (field, code, fragment) => {
    const blockers = productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, [field]: false });
    const found = blockers.find((entry) => entry.code === code);

    expect(found).toBeDefined();
    expect(found?.message).toContain(fragment);
  });

  it("blocks a claim with no evidence, as EVIDENCE_ABSENT", () => {
    const blockers = productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, evidenceLinks: 0 });

    expect(blockers).toContainEqual({
      code: "EVIDENCE_ABSENT",
      message: "The claim cites no evidence.",
    });
  });

  /**
   * `plannerFlagged` is CONTEXT, not a blocker. A `NEEDS_REVIEW` row is exactly what a reviewer is
   * there to decide; treating the flag as an obstacle would make the queue unworkable.
   */
  it("does not block on the planner's own flag", () => {
    expect(specificationApprovalBlockers({ ...ELIGIBLE_SPEC, plannerFlagged: true })).toEqual([]);
    expect(productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, plannerFlagged: true })).toEqual([]);
  });

  /**
   * The contract itself: nothing is a bare string any more.
   *
   * The gate's requirement was to convert EVERY existing blocker to a code and leave no mixture of
   * the two. This asserts the absence of the mixture directly, over a row that fails every rule at
   * once, rather than trusting that the previous cases covered them all.
   */
  it("emits no bare string and no unknown code, on either subject type", () => {
    const specBlockers = specificationApprovalBlockers({
      live: false,
      productExists: false,
      gradeOk: false,
      propertyInDictionary: false,
      normalized: false,
      valueShapeOk: false,
      evidenceLinks: 1,
      evidenceOrphans: 1,
      mappingOk: false,
      plannerFlagged: true,
      methodRequirement: "required",
      normalizedMethodPresent: false,
      rawMethodPresent: false,
      sourceCaptured: false,
      documentDateUnknown: true,
      documentRevisionUnknown: true,
    });
    const claimBlockers = productClaimApprovalBlockers({
      live: false,
      productExists: false,
      gradeOk: false,
      kindApprovable: false,
      namedBodyOk: false,
      identityOk: false,
      evidenceLinks: 1,
      evidenceOrphans: 1,
      plannerFlagged: true,
      sourceCaptured: false,
      documentDateUnknown: true,
      documentRevisionUnknown: true,
    });

    for (const entry of [...specBlockers, ...claimBlockers]) {
      expect(typeof entry).toBe("object");
      expect(REVIEW_BLOCKER_CODES).toContain(entry.code);
      expect(entry.message.length).toBeGreaterThan(0);
    }

    /* Every specification rule fires at once, and each fires exactly once. */
    expect(codesOf(specBlockers)).toEqual([
      "SUBJECT_RETIRED",
      "PRODUCT_UNRESOLVED",
      "GRADE_NOT_OF_PRODUCT",
      "SPECIFICATION_NOT_NORMALIZED",
      "PROPERTY_NOT_IN_DICTIONARY",
      "VALUE_SHAPE_MISMATCH",
      "EVIDENCE_LINK_UNRESOLVED",
      "PROPERTY_MAPPING_UNRESOLVED",
      "REQUIRED_METHOD_ABSENT",
      "SOURCE_ASSET_ABSENT",
    ]);
    expect(codesOf(claimBlockers)).toEqual([
      "SUBJECT_RETIRED",
      "PRODUCT_UNRESOLVED",
      "GRADE_NOT_OF_PRODUCT",
      "CLAIM_KIND_NEVER_APPROVABLE",
      "NAMED_BODY_ABSENT",
      "CLAIM_IDENTITY_ABSENT",
      "EVIDENCE_LINK_UNRESOLVED",
      "SOURCE_ASSET_ABSENT",
    ]);
  });
});

/* ========================================================================== */
/*  The required-method rules                                                  */
/* ========================================================================== */

describe("the required-method rules", () => {
  /** Rule 1, with no raw method either. */
  it("blocks a required-method property that records no method", () => {
    const blockers = specificationApprovalBlockers({
      ...ELIGIBLE_SPEC,
      methodRequirement: "required",
      normalizedMethodPresent: false,
      rawMethodPresent: false,
    });

    expect(codesOf(blockers)).toEqual(["REQUIRED_METHOD_ABSENT"]);
  });

  /**
   * Rule 1 again, with a raw method PRESENT.
   *
   * The ratified rule applies "whether raw method is present or absent": a method the source stated
   * but that this platform never normalized is not a recorded method, and approving would publish
   * a required-method property with nothing in its method column.
   */
  it("blocks a required-method property with no normalized method even when the source stated one", () => {
    const blockers = specificationApprovalBlockers({
      ...ELIGIBLE_SPEC,
      methodRequirement: "required",
      normalizedMethodPresent: false,
      rawMethodPresent: true,
    });

    expect(codesOf(blockers)).toEqual(["REQUIRED_METHOD_ABSENT"]);
  });

  /**
   * Rule 2 — the guarded fabrication shape.
   *
   * A normalized method no current evidence carries is a value this platform produced rather than
   * read. The live count is zero and the rule exists to keep it zero.
   */
  it("blocks a normalized method that no evidence states", () => {
    const blockers = specificationApprovalBlockers({
      ...ELIGIBLE_SPEC,
      normalizedMethodPresent: true,
      rawMethodPresent: false,
    });

    expect(codesOf(blockers)).toEqual(["METHOD_NOT_EVIDENCED"]);
  });

  /** Rule 2 applies regardless of the requirement, including where it is OPTIONAL. */
  it.each(["required", "optional", "not_applicable"] as const)(
    "blocks an unevidenced method when the requirement is %s",
    (methodRequirement) => {
      const blockers = specificationApprovalBlockers({
        ...ELIGIBLE_SPEC,
        methodRequirement,
        normalizedMethodPresent: true,
        rawMethodPresent: false,
      });

      expect(codesOf(blockers)).toContain("METHOD_NOT_EVIDENCED");
    },
  );

  /** Rule 3 — optional and absent is simply fine. No blocker, and no warning either. */
  it("permits an optional method that is absent, with no warning", () => {
    const row: SpecificationEligibilityRow = {
      ...ELIGIBLE_SPEC,
      methodRequirement: "optional",
      normalizedMethodPresent: false,
      rawMethodPresent: false,
    };

    expect(specificationApprovalBlockers(row)).toEqual([]);
    expect(specificationApprovalWarnings(row)).toEqual([]);
  });

  /** Rule 4 — a warning, and the subject stays eligible. */
  it("warns, without blocking, when a not-applicable property carries a method", () => {
    const row: SpecificationEligibilityRow = {
      ...ELIGIBLE_SPEC,
      methodRequirement: "not_applicable",
      normalizedMethodPresent: true,
      rawMethodPresent: true,
    };

    expect(specificationApprovalBlockers(row)).toEqual([]);
    expect(warningCodesOf(specificationApprovalWarnings(row))).toEqual([
      "METHOD_NOT_APPLICABLE_BUT_PRESENT",
    ]);
  });

  /**
   * An unresolved dictionary record does not fire a method rule, and does not need to.
   *
   * `PROPERTY_NOT_IN_DICTIONARY` already blocks such a row, so eligibility is false either way —
   * and inferring `required` from a missing record would be inventing a dictionary entry.
   */
  it("infers no method requirement from a missing dictionary record", () => {
    const blockers = specificationApprovalBlockers({
      ...ELIGIBLE_SPEC,
      propertyInDictionary: false,
      methodRequirement: null,
      normalizedMethodPresent: false,
      rawMethodPresent: false,
    });

    expect(codesOf(blockers)).toEqual(["PROPERTY_NOT_IN_DICTIONARY"]);
    expect(blockers.length).toBeGreaterThan(0);
  });

  /** A claim cannot receive either method blocker: its row shape carries neither fact. */
  it("never applies a method rule to a claim", () => {
    const blockers = productClaimApprovalBlockers({ ...ELIGIBLE_CLAIM, evidenceOrphans: 1 });

    expect(codesOf(blockers)).not.toContain("REQUIRED_METHOD_ABSENT");
    expect(codesOf(blockers)).not.toContain("METHOD_NOT_EVIDENCED");
  });
});

/* ========================================================================== */
/*  The captured-source rule                                                   */
/* ========================================================================== */

describe("the captured-source rule", () => {
  it.each([
    ["a specification", specificationApprovalBlockers, ELIGIBLE_SPEC],
    ["a claim", productClaimApprovalBlockers, ELIGIBLE_CLAIM],
  ] as const)("blocks %s whose cited source has no captured asset", (_label, build, eligible) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- one call over two row shapes
    const blockers = (build as (row: any) => ReviewBlocker[])({
      ...eligible,
      sourceCaptured: false,
    });

    expect(codesOf(blockers)).toEqual(["SOURCE_ASSET_ABSENT"]);
  });

  /** An uploaded workbook backed by a real captured asset remains acceptable. */
  it.each([
    ["a specification", specificationApprovalBlockers, ELIGIBLE_SPEC],
    ["a claim", productClaimApprovalBlockers, ELIGIBLE_CLAIM],
  ] as const)("permits %s whose source is captured", (_label, build, eligible) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- one call over two row shapes
    expect((build as (row: any) => ReviewBlocker[])(eligible)).toEqual([]);
  });

  /**
   * Manual transcription is judged on capture and on nothing else.
   *
   * The extraction method is not an input to this rule at all — `SOURCE_ASSET_ABSENT` fires when
   * the bytes behind the evidence are uncaptured, whether they were read by a spreadsheet parser,
   * an OCR pass or a person. A transcription whose source IS captured is acceptable, and one whose
   * source is not gets exactly ONE blocker rather than a second duplicate describing the same
   * condition from the transcription's side.
   */
  it("emits exactly one blocker for an uncaptured manual transcription", () => {
    const blockers = specificationApprovalBlockers({ ...ELIGIBLE_SPEC, sourceCaptured: false });

    expect(blockers).toHaveLength(1);
    expect(blockers[0]?.code).toBe("SOURCE_ASSET_ABSENT");
  });

  /** No locator, no URL, no file name, no title, no hash — the message names the rule only. */
  it("leaks no locator or provenance in the blocker message", () => {
    const message =
      specificationApprovalBlockers({ ...ELIGIBLE_SPEC, sourceCaptured: false })[0]?.message ?? "";

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toMatch(/https?:\/\//);
    expect(message).not.toMatch(/\.(pdf|xlsx|xls|docx?|csv)\b/i);
    expect(message).not.toMatch(/[0-9a-f]{64}/);
    expect(message).not.toMatch(/locator/i);
  });

  /**
   * A subject citing nothing gets `EVIDENCE_ABSENT` alone.
   *
   * Two blockers for one absence would double-count it, and `SOURCE_ASSET_ABSENT` would be saying
   * something untrue: there is no uncaptured source, there is no source.
   */
  it("does not add a capture blocker to a subject that cites no evidence", () => {
    const blockers = specificationApprovalBlockers({
      ...ELIGIBLE_SPEC,
      evidenceLinks: 0,
      sourceCaptured: false,
    });

    expect(codesOf(blockers)).toEqual(["EVIDENCE_ABSENT"]);
  });

  /**
   * …but a subject whose links are ALL superseded is still blocked.
   *
   * `evidenceLinks` counts every link, so this row has evidence; the CURRENT set is empty, and the
   * SQL coalesces `bool_and` over an empty set to false. Fail closed.
   */
  it("blocks a subject whose only evidence is superseded", () => {
    const blockers = specificationApprovalBlockers({
      ...ELIGIBLE_SPEC,
      evidenceLinks: 2,
      sourceCaptured: false,
      rawMethodPresent: false,
      normalizedMethodPresent: false,
      methodRequirement: "optional",
    });

    expect(codesOf(blockers)).toEqual(["SOURCE_ASSET_ABSENT"]);
  });
});

/* ========================================================================== */
/*  Warnings                                                                   */
/* ========================================================================== */

describe("the document-metadata warnings", () => {
  it("warns when a cited document records no date", () => {
    const row: SpecificationEligibilityRow = { ...ELIGIBLE_SPEC, documentDateUnknown: true };

    expect(warningCodesOf(specificationApprovalWarnings(row))).toEqual(["DOCUMENT_DATE_UNKNOWN"]);
  });

  it("warns when a cited document records no revision label", () => {
    const row: SpecificationEligibilityRow = { ...ELIGIBLE_SPEC, documentRevisionUnknown: true };

    expect(warningCodesOf(specificationApprovalWarnings(row))).toEqual([
      "DOCUMENT_REVISION_UNKNOWN",
    ]);
  });

  it("warns on both axes for a claim as well", () => {
    const row: ProductClaimEligibilityRow = {
      ...ELIGIBLE_CLAIM,
      documentDateUnknown: true,
      documentRevisionUnknown: true,
    };

    expect(warningCodesOf(productClaimApprovalWarnings(row))).toEqual([
      "DOCUMENT_DATE_UNKNOWN",
      "DOCUMENT_REVISION_UNKNOWN",
    ]);
  });

  /**
   * The load-bearing property of the whole warning channel.
   *
   * Every one of the 69 source documents in the catalogue is missing both fields, so if either
   * could make a subject ineligible the entire queue would be frozen on a metadata gap that says
   * nothing about whether the recorded value is right.
   */
  it("never makes an otherwise eligible subject ineligible", () => {
    const spec: SpecificationEligibilityRow = {
      ...ELIGIBLE_SPEC,
      methodRequirement: "not_applicable",
      documentDateUnknown: true,
      documentRevisionUnknown: true,
    };
    const claim: ProductClaimEligibilityRow = {
      ...ELIGIBLE_CLAIM,
      documentDateUnknown: true,
      documentRevisionUnknown: true,
    };

    expect(specificationApprovalWarnings(spec)).toHaveLength(3);
    expect(specificationApprovalBlockers(spec)).toEqual([]);

    expect(productClaimApprovalWarnings(claim)).toHaveLength(2);
    expect(productClaimApprovalBlockers(claim)).toEqual([]);
  });

  it("emits only known warning codes, and no bare string", () => {
    const warnings = specificationApprovalWarnings({
      ...ELIGIBLE_SPEC,
      methodRequirement: "not_applicable",
      documentDateUnknown: true,
      documentRevisionUnknown: true,
    });

    for (const entry of warnings) {
      expect(typeof entry).toBe("object");
      expect(REVIEW_WARNING_CODES).toContain(entry.code);
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });

  /** A warning is never a blocker, on either subject type, whatever else is true of the row. */
  it("shares no code with the blocker vocabulary", () => {
    for (const code of REVIEW_WARNING_CODES) {
      expect(REVIEW_BLOCKER_CODES).not.toContain(code as unknown as ReviewBlockerCode);
    }
  });
});
