import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

import { LocaleQuery } from "../../../common/locale/locale.query";

/**
 * The sort values `GET /products` accepts. API_DESIGN.md §Pagination & Filtering fixes the
 * syntax (`-` prefix = descending); this list fixes the columns, and it is closed on purpose —
 * an open `sort` maps caller-supplied text onto a database column.
 */
export const PRODUCT_SORTS = ["createdAt", "-createdAt", "name", "-name"] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

/**
 * A hard ceiling, not a suggestion. Without it `?limit=100000` is a one-request denial of
 * service against a public, unauthenticated endpoint.
 */
export const MAX_LIMIT = 100;

/**
 * Alphabetical rather than newest-first: this endpoint backs the Product Finder (§2.7), a
 * browsing surface where a stable A–Z order is what a buyer scanning grades expects. A client
 * that wants recency asks for `sort=-createdAt`.
 */
export const DEFAULT_SORT: ProductSort = "name";

/**
 * `GET /products` query parameters — API_CONTRACT_FINAL.md §2.7.
 *
 * **`industry`, `application` and `packaging` are deliberately absent.** §2.7's example URL
 * carries them, but no column in `sam_platform` backs any of the three (schema.prisma has no
 * such fields on `Product`, and `Specification` is an unconstrained key/value pair). Declaring
 * them here would accept a filter this API cannot apply. Because the global ValidationPipe
 * runs with `forbidNonWhitelisted`, their absence is not silence: sending one answers 400
 * VALIDATION_ERROR naming the property, which is the honest response until the data model
 * gains the fields.
 *
 * `category`, `q`, `segment` and `productType` carry no `@IsNotEmpty`. A filter UI submits every
 * control it owns, so `?q=&category=` is an unfiltered list rather than a malformed request; the
 * service trims them all and treats an empty value as an omitted one.
 */
export class ProductListQuery extends LocaleQuery {
  /** A category SLUG, not an id — locale-specific, and matched exactly (no subtree). */
  @IsOptional()
  @IsString()
  category?: string;

  /**
   * A Segment SLUG, not an id — the application/use axis (ADR-007 §4), locale-aware like
   * `category`. Named `segment`, and single-valued: ADR-008 fixes the parameter name and defers
   * multi-value taxonomy filtering, so `?segment=a&segment=b` is not a supported request.
   */
  @IsOptional()
  @IsString()
  segment?: string;

  /**
   * A Product Type SLUG, not an id. Spelled `productType` and never `type` — ADR-008 rejects the
   * short form, which would collide with every other "type" this API already carries.
   */
  @IsOptional()
  @IsString()
  productType?: string;

  /** Free-text search across product name, slug and specification values. */
  @IsOptional()
  @IsString()
  q?: string;

  // `@Type(() => Number)` is required: query strings arrive as text, and without the
  // conversion `@IsInt` rejects every page number ever sent. A non-numeric value converts to
  // NaN and is then rejected by `@IsInt` — which is the intent.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @IsIn([...PRODUCT_SORTS])
  sort?: ProductSort;
}
