import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { FINDER_FACETS } from "../products-data";

/**
 * 3 · Product Finder teaser.
 *
 * The finder itself is a route of its own (`/products/finder`); this block is the teaser
 * FRONTEND_ARCHITECTURE §105 specifies for the landing page. Its job is to say what the finder
 * filters on and send the reader there — not to be a second, worse finder embedded in a page
 * that has no catalogue data behind it yet.
 *
 * **The panel on the right is a picture, not a control.** It is marked `aria-hidden` and contains
 * no inputs at all — no disabled `<select>`, no dead search box. A screen-reader user gets the
 * facet names from the prose on the left, which lists them in full, and no one gets a control
 * that looks operable and is not.
 */
/**
 * "category, industry, application and packaging" — the facet names as running prose.
 *
 * Built rather than written out so the sentence cannot fall out of step with the panel beside it
 * when a facet is added. English conjunction only; this is fixed proof copy, and the real page
 * will get this sentence from the CMS in each locale rather than assembling it in code.
 */
function facetSentence(): string {
  const names = FINDER_FACETS.map((facet) => facet.name.toLowerCase());
  const last = names.at(-1);
  if (names.length < 2 || last === undefined) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${last}`;
}

/** `locale` is the route's own locale segment, threaded down from `ProductsExperience`. */
export function FinderTeaser({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec pr-finder" data-surface="light">
      {/* Texture the register does not have — the fourth cue in the seam; see products.css. */}
      <div className="fs-blueprint fs-blueprint--light" aria-hidden="true" />

      <div className="fs-wrap pr-finder-grid">
        <div className="pr-finder-copy reveal-fade-rise">
          <p className="fs-eyebrow">Product Finder</p>
          <h2 className="fs-d2">Filter to the grade.</h2>
          {/* The facet names are read off the same constant the panel renders, so the sentence
              and the picture beside it cannot describe different tools. */}
          <p className="fs-lead">
            Narrow the published range by {facetSentence()}, or search directly by product name,
            grade, or a public specification value.
          </p>

          <div className="pr-finder-actions">
            <a href={localeHref(locale, ROUTES.productFinder)} className="fs-btn fs-btn--outline">
              Open Product Finder
              <Arrow size={15} />
            </a>
          </div>
        </div>

        {/*
          A selection matrix, still `aria-hidden` and still a picture rather than a tool.

          Hiding it is the accessible choice here, not a shortcut: the paragraph to the left names
          all four parameters in running prose, and the values in this table are illustrative
          labels rather than catalogue data. Exposing them would give a screen-reader user a
          second, less precise account of the same thing and imply the catalogue holds exactly
          these values. One source of truth, and the finder itself is a route away.
        */}
        <div className="pr-matrix reveal-mask-wipe" aria-hidden="true">
          <p className="pr-matrix-head">
            <span>Selection parameters</span>
            <span>{String(FINDER_FACETS.length).padStart(2, "0")}</span>
          </p>

          {FINDER_FACETS.map((facet, i) => (
            <div className="pr-matrix-row" key={facet.name}>
              <span className="pr-matrix-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="pr-matrix-name">{facet.name}</span>
              <span className="pr-matrix-vals">
                {facet.sample.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </span>
            </div>
          ))}

          <div className="pr-matrix-row pr-matrix-row--direct">
            <span className="pr-matrix-index">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4.3-4.3" />
              </svg>
            </span>
            <span className="pr-matrix-name">Direct</span>
            <span className="pr-matrix-vals">
              <span>Search by product, grade, or specification</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
