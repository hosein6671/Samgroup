import type { ReactNode } from "react";

import { ProductCard } from "../../product-card";
import { productTypeName } from "../../product-types-data";
import { FAMILIES } from "../../products-data";
import { segmentName } from "../../segments-data";
import { FIRST_PAGE, NO_FILTERS, hasFilters, finderHref, pageHref } from "../finder-query";

import type { FinderQuery } from "../finder-query";
import type { ProductListResult } from "@/lib/products";

/**
 * The finder's result list — the only thing on this page that depends on the catalog service.
 *
 * ── Seven states, and they are seven because they mean seven different things ─
 *
 * loading · results · nothing published · nothing matches these filters · that page does not exist ·
 * that filter is not recognised · the list is unavailable. Collapsing any pair of them would
 * misreport the platform to a visitor: "no products match" is a fact about the catalog and "the
 * service did not answer" is a fact about the infrastructure, and ADR-010 §7 forbids the second
 * being presented as the first. The unfiltered empty state is kept apart from the filtered one for
 * the same reason at a smaller scale — one says the catalog is empty, the other says the visitor's
 * selection is.
 *
 * **The out-of-range page is the newest of the seven and the easiest to lose.** `?page=5` of a
 * two-page result is a 200 carrying zero rows, which is byte-for-byte what "nothing matches" looks
 * like — and telling a visitor their filters found nothing, when those filters found thirty-three
 * products two pages back, is the same class of lie as reporting an outage as an empty catalog. The
 * two are told apart by `meta.total`, which the same response already carries.
 *
 * **No branch invents a product.** There is no fallback fixture, no sample row and no placeholder
 * card anywhere below. A finder that showed plausible products while the API was down would be
 * publishing catalog data that does not exist. The out-of-range branch holds the same line from the
 * other direction: it does not clamp to the last page, and it does not issue a second request to
 * find out what that page holds — it says the page does not exist and offers the one that does.
 *
 * ── The count and the page bounds are the API's, not this component's ───────
 *
 * `meta.total` is the size of the real filtered set. `products.length` is how much of it this page
 * holds, which is the same number until a filter selects more than the endpoint's default page of
 * twenty — and when it is not, the difference is stated rather than rounded away.
 *
 * The last page is `ceil(total / limit)` over the response's OWN `total` and `limit`, never over a
 * page size assumed here. `limit` is the endpoint's to choose and this surface never sends one, so
 * the day it changes, the pagination follows without an edit.
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
    `[finder:category=${query.category ?? "-"},segment=${query.segment ?? "-"},` +
      `productType=${query.productType ?? "-"},page=${String(query.page)}] ` +
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

/**
 * The one sentence that describes the active selection, built from approved names only.
 *
 * ── Composed rather than enumerated ─────────────────────────────────────────
 *
 * Two axes plus a search term fit in a cascade of six `if`s. Three do not: the same shape would
 * need fourteen, and the branch that got left out would not be a missing sentence but a wrong one —
 * a filtered empty state saying "the requested filters" while the page is showing a named Product
 * Type chip as active. So the named axes are collected and joined, and the search term wraps
 * whatever that produced.
 *
 * The join is `in`, in axis order — Family, Segment, Product Type — which is the order the chips are
 * drawn in and the order `finderHref` writes the query string in. One order, three places.
 *
 * ── Only approved names reach the sentence ──────────────────────────────────
 *
 * Each lookup answers `null` for a slug outside its registry — a hand-typed value the API has not
 * rejected — and a `null` axis contributes nothing rather than its raw slug. Echoing the slug back
 * would put caller-supplied text where an approved display name belongs (ADR-009 for the Family,
 * ADR-008 §4 for the Segment, ADR-020 §1 for the Product Type). When that leaves nothing named at
 * all, the sentence says so generically rather than inventing a subject.
 */
function selectionSentence(query: FinderQuery): string {
  const named = [
    query.category === null ? null : familyName(query.category),
    query.segment === null ? null : segmentName(query.segment),
    query.productType === null ? null : productTypeName(query.productType),
  ].filter((name): name is string => name !== null);

  const selection = named.join(" in ");

  if (query.q !== null) {
    return selection === "" ? "the requested search" : `the search within ${selection}`;
  }

  return selection === "" ? "the requested filters" : selection;
}

