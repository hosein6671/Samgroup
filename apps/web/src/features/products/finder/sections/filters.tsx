import type { ReactNode } from "react";

import { FAMILIES } from "../../products-data";
import { PRODUCT_TYPES } from "../../product-types-data";
import { SEGMENTS } from "../../segments-data";
import { NO_FILTERS, filterHref, finderHref, finderPath, hasFilters } from "../finder-query";

import type { FinderQuery } from "../finder-query";

/**
 * The finder's search field, its three filter rows, and the control that clears them.
 *
 * ── Every control is a link ─────────────────────────────────────────────────
 *
 * Not a `<select>`, not a checkbox, not a form. A chip is an `<a>` to this same route with a
 * different query string, so the section ships no JavaScript, needs no hydration, works before and
 * without it, and puts the filter state where a URL can carry it. `product-list.css`'s `.pl-filter`
 * and `.pl-chip` already draw exactly this construction for the Product Family pages' Segment row —
 * it is reused rather than restated, so the two surfaces cannot drift into looking like different
 * kinds of control for the same job.
 *
 * ── The three vocabularies, and where each one comes from ───────────────────
 *
 * **Product Family** is `FAMILIES` — the canonical ADR-009 registry, where each `id` IS the
 * default-locale `Category.slug`. That is the value sent as `?category=`, and it is read from the
 * registry rather than derived from the label: `products-data.ts` enforces at module load that a
 * family's id equals its route segment, which is the invariant that makes reading it safe.
 *
 * **Segment** is `SEGMENTS` — the eight approved rows of ADR-008 §4, mirrored frontend-side because
 * no `GET /segments` endpoint exists. Its own module states the full reasoning and states that it
 * is deleted rather than maintained the moment that endpoint lands.
 *
 * **Product Type** is `PRODUCT_TYPES` — the eight slugs and display names ADR-020 §1 approved on 31
 * August 2026, mirrored for the same reason and on the same terms. ADR-020 §2 is what permits this
 * row to exist at all: it approves showing the eight as a filter axis on this public Finder, and
 * approves nothing beyond the vocabulary and this surface.
 *
 * This file authors none of the three and copies no list into itself.
 *
 * ── Three axes, and Product Type is not a fourth reading of the first ───────
 *
 * ADR-020 §3: Product Family, Segment and Product Type are orthogonal axes over Product. The row
 * below does not replace or rename the six Families, and `lubricant-additives` and
 * `antifreeze-coolants` naming a Family and a Product Type alike is a coincidence of vocabulary
 * rather than a merge — the two chips send different parameters against different columns.
 *
 * ── Selecting one axis preserves the others ─────────────────────────────────
 *
 * Each chip carries the ACTIVE query and replaces one field, so choosing a Product Type keeps the
 * chosen Family, the chosen Segment and the search term, and every other combination likewise. That
 * is what makes the axes conjunctive in the interface the same way ADR-008 makes them conjunctive in
 * the API — the alternative, a chip that resets the other rows, would quietly contradict the
 * semantics the request is about to use. The search field carries the same guarantee through hidden
 * inputs, one per active axis, because a `GET` form submits only its own controls.
 *
 * ── …and every one of them resets the page ──────────────────────────────────
 *
 * `filterHref`, not `finderHref`, is what every chip and every "All" in this file is built from, and
 * the difference between them is the `page` the first one drops. A page number is a position in a
 * result; changing the filter changes the result, so the position stops meaning anything. Carrying
 * it would land a visitor on page 2 of a one-page selection and tell them, accurately, that the page
 * they are on does not exist. The clear-all uses `NO_FILTERS`, which is page 1 by construction, and
 * the search form resets by submitting no `page` at all.
 *
 * ── Labels are English in every locale, on purpose ──────────────────────────
 *
 * `content_translations` holds no Category, Segment or Product Type translation row, so `fa`/`ar`
 * would fall back to these same strings even if they were fetched — and for Product Type the
 * position is stronger than a missing row: ADR-020's Non-Goals put "any translation of a Product
 * Type name or slug" outside what is approved. Writing Persian or Arabic labels here would be
 * inventing approved vocabulary in a language nobody has approved it in; the page's `lang`/`dir`
 * still come from the `Locale` table and still apply.
 *
 * A Server Component. No state, no JavaScript.
 */

