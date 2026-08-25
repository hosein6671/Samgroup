import {
  ProductClaimKind,
  TechnicalReviewDecision,
  TechnicalReviewStatus,
} from "../../../prisma/generated/enums";

/**
 * The review vocabulary, as it appears on the wire.
 *
 * ── Physical enum labels, following the platform precedent ──────────────────
 *
 * `schema.prisma` maps every member of `technical_review_status`,
 * `technical_review_decision` and `product_claim_kind` to a lowercase label, and the generated
 * client's constant carries the MEMBER NAME rather than that label. The wire vocabulary is the
 * label — the same choice `user-role.ts` makes for `UserRole` and `create-inquiry.dto.ts` makes
 * for `inquiryType`, and for the same reason: a display form belongs to a translation catalog,
 * and the physical label is the stable transport value.
 *
 * ── Two enums that look like one ────────────────────────────────────────────
 *
 * `TechnicalReviewStatus` is what a row IS. `TechnicalReviewDecision` is what a reviewer DID.
 * They overlap in three labels and differ in one that matters: `source_recorded` exists only as
 * a status, because it is the state before any human decision and can therefore never be the
 * outcome of one. Nothing here maps between them implicitly — `DECISION_TARGET_STATUS` below is
 * the one place the correspondence is written down.
 */

/** Which table a review subject lives in. There is no third kind and none may be added here. */
export const REVIEW_SUBJECT_TYPES = ["specification", "product_claim"] as const;

export type ReviewSubjectType = (typeof REVIEW_SUBJECT_TYPES)[number];

/** The review statuses, on the wire. */
export const REVIEW_STATUS_WIRE_VALUE: Readonly<Record<TechnicalReviewStatus, string>> = {
  [TechnicalReviewStatus.SOURCE_RECORDED]: "source_recorded",
  [TechnicalReviewStatus.NEEDS_REVIEW]: "needs_review",
  [TechnicalReviewStatus.APPROVED]: "approved",
  [TechnicalReviewStatus.REJECTED]: "rejected",
  [TechnicalReviewStatus.SUPERSEDED]: "superseded",
};

export const REVIEW_STATUSES = Object.values(REVIEW_STATUS_WIRE_VALUE);

export function toWireReviewStatus(status: TechnicalReviewStatus): string {
  return REVIEW_STATUS_WIRE_VALUE[status];
}

const REVIEW_STATUS_BY_WIRE: ReadonlyMap<string, TechnicalReviewStatus> = new Map(
  (Object.entries(REVIEW_STATUS_WIRE_VALUE) as [TechnicalReviewStatus, string][]).map(
    ([status, wire]) => [wire, status],
  ),
);

/** `undefined` for a value outside the vocabulary; callers validate before calling. */
export function fromWireReviewStatus(wire: string): TechnicalReviewStatus | undefined {
  return REVIEW_STATUS_BY_WIRE.get(wire);
}

/**
 * The decisions this API accepts, and the only three it will ever accept.
 *
 * `SUPERSEDED` is a member of `TechnicalReviewDecision` and is deliberately NOT offered here.
 * Superseding is what happens when a LATER fact replaces an earlier one — it is a consequence of
 * a new import or a correction, not something a reviewer chooses while looking at one row. An
 * endpoint that let a person mark a row superseded with no replacement in hand would produce a
 * retired fact that nothing replaces, which is a data-loss shape rather than a review outcome.
 *
 * `RETURN_TO_NEEDS_REVIEW` is the wire spelling of `TechnicalReviewDecision.NEEDS_REVIEW`. The
 * decision enum's own label reads as a status ("this row needs review"); the wire name says what
 * the reviewer is doing ("send it back"), which is the thing a client is choosing.
 */
export const REVIEW_DECISIONS = ["approve", "reject", "return_to_needs_review"] as const;

export type ReviewDecisionInput = (typeof REVIEW_DECISIONS)[number];

