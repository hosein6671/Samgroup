import type {
  ReviewClaimKind,
  ReviewQueueSort,
  ReviewStatus,
  ReviewSubjectType,
} from "@sam-group/types";

/**
 * Every word the review queue puts on screen, in one place.
 *
 * The Admin surface is English-only and LTR (`app/(admin)/layout.tsx` fixes `lang="en" dir="ltr"`),
 * so this is a label table rather than a translation catalogue. It exists so the wording is
 * reviewable as wording — the statuses in particular are the part of this screen most likely to be
 * misread, and they are the part a queue must not get wrong.
 *
 * Every lookup below is used as `TABLE[value] ?? value`. A status the API adds and this build does
 * not know renders as the API spelled it, which is honest, rather than as "Unknown" or as a blank
 * cell that reads like a rendering fault.
 */

/* -------------------------------------------------------------------------- */
/*  Subject type                                                               */
/* -------------------------------------------------------------------------- */

export const SUBJECT_TYPE_LABEL: Readonly<Record<ReviewSubjectType, string>> = {
  specification: "Specification",
  product_claim: "Product claim",
};

/** Plural, for filter controls and counts. */
export const SUBJECT_TYPE_PLURAL: Readonly<Record<ReviewSubjectType, string>> = {
  specification: "Specifications",
  product_claim: "Product claims",
};

/* -------------------------------------------------------------------------- */
/*  Review status                                                              */
/* -------------------------------------------------------------------------- */

export const STATUS_LABEL: Readonly<Record<ReviewStatus, string>> = {
  source_recorded: "Source recorded",
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Superseded",
};

/**
 * What each status actually means, in the reviewer's terms.
 *
 * The two that exist in the catalogue today are the two that get misread, and the misreading has a
 * direction: `NEEDS_REVIEW` looks like "the backlog" and `SOURCE_RECORDED` looks like "done". Both
 * readings are wrong and the second is dangerous — `SOURCE_RECORDED` is 1,416 of the 1,546 rows,
 * every one of them unapproved, unreviewed and invisible to the public site.
 *
 * This wording is rendered on the page as a legend, not held only here (ADR-016 §7, ratified
 * decision D8).
 */
export const STATUS_MEANING: Readonly<Record<ReviewStatus, string>> = {
  source_recorded:
    "Imported from its source document with its evidence recorded. Nobody has reviewed it yet.",
  needs_review:
    "The importer detected a reason this row needs attention — a conflict, or a source property " +
    "that does not resolve to the controlled dictionary.",
  approved: "Reviewed and approved. This is the only status the public site publishes.",
  rejected: "Reviewed and refused. It is not published and will not be.",
  superseded: "Replaced by a later revision of the same fact.",
};

/**
 * Whether a status means the subject is published.
 *
 * Exactly one does. Used so no badge, count or summary can imply that anything in this catalogue
 * is live — live DEV holds 0 approved Specifications and 0 approved ProductClaims.
 */
export function statusIsPublished(status: ReviewStatus): boolean {
  return status === "approved";
}

/* -------------------------------------------------------------------------- */
/*  Claim kind                                                                 */
/* -------------------------------------------------------------------------- */

export const CLAIM_KIND_LABEL: Readonly<Record<ReviewClaimKind, string>> = {
  classification_stated: "Classification stated",
  meets: "Meets",
  suitable_for: "Suitable for",
  recommended_for: "Recommended for",
  formulated_for: "Formulated for",
  approved_by: "Approved by",
  licensed_by: "Licensed by",
  reference_only: "Reference only",
};

/**
 * The two kinds ADR-016 §6 puts permanently out of reach of an approval.
 *
 * Surfaced in the queue as plain text so a reviewer is not sent to a detail screen to discover that
 * the row was never approvable. Five rows in live DEV, all `reference_only`.
 */
export const NEVER_APPROVABLE_CLAIM_KINDS: readonly ReviewClaimKind[] = [
  "licensed_by",
  "reference_only",
];

export function claimKindIsNeverApprovable(kind: ReviewClaimKind): boolean {
  return NEVER_APPROVABLE_CLAIM_KINDS.includes(kind);
}

/* -------------------------------------------------------------------------- */
/*  Findings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `hasUnresolvedFindings`, as words.
 *
 * Never a colour, never an icon, never a bare dot: WCAG 2.2 §1.4.1 aside, "•" in a column called
 * Findings does not say whether the dot means there is a finding or that the check ran.
 */
export const FINDINGS_LABEL = {
  unresolved: "Unresolved finding",
  clear: "No unresolved finding",
} as const;

export const FINDINGS_MEANING =
  "An unresolved finding means the importer flagged this row, or — for a Specification — its " +
  "source property does not resolve to the controlled dictionary through an approved " +
  "high-confidence mapping. It does not mean the value is wrong; it means something is unsettled.";

/* -------------------------------------------------------------------------- */
/*  Sort                                                                       */
/* -------------------------------------------------------------------------- */

export const SORT_LABEL: Readonly<Record<ReviewQueueSort, string>> = {
  "-createdAt": "Newest first",
  createdAt: "Oldest first",
  "-updatedAt": "Recently decided",
  updatedAt: "Least recently decided",
};

/* -------------------------------------------------------------------------- */
/*  Filter descriptions                                                        */
/* -------------------------------------------------------------------------- */

/**
 * How each closed-vocabulary filter value is spelled in the active-filter summary.
 *
 * Passed into `activeFilters` so that module stays free of presentation: it decides *which* filters
 * are active, this decides what they are called. Keeping the two apart is why `review-query.ts` can
 * be tested without rendering anything.
 */
export const DESCRIBE_FILTER = {
  subjectType: (value: ReviewSubjectType): string => SUBJECT_TYPE_PLURAL[value] ?? value,
  reviewStatus: (value: ReviewStatus): string => STATUS_LABEL[value] ?? value,
  claimKind: (value: ReviewClaimKind): string => CLAIM_KIND_LABEL[value] ?? value,
  unresolvedFindings: (value: boolean): string =>
    value ? FINDINGS_LABEL.unresolved : FINDINGS_LABEL.clear,
} as const;
