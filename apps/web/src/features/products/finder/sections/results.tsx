import type { ReactNode } from "react";

import { ProductCard } from "../../product-card";
import { FAMILIES } from "../../products-data";
import { segmentName } from "../../segments-data";
import { finderHref } from "../finder-query";

import type { FinderQuery } from "../finder-query";
import type { ProductListResult } from "@/lib/products";

/**
 * The finder's result list — the only thing on this page that depends on the catalog service.
 *
 * ── Six states, and they are six because they mean six different things ─────
 *
 * loading · results · nothing published · nothing matches these filters · that filter is not
 * recognised · the list is unavailable. Collapsing any pair of them would misreport the platform to
 * a visitor: "no products match" is a fact about the catalog and "the service did not answer" is a
 * fact about the infrastructure, and ADR-010 §7 forbids the second being presented as the first.
 * The unfiltered empty state is kept apart from the filtered one for the same reason at a smaller
 * scale — one says the catalog is empty, the other says the visitor's selection is.
 *
 * **No branch invents a product.** There is no fallback fixture, no sample row and no placeholder
 * card anywhere below. A finder that showed plausible products while the API was down would be
 * publishing catalog data that does not exist.
 *
 * ── The count is the API's, not this component's ────────────────────────────
 *
 * `meta.total` is the size of the real filtered set. `products.length` is how much of it this page
 * holds, which is the same number until a filter selects more than the endpoint's default page of
 * twenty — and when it is not, the difference is stated rather than rounded away.
 *
 * A Server Component. The only reason it is `async` is that it awaits a promise the ROUTE created;
 * it issues no request of its own, which keeps data access at the route (FRONTEND_ARCHITECTURE §7)
 * while still letting the page stream around it.
 */

/**
 * The approved family name for a canonical slug, or `null` for a slug the registry does not hold.
 *
 * Local rather than exported from `products-data.ts`, because it exists for one narrow purpose: a
 * notice that names the ACTIVE filter reads better than one that echoes a query string. `null` is
 * not an error — a hand-typed `?category=` reaches this page as caller-supplied text, and whether
 * it names a real family is the API's answer rather than this module's.
 */
function familyName(slug: string): string | null {
  return FAMILIES.find((family) => family.id === slug)?.name ?? null;
}

/**
 * Server-side only, and never rendered — the same arrangement the Product Family catalog uses.
 *
 * A finder that silently showed nothing when the API refused the request would hide exactly the
 * drift this integration exists to surface. Nothing from the API's own `message` is echoed; the
 * line names a cause instead.
 */
function report(query: FinderQuery, result: ProductListResult): void {
  if (result.ok) return;

  const detail =
    result.reason === "unreachable"
      ? "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
      : result.reason === "unknown-filter"
        ? `the API rejected the '${result.field}' filter as an unknown slug`
        : `the API answered, but not with a product list (HTTP ${String(result.status)})`;

  console.warn(
    `[finder:category=${query.category ?? "-"},segment=${query.segment ?? "-"}] ` +
      `product list unavailable — ${detail}`,
  );
}

/**
 * What is said when a state is not a list — one construction, several messages, so they read as the
 * same kind of statement about the results rather than as several different page states.
 *
 * Reuses `product-list.css`'s `.pl-notice` for the same reason the chips reuse `.pl-chip`: the
 * Product Family pages already draw this exact block for the same four conditions.
 */
function ResultNotice({
  heading,
  body,
  reset,
  resetLabel,
}: {
  readonly heading: string;
  readonly body: string;
  /** Where the visitor can get back to a working view, when there is such a place. */
  readonly reset?: string;
  readonly resetLabel?: string;
}): ReactNode {
  return (
    <div className="pl-notice reveal-fade-rise">
      <p className="pl-notice-heading">{heading}</p>
      <p className="pl-notice-body">{body}</p>
      {reset !== undefined && resetLabel !== undefined && (
        <a className="pl-notice-reset" href={reset}>
          {resetLabel}
        </a>
      )}
    </div>
  );
}

/** The one sentence that describes the active selection, built from approved names only. */
function selectionSentence(query: FinderQuery): string {
  const family = query.category === null ? null : familyName(query.category);
  const segment = query.segment === null ? null : segmentName(query.segment);

  if (family !== null && segment !== null) return `${family} in ${segment}`;
  if (family !== null) return family;
  if (segment !== null) return segment;

  /*
   * Reached when a filter is active but its slug is outside the registries — a hand-typed value the
   * API has not rejected. The raw value is deliberately NOT echoed: it is caller-supplied text, and
   * repeating it back would put an unapproved string where an approved name belongs.
   */
  return "the requested filters";
}