/**
 * What each decision records, and what it moves the subject to.
 *
 * The two halves are stated together in one table on purpose: an approval that wrote decision
 * `APPROVED` while leaving the subject `NEEDS_REVIEW` — or the reverse — is the exact class of
 * bug that makes an audit trail disagree with the catalogue it describes.
 */
export const DECISION_TARGET_STATUS: Readonly<
  Record<ReviewDecisionInput, { decision: TechnicalReviewDecision; status: TechnicalReviewStatus }>
> = {
  approve: {
    decision: TechnicalReviewDecision.APPROVED,
    status: TechnicalReviewStatus.APPROVED,
  },
  reject: {
    decision: TechnicalReviewDecision.REJECTED,
    status: TechnicalReviewStatus.REJECTED,
  },
  return_to_needs_review: {
    decision: TechnicalReviewDecision.NEEDS_REVIEW,
    status: TechnicalReviewStatus.NEEDS_REVIEW,
  },
};

export const DECISION_WIRE_VALUE: Readonly<Record<TechnicalReviewDecision, string>> = {
  [TechnicalReviewDecision.APPROVED]: "approved",
  [TechnicalReviewDecision.REJECTED]: "rejected",
  [TechnicalReviewDecision.NEEDS_REVIEW]: "needs_review",
  [TechnicalReviewDecision.SUPERSEDED]: "superseded",
};

export function toWireDecision(decision: TechnicalReviewDecision): string {
  return DECISION_WIRE_VALUE[decision];
}

/**
 * The statuses a decision may be recorded FROM.
 *
 * A row that is already `APPROVED` or `REJECTED` is not re-decided by this API — the caller sends
 * the status they saw, and a mismatch is a 409 rather than a silent overwrite. `SUPERSEDED` is
 * excluded outright: a superseded fact has been replaced, and reviewing a replaced fact would put
 * a decision on a row nothing reads.
 *
 * This is a check on the CURRENT state, not on the caller's assertion about it. The two are
 * compared separately, inside the transaction — see `catalog-review.service.ts`.
 */
export const DECIDABLE_FROM_STATUSES: readonly TechnicalReviewStatus[] = [
  TechnicalReviewStatus.SOURCE_RECORDED,
  TechnicalReviewStatus.NEEDS_REVIEW,
  TechnicalReviewStatus.APPROVED,
  TechnicalReviewStatus.REJECTED,
];

/**
 * The claim kinds that can never become APPROVED, restated in the service layer.
 *
 * `product_claims_forbidden_approval` is the invariant and it is a database CHECK; this constant
 * exists so the API answers **422-shaped 409/400 semantics with a readable message** instead of
 * surfacing a constraint violation as a 500, and so the rule is visible to a reader of the
 * service. It is the second lock on the door, exactly as `v_product_claim_public` repeats it —
 * never the only one.
 */
export const NEVER_APPROVABLE_CLAIM_KINDS: readonly ProductClaimKind[] = [
  ProductClaimKind.LICENSED_BY,
  ProductClaimKind.REFERENCE_ONLY,
];

export const CLAIM_KIND_WIRE_VALUE: Readonly<Record<ProductClaimKind, string>> = {
  [ProductClaimKind.CLASSIFICATION_STATED]: "classification_stated",
  [ProductClaimKind.MEETS]: "meets",
  [ProductClaimKind.SUITABLE_FOR]: "suitable_for",
  [ProductClaimKind.RECOMMENDED_FOR]: "recommended_for",
  [ProductClaimKind.FORMULATED_FOR]: "formulated_for",
  [ProductClaimKind.APPROVED_BY]: "approved_by",
  [ProductClaimKind.LICENSED_BY]: "licensed_by",
  [ProductClaimKind.REFERENCE_ONLY]: "reference_only",
};

export const CLAIM_KINDS = Object.values(CLAIM_KIND_WIRE_VALUE);

export function toWireClaimKind(kind: ProductClaimKind): string {
  return CLAIM_KIND_WIRE_VALUE[kind];
}
