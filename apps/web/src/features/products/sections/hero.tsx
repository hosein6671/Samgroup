import { structuralSection, type StructuralFields } from "@/features/content/structural-copy";
import type { ReactNode } from "react";

import { BrandedPhoto } from "@/features/home/branded-photo";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

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
/**
 * `locale` is the route's own locale segment, threaded down from `ProductsExperience`.
 *
 * The two hero actions are structural routes and were rendered raw. The grade index below them is
 * same-page `#family-*` fragments, which carry no locale and are left exactly as they were.
 */
export function ProductsHero({
  locale,
  editorial,
}: { readonly locale: string } & { readonly editorial?: StructuralFields }): ReactNode {
  const copy = structuralSection("products-landing", "hero", editorial);

  return (
    <section className="pr-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pr-hero-inner">
        <div className="pr-hero-copy reveal-fade-rise">
          <p className="fs-eyebrow">{copy.text("products")}</p>
          <h1 className="fs-d1">{copy.text("find_the_product_define_the")}</h1>
          <p className="fs-lead">{copy.text("browse_base_oils_additives_automotive")}</p>

          <div className="pr-hero-actions">
            <a href={localeHref(locale, ROUTES.productFinder)} className="fs-btn fs-btn--gold">
              {copy.text("open_product_finder")}
              <Arrow size={15} />
            </a>
            <a href={localeHref(locale, ROUTES.requestQuote)} className="fs-btn fs-btn--glass">
              {copy.text("request_a_quote")}
            </a>
          </div>
        </div>

        <div className="pr-hero-visual reveal-fade-rise">
          <BrandedPhoto
            src="/images/products-portfolio-review.webp"
            alt={copy.text("industrial_lubricant_containers_and_oil")}
            caption={copy.text("caption_6")}
            className="pr-hero-photo"
            sizes="(max-width: 1180px) 100vw, 48vw"
          />
        </div>
      </div>

      <div className="fs-wrap pr-hero-index">
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

      <p className="pr-arch-note">Choose a family to review its range and available information.</p>

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