/**
 * The last page the API's own numbers say exists, never fewer than one.
 *
 * `limit` is read off the response rather than assumed, so the endpoint remains free to change its
 * page size without this file agreeing to it separately. The `<= 0` guard is not defensive
 * decoration: `getProducts` falls `limit` back to `products.length` when the envelope omits it, and
 * on an out-of-range page that length is zero — which is exactly the case this function exists to
 * classify, and the one where a division would answer `Infinity`.
 *
 * An empty result is one page rather than zero. "Page 1 of 0" is not a thing to show anybody, and
 * the empty states below say what is true about it in words.
 */
function lastPageOf(total: number, limit: number): number {
  if (limit <= 0) return FIRST_PAGE;

  return Math.max(FIRST_PAGE, Math.ceil(total / limit));
}

/**
 * Previous · where you are · Next.
 *
 * ── Three links' worth of decisions ─────────────────────────────────────────
 *
 * **Real anchors, because the URL is the state.** Nothing on this page is client state, so a page
 * control that was a button would be a control that could not be shared, bookmarked, opened in a new
 * tab, or used by anything that does not run JavaScript. Each one is an `<a>` to this same route
 * carrying `?page=` and every filter untouched — `pageHref` is the mirror image of the chips'
 * `filterHref`, and between them they say the two things this surface can do.
 *
 * **An unavailable direction is rendered, not removed.** Previous on page 1 and Next on the last
 * page are `<span>`s, not anchors: they are not focusable, they are not announced as links, and
 * `aria-disabled` says why they are inert. Dropping them instead would move the position label and
 * shift what the remaining control does under a returning visitor's cursor between one page and the
 * next — the layout would be a different shape on the first, middle and last page of one list.
 *
 * **The label is the accessible name.** `aria-label` extends the visible word rather than replacing
 * it ("Previous" → "Previous page"), so the accessible name still contains the visible text and
 * voice control can act on what it says (WCAG 2.5.3). The position is a real sentence — "Page 2 of
 * 2" — because a bare "2 / 2" is a graphic that a screen reader reads as two numbers.
 *
 * The whole block is one `nav` with its own name, so it is a landmark a visitor can jump to and is
 * not confused with the filter rows, which are also `nav`s.
 */
