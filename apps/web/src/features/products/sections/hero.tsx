import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

import { FAMILIES } from "../products-data";

/**
 * 1 · Products hero.
 *
 * The headline is the one string SITE_STRUCTURE §3 actually specifies for this page — "A
 * Complete Range of Petroleum Products" — and it is used verbatim rather than improved on.
 * Everything under it is descriptive: this page's job is to route a buyer into one of six
 * families, so the hero states the shape of the range and then hands over to the register.
 *
 * The right column carries the product architecture — see `ProductArchitecture` below.
 */
export function ProductsHero(): ReactNode {
  return (
    <section className="pr-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pr-hero-inner">
        <div className="pr-hero-copy reveal-fade-rise">
          <p className="fs-eyebrow">Products</p>
          <h1 className="fs-d1">A Complete Range of Petroleum Products</h1>
          <p className="fs-lead">
            Six product families, each one a page of its own — base stocks, the additives that turn
            them into finished fluids, and the finished fluids themselves. Start with the family, or
            go straight to a grade.
          </p>

          <div className="pr-hero-actions">
            <a href={ROUTES.productFinder} className="fs-btn fs-btn--gold">
              Open Product Finder
              <Arrow size={15} />
            </a>
            <a href={ROUTES.requestQuote} className="fs-btn fs-btn--glass">
              Request a Quote
            </a>
          </div>
        </div>

        <ProductArchitecture />
      </div>
    </section>
  );
}

/**
 * The product architecture — the hero's right-hand element.
 *
 * ── What it is ──────────────────────────────────────────────────────────────
 *
 * A riser diagram: one vertical stem, six branches. It draws the claim the register's heading
 * makes in words — one refining chain that branches six ways — and it is the page's index at the
 * same time, since every branch is a link into its entry below.
 *
 * ── Why this rather than a panel of figures ─────────────────────────────────
 *
 * The homepage fills this position with the live telemetry table, and copying that shape here
 * would need numbers this page has none of: no capacity, no throughput, no counts, nothing
 * commercial. Every label below is a category name or its two-letter mark, both already frozen
 * in `site-routes.ts`. Nothing here is a metric, and nothing here is invented.
 *
 * It also replaces the key strip that previously ran under the hero. That strip listed the same
 * six families this panel lists — two indexes of one set, one of them ragged at 390px. Folding
 * it into the panel removes the duplication and fills the space the copy left empty.
 *
 * ── Construction ────────────────────────────────────────────────────────────
 *
 * CSS only. The stem, the connector ticks and the branch nodes are borders and pseudo-elements
 * on tokenised colours — no SVG to keep in sync with the data, no canvas, no JavaScript, and
 * nothing added to the first-load budget.
 */
function ProductArchitecture(): ReactNode {
  return (
    <aside className="pr-arch reveal-fade-rise" aria-labelledby="pr-arch-title">
      <p className="fs-eyebrow" id="pr-arch-title">
        Product architecture
      </p>

      <p className="pr-arch-note">One refining chain, six engineered branches.</p>

      <ol className="pr-arch-stem">
        {FAMILIES.map((family, i) => (
          <li className="pr-arch-branch" key={family.id}>
            <a href={`#family-${family.id}`}>
              <span className="pr-arch-code">
                {String(i + 1).padStart(2, "0")} · {family.code}
              </span>
              <span className="pr-arch-name">{family.name}</span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
