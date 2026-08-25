import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { TrimToUndefined } from "../../../../common/validation/trim.transform";
import {
  CLAIM_KINDS,
  REVIEW_STATUSES,
  REVIEW_SUBJECT_TYPES,
  type ReviewSubjectType,
} from "../review-subject";

/**
 * `GET /admin/catalog/review/queue` query parameters.
 *
 * Every filter is optional and every one is a CLOSED vocabulary or an exact-match string. There
 * is no free-text search, no `sort` over a caller-supplied column name, and no filter that maps
 * user text onto SQL — the same discipline `product-list.query.ts` applies to the public list,
 * and it matters more here because this surface reads unapproved technical data.
 *
 * The global `ValidationPipe` runs `whitelist` + `forbidNonWhitelisted`, so an unknown parameter
 * is answered **400 VALIDATION_ERROR naming it** rather than ignored. That is what keeps a
 * misspelled filter from silently widening a queue.
 */
export const REVIEW_QUEUE_SORTS = ["createdAt", "-createdAt", "updatedAt", "-updatedAt"] as const;

export type ReviewQueueSort = (typeof REVIEW_QUEUE_SORTS)[number];

export const DEFAULT_QUEUE_PAGE = 1;
export const DEFAULT_QUEUE_LIMIT = 25;

/**
 * A hard ceiling. Lower than the public catalog's 100 on purpose: a queue page carries evidence
 * context per row, and an operator working a review queue reads a screen at a time rather than
 * exporting one.
 */
export const MAX_QUEUE_LIMIT = 100;

/**
 * Newest-first by default. A review queue is a work list, and the thing an operator wants first
 * is what arrived last — the opposite of the public catalog, where A–Z is what a browsing buyer
 * expects.
 */
export const DEFAULT_QUEUE_SORT: ReviewQueueSort = "-createdAt";

/**
 * `updatedAt` is an ORDERING NAME, not a column.
 *
 * Neither `specifications` nor `product_claims` carries an `updated_at` column, and this gate
 * adds no migration. What "most recently updated" means for a review subject is the timestamp of
 * its latest `TechnicalReview`, falling back to `created_at` when it has none — which is exactly
 * the order an operator means by "what moved last". Stated here because the parameter name would
 * otherwise imply a column that does not exist.
 */

/** `?flag=true` / `?flag=false`, the only two spellings accepted. */
const booleanQuery = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  });

export class ReviewQueueQuery {
  /** Omitted means both kinds, interleaved by the chosen ordering. */
  @IsOptional()
  @IsIn([...REVIEW_SUBJECT_TYPES])
  subjectType?: ReviewSubjectType;

  /**
   * A single review status. Single-valued deliberately: `?reviewStatus=a&reviewStatus=b` would be
   * an array this DTO does not declare, and a multi-value filter on a publication gate is a
   * decision worth taking explicitly rather than falling into.
   */
  @IsOptional()
  @IsIn([...REVIEW_STATUSES])
  reviewStatus?: string;

  /** The internal catalog identity, exact match. Admin-only surface — see the controller. */
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(64)
  sourceRef?: string;

  /** The Product's default-locale slug, exact match. */
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(200)
  productSlug?: string;

  /**
   * A Product Family, named by its default-locale `Category.slug` — the canonical identifier
   * ADR-009 freezes. Not a localized slug and not an id: this is an internal operator surface,
   * and the canonical identifier is the one value that is stable across locales.
   */
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(200)
  family?: string;

  /** A `ProductType.slug`. Spelled in full, never `type` — ADR-008 rejects the short form. */
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(200)
  productType?: string;

  /** A `SpecProperty` key. Meaningful only for Specifications; a claim never matches one. */
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(200)
  propertyKey?: string;

  /** A `ProductClaimKind`. Meaningful only for ProductClaims. */
  @IsOptional()
  @IsIn([...CLAIM_KINDS])
  claimKind?: string;

  /**
   * The evidence source, named by `SourceDocument.locatorValue` — exact match. A reviewer working
   * through one supplier's TDS filters by the document they are holding.
   */
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(2000)
  documentLocator?: string;

  /**
   * `true` narrows to subjects that carry an unresolved finding; `false` narrows to those that do
   * not; omitted returns both.
   *
   * "Unresolved finding" is defined in `catalog-review.service.ts` against durable database state
   * only — the importer's per-row verdict and the property-mapping resolution. It is never read
   * from a manifest artefact, which is a file and not a fact about the row.
   */
  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  unresolvedFindings?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUEUE_LIMIT)
  limit?: number;

  @IsOptional()
  @IsIn([...REVIEW_QUEUE_SORTS])
  sort?: ReviewQueueSort;
}
