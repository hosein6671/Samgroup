/**
 * The Blog resource client — `GET /api/v1/blog/posts` and `GET /api/v1/blog/posts/:slug`.
 *
 * ── Why this is its own module ──────────────────────────────────────────────
 *
 * The same reason `products.ts` is not inside `catalog.ts`: FRONTEND_ARCHITECTURE.md §11 asks for
 * one function per resource, and `apps/api` draws the same line — `blog-posts.service.ts` is its own
 * module beside the catalog's, because Blog is its own owned entity set.
 *
 * ── Two functions, and the difference between their failures matters ────────
 *
 * `getBlogPosts` backs an index page that exists regardless; `getBlogPostBySlug` decides whether an
 * article page exists at all. That makes the distinction between "this post does not exist" and "the
 * blog service did not answer" load-bearing rather than tidy: the principle ADR-010 §7 fixes for
 * Product Detail — infrastructure failure must never become a canonical-content 404 — applies
 * unchanged here, so both results are separated at the source and the route can never collapse them
 * by accident.
 *
 * Server-only by transitive import of `api-client`, whose `import "server-only"` fails a client
 * bundle at build time. Nothing in `apps/web` reaches Prisma or Payload; NestJS is the only API
 * surface, blog included.
 */

import { apiGet } from "./api-client";

import type { BlogPostDetailResponse, BlogPostListItemResponse } from "@sam-group/types";

/**
 * What a post-list request produced.
 *
 * The outcomes are kept apart rather than collapsed into an array-or-empty, and the distinction is
 * the point: an empty list and a failed request must never render the same way. "Nothing is
 * published yet" is a fact about the blog; "the API did not answer" is a fact about the
 * infrastructure, and presenting the second as the first would tell a visitor something untrue.
 * `unknown-filter` is separated from the other failures because it is the only one the VISITOR
 * caused and the only one they can undo.
 */
export type BlogPostListResult =
  | {
      readonly ok: true;
      readonly posts: readonly BlogPostListItemResponse[];
      /** `meta.total` — the size of the filtered set, which may exceed `posts.length`. */
      readonly total: number;
      readonly page: number;
      readonly limit: number;
      /** `meta.localeFallback` — true when part of the response was served in the default locale. */
      readonly localeFallback: boolean;
    }
  /** A 400 VALIDATION_ERROR naming a filter parameter — an unknown `category` slug. */
  | { readonly ok: false; readonly reason: "unknown-filter"; readonly field: string }
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "api-error"; readonly status: number };

/**
 * The five fields of one list row, checked before any of them is trusted.
 *
 * `apiGet` verifies the envelope, not the payload — a 200 carrying something that is not a post row
 * would otherwise reach a heading as `undefined`. Every field the shared type declares is checked,
 * `category` included: a validator that vouches for less than the type declares is a validator that
 * makes the type a claim rather than a guarantee.
 */
function isBlogPostListItem(value: unknown): value is BlogPostListItemResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const category = record.category as Record<string, unknown> | null | undefined;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.slug === "string" &&
    typeof record.publishedAt === "string" &&
    typeof category === "object" &&
    category !== null &&
    typeof category.name === "string" &&
    typeof category.slug === "string"
  );
}

/**
 * The `field` of the first `VALIDATION_ERROR` detail, when the API named one.
 *
 * The service answers 400 with `details: [{ field: "category", issue: ... }]` for a slug that
 * resolves to no blog category. Which parameter was rejected is the whole of what the page needs in
 * order to say something true about it; the `issue` text is the API's own prose and is never
 * rendered.
 */
function rejectedFilterField(details: readonly { field: string }[] | null): string | null {
  return details?.[0]?.field ?? null;
}

/**
 * The axes `GET /blog/posts` is asked to narrow or page on.
 *
 * `tag` is deliberately not a member. `blog_post_tags` exists, but no tag vocabulary is approved and
 * the endpoint declines the parameter — a field here would be an invitation to send one.
 */
export type BlogPostFilters = {
  /** A `BlogCategory` slug. Matched exactly server-side; an unknown one answers 400. */
  readonly category?: string;
  /** 1-based. Omitted means page 1, which is what the endpoint defaults to. */
  readonly page?: number;
};

/**
 * The published post list, newest first, optionally narrowed to one category.
 *
 * @param locale the active locale code from the `[locale]` segment. The API resolves the post's
 *   `title` and `slug` in it and reports `meta.localeFallback` when it could not.
 * @param filters the axes to narrow or page on. `{}` is the whole published index.
 *
 * **Filtering and paging are the backend's**, in full. Nothing here fetches a wider set and slices
 * it locally — that would reimplement the endpoint's semantics against a list it has already
 * paginated. It is also why `total` below is `meta.total` and never a length this module computed.
 *
 * Never throws for an API condition; every one of them is reported as a value. The Insights index
 * has a hero and chrome that must survive a blog outage.
 */