type ResultsProps = {
  readonly products: Promise<ProductListResult>;
  /** The active locale segment — half of every link this section emits. */
  readonly locale: string;
  /** The normalized filter state, exactly as the route read it off the URL. */
  readonly query: FinderQuery;
};

export async function FinderResults({ products, locale, query }: ResultsProps): Promise<ReactNode> {
  const result = await products;

  report(query, result);

  const unfilteredHref = finderHref(locale, { category: null, segment: null });
  const listed = result.ok ? result.products.length : 0;
  const filtered = query.category !== null || query.segment !== null;

  return (
    <div className="pf-results">
      {result.ok && listed > 0 && (
        <>
          <p className="pl-count">
            <span>{String(result.total).padStart(2, "0")}</span>
            {result.total === 1 ? "product" : "products"}
            {/*
             * Only when this page genuinely does not hold the whole set. `limit` defaults to 20
             * server-side and the catalog is nowhere near it today, so this is silent — but a list
             * that showed 20 of 40 without saying so would be a wrong count, not a short one.
             */}
            {result.total > listed && <small>showing the first {listed}</small>}
          </p>

          <div className="pl-grid reveal-stagger">
            {result.products.map((product) => (
              /*
               * The same card the Product Family pages render, from the same `GET /products` row,
               * composing the same flat canonical URL — `/{locale}/products/{product-slug}`
               * (ADR-007 §4, ADR-010 §2). The card builds that path itself from the locale it is
               * given, which is what makes a nested or cross-locale link impossible here.
               */
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </>
      )}

      {result.ok && listed === 0 && filtered && (
        <ResultNotice
          heading="No products match these filters"
          body={`The catalog holds no published product for ${selectionSentence(query)}.`}
          reset={unfilteredHref}
          resetLabel="Clear all filters"
        />
      )}

      {result.ok && listed === 0 && !filtered && (
        <ResultNotice
          heading="No products published yet"
          body="The catalog holds no published products. The six product families and what each one covers are on the Products pages."
        />
      )}

      {/*
       * The visitor-caused failure, and the only one with a remedy. The API resolves `category`
       * before `segment`, so at most one field is named even when both are wrong — clearing the
       * named one is what lets the other be re-checked.
       */}
      {!result.ok && result.reason === "unknown-filter" && result.field === "category" && (
        <ResultNotice
          heading="That product family is not recognised"
          body="The requested product family does not match a published family, so no product list was returned."
          reset={finderHref(locale, { ...query, category: null })}
          resetLabel="Clear the family filter"
        />
      )}

      {!result.ok && result.reason === "unknown-filter" && result.field === "segment" && (
        <ResultNotice
          heading="That segment is not recognised"
          body="The requested segment does not match a published segment, so no product list was returned."
          reset={finderHref(locale, { ...query, segment: null })}
          resetLabel="Clear the segment filter"
        />
      )}

      {/*
       * Everything else — service down, refused, timed out, 5xx, a malformed payload, or a
       * `VALIDATION_ERROR` naming a field this page does not send. No reset is offered, because
       * nothing the visitor can do would change the outcome.
       */}
      {!result.ok &&
        (result.reason !== "unknown-filter" ||
          (result.field !== "category" && result.field !== "segment")) && (
          <ResultNotice
            heading="Product list unavailable"
            body="The catalog service did not answer this request. No products can be listed until it does; the filters above are unaffected."
          />
        )}
    </div>
  );
}

/**
 * What stands in while the list is in flight.
 *
 * The route hands this section a promise it does not await, so React streams the hero and the
 * filter bar first and this block occupies the results' place until the catalog answers. That
 * matters more than it looks: `api-client` allows a request ten seconds before it times out, and
 * without a boundary here a hung catalog service would hold back the whole page — including the
 * filter controls, which are the one thing a visitor could use to try something else.
 *
 * Deliberately **no product names, no count and no fabricated rows**: a skeleton that guessed at
 * content would be inventing catalog data for the duration of a request.
 */
export function FinderResultsSkeleton(): ReactNode {
  return (
    <div className="pf-results" aria-busy="true">
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
  );
}