/** One row of the filter bar: a label, an "All" chip, and one chip per vocabulary entry. */
function FilterRow({
  label,
  legend,
  options,
  activeSlug,
  hrefFor,
}: {
  /** The short technical label in the index column. */
  readonly label: string;
  /** The row's accessible name — the label alone would read as a fragment out of context. */
  readonly legend: string;
  readonly options: readonly { readonly slug: string; readonly name: string }[];
  /** The value currently filtered on for THIS axis, or `null`. */
  readonly activeSlug: string | null;
  /** The link for one value of this axis, or for clearing it when given `null`. */
  readonly hrefFor: (slug: string | null) => string;
}): ReactNode {
  return (
    <nav className="pl-filter pf-filter" aria-label={legend}>
      <p className="pl-filter-label">{label}</p>

      <ul className="pl-filter-list">
        <li>
          <a
            className="pl-chip"
            href={hrefFor(null)}
            /*
             * `data-active` is what the stylesheet reads and `aria-current` is what a screen
             * reader reads, and both are set from one condition — so the visual state and the
             * announced state cannot disagree.
             */
            data-active={activeSlug === null ? "true" : undefined}
            aria-current={activeSlug === null ? "true" : undefined}
          >
            All
          </a>
        </li>

        {options.map((option) => (
          <li key={option.slug}>
            <a
              className="pl-chip"
              href={hrefFor(option.slug)}
              data-active={activeSlug === option.slug ? "true" : undefined}
              aria-current={activeSlug === option.slug ? "true" : undefined}
            >
              {option.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function FinderFilters({
  locale,
  query,
}: {
  /** The active locale segment. Half of every link this section emits. */
  readonly locale: string;
  /** The normalized filter state, exactly as the route read it off the URL. */
  readonly query: FinderQuery;
}): ReactNode {
  return (
    <div className="pf-filters">
      <form className="pf-search" action={finderPath(locale)} method="get" role="search">
        {/*
         * One hidden input per ACTIVE axis, and none for an inactive one. A `GET` form navigates to
         * `action` carrying only its own controls, so without these a search would silently clear
         * every chip the visitor had selected — and an axis with a hidden input carrying `""` would
         * be worse than a missing one, because `?productType=` would then appear in every shared
         * URL as a filter that is not being applied.
         *
         * **There is deliberately no hidden `page`.** The same mechanism that makes these three
         * necessary is what resets the page for free: a `GET` form submits its own controls and
         * nothing else, so a search from page 3 navigates to page 1 of the new result. Adding a
         * hidden `page` here would carry a position across a change of what is being positioned in.
         */}
        {query.category !== null && <input type="hidden" name="category" value={query.category} />}
        {query.segment !== null && <input type="hidden" name="segment" value={query.segment} />}
        {query.productType !== null && (
          <input type="hidden" name="productType" value={query.productType} />
        )}
        <label htmlFor="product-search">Search the published catalogue</label>
        <div className="pf-search-control">
          <input
            id="product-search"
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            placeholder="Product name, grade, or specification"
            autoComplete="off"
          />
          <button type="submit">Search</button>
        </div>
      </form>

      <FilterRow
        label="Family"
        legend="Filter products by product family"
        /*
         * `id` is the family's canonical default-locale `Category.slug` — the value that goes on
         * the wire as `?category=`. Taken from the registry, never derived from `name`.
         */
        options={FAMILIES.map((family) => ({ slug: family.id, name: family.name }))}
        activeSlug={query.category}
        hrefFor={(slug) => filterHref(locale, query, { category: slug })}
      />

      <FilterRow
        label="Segment"
        legend="Filter products by segment"
        options={SEGMENTS}
        activeSlug={query.segment}
        hrefFor={(slug) => filterHref(locale, query, { segment: slug })}
      />

      {/*
       * The only axis every published product carries. Segment above it reaches 41 of the 100,
       * because five of the eight approved Segment keys have no rule to derive them from; this one
       * reaches all 100. Drawn last regardless, so the two rows that shipped first keep the order a
       * returning visitor already read them in — coverage is a reason to offer an axis, not a reason
       * to reorder the bar around it.
       */}
      <FilterRow
        label="Product type"
        legend="Filter products by product type"
        options={PRODUCT_TYPES}
        activeSlug={query.productType}
        hrefFor={(slug) => filterHref(locale, query, { productType: slug })}
      />

      {/*
       * Offered only when there is something to clear. A permanently visible "Clear all" that does
       * nothing on an unfiltered page is a control that lies about the page's state — and every
       * row already carries its own "All" chip, which is the per-axis version of the same action.
       *
       * `NO_FILTERS` rather than an object literal listing every axis. A literal is a second place
       * that has to be edited when an axis is added, and the failure it produces is silent: the
       * control still renders, still says "clear", and leaves the forgotten axis in force.
       */}
      {hasFilters(query) && (
        <p className="pf-reset">
          <a href={finderHref(locale, NO_FILTERS)}>Clear search and filters</a>
        </p>
      )}
    </div>
  );
}
