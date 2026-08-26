/**
 * The wire shapes of the Admin catalog review surface.
 *
 * ── Curated projections, not rows ───────────────────────────────────────────
 *
 * Every type here describes an EXPLICIT projection that the service assembles field by field.
 * None of them is a Prisma model, none is produced by a spread, and none carries a passthrough
 * for "everything else". That is the mechanism by which the four categories below stay off the
 * wire even as the tables behind them grow columns:
 *
 *   * **credentials** — nothing in this module reads `users.password_hash`, and the reviewer
 *     identity served is a snapshot string the review row already holds;
 *   * **local paths** — `SourceDocument.locatorValue` is a URL or a FILE NAME, never a filesystem
 *     path, and the API never resolves one;
 *   * **document bytes** — `SourceAsset` stores no bytes at all (ADR-014), so there are none to
 *     leak; what is served is the SHA-256, the media type and the size;
 *   * **anything public** — none of these shapes is reachable without an Admin token, and none of
 *     them is produced by, or shared with, the public catalog DTOs in `../dto/product.response.ts`.
 *
 * ── `sourceRef` appears here and NOWHERE else ───────────────────────────────
 *
 * ADR-015 §1 makes `Product.sourceRef` categorically non-public, and `source-ref-boundary.spec.ts`
 * asserts it is absent from every public DTO and select. This module is the one place it is
 * legitimately served, because a reviewer reconciling a value against the ratified workbook needs
 * the workbook row identifier. The boundary is therefore "Admin review DTOs only", and the
 * boundary test is extended to say exactly that rather than being weakened.
 */

import type { ReviewBlocker, ReviewWarning } from "../review-eligibility";

/**
 * The structured eligibility shapes are re-exported from here so that a reader of the wire
 * contract finds them where the rest of the contract lives, while `review-eligibility.ts` stays
 * their single definition — the rules and the vocabulary they emit must not be able to drift apart.
 */
export type {
  ReviewBlocker,
  ReviewBlockerCode,
  ReviewWarning,
  ReviewWarningCode,
} from "../review-eligibility";

/** Which table a subject lives in, on the wire. */
export type ReviewSubjectTypeResponse = "specification" | "product_claim";

/** The Product a subject hangs off, as a reviewer needs to see it. */
export interface ReviewProductRef {
  /** The default-locale slug — the canonical Product identity in a URL (ADR-009/ADR-010). */
  slug: string;
  name: string;
  /** ADMIN-ONLY. The ratified catalog identity (ADR-015 §1). Never served publicly. */
  sourceRef: string | null;
  /** The Product Family, by its canonical default-locale `Category.slug`. Null if uncategorized. */
  family: string | null;
  /** The primary `ProductType.slug`, single-valued in v2 (ADR-007 §4). Null while unassigned. */
  productType: string | null;
}

/** The Grade a subject belongs to, or `null` for a Product-level fact. */
export interface ReviewGradeRef {
  id: string;
  /** The exact source label, verbatim and unparsed. */
  label: string;
  /** `SAE` / `ISO_VG` / `NLGI`, or null when the label belongs to no classified system. */
  gradeSystem: string | null;
}

/**
 * The normalized value under review, for a Specification.
 *
 * Both the display string and the numeric payload are served: they are stored independently and
 * neither is derivable from the other (ADR-014 §3), so showing a reviewer one of them would show
 * them half of what they are approving.
 */
export interface ReviewSpecificationValue {
  propertyKey: string | null;
  displayValue: string | null;
  valueType: string | null;
  numericMin: string | null;
  numericMax: string | null;
  pairFirst: string | null;
  pairSecond: string | null;
  unit: string | null;
  method: string | null;
  qualifier: string | null;
  resultBasis: string;

  /**
   * The `SpecProperty` dictionary metadata behind this Specification's property key.
   *
   * Two INDEPENDENT axes, both null when the key resolves to no dictionary entry:
   *
   *   * `valueKind` — `numeric` / `textual` / `coded`. What the PROPERTY carries, which is a
   *     coarser question than `valueType`, which describes ONE recorded value. A numeric property
   *     recorded as `text` is a discrepancy worth a reviewer's eye; in this gate it is
   *     informational only, and no rule converts either axis into the other or infers one from the
   *     other.
   *   * `methodRequirement` — `required` / `optional` / `not_applicable`. The input to
   *     `REQUIRED_METHOD_ABSENT` and to `METHOD_NOT_APPLICABLE_BUT_PRESENT`.
   *
   * Null is a stated absence and never a default. Such a subject is already blocked by
   * `PROPERTY_NOT_IN_DICTIONARY`, so nothing needs to guess a value to stay fail-closed.
   */
  valueKind: string | null;
  methodRequirement: string | null;
}

