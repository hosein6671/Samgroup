/**
 * The Admin catalog technical-review queue's wire shape — `GET /api/v1/admin/catalog/review/queue`.
 *
 * ── Transcribed, not shared ────────────────────────────────────────────────
 *
 * Same constraint as `api.ts` and `admin-leads.ts`: `apps/api` declares its own copy in
 * `modules/catalog/review/dto/review.response.ts` and is not coupled to this file. The agreement
 * between the two is maintained by reading and by the tests on either side, not by `tsc`. Nothing
 * here imports from Prisma, and no Prisma model is reproduced — these are projections the API was
 * asked to return, not tables.
 *
 * ── The queue only, deliberately ───────────────────────────────────────────
 *
 * ADR-016 §1 ships five routes. This module describes **one** of them. The two detail responses
 * carry the evidence array, the source-document identities, the mapping refs and the reviewer
 * history — internal provenance with no consumer until the Phase B detail routes exist. Declaring
 * them here now would put provenance shapes in a shared package that nothing reads, which is the
 * opposite of the narrow surface the shared package is for. They arrive with the gate that renders
 * them.
 *
 * There is no decision shape here either, and that is not an oversight: Phase A ships no write.
 *
 * ── Closed vocabularies ────────────────────────────────────────────────────
 *
 * `reviewStatus`, `subjectType`, `claimKind` and the sort keys are unions rather than `string`
 * because each is a PostgreSQL enum or a DTO `@IsIn` list on the API side — the narrowing describes
 * reality rather than asserting over it. A value outside a set is a contract violation the frontend
 * should notice; the queue view still renders an unrecognised status as stored rather than crashing
 * or hiding the row.
 */

/** The three things a technical review can be about. Serves as the discriminant on every row. */
export type ReviewSubjectType = "specification" | "product_claim" | "product_copy";

/**
 * The five review statuses, spelled as the API serves them — the physical labels of the
 * `technical_review_status` enum.
 *
 * Only `source_recorded` and `needs_review` exist in the catalogue today, and both mean
 * *unapproved*: `source_recorded` is "imported with its evidence, nobody has looked at it yet",
 * and `needs_review` is "the importer's planner attached a reason this row needs attention".
 * Neither is a backlog the other is not.
 */
export type ReviewStatus =
  "source_recorded" | "needs_review" | "approved" | "rejected" | "superseded";

/** The eight `ProductClaim.kind` values. `licensed_by` and `reference_only` can never be approved. */
export type ReviewClaimKind =
  | "classification_stated"
  | "meets"
  | "suitable_for"
  | "recommended_for"
  | "formulated_for"
  | "approved_by"
  | "licensed_by"
  | "reference_only";

/**
 * The four orderings the queue accepts. `updatedAt` sorts on the most recent decision, falling
 * back to `createdAt` for a subject nobody has decided — which today is every subject.
 */
export type ReviewQueueSort = "createdAt" | "-createdAt" | "updatedAt" | "-updatedAt";

/**
 * The Product a review subject belongs to.
 *
 * `family` is the default-locale `Category.slug`, which ADR-009 makes a Product Family's one
 * canonical identifier. `productType` is the `ProductType.slug`.
 *
 * ## `sourceRef` is internal, and this file is one of three places allowed to name it
 *
 * It is SAM's **internal import identity** for a Product — the stable handle a reviewer uses to
 * tell two similar subjects apart and to find the row again in the ratified workbook. It is not a
 * public SKU, not a supplier name, not a brand, and not product content, and nothing may present
 * it as any of those.
 *
 * ADR-015 §1 makes the column categorically non-public and ADR-016 §3 exempts the Admin review DTO.
 * ADMIN-REVIEW-UI-1B-H1 extends that exemption to exactly three frontend locations: the Review
 * route, the Review feature, and this file. It stays forbidden in every public web route and
 * component, in Payload, in the generic shared Product types (`catalog.ts`), in the public API
 * DTOs, in SEO, sitemap and metadata, in analytics, in logs, in public URLs and in browser storage.
 *
 * `apps/api/src/modules/catalog/source-ref-boundary.spec.ts` holds the allowlist and proves the
 * boundary is still closed everywhere else — including by mutating a real public Product component
 * and checking that it is caught.
 *
 * **This field must not be added to `catalog.ts` or to any generic Product type.** A
 * `ProductListItemResponse` carrying it would publish it from every Product page without anyone
 * touching a Product component, which is precisely the failure the boundary exists to prevent.
 */
