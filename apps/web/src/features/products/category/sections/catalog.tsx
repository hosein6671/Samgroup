import type { ReactNode } from "react";

import { ProductCard } from "../../product-card";
import { SEGMENTS, segmentName } from "../../segments-data";

import type { ProductListResult } from "@/lib/products";

/**
 * The published products of one Product Family — the first surface in `apps/web` to render the
 * Product API.
 *
 * ── Where it sits, and why ──────────────────────────────────────────────────
 *
 * Directly after the Product Range register (SITE_STRUCTURE §4 item 3) and before Key
 * Specifications. The register states the family's TAXONOMY — the sub-ranges the source document
 * names — and this states its CATALOG: the `Product` rows that actually exist in `sam_platform`
 * for that family. They are two different claims about the same family and the page reads
 * correctly only if they stay two blocks. Merging them would either put database rows under a
 * taxonomy heading or put approved taxonomy under a list that is presently demo data.
 *
 * It is deliberately **not** one of §4's twelve items, exactly as `CategoryRelated` is not. §4 was
 * written when there was no Product entity in the frontend at all.
 *
 * ── Filtering is the API's, entirely ────────────────────────────────────────
 *
 * Each chip is a plain link to this same page carrying `?segment=<slug>`, and the page re-fetches
 * `GET /products?category=…&segment=…`. Nothing is filtered client-side and nothing is filtered
 * server-side in `apps/web` either: ADR-008 fixes the semantics of combining `category` and
 * `segment`, the API implements them, and a second implementation here could only ever agree by
 * coincidence. It also means the count under the heading is `meta.total` — the size of the real
 * filtered set — rather than the length of something this component narrowed.
 *
 * That is also why the chips are links rather than a control: there is no client JavaScript in
 * this section, the filter is in the URL, and the browser's own history is the state machine.
 *
 * ── Every failure keeps the page ────────────────────────────────────────────
 *
 * ADR-010 §7 forbids infrastructure failure becoming a canonical-content 404, and the rule is
 * wider than the status code: a family page's editorial content is registered locally and owes
 * nothing to the catalog endpoint. So no branch below throws, none calls `notFound()`, and none
 * substitutes a fixture — an unavailable list says it is unavailable, in one restrained block,
 * while the other ten sections render exactly as they did before this gate.
 *
 * A Server Component. The only reason it is `async` is that it awaits a promise the ROUTE created;
 * it issues no request of its own, which is what keeps data access at the route per
 * FRONTEND_ARCHITECTURE §7 while still letting the page stream around it.
 */

/** `/{locale}/products/{family}` plus the filter, or without it for the unfiltered view. */
function filterHref(locale: string, familySlug: string, segmentSlug?: string): string {
  const path = `/${locale}/products/${familySlug}`;

  return segmentSlug === undefined
    ? path
    : `${path}?${new URLSearchParams({ segment: segmentSlug }).toString()}`;
}

/**
 * Server-side only, and never rendered — the same arrangement `resolve-category-page.ts` uses.
 *
 * A product list that silently showed nothing when the API refused the request would hide exactly
 * the drift this integration exists to surface. Nothing from the API's own `message` is echoed;
 * the line names a cause instead.
 */
function report(familySlug: string, result: ProductListResult): void {
  if (result.ok) return;

  const detail =
    result.reason === "unreachable"
      ? "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
      : result.reason === "unknown-filter"
        ? `the API rejected the '${result.field}' filter as an unknown slug`
        : `the API answered, but not with a product list (HTTP ${String(result.status)})`;

  console.warn(`[products:${familySlug}] product list unavailable — ${detail}`);
}

type CatalogProps = {
  readonly products: Promise<ProductListResult>;
  /** The active locale segment — half of every link this section emits. */
  readonly locale: string;
  /** The family's canonical default-locale `Category.slug`; the other half. */
  readonly familySlug: string;
  /** The `?segment=` value as it arrived, already normalized. `null` is the unfiltered view. */
  readonly activeSegment: string | null;
};