/**
 * The claim under review, for a ProductClaim.
 *
 * **No dictionary metadata, ever.** A claim has no property key, so it has no `SpecProperty` row;
 * a `valueKind` or a `methodRequirement` here would be a value nothing measured. The separation is
 * asserted by `catalog-review.service.spec.ts` rather than left to reading.
 */
export interface ReviewClaimValue {
  kind: string;
  standardBody: string | null;
  standardCode: string | null;
  contextNote: string | null;
}

/**
 * One immutable `SourceFact` supporting the subject, with the document that stated it.
 *
 * Every `raw*` field is verbatim source text. They are the whole reason a review surface exists:
 * a reviewer compares the normalized value against what the document actually said, and a
 * response that carried only the normalized side would be asking them to approve their own
 * output.
 */
export interface ReviewEvidenceEntry {
  sourceFactId: string;
  /** `PRIMARY` / `CORROBORATING` / `SUPERSEDED`, on the wire. */
  role: string;
  note: string | null;

  rawProperty: string | null;
  rawValue: string;
  rawUnit: string | null;
  rawMethod: string | null;
  rawGrade: string | null;

  extractionMethod: string;
  unitClassification: string;
  /** The effective basis: the fact's override, else the document's default. */
  resultBasis: string;

  /** Where in the document the reading was taken from. Whichever the medium has. */
  pageNumber: number | null;
  sheetName: string | null;
  rowNumber: number | null;
  columnLabel: string | null;

  document: ReviewDocumentRef;
}

/**
 * The cited source. NO BYTES and no download link — ADR-014 stores none, and this API creates
 * none. `locatorValue` is the URL or the file name the document was recorded under; it is served
 * only inside this Admin response and is never rendered on a public surface.
 */
export interface ReviewDocumentRef {
  id: string;
  title: string;
  publisher: string | null;
  /** `url` or `uploaded_file`. */
  locatorType: string;
  locatorValue: string;
  revisionLabel: string | null;
  documentDate: string | null;
  retrievedAt: string;
  /** The captured file's SHA-256, or null when the source was cited without a captured file. */
  assetSha256: string | null;
  assetMediaType: string | null;
  assetByteSize: number | null;
  /** Non-null when a later revision has replaced this document. */
  supersededById: string | null;
}

/**
 * How the raw property reached the dictionary — the durable half of "importer conflicts and
 * flags".
 *
 * The importer's manifest flags are an ARTEFACT, a file on disk, and are not persisted per row;
 * the two things that are persisted are the planner's verdict (the subject's own review status)
 * and this mapping. Serving what is durable and saying so beats serving something that looks like
 * a live finding but is a snapshot of a file nobody can produce again.
 */
export interface ReviewMappingRef {
  rawProperty: string;
  rawUnit: string | null;
  /** The key the mapping proposes, or null when it maps to nothing. */
  specPropertyKey: string | null;
  /** `high` / `medium` / `low`. */
  confidence: string;
  /** The mapping's own review status — separate from the subject's. */
  reviewStatus: string;
  note: string | null;
  /** Whether this mapping resolves the subject's own `propertyKey` at HIGH confidence. */
  resolvesSubjectProperty: boolean;
}

/** One prior decision, newest first in the detail response. */
export interface ReviewHistoryEntry {
  id: string;
  decision: string;
  /** The snapshot, never a user id — see the module note in `catalog-review.service.ts`. */
  reviewerEmail: string;
  /** Null once the account has been deleted; the snapshot above still names them. */
  reviewerId: string | null;
  reviewedAt: string;
  note: string | null;
  evidenceSetHash: string;
  /** Whether that decision's hash still matches the evidence as it stands now. */
  evidenceCurrent: boolean;
}

/**
 * The closed set of reasons an approval was retired by the system (ADR-017 §6).
 *
 * Each names the CLASS of change, never the row that made it. In particular `SOURCE_CAPTURE_CHANGED`
 * says a cited source became captured and says nothing about which source, where it lives, or what
 * it is called — the same boundary `SOURCE_ASSET_ABSENT` observes on the blocker side.
 */