export interface ReviewProductRef {
  slug: string;
  name: string;
  sourceRef: string | null;
  family: string | null;
  productType: string | null;
}

/** The grade a subject is scoped to, when it is scoped to one at all. */
export interface ReviewGradeRef {
  id: string;
  label: string;
  gradeSystem: string | null;
}

/**
 * One row of the queue.
 *
 * `summary` is composed by the API from the columns that identify the subject — property key,
 * display value and unit for a Specification; kind, body, code and context for a ProductClaim. It
 * is the one field meant to be read at a glance, and it is already curated: no raw source value and
 * no document locator reaches it.
 *
 * `hasUnresolvedFindings` is defined over durable database state only (ADR-016 §7) — the planner's
 * per-row verdict, and for a Specification whether its property mapping resolves. It is the axis
 * that actually partitions this queue; `reviewStatus` is not.
 *
 * `evidenceCount` and `reviewCount` are cardinalities, never the evidence or the reviews.
 */
export interface ReviewQueueItemResponse {
  subjectType: ReviewSubjectType;
  id: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  product: ReviewProductRef;
  grade: ReviewGradeRef | null;
  propertyKey: string | null;
  claimKind: ReviewClaimKind | null;
  /** For ProductCopy: the locale it is written in. Otherwise null. */
  locale: string | null;
  summary: string;
  evidenceCount: number;
  hasUnresolvedFindings: boolean;
  reviewCount: number;
}

/* ========================================================================== */
/*  Detail — `GET /api/v1/admin/catalog/review/{subject}/:id`                  */
/* ========================================================================== */

/**
 * The curated detail response, added for the Phase B detail routes.
 *
 * ── Why these arrive now and not with the queue ────────────────────────────
 *
 * The note at the top of this file said the detail shapes "arrive with the gate that renders
 * them". This is that gate. Nothing below is speculative: every field is read by
 * `specification-detail.tsx` or `product-claim-detail.tsx`, or by the shared shell they compose.
 *
 * ── Still transcribed, still not a Prisma model ────────────────────────────
 *
 * `apps/api/src/modules/catalog/review/dto/review.response.ts` remains the authority and is not
 * imported from here. These are the projections the service assembles field by field — there is no
 * spread on either side and no passthrough, so a column added to `specifications` or
 * `source_facts` does not appear here by accident.
 *
 * ── No decision shape, deliberately ────────────────────────────────────────
 *
 * The API's decision response and decision request body are NOT transcribed here. Phase B ships no
 * write, and an unused decision shape sitting in a shared package is a capability waiting to be
 * picked up by the next person who greps for one.
 *
 * ── `sourceRef` reaches this file through `ReviewProductRef` and nowhere else ─
 *
 * Both detail responses carry the same `ReviewProductRef` the queue carries. The boundary is
 * unchanged: it is displayed inside the authenticated Review UI and it enters no URL, no log and no
 * generic Product type. See the note on `ReviewProductRef` above.
 */

/**
 * The shape of a normalized value — `SpecValueType`, as the API lowercases it.
 *
 * This is the *shape* axis: what the numeric columns of ONE recorded value mean. It is not the
 * *kind* axis — that is `ReviewValueKind` below, and the two are served independently.
 */
export type ReviewValueType =
  "point" | "range" | "minimum" | "maximum" | "text" | "report_only" | "code" | "pair";

/**
 * What kind of value the PROPERTY carries — `SpecValueKind`, as the API lowercases it.
 *
 * The coarser of the two value axes, and a column of the `SpecProperty` dictionary rather than of
 * the Specification. Viscosity is `numeric` and may legitimately arrive as `point`, `range` or
 * `minimum`; appearance is `textual`.
 *
 * ## The two axes are independent, and neither is derived from the other
 *
 * A `numeric` property recorded as `text` is a discrepancy worth a reviewer's attention, and the
 * only way a surface can show it is by serving both axes side by side. Nothing in this platform
 * converts one into the other, infers a missing one from the other, or renders one under the
 * other's label. In this gate the discrepancy is **informational**: it is not a blocker and not a
 * warning, because no rule about it has been ratified.
 *
 * Null when the Specification's property key resolves to no dictionary entry. That is a stated
 * absence, never a default — `PROPERTY_NOT_IN_DICTIONARY` already blocks such a subject.
 */
