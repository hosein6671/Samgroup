import type { ReactNode } from "react";

import { ProductCard } from "../../../product-card";
import { segmentName } from "../../../segments-data";

import type { ProductListResult } from "@/lib/products";

/**
 * v2 · Block 2 — the published products of this Family, directly beneath the hero.
 *
 * ── Why this is a v2-local component, not the shared `CategoryCatalog` ─────
 *
 * The shared section renders the full eight-chip Segment filter on every family. The v2 families
 * so far — Base Oils, and Engine Oils & Automotive Lubricants — each have catalog rows that carry
 * no Segment membership, so every chip returns nothing and the chip row is noise. This block's
 * treatment: **no chip row in the default view**, replaced by one plain line; and for a link or
 * bookmark that still carries `?segment=`, an active-filter notice with a reset back to the
 * unfiltered family URL. Nothing in `segments-data.ts` or the shared `catalog.tsx` is changed to
 * do this, and neither is the Segment vocabulary or any database assignment — the chips are only
 * hidden here, not removed anywhere.
 *
 * Access to the whole catalogue is not lost with the chips: a family that runs past the API's
 * first page gets `CatalogMoreLink` beneath this block, into the Product Finder, which keeps its
 * own Segment filter.
 *
 * `CatalogNotice` and the console reporting in `catalog.tsx` are module-private there, so this
 * file carries its own small versions rather than claiming an import it cannot have.
 *
 * ── Every failure keeps the page ──────────────────────────────────────────
 *
 * Same contract as the shared section: no branch throws, none calls `notFound()`, none
 * substitutes a fixture. An unreachable or erroring catalog service renders one restrained
 * "unavailable" block; the other blocks on the page are unaffected. An empty *unfiltered*
 * catalogue returns nothing rather than an empty heading (both v2 families publish products, so
 * this is a guard, not a state anyone sees today).
 *
 * A Server Component. `async` only because it awaits a promise the route created — it issues no
 * request of its own. No `reveal-*` class; legible at rest.
 */

type CatalogV2Props = {
  readonly products: Promise<ProductListResult>;
  readonly locale: string;
  /** The family's canonical default-locale `Category.slug`. */
  readonly familySlug: string;
  /** The `?segment=` value as it arrived, already normalized. `null` is the unfiltered view. */
  readonly activeSegment: string | null;
};

/** `/{locale}/products/{family}`, no filter — the reset target and the unfiltered link. */
function unfilteredHref(locale: string, familySlug: string): string {
  return `/${locale}/products/${familySlug}`;
}

/** Server-side only, never rendered. Names a cause rather than echoing the API's own message. */
function reportUnavailable(familySlug: string, result: ProductListResult): void {
  if (result.ok) return;

  const detail =
    result.reason === "unreachable"
      ? "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
      : result.reason === "unknown-filter"
        ? `the API rejected the '${result.field}' filter as an unknown slug`
        : `the API answered, but not with a product list (HTTP ${String(result.status)})`;

  console.warn(`[products:${familySlug}] product list unavailable — ${detail}`);
}

function CatalogNoticeV2({
  heading,
  body,
  reset,
}: {
  readonly heading: string;
  readonly body: string;
  readonly reset?: string;
}): ReactNode {
  return (
    <div className="pl-notice">
      <p className="pl-notice-heading">{heading}</p>
      <p className="pl-notice-body">{body}</p>
      {reset !== undefined && (
        <a className="pl-notice-reset" href={reset}>
          Show all products in this family
        </a>
      )}
    </div>
  );
}

export async function CategoryCatalogV2({
  products,
  locale,
  familySlug,
  activeSegment,
}: CatalogV2Props): Promise<ReactNode> {
  const result = await products;
  reportUnavailable(familySlug, result);

  const activeName = activeSegment === null ? null : segmentName(activeSegment);
  const reset = unfilteredHref(locale, familySlug);
  const listed = result.ok ? result.products.length : 0;

  /* An empty, unfiltered catalogue is not a section the buyer can use — suppress only that. */
  if (result.ok && listed === 0 && activeSegment === null) return null;

  return (
    <section className="fs-sec pcv2-browse" id="products" data-surface="light">
      <div className="fs-wrap">
        <header className="pcv2-browse-head">
          <p className="fs-eyebrow">In the catalogue</p>
          <h2 className="fs-d2">Published products</h2>
        </header>

        {activeSegment !== null && (
          <div className="pcv2-filterbar">
            <p>
              Filtered by segment: <b>{activeName ?? activeSegment}</b>
            </p>
            <a className="pcv2-filter-reset" href={reset}>
              Clear filter
            </a>
          </div>
        )}

        {result.ok && listed > 0 && (
          <>
            <p className="pl-count">
              <span>{String(listed).padStart(2, "0")}</span>
              {listed === 1 ? "product" : "products"}
              {result.total > listed && <small>of {result.total} — first page only</small>}
            </p>

            {activeSegment === null && result.total <= listed && (
              <p className="pcv2-browse-all">Showing every published product in this family.</p>
            )}

            <div className="pl-grid">
              {result.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  familySlug={familySlug}
                />
              ))}
            </div>
          </>
        )}

        {result.ok && listed === 0 && activeSegment !== null && (
          <CatalogNoticeV2
            heading="No products match this segment"
            body={
              activeName === null
                ? "The catalogue holds no product in this family for the requested segment."
                : `The catalogue holds no product in this family for ${activeName}.`
            }
            reset={reset}
          />
        )}

        {!result.ok && result.reason === "unknown-filter" && result.field === "segment" && (
          <CatalogNoticeV2
            heading="That segment is not recognised"
            body="The requested segment filter does not match a published segment, so no product list was returned."
            reset={reset}
          />
        )}

        {!result.ok && (result.reason !== "unknown-filter" || result.field !== "segment") && (
          <CatalogNoticeV2
            heading="Product list unavailable"
            body="The catalogue service did not answer this request. Nothing else on this page is affected, and the list returns when the service does."
          />
        )}
      </div>
    </section>
  );
}

/**
 * The Suspense fallback while the list is in flight.
 *
 * Deliberately no product names, counts or fabricated rows — three neutral placeholder rows and
 * the section frame. No Segment filter (this block does not render one), so it is a plainer
 * skeleton than the shared `CategoryCatalogSkeleton`.
 */
export function CategoryCatalogV2Skeleton(): ReactNode {
  return (
    <section className="fs-sec pcv2-browse" id="products" data-surface="light" aria-busy="true">
      <div className="fs-wrap">
        <header className="pcv2-browse-head">
          <p className="fs-eyebrow">In the catalogue</p>
          <h2 className="fs-d2">Published products</h2>
        </header>

        <p className="pl-count pl-count--pending">Loading the catalogue…</p>

        <div className="pl-grid" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div className="pl-card pl-card--pending" key={index}>
              <span className="pl-skeleton pl-skeleton--media" />
              <span className="pl-skeleton pl-skeleton--name" />
              <span className="pl-skeleton pl-skeleton--line" />
              <span className="pl-skeleton pl-skeleton--line pl-skeleton--short" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
