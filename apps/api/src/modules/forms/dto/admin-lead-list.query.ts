import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * The pagination and ordering contract every `/admin/*` lead list answers to — API_DESIGN.md
 * §Pagination & Filtering, unchanged and not re-decided here.
 *
 * ── Offset, not cursor ──────────────────────────────────────────────────────
 *
 * §Pagination fixes `?page=1&limit=20` and "list responses always include `meta.total`,
 * `meta.page`, `meta.limit`". Every list this platform serves — products, blog posts — already
 * reads that way, and an admin inbox that paginated differently from the rest of the API would
 * make the frontend carry two pagination shapes for no gain. Cursor pagination is what
 * `/rag/export` contracts, and that is a bulk export, not a browsable page.
 *
 * ── Ordering is closed, and defaults to newest first ────────────────────────
 *
 * `createdAt` is the only column offered, in both directions. A lead inbox is read newest-first;
 * that is the whole of its ordering requirement, and an open `sort` maps caller-supplied text onto
 * a database column. There is no `status` sort because there is no second status value to order
 * against (see `submission-status.ts`), and no name sort because a sales queue is not an address
 * book.
 *
 * **The tie-breaker is not optional.** `created_at` is `timestamptz(6)`, and two rows written in
 * the same microsecond — two submissions, one seed, one test — would otherwise be ordered by
 * whatever Postgres returned, which can differ between two requests for the same page. That is
 * how a row appears twice on page 1 and never on page 2. `id` is added as a secondary key in the
 * same direction, which makes every page boundary deterministic.
 */

export const DEFAULT_PAGE = 1;

/**
 * A screenful of an inbox. Larger than the blog's 12 because a lead row is one line rather than a
 * card, smaller than a page nobody scrolls to the bottom of.
 */
export const DEFAULT_LIMIT = 25;

/**
 * A hard ceiling, not a suggestion. These rows carry personal data, so an unbounded `limit` is
 * both a denial-of-service lever and a bulk-extraction one: a single request must never be able
 * to pull the entire lead table. Export is a separate, unbuilt capability with its own approval.
 */
export const MAX_LIMIT = 100;

export const LEAD_SORTS = ["createdAt", "-createdAt"] as const;

export type LeadSort = (typeof LEAD_SORTS)[number];

/** Newest first — what an operator opening an inbox is looking for. */
export const DEFAULT_SORT: LeadSort = "-createdAt";

export abstract class AdminLeadListQuery {
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
  @IsIn([...LEAD_SORTS])
  sort?: LeadSort;
}

/** The resolved page window, after defaults are applied. */
export type LeadPage = {
  readonly page: number;
  readonly limit: number;
  readonly skip: number;
  readonly direction: "asc" | "desc";
};

export function resolveLeadPage(query: AdminLeadListQuery): LeadPage {
  const page = query.page ?? DEFAULT_PAGE;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const sort = query.sort ?? DEFAULT_SORT;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    direction: sort.startsWith("-") ? "desc" : "asc",
  };
}