function Pagination({
  locale,
  query,
  page,
  lastPage,
}: {
  readonly locale: string;
  readonly query: FinderQuery;
  /** The page being shown — the API's own `meta.page`, not the one this component assumed. */
  readonly page: number;
  readonly lastPage: number;
}): ReactNode {
  const hasPrevious = page > FIRST_PAGE;
  const hasNext = page < lastPage;

  return (
    <nav className="pf-pages" aria-label="Product list pages">
      {hasPrevious ? (
        <a
          className="pf-page-step"
          rel="prev"
          aria-label="Previous page"
          href={pageHref(locale, query, page - 1)}
        >
          Previous
        </a>
      ) : (
        <span className="pf-page-step" aria-disabled="true">
          Previous
        </span>
      )}

      <p className="pf-page-at">
        Page {page} of {lastPage}
      </p>

      {hasNext ? (
        <a
          className="pf-page-step"
          rel="next"
          aria-label="Next page"
          href={pageHref(locale, query, page + 1)}
        >
          Next
        </a>
      ) : (
        <span className="pf-page-step" aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
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

  const unfilteredHref = finderHref(locale, NO_FILTERS);
  const listed = result.ok ? result.products.length : 0;
  const filtered = hasFilters(query);

  /*
   * Everything about paging, decided from the response this component was already handed.
   *
   * `result.page` rather than `query.page`: they agree, but one of them describes the rows below and
   * the other describes what was asked for, and it is the first that a count and a "Page x of y"
   * must be built from.
   *
   * `outOfRange` requires `total > 0` on purpose. With no matches at all there is no page to be past
   * the end of, and the honest statement is that the selection is empty — telling a visitor that
   * page 3 does not exist, and then showing them an empty page 1, would be two answers where one is
   * true. So an empty result is the empty state at any page number, and this branch is reserved for
   * the case it is actually for: a real, non-empty result asked for beyond its last page.
   */
  const page = result.ok ? result.page : FIRST_PAGE;
  const lastPage = result.ok ? lastPageOf(result.total, result.limit) : FIRST_PAGE;
  const outOfRange = result.ok && result.total > 0 && page > lastPage;
  const firstOnPage = result.ok ? (page - 1) * result.limit + 1 : FIRST_PAGE;

  return (
    <div className="pf-results">
      {result.ok && listed > 0 && (
        <>
          <p className="pl-count">
            <span>{String(result.total).padStart(2, "0")}</span>
            {result.total === 1 ? "product" : "products"}
            {/*
             * Only when this page genuinely does not hold the whole set — and stated as the WINDOW
             * rather than as a prefix. This line read "showing the first 20" before there were
             * pages, which was true of every list that could exist then and is false on page 2 of
             * this one: those thirteen rows are the last thirteen, not the first thirteen.
             */}
            {/* One interpolated string rather than three children, so the range is one text node
                and cannot be broken across a line by whitespace the JSX introduced. */}
            {result.total > listed && (
              <small>{`showing ${String(firstOnPage)}–${String(firstOnPage + listed - 1)}`}</small>
            )}
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

          {/*
           * Absent on a single-page result, where it would be three controls saying that there is
           * nowhere to go. Every other page — first, middle and last — draws all three, so the block
           * keeps one shape for the whole of a list a visitor is walking through.
           */}
          {lastPage > FIRST_PAGE && (
            <Pagination locale={locale} query={query} page={page} lastPage={lastPage} />
          )}
        </>
      )}

      {/*
       * The page that does not exist. Distinguished from "nothing matches" by `meta.total`, which
       * says a real result is there to be looked at — so the remedy is page 1 of THIS selection, not
       * clearing it. `pageHref` carries every filter and the search term through untouched, which is
       * what makes this a way back into the result rather than out of it.
       */}
      {result.ok && listed === 0 && outOfRange && (
        <ResultNotice
          heading="That page does not exist"
          body={`This selection holds ${String(result.total)} ${result.total === 1 ? "product" : "products"} across ${String(lastPage)} ${lastPage === 1 ? "page" : "pages"}, so there is no page ${String(page)} to show.`}
          reset={pageHref(locale, query, FIRST_PAGE)}
          resetLabel="Go to the first page"
        />
      )}

      {result.ok && listed === 0 && !outOfRange && filtered && (
        <ResultNotice
          heading="No products match this search"
          body={`The catalog holds no published product for ${selectionSentence(query)}.`}
          reset={unfilteredHref}
          resetLabel="Clear search and filters"
        />
      )}

      {result.ok && listed === 0 && !outOfRange && !filtered && (
        <ResultNotice
          heading="No products published yet"
          body="The catalog holds no published products. The six product families and what each one covers are on the Products pages."
        />
      )}

      {/*
       * The visitor-caused failure, and the only one with a remedy. The API names ONE field even
       * when several are wrong, so each axis gets its own branch and clearing the named one is what
       * lets the others be re-checked. A branch missing here is not a missing message but a wrong
       * one: the row would fall to the catch-all below and tell the visitor the service was down
       * when it had in fact answered.
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

      {!result.ok && result.reason === "unknown-filter" && result.field === "productType" && (
        <ResultNotice
          heading="That product type is not recognised"
          body="The requested product type does not match a published type, so no product list was returned."
          reset={finderHref(locale, { ...query, productType: null })}
          resetLabel="Clear the product type filter"
        />
      )}

      {/*
       * Everything else — service down, refused, timed out, 5xx, a malformed payload, or a
       * `VALIDATION_ERROR` naming a field this page does not send. No reset is offered, because
       * nothing the visitor can do would change the outcome.
       */}
      {!result.ok &&
        (result.reason !== "unknown-filter" ||
          (result.field !== "category" &&
            result.field !== "segment" &&
            result.field !== "productType")) && (
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
