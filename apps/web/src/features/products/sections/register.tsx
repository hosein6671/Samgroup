import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref } from "@/features/site/site-routes";

import { FAMILIES } from "../products-data";

/**
 * 2 · The register — the six product families.
 *
 * **Why a ledger and not a grid of cards.** Six cards in a 3×2 grid would give all six families
 * equal weight in equal boxes and leave room for roughly a line of text each — which is exactly
 * the amount of room in which "Base Oils" and "Marine Oils & Lubricants" become
 * indistinguishable. The taxonomies are the substance of this page: SITE_STRUCTURE §4 names
 * seven ranges under Base Oils and eleven under Lubricant Additives, and a buyer scanning for
 * "Group III" or "stern tube" needs to see those words, not a card that promises them.
 *
 * So each family is a full-measure entry with its ranges printed in full, stacked and hairline
 * separated — the same register construction the homepage uses for its specification blocks,
 * carrying more content. The sticky rail keeps the six-item index in view while a reader is deep
 * inside one entry.
 *
 * A Server Component. Nothing here holds state: every entry is a link, and the hover treatment
 * is CSS. The reveal is the design system's `reveal-stagger`, so this page adds nothing to the
 * first-load JavaScript budget.
 */
/**
 * `locale` is the route's own locale segment, threaded down from `ProductsExperience`.
 *
 * `FAMILIES[].href` stays what it is — the canonical, locale-less `/products/{slug}` this list
 * already validates against the route table at module load. Prefixing it in the fixture would put
 * per-request route state into static content and would need the six families three times over.
 * The address is composed here, once, at render.
 *
 * The rail above is same-page `#family-*` fragments and is untouched.
 */
export function ProductRegister({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec pr-reg" id="families" data-surface="light">
      <div className="fs-wrap">
        <header className="pr-reg-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">The range</p>
            <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "13ch" }}>
              Start with the product family.
            </h2>
          </div>
          <p className="fs-lead">
            Each family brings its published grades, applications, typical properties, packaging
            context, and available documents into one review path.
          </p>
        </header>

        <div className="pr-reg-layout">
          <nav className="pr-rail" aria-label="Jump to a product family">
            {FAMILIES.map((family, i) => (
              <a href={`#family-${family.id}`} key={family.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {family.code}
              </a>
            ))}
          </nav>

          <div className="pr-entries reveal-stagger">
            {FAMILIES.map((family, i) => (
              <article className="pr-entry" id={`family-${family.id}`} key={family.id}>
                <p className="pr-entry-index">
                  {String(i + 1).padStart(2, "0")}
                  <span>{family.code}</span>
                </p>

                <div>
                  {/* The heading's link covers the whole entry via a stretched pseudo-element,
                      so the row is one target with one accessible name rather than three. */}
                  <h3 className="pr-entry-title">
                    <a href={localeHref(locale, family.href)}>{family.name}</a>
                  </h3>

                  <p className="pr-entry-desc">{family.descriptor}</p>

                  <ul className="pr-ranges">
                    {family.ranges.map((range) => (
                      <li key={range}>{range}</li>
                    ))}
                  </ul>

                  {family.namedBlock && <p className="pr-named">{family.namedBlock}</p>}
                </div>

                <span className="pr-entry-go" aria-hidden="true">
                  <Arrow size={18} />
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