export async function getBlogPosts(
  locale: string,
  filters: BlogPostFilters = {},
): Promise<BlogPostListResult> {
  const result = await apiGet<unknown>("/blog/posts", {
    locale,
    // Spread rather than sent blank. The service treats `?category=` as an omitted filter, so both
    // forms behave alike — but a parameter that is not a filter should not appear in the request.
    ...(filters.category === undefined ? {} : { category: filters.category }),
    ...(filters.page === undefined ? {} : { page: String(filters.page) }),
  });

  if (!result.ok) {
    if (result.reason === "unreachable") {
      return { ok: false, reason: "unreachable" };
    }

    if (result.reason === "http") {
      const field = result.status === 400 ? rejectedFilterField(result.details) : null;

      return field === null
        ? { ok: false, reason: "api-error", status: result.status }
        : { ok: false, reason: "unknown-filter", field };
    }

    return { ok: false, reason: "api-error", status: result.status };
  }

  if (!Array.isArray(result.data) || !result.data.every(isBlogPostListItem)) {
    // `status` is 200 here — the failure is in the payload, not the status line.
    return { ok: false, reason: "api-error", status: 200 };
  }

  const posts = result.data;

  return {
    ok: true,
    posts,
    // API_DESIGN.md §Pagination contracts all three as always present on a list response. They are
    // read defensively anyway, and fall back to what the response itself demonstrates rather than to
    // a literal that could contradict it.
    total: result.meta.total ?? posts.length,
    page: result.meta.page ?? 1,
    limit: result.meta.limit ?? posts.length,
    localeFallback: result.meta.localeFallback === true,
  };
}

/* ------------------------------------------------------------------- detail */

/**
 * What a post lookup produced.
 *
 * The four outcomes are kept apart because exactly one of them is allowed to become a 404.
 * `not-found` is the API stating that no published post answers this slug in this locale — a fact
 * about the blog, and the only honest reason to serve a canonical 404. `unreachable` and `api-error`
 * are facts about the infrastructure, and converting either into a 404 is the thing ADR-010 §7
 * forbids for Product Detail and that this route holds to for the same reasons. Collapsing them into
 * `null` would make that rule impossible to keep at the call site.
 */
export type BlogPostResult =
  | {
      readonly ok: true;
      readonly record: BlogPostDetailResponse;
      /**
       * `meta.localeFallback` — true when any localized part of the response was served in the
       * default locale because the requested one has no translation. Envelope metadata, not a field
       * on the record, so it is surfaced beside it rather than folded into it.
       */
      readonly localeFallback: boolean;
    }
  /** A definitive 404 from the API: no PUBLISHED post answers this slug. */
  | { readonly ok: false; readonly reason: "not-found" }
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "api-error"; readonly status: number };

/**
 * The fields the article page reads, checked before any of them is trusted.
 *
 * `tags` is checked for being an array and nothing deeper: its contents are rendered through `.map`,
 * so a malformed member would surface as a missing string rather than as a thrown render.
 */
function isBlogPostDetail(value: unknown): value is BlogPostDetailResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const category = record.category as Record<string, unknown> | null | undefined;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.slug === "string" &&
    typeof record.content === "string" &&
    typeof record.publishedAt === "string" &&
    typeof category === "object" &&
    category !== null &&
    typeof category.name === "string" &&
    typeof category.slug === "string" &&
    Array.isArray(record.tags)
  );
}

/**
 * One published post by its locale-specific slug.
 *
 * @param slug the slug as it appears in the URL. The API resolves it in the requested locale's
 *   vocabulary — translated slug first, the row's own column second — so a post with no translation
 *   is still reachable in every locale at its default-locale path.
 * @param locale the active locale code from the `[locale]` segment.
 *
 * Never throws for an API condition, and never reports a transport failure as a missing post. The
 * route's 404 decision reads `reason`, and only `not-found` may produce one.
 */
export async function getBlogPostBySlug(slug: string, locale: string): Promise<BlogPostResult> {
  const result = await apiGet<unknown>(`/blog/posts/${encodeURIComponent(slug)}`, { locale });

  if (!result.ok) {
    if (result.reason === "unreachable") {
      return { ok: false, reason: "unreachable" };
    }

    if (result.reason === "http") {
      /*
       * Matched on the status line rather than on `error.code`, for the same reason `products.ts`
       * does: the status is the part of the contract the HTTP layer guarantees even when the body
       * never arrived. A 404 here is the service's own NOT_FOUND — the one definitive answer, and
       * the one an unpublished post also produces by design.
       */
      return result.status === 404
        ? { ok: false, reason: "not-found" }
        : { ok: false, reason: "api-error", status: result.status };
    }

    return { ok: false, reason: "api-error", status: result.status };
  }

  if (!isBlogPostDetail(result.data)) {
    // A 2xx carrying something that is not a post. Reported as an API error and NOT as `not-found`:
    // a broken contract must not be able to delete a page.
    return { ok: false, reason: "api-error", status: 200 };
  }

  return { ok: true, record: result.data, localeFallback: result.meta.localeFallback === true };
}
