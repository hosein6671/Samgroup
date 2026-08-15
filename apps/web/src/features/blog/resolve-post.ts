import { cache } from "react";

import { getBlogPostBySlug } from "@/lib/blog";

import type { BlogPostResult } from "@/lib/blog";

/**
 * The article route's one lookup, memoized for the request.
 *
 * ── Why `cache()` is here rather than at the call site ──────────────────────
 *
 * Next calls `generateMetadata` and the page component as two separate invocations of the same
 * request, and both need the post: the metadata needs its title, the page needs all of it. Without
 * memoization that is two `GET /blog/posts/:slug` round trips per page view for one record — and
 * worse, two chances to disagree, since the second could answer differently from the first and
 * produce a `<title>` describing an article the body does not show.
 *
 * React's `cache` deduplicates by argument for the lifetime of one request. It is not a
 * cross-request cache and does not change `api-client`'s `no-store` policy — nothing is retained
 * after the response is sent.
 *
 * ── No fallback, and nothing decided here ───────────────────────────────────
 *
 * This adds memoization and nothing else. It does not interpret the result, does not decide what a
 * failure means, and never converts one outcome into another — the route owns the rule that only
 * `not-found` may become a 404, and burying that decision in a resolver would put it somewhere no
 * one reading the route would look for it. The same arrangement `resolve-product-page.ts` uses.
 */
export const resolvePost = cache(async (slug: string, locale: string): Promise<BlogPostResult> =>
  getBlogPostBySlug(slug, locale),
);
