import type { ReactNode } from "react";

import { FAMILIES } from "../../products-data";
import { SEGMENTS } from "../../segments-data";
import { finderHref, hasFilters } from "../finder-query";

import type { FinderQuery } from "../finder-query";

/**
 * The finder's two filter rows, and the control that clears them.
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
 * ── The two vocabularies, and where each one comes from ─────────────────────
 *
 * **Product Family** is `FAMILIES` — the canonical ADR-009 registry, where each `id` IS the
 * default-locale `Category.slug`. That is the value sent as `?category=`, and it is read from the
 * registry rather than derived from the label: `products-data.ts` enforces at module load that a
 * family's id equals its route segment, which is the invariant that makes reading it safe.
 *
 * **Segment** is `SEGMENTS` — the eight approved rows of ADR-008 §4, mirrored frontend-side because
 * no `GET /segments` endpoint exists. Its own module states the full reasoning and states that it
 * is deleted rather than maintained the moment that endpoint lands. This file adds no third
 * vocabulary and copies neither list.
 *
 * **There is no Product Type row**, and there deliberately is not: no ProductType name or slug is
 * approved (ADR-008), `product_types` holds zero rows, and every non-blank `?productType=` answers
 * 400. A control for it would be a UI for a vocabulary that does not exist.
 *
 * ── Selecting one axis preserves the other ──────────────────────────────────
 *
 * Each chip spreads the ACTIVE query and replaces one field, so choosing a Segment keeps the chosen
 * Family and vice versa. That is what makes the two axes conjunctive in the interface the same way
 * ADR-008 makes them conjunctive in the API — the alternative, a chip that resets the other row,
 * would quietly contradict the semantics the request is about to use.
 *
 * ── Labels are English in every locale, on purpose ──────────────────────────
 *
 * `content_translations` holds no Category or Segment translation row, so `fa`/`ar` would fall back
 * to these same strings even if they were fetched. Writing Persian or Arabic labels here would be
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
      <FilterRow
        label="Family"
        legend="Filter products by product family"
        /*
         * `id` is the family's canonical default-locale `Category.slug` — the value that goes on
         * the wire as `?category=`. Taken from the registry, never derived from `name`.
         */
        options={FAMILIES.map((family) => ({ slug: family.id, name: family.name }))}
        activeSlug={query.category}
        hrefFor={(slug) => finderHref(locale, { ...query, category: slug })}
      />

      <FilterRow
        label="Segment"
        legend="Filter products by segment"
        options={SEGMENTS}
        activeSlug={query.segment}
        hrefFor={(slug) => finderHref(locale, { ...query, segment: slug })}
      />

      {/*
       * Offered only when there is something to clear. A permanently visible "Clear all" that does
       * nothing on an unfiltered page is a control that lies about the page's state — and both
       * rows already carry their own "All" chip, which is the per-axis version of the same action.
       */}
      {hasFilters(query) && (
        <p className="pf-reset">
          <a href={finderHref(locale, { category: null, segment: null })}>Clear all filters</a>
        </p>
      )}
    </div>
  );
}