/** The filter bar. Rendered above every state, including the failures — see `CategoryCatalog`. */
function SegmentFilter({
  locale,
  familySlug,
  activeSegment,
}: Omit<CatalogProps, "products">): ReactNode {
  return (
    <nav className="pl-filter" aria-label="Filter products by segment">
      <p className="pl-filter-label">Segment</p>

      <ul className="pl-filter-list">
        <li>
          <a
            className="pl-chip"
            href={filterHref(locale, familySlug)}
            data-active={activeSegment === null ? "true" : undefined}
            aria-current={activeSegment === null ? "true" : undefined}
          >
            All
          </a>
        </li>

        {SEGMENTS.map((segment) => (
          <li key={segment.slug}>
            <a
              className="pl-chip"
              href={filterHref(locale, familySlug, segment.slug)}
              data-active={activeSegment === segment.slug ? "true" : undefined}
              aria-current={activeSegment === segment.slug ? "true" : undefined}
            >
              {segment.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * What is said when a filter selects nothing, an unknown filter is requested, or the API is
 * unavailable — one construction, three messages, so the three read as the same kind of statement
 * about the list rather than as three different page states.
 */
function CatalogNotice({
  heading,
  body,
  reset,
}: {
  readonly heading: string;
  readonly body: string;
  readonly reset?: string;
}): ReactNode {
  return (
    <div className="pl-notice reveal-fade-rise">
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

export async function CategoryCatalog({
  products,
  locale,
  familySlug,
  activeSegment,
}: CatalogProps): Promise<ReactNode> {
  const result = await products;

  report(familySlug, result);

  const activeName = activeSegment === null ? null : segmentName(activeSegment);
  const unfilteredHref = filterHref(locale, familySlug);
  const listed = result.ok ? result.products.length : 0;

  return (
    <section className="fs-sec pl-sec" id="products" data-surface="light">
      <div className="fs-wrap">
        <header className="pl-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Published products</p>
            <h2 className="fs-d2">
              {activeName === null ? "In this family" : `In this family · ${activeName}`}
            </h2>
          </div>

          <div className="pl-head-note">
            <p className="fs-lead">
              The catalog entries held for this family, as the platform publishes them.
            </p>
            {/*
             * The "individual product pages are not published yet, so these entries are not links"
             * caveat that stood here is GONE, because it is no longer true: the Product branch of
             * the shared namespace exists and every card links to its product's canonical page. A
             * caveat that outlives the limitation it describes is worse than no caveat — it teaches
             * a reader to distrust the ones that are still accurate.
             */}
          </div>
        </header>

        {/*
         * The filter renders in every state, failures included. It is navigation, not a view of
         * the data: removing it when the list is unavailable would take away the one control that
         * lets a visitor get back to a working view.
         */}
        <SegmentFilter locale={locale} familySlug={familySlug} activeSegment={activeSegment} />

        {result.ok && listed > 0 && (
          <>
            <p className="pl-count">
              <span>{String(listed).padStart(2, "0")}</span>
              {listed === 1 ? "product" : "products"}
              {/*
               * Only when the page genuinely does not hold the whole set. `limit` defaults to 20
               * server-side and no family approaches it today, so this is silent — but a list that
               * showed 20 of 40 without saying so would be a wrong count, not a short one.
               */}
              {result.total > listed && <small>of {result.total} — first page only</small>}
            </p>

            <div className="pl-grid reveal-stagger">
              {result.products.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} />
              ))}
            </div>
          </>
        )}

        {result.ok && listed === 0 && activeSegment !== null && (
          <CatalogNotice
            heading="No products match this segment"
            body={
              activeName === null
                ? "The catalog holds no product in this family for the requested segment."
                : `The catalog holds no product in this family for ${activeName}.`
            }
            reset={unfilteredHref}
          />
        )}

        {result.ok && listed === 0 && activeSegment === null && (
          <CatalogNotice
            heading="No products published yet"
            body="This family's catalog entries have not been published. Its range and specifications are above."
          />
        )}

        {/*
         * The visitor-caused failure, and the only one with a remedy. A `category` rejection is
         * not this — that would mean the route's own family slug did not resolve, which is drift
         * rather than a bad filter, and it falls through to the block below.
         */}
        {!result.ok && result.reason === "unknown-filter" && result.field === "segment" && (
          <CatalogNotice
            heading="That segment is not recognised"
            body="The requested segment filter does not match a published segment, so no product list was returned."
            reset={unfilteredHref}
          />
        )}

        {!result.ok && (result.reason !== "unknown-filter" || result.field !== "segment") && (
          <CatalogNotice
            heading="Product list unavailable"
            body="The catalog service did not answer this request. Nothing else on this page is affected, and the list returns when the service does."
          />
        )}
      </div>
    </section>
  );
}

/**
 * What stands in while the list is in flight.
 *
 * The route hands this section a promise it does not await, so React streams the rest of the page
 * first and this block is what occupies its place until the catalog answers. That matters more
 * than it looks: `api-client` allows a request ten seconds before it times out, and without a
 * boundary here a hung catalog service would hold back eleven sections of approved editorial
 * content that owe it nothing.
 *
 * It draws the filter — which is navigation and is known without any fetch — and three neutral
 * placeholder rows. Deliberately **no product names, no counts and no fabricated rows**: a
 * skeleton that guessed at content would be inventing catalog data for the duration of a request.
 */
export function CategoryCatalogSkeleton({
  locale,
  familySlug,
  activeSegment,
}: Omit<CatalogProps, "products">): ReactNode {
  return (
    <section className="fs-sec pl-sec" id="products" data-surface="light" aria-busy="true">
      <div className="fs-wrap">
        <header className="pl-head">
          <div>
            <p className="fs-eyebrow">Published products</p>
            <h2 className="fs-d2">In this family</h2>
          </div>
        </header>

        <SegmentFilter locale={locale} familySlug={familySlug} activeSegment={activeSegment} />

        <p className="pl-count pl-count--pending">Loading the catalog…</p>

        <div className="pl-grid" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div className="pl-card pl-card--pending" key={index}>
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