export type ReviewValueKind = "numeric" | "textual" | "coded";

/**
 * Whether a test method must accompany a value for that property to mean anything —
 * `MethodRequirement`, as the API lowercases it.
 *
 * A viscosity without its ASTM method is not the same fact as one with it. This is the dictionary's
 * statement about the property, and it is the input to `REQUIRED_METHOD_ABSENT` and to
 * `METHOD_NOT_APPLICABLE_BUT_PRESENT`.
 *
 * Null when the property key resolves to no dictionary entry, exactly as `ReviewValueKind` is.
 */
export type ReviewMethodRequirement = "required" | "optional" | "not_applicable";

/** What a recorded number actually is. `unspecified` means the source did not say. */
export type ReviewResultBasis =
  "average" | "typical" | "specification_limit" | "measured" | "unspecified";

/** How one `SourceFact` supports the subject. `superseded` evidence is retained, never unlinked. */
export type ReviewEvidenceRole = "primary" | "corroborating" | "superseded";

/** How the reading was got out of its document. An OCR reading is not a spreadsheet cell. */
export type ReviewExtractionMethod =
  "spreadsheet_cell" | "pdf_text_layer" | "pdf_ocr" | "manual_transcription";

/**
 * What the source said about units for one extracted fact.
 *
 * `absent` and `unrecognized` are the two that matter to a reviewer: the first means the source
 * gave no unit at all, the second means it gave one this platform cannot yet interpret. Neither is
 * a licence to guess, and no surface may render either as a resolved unit.
 */
export type ReviewUnitClassification = "stated" | "absent" | "dimensionless" | "unrecognized";

/** How a `SourceDocument` is addressed. The ratified workbook is an uploaded file with no URL. */
export type ReviewLocatorType = "url" | "uploaded_file";

/** How confident a raw-property to `SpecProperty` mapping is. Only `high` ever resolves one. */
export type ReviewMappingConfidence = "high" | "medium" | "low";

/**
 * What a reviewer decided, as opposed to what state a row is in.
 *
 * Read-only here: it is the wire spelling of a recorded, immutable decision, carried so history can
 * be rendered. It is not a request vocabulary, and no type in this package accepts it as input.
 */
export type ReviewHistoryDecision = "approved" | "rejected" | "needs_review" | "superseded";

/**
 * The normalized Specification under review.
 *
 * Both the display string and the numeric payload are served because neither is derivable from the
 * other, and a reviewer shown only one of them is shown half of what they would be approving. The
 * decimals are strings: `numeric(20,6)` does not survive a JavaScript double, and a limit that
 * changes when it is round-tripped is not a limit.
 */
export interface ReviewSpecificationValue {
  propertyKey: string | null;
  displayValue: string | null;
  valueType: ReviewValueType | null;
  numericMin: string | null;
  numericMax: string | null;
  pairFirst: string | null;
  pairSecond: string | null;
  unit: string | null;
  method: string | null;
  qualifier: string | null;
  resultBasis: ReviewResultBasis;

  /**
   * The `SpecProperty` dictionary metadata for this Specification's property key.
   *
   * Two INDEPENDENT axes, both null when the key resolves to no dictionary entry. They are served
   * on the Specification shape and on no other: a ProductClaim has no property key, so it has no
   * dictionary record, and `ReviewClaimValue` must never grow either field.
   */
  valueKind: ReviewValueKind | null;
  methodRequirement: ReviewMethodRequirement | null;
}

/**
 * The ProductClaim under review.
 *
 * `kind` is the legal strength of the statement, and it is the field this platform is least willing
 * to let a UI blur: "formulated for" is an additive target level and "approved by" is a named
 * body's approval. No surface may present one as the other.
 */
export interface ReviewClaimValue {
  kind: ReviewClaimKind;
  standardBody: string | null;
  standardCode: string | null;
  contextNote: string | null;
}

