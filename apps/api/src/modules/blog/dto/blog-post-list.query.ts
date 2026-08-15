import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

import { LocaleQuery } from "../../../common/locale/locale.query";

/**
 * The sort values `GET /blog/posts` accepts. API_DESIGN.md §Pagination & Filtering fixes the syntax
 * (`-` prefix = descending); this list fixes the columns, and it is closed on purpose — an open
 * `sort` maps caller-supplied text onto a database column.
 *
 * `publishedAt` is the only column offered, and that is the whole of what the schema supports as an
 * ordering axis for an index of articles. `title` is deliberately absent: it is translated, so
 * ordering by it would order by the DEFAULT locale's title while presenting the requested locale's
 * — the same trade-off the product list documents, but without a browsing use case to justify
 * carrying it here.
 */
export const BLOG_POST_SORTS = ["publishedAt", "-publishedAt"] as const;

export type BlogPostSort = (typeof BLOG_POST_SORTS)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 12;

/**
 * A hard ceiling, not a suggestion. Without it `?limit=100000` is a one-request denial of service
 * against a public, unauthenticated endpoint. Lower than the catalog's 100 because a blog row is a
 * heavier read than a product row even without `content` on it.
 */
export const MAX_LIMIT = 50;

/**
 * Newest first — the one ordering an index of articles is read in. A client that wants the archive
 * in publication order asks for `sort=publishedAt`.
 */
export const DEFAULT_SORT: BlogPostSort = "-publishedAt";

/**
 * `GET /blog/posts` query parameters.
 *
 * **`tag`, `q` and `author` are deliberately absent.** `blog_post_tags` exists and would support a
 * tag filter mechanically, but no tag vocabulary is approved and no page has a tag control, so
 * declaring the parameter would fix filter semantics ahead of the decision that defines them.
 * Because the global ValidationPipe runs with `forbidNonWhitelisted`, their absence is not silence:
 * sending one answers 400 VALIDATION_ERROR naming the property.
 *
 * `category` carries no `@IsNotEmpty`. A filter UI submits every control it owns, so `?category=`
 * is an unfiltered list rather than a malformed request; the service trims it and treats an empty
 * value as an omitted one — the same reading `ProductListQuery` documents.
 */
export class BlogPostListQuery extends LocaleQuery {
  /** A `BlogCategory` SLUG, not an id. Matched exactly; `BlogCategory` has no hierarchy. */
  @IsOptional()
  @IsString()
  category?: string;

  // `@Type(() => Number)` is required: query strings arrive as text, and without the conversion
  // `@IsInt` rejects every page number ever sent. A non-numeric value converts to NaN and is then
  // rejected by `@IsInt` — which is the intent.
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
  @IsIn([...BLOG_POST_SORTS])
  sort?: BlogPostSort;
}