export const REVIEW_INVALIDATION_REASON_CODES = [
  "SUBJECT_STATE_CHANGED",
  "EVIDENCE_CHANGED",
  "DICTIONARY_CHANGED",
  "MAPPING_CHANGED",
  "SOURCE_CAPTURE_CHANGED",
] as const;

export type ReviewInvalidationReasonCode = (typeof REVIEW_INVALIDATION_REASON_CODES)[number];

/**
 * One SYSTEM event: an approval stopped describing its subject and was retired.
 *
 * **Not a decision, and never rendered as one.** It carries no reviewer, no email, no note and no
 * decision verb, because none exists — the `review_invalidations` table has no such columns. What
 * it names is the approval that was retired (`technicalReviewId`), the class of change that retired
 * it, and when.
 *
 * Neither hash is served. They are internal fingerprints: a reviewer cannot act on one, and putting
 * one on the wire would invite a client to compare or echo it.
 */
export interface ReviewInvalidationEntry {
  id: string;
  /** The `TechnicalReview` whose approval this event retired. Always present. */
  technicalReviewId: string;
  /** One of `REVIEW_INVALIDATION_REASON_CODES`. */
  reasonCode: string;
  createdAt: string;
}

/** One row of the queue. Narrower than the detail, deliberately. */
export interface ReviewQueueItemResponse {
  subjectType: ReviewSubjectTypeResponse;
  id: string;
  reviewStatus: string;
  createdAt: string;
  product: ReviewProductRef;
  grade: ReviewGradeRef | null;
  /** For a Specification: the dictionary key. For a ProductClaim: null. */
  propertyKey: string | null;
  /** For a ProductClaim: the kind. For a Specification: null. */
  claimKind: string | null;
  /** A one-line rendering of what is under review, for a work list. */
  summary: string;
  evidenceCount: number;
  /** True when the subject carries an unresolved finding — see the service. */
  hasUnresolvedFindings: boolean;
  /** How many decisions have already been recorded against this subject. */
  reviewCount: number;
}

/** The full review context for one subject. */
export interface ReviewDetailResponse {
  subjectType: ReviewSubjectTypeResponse;
  id: string;
  reviewStatus: string;
  createdAt: string;
  deletedAt: string | null;

  product: ReviewProductRef;
  grade: ReviewGradeRef | null;

  /** Exactly one of these two is populated, matching `subjectType`. */
  specification: ReviewSpecificationValue | null;
  claim: ReviewClaimValue | null;

  /**
   * The hash a decision request must echo back. Recomputed on every read, so a client that acts
   * on a stale detail response loses the comparison inside the transaction rather than winning it.
   */
  evidenceSetHash: string;
  evidence: ReviewEvidenceEntry[];
  mappings: ReviewMappingRef[];

  /**
   * Why the subject cannot be approved right now. Empty means every mechanical rule passes.
   *
   * Structured rather than sentences: `code` is the rule's stable identity and `message` is its
   * rendering. The codes are declared in `../review-eligibility.ts`, which is their authority, and
   * the SAME codes are echoed in the 409 a refused approval answers with — so the refusal a client
   * receives is identifiable without matching English text, and frontend wording is never the
   * enforcement boundary.
   */
  approvalBlockers: ReviewBlocker[];

  /** Exactly `approvalBlockers.length === 0`. `warnings` never participates in it. */
  eligibleForApproval: boolean;

  /**
   * Reasons to look twice that are NOT reasons to refuse.
   *
   * Every source document in the catalogue is missing both its date and its revision label, so a
   * rule that made either a blocker would freeze the whole queue on a metadata gap that says
   * nothing about whether the recorded value is right.
   */
  warnings: ReviewWarning[];

  /** Human decisions, newest first. */
  history: ReviewHistoryEntry[];

  /**
   * System invalidation events, newest first — kept in their own array so a client cannot render
   * one as a human decision. Empty for every subject nothing has ever invalidated, which today is
   * every subject in the catalogue.
   */
  invalidations: ReviewInvalidationEntry[];
}

/** What a successful decision answers with — the authoritative post-state, and nothing else. */
export interface ReviewDecisionResponse {
  subjectType: ReviewSubjectTypeResponse;
  id: string;
  reviewStatus: string;
  decision: string;
  reviewId: string;
  reviewedAt: string;
  evidenceSetHash: string;
  reviewerEmail: string;
}