/**
 * The editorial copy under review, in one locale (ADR-019).
 *
 * Unlike the other two subject values, this IS the artifact rather than a normalization of it: a
 * reviewer reads these fields beside the raw evidence and decides whether the sentence says what
 * the source document said.
 */
export interface ReviewCopyValue {
  locale: string;
  /** Whether that locale is currently active. A visible fact, never an approval blocker. */
  localeActive: boolean;
  summary: string;
  selectionNote: string | null;
}

/**
 * The cited source document.
 *
 * No bytes and no link. ADR-014 stores no document bytes and the API creates no proxy, no redirect
 * and no signed URL, so there is nothing here to open. `locatorValue` is the URL or the file name
 * the document was recorded under; what the Review UI does with it is decided by `locatorType`, and
 * it is never an anchor.
 */
export interface ReviewDocumentRef {
  id: string;
  title: string;
  publisher: string | null;
  locatorType: ReviewLocatorType;
  locatorValue: string;
  revisionLabel: string | null;
  documentDate: string | null;
  retrievedAt: string;
  assetSha256: string | null;
  assetMediaType: string | null;
  assetByteSize: number | null;
  supersededById: string | null;
}

/**
 * One immutable `SourceFact` supporting the subject.
 *
 * Every raw field is verbatim source text, and that is the reason a review surface exists at all:
 * the reviewer compares the normalized value against what the document actually said. A UI showing
 * only the normalized side would be asking someone to approve the platform's own output.
 */
export interface ReviewEvidenceEntry {
  sourceFactId: string;
  role: ReviewEvidenceRole;
  note: string | null;

  rawProperty: string | null;
  rawValue: string;
  rawUnit: string | null;
  rawMethod: string | null;
  rawGrade: string | null;

  extractionMethod: ReviewExtractionMethod;
  unitClassification: ReviewUnitClassification;
  resultBasis: ReviewResultBasis;

  pageNumber: number | null;
  sheetName: string | null;
  rowNumber: number | null;
  columnLabel: string | null;

  document: ReviewDocumentRef;
}

/**
 * How a raw property reached the controlled dictionary — the durable half of the importer's
 * findings, and the only half that survives as rows.
 *
 * `reviewStatus` here is the mapping's own status, not the subject's. Conflating the two is the
 * specific misreading this field invites, so the Review UI labels it in full.
 */
export interface ReviewMappingRef {
  rawProperty: string;
  rawUnit: string | null;
  specPropertyKey: string | null;
  confidence: ReviewMappingConfidence;
  reviewStatus: ReviewStatus;
  note: string | null;
  resolvesSubjectProperty: boolean;
}

/**
 * One prior decision. Newest first, never filtered and never trimmed — this is the audit trail.
 *
 * `reviewerEmail` is a snapshot taken when the decision was recorded, not a join: it still names
 * the reviewer after the account is deleted, which is when `reviewerId` becomes null.
 * `evidenceCurrent` says whether the evidence behind that decision still hashes to the same value.
 */
export interface ReviewHistoryEntry {
  id: string;
  decision: ReviewHistoryDecision;
  reviewerEmail: string;
  reviewerId: string | null;
  reviewedAt: string;
  note: string | null;
  evidenceSetHash: string;
  evidenceCurrent: boolean;
}

/**
 * Why the system retired an approval — a closed set, one value per class of change (ADR-017 §6).
 *
 * ## These are not decisions
 *
 * Every other vocabulary in this file describes something a person did or a rule a person must
 * satisfy. This one describes something the DATABASE did, on its own, because a subject's
 * `spec-review-v2` or `claim-review-v2` hash stopped matching the review that approved it. No
 * reviewer is named because none exists.
 *
 * ## What each one means to a reviewer
 *
 * | code                     | what moved                                                        |
 * | ------------------------ | ----------------------------------------------------------------- |
 * | `SUBJECT_STATE_CHANGED`  | the specification or claim itself — value, unit, method, kind, …   |
 * | `EVIDENCE_CHANGED`       | an evidence link was added, removed, or had its role changed       |
 * | `DICTIONARY_CHANGED`     | the controlled property entry behind the specification             |
 * | `MAPPING_CHANGED`        | the raw-property mapping that resolves the specification           |
 * | `SOURCE_CAPTURE_CHANGED` | a cited source gained its captured file                            |
 *
 * `SOURCE_CAPTURE_CHANGED` names no document and no locator, exactly as `SOURCE_ASSET_ABSENT` names
 * none on the blocker side.
 */
