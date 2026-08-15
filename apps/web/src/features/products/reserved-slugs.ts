/**
 * The slugs ADR-010 §4 reserves inside `/{locale}/products/{slug}`.
 *
 * ── This is a DECLARATION, never an enforcement mechanism ───────────────────
 *
 * ADR-011 fixes the authority chain for reserved vocabulary and puts this file third in it:
 * **ADR-010 §4 → the SQL `product_slug_reserved()` function (the database's enforcement copy) → a
 * TypeScript constant (declaration only) → a drift test.** The database rejects a `Category` or
 * `Product` claiming any of these values whether or not this file exists or agrees with it, so
 * nothing here is protecting the namespace.
 *
 * What this file is for is the ROUTE: the shared `[slug]` segment has to know that these three
 * paths are not products before it asks the catalog about them. Without it, `/en/products/finder`
 * would be a catalog lookup — one that answers 404 today only because no row has claimed the slug,
 * which is the accident, not the rule.
 *
 * ── Why these three answer 404 for now ──────────────────────────────────────
 *
 * They are reserved *for* something: `finder` is the Product Finder route named in `site-routes.ts`
 * (`ROUTES.productFinder`), and `segments`/`types` are the taxonomy browse routes ADR-007 defers.
 * None is built. A path that is reserved and unbuilt is a path with no page, and the honest answer
 * to it is a 404 — the same answer `/en/products/anything-else-unclaimed` gets.
 *
 * The important part is what a 404 here is NOT: it is not a catalog answer. When the Product Finder
 * ships it becomes a static `finder/page.tsx` sibling, a static segment outranks a dynamic one in
 * the App Router, and this entry stops being consulted at all — without a Product ever having been
 * able to occupy the path in the meantime.
 *
 * ── Matching ────────────────────────────────────────────────────────────────
 *
 * Lower-cased before comparison, which mirrors the case half of ADR-011's `slug_key()`
 * normalization (NFC + lower-case). The NFC half is deliberately not reimplemented here: it matters
 * for `fa`/`ar` vocabulary that does not exist yet, this is a route guard rather than the
 * uniqueness authority, and a partial reimplementation that looked complete would be worse than one
 * that states its scope.
 */

/** The three reserved values, verbatim from ADR-010 §4. */
export const RESERVED_PRODUCT_SLUGS: readonly string[] = ["finder", "segments", "types"];

/** Whether a `[slug]` value names reserved route space rather than a Family or a Product. */
export function isReservedProductSlug(slug: string): boolean {
  return RESERVED_PRODUCT_SLUGS.includes(slug.toLowerCase());
}
