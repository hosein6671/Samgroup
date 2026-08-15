import { cache } from "react";

import { getProductBySlug } from "@/lib/products";

import type { ProductResult } from "@/lib/products";

/**
 * The Product branch's one lookup, memoized for the request.
 *
 * ── Why `cache()` is here rather than at the call site ──────────────────────
 *
 * Next calls `generateMetadata` and the page component as two separate invocations of the same
 * request, and both need the product: the metadata needs its name and description, the page needs
 * all of it. Without memoization that is two `GET /products/:slug` round trips per page view for
 * one record — and worse, two chances to disagree, since the second could answer differently from
 * the first and produce a `<title>` describing a product the body does not show.
 *
 * React's `cache` deduplicates by argument for the lifetime of one request, so the page and its
 * metadata are guaranteed to be looking at the same response. It is not a cross-request cache and
 * does not change `api-client`'s `no-store` policy — nothing is retained after the response is sent.
 *
 * The Family branch deliberately does NOT go through anything like this: its metadata is read from
 * the local content registry and issues no request at all, which is a stronger property than
 * deduplication and is left exactly as it was.
 *
 * ── No fallback, and nothing decided here ───────────────────────────────────
 *
 * This adds memoization and nothing else. It does not interpret the result, does not decide what a
 * failure means, and never converts one outcome into another — the route owns the rule that only
 * `not-found` may become a 404 (ADR-010 §7), and burying that decision in a resolver would put it
 * somewhere no one reading the route would look for it.
 */
export const resolveProduct = cache(async (slug: string, locale: string): Promise<ProductResult> =>
  getProductBySlug(slug, locale),
);