export type ReviewInvalidationReasonCode =
  | "SUBJECT_STATE_CHANGED"
  | "EVIDENCE_CHANGED"
  | "DICTIONARY_CHANGED"
  | "MAPPING_CHANGED"
  | "SOURCE_CAPTURE_CHANGED";

/**
 * One system invalidation event.
 *
 * Deliberately NOT shaped like `ReviewHistoryEntry`: there is no `decision`, no `reviewerEmail`, no
 * `reviewerId` and no `note`, because the row behind it has none of those columns. A UI that wanted
 * to present this as a decision would have to invent every one of them, and the missing fields are
 * what stops it.
 *
 * Neither hash is carried. They are internal fingerprints a reviewer cannot act on.
 */
export interface ReviewInvalidationEntry {
  id: string;
  /** The decision whose approval this event retired. */
  technicalReviewId: string;
  reasonCode: ReviewInvalidationReasonCode;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Eligibility — blockers and warnings                                        */
/* -------------------------------------------------------------------------- */

/**
 * Every reason a subject cannot be approved, as a closed set of stable machine-readable codes.
 *
 * ## Why the codes exist at all
 *
 * The blockers used to be bare sentences. A sentence is what a reviewer reads; it is not what a
 * client can branch on, and it is not what a refusal can carry back through an HTTP status. The
 * ratified rule is that **frontend wording must never be the enforcement boundary** — a direct
 * `POST` that never rendered a page must still be refused with the same reason the page would have
 * shown. That requires an identifier the wording cannot drift away from.
 *
 * So each code is the rule's identity and the message is its rendering. Change the message freely;
 * changing a code is changing the contract.
 *
 * ## The mapping from the sentences these replaced
 *
 * One code per rule, and the same code where the rule is genuinely the same on both subject types
 * (the message still names the subject). Nothing was merged, nothing was split, and no rule's
 * eligibility meaning moved:
 *
 * | code                           | the sentence it replaces                                          |
 * | ------------------------------ | ----------------------------------------------------------------- |
 * | `SUBJECT_RETIRED`              | "The specification/claim has been retired (deletedAt is set)."     |
 * | `PRODUCT_UNRESOLVED`           | "The specification/claim does not resolve to a Product."           |
 * | `GRADE_NOT_OF_PRODUCT`         | "The grade does not belong to this Product."                       |
 * | `SPECIFICATION_NOT_NORMALIZED` | "…not normalized: it needs a value type and a display value."      |
 * | `PROPERTY_NOT_IN_DICTIONARY`   | "The property key is not an entry in the controlled dictionary."   |
 * | `VALUE_SHAPE_MISMATCH`         | "The numeric columns do not match the declared value type."        |
 * | `EVIDENCE_ABSENT`              | "The specification/claim cites no evidence."                       |
 * | `EVIDENCE_LINK_UNRESOLVED`     | "An evidence link does not resolve to a SourceFact and its …"      |
 * | `PROPERTY_MAPPING_UNRESOLVED`  | "The source property does not resolve to this property key …"      |
 * | `CLAIM_KIND_NEVER_APPROVABLE`  | "This claim kind can never be approved (LICENSED_BY and …)."       |
 * | `NAMED_BODY_ABSENT`            | "An APPROVED_BY claim requires a named standard body."             |
 * | `CLAIM_IDENTITY_ABSENT`        | "The claim carries no identifying body, code, context or hash."    |
 *
 * The last three below replace no sentence. They are this gate's new fail-closed rules.
 */
export type ReviewBlockerCode =
  /* Shared by both subject types. */
  | "SUBJECT_RETIRED"
  | "PRODUCT_UNRESOLVED"
  | "GRADE_NOT_OF_PRODUCT"
  | "EVIDENCE_ABSENT"
  | "EVIDENCE_LINK_UNRESOLVED"
  /* Specification only. */
  | "SPECIFICATION_NOT_NORMALIZED"
  | "PROPERTY_NOT_IN_DICTIONARY"
  | "VALUE_SHAPE_MISMATCH"
  | "PROPERTY_MAPPING_UNRESOLVED"
  | "REQUIRED_METHOD_ABSENT"
  | "METHOD_NOT_EVIDENCED"
  /* ProductClaim only. */
  | "CLAIM_KIND_NEVER_APPROVABLE"
  | "NAMED_BODY_ABSENT"
  | "CLAIM_IDENTITY_ABSENT"
  /* Source capture — both subject types. */
  | "SOURCE_ASSET_ABSENT";

/**
 * Every reason a reviewer should look twice, none of which makes a subject ineligible.
 *
 * The distinction is load-bearing rather than cosmetic. All 69 source documents in the catalogue
 * are missing both a document date and a revision label, so a rule that turned either into a
 * blocker would freeze the entire queue on a metadata gap that says nothing about whether the value
 * is right. Warnings are how that gap is reported without being an obstacle.
 */
export type ReviewWarningCode =
  "METHOD_NOT_APPLICABLE_BUT_PRESENT" | "DOCUMENT_DATE_UNKNOWN" | "DOCUMENT_REVISION_UNKNOWN";

/**
 * One reason approval is unavailable: the code a client branches on, and the sentence a person
 * reads. Both are always present; neither substitutes for the other.
 */
export interface ReviewBlocker {
  code: ReviewBlockerCode;
  message: string;
}

/** One reason to look twice. Never affects `eligibleForApproval`. */
export interface ReviewWarning {
  code: ReviewWarningCode;
  message: string;
}

/**
 * The full review context for one subject.
 *
 * `specification`, `claim` and `copy` are exclusive and match `subjectType`; `mappings` is always
 * empty for a ProductClaim and a ProductCopy, because neither has a property key for a mapping to
 * bear on.
 *
 * `evidenceSetHash` is recomputed on every read. It is carried as the identity of the evidence set
 * as it currently stands, which is what makes each history entry's `evidenceCurrent` meaningful.
 * Phase B never sends it anywhere.
 */
export interface ReviewDetailResponse {
  subjectType: ReviewSubjectType;
  id: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  deletedAt: string | null;

