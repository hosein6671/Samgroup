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

/** The two things a technical review can be about. Serves as the discriminant on every row. */
export type ReviewSubjectType = "specification" | "product_claim";

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
 * This is the *shape* axis: what the numeric columns mean. It is not the *kind* axis.
 * `SpecValueKind` — whether the property is numeric, textual or coded — is a `SpecProperty` column
 * and the review detail response does not serve it. Nothing here infers it.
 */
export type ReviewValueType =
  "point" | "range" | "minimum" | "maximum" | "text" | "report_only" | "code" | "pair";

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
 * The full review context for one subject.
 *
 * `specification` and `claim` are exclusive and match `subjectType`; `mappings` is always empty for
 * a ProductClaim, because a claim has no property key for a mapping to bear on.
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

  evidenceSetHash: string;
  evidence: readonly ReviewEvidenceEntry[];
  mappings: readonly ReviewMappingRef[];

  approvalBlockers: readonly string[];
  eligibleForApproval: boolean;

  history: readonly ReviewHistoryEntry[];
}
