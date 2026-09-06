import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import type { ProductListResult } from "@/lib/products";

/**
 * v2 · "See all N products" — the path to the rest of a large catalogue.
 *
 * The v2 catalog block serves the API's default page (twenty) and labels it "first page only"
 * when the family holds more. That is honest but it is not a way through: Engine Oils publishes
 * forty-five. This adds the link that is — into the existing Product Finder, which already reads
 * `?category=` and `?segment=` and paginates the full filtered set (`?page=`). No route, endpoint
 * or contract changes; it reuses a capability that is already live.
 *
 * ── The count and the destination carry the same filters ──────────────────
 *
 * `result` is the promise the catalog block awaits — same `?category=` and, when a bookmarked
 * `?segment=` narrowed it, same `?segment=`. `result.total` is therefore the size of *that*
 * filtered set, and `activeSegment` is passed straight into the Finder URL beside `category`, so
 * "See all N" and where it goes cannot describe two different result sets. Parameter order
 * matches `finder-query.ts`'s `finderHref` (`category` before `segment`) so a shared link reads
 * the same however it was built.
 *
 * It renders only when there genuinely is more to see (`total > listed`), so a family whose whole
 * (filtered) catalogue fits on one page shows nothing here.
 *
 * `async` only because it awaits the promise the route created; it issues no request of its own,
 * and it awaits the same promise the catalog block does, so the two cannot disagree about the
 * count. Placed inside the catalog's Suspense boundary — its skeleton covers this too.
 *
 * A Server Component. No `reveal-*` class.
 */
export async function CatalogMoreLink({
  products,
  familySlug,
  locale,
  activeSegment,
}: {
  readonly products: Promise<ProductListResult>;
  /** The family's canonical default-locale `Category.slug`, sent to the Finder as `?category=`. */
  readonly familySlug: string;
  readonly locale: string;
  /** The active `?segment=` as it arrived, already normalized; `null` is the unfiltered view. */
  readonly activeSegment: string | null;
}): Promise<ReactNode> {
  const result = await products;

  if (!result.ok || result.total <= result.products.length) return null;

  const params = new URLSearchParams({ category: familySlug });
  if (activeSegment !== null) params.set("segment", activeSegment);

  const href = `${localeHref(locale, ROUTES.productFinder)}?${params.toString()}`;

  return (
    <p className="pcv2-more">
      <a href={href}>
        See all {result.total} products in the Product Finder
        <Arrow size={14} />
      </a>
    </p>
  );
}
