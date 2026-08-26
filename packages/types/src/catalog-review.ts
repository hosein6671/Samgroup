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