  product: ReviewProductRef;
  grade: ReviewGradeRef | null;

  specification: ReviewSpecificationValue | null;
  claim: ReviewClaimValue | null;
  copy: ReviewCopyValue | null;

  evidenceSetHash: string;
  evidence: readonly ReviewEvidenceEntry[];
  mappings: readonly ReviewMappingRef[];

  /**
   * Why the subject cannot be approved right now. Empty means every mechanical rule passes.
   *
   * `eligibleForApproval` is exactly `approvalBlockers.length === 0`, and it is served rather than
   * left to be derived so that a client cannot arrive at a different answer than the API did.
   * `warnings` never participates in it.
   */
  approvalBlockers: readonly ReviewBlocker[];
  eligibleForApproval: boolean;
  warnings: readonly ReviewWarning[];

  /** Human decisions, newest first. */
  history: readonly ReviewHistoryEntry[];

  /**
   * System invalidation events, newest first.
   *
   * A separate array from `history` on purpose — see `ReviewInvalidationEntry`. Empty for every
   * subject nothing has ever invalidated, which today is every subject in the catalogue.
   */
  invalidations: readonly ReviewInvalidationEntry[];
}

/* ========================================================================== */
/*  Phase C — decision command                                                 */
/* ========================================================================== */

/** The three decisions the Admin review API accepts. Superseding is never a UI decision. */
export type ReviewDecisionInput = "approve" | "reject" | "return_to_needs_review";

/** The optimistic-concurrency body sent to one subject's decisions sub-collection. */
export interface ReviewDecisionRequest {
  decision: ReviewDecisionInput;
  expectedReviewStatus: ReviewStatus;
  expectedEvidenceSetHash: string;
  note?: string;
}

/** The authoritative post-state returned after one immutable decision is recorded. */
export interface ReviewDecisionResponse {
  subjectType: ReviewSubjectType;
  id: string;
  reviewStatus: ReviewStatus;
  decision: ReviewHistoryDecision;
  reviewId: string;
  reviewedAt: string;
  evidenceSetHash: string;
  reviewerEmail: string;
}
