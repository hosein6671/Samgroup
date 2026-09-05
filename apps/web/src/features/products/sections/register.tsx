import type { ReactNode } from "react";

import { BrandedPhoto } from "@/features/home/branded-photo";
import { familyIconFor } from "@/features/site/icons";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref } from "@/features/site/site-routes";

import { getCategoryContent } from "../category/data";
import { FAMILIES } from "../products-data";

/**
 * 2 · The register — the six product families, image-led.
 *
 * ── From ledger to grid ──────────────────────────────────────────────────────
 *
 * The previous construction was a text-only ledger: six full-measure rows, each printing its whole
 * range list. That is the right shape for the six Family pages this section links to — full
 * taxonomies belong there — but on the Overview it left the page with no imagery above the fold
 * and a lot of technical text to scan before reaching a decision. This is a grid of six cards
 * instead: one photograph, one name, one restrained descriptor, a short preview of the range (not
 * the whole list — the Family page is where that lives), and one action.
 *
 * ── Where the photographs come from ─────────────────────────────────────────
 *
 * Not new imagery. Each of the six `category/data/*.ts` fixtures already carries an approved
 * `hero.image` — the same photograph its own Family page's hero already uses — read here through
 * `getCategoryContent`, the one function every category-aware page in this feature already calls.
 * Nothing is duplicated and nothing is invented: the six lab-sample photographs SAM Group approved
 * for each family's own page are what this grid shows.
 *
 * ── The fallback is not hypothetical scaffolding ─────────────────────────────
 *
 * `getCategoryContent(...)?.hero.image` is optional in its own type (`CategoryHero.image?`), and
 * this component honours that: a family with no approved photograph renders its glyph from
 * `FAMILY_ICON_BY_SLUG` on a quiet bordered surface instead — the same restrained, clearly-a-
 * placeholder treatment `ProductGallery`'s own fallback uses on Product Detail, reusing
 * `familyIconFor` rather than a second copy of that lookup.
 *
 * A Server Component, like the ledger it replaces. Nothing here holds state.
 */
const RANGE_PREVIEW_COUNT = 3;

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

        <div className="pr-family-grid reveal-stagger">
          {FAMILIES.map((family, i) => {
            const image = getCategoryContent(family.id)?.hero.image;
            const FamilyIcon = familyIconFor(family.id);
            const preview = family.ranges.slice(0, RANGE_PREVIEW_COUNT);
            const more = family.ranges.length - preview.length;

            return (
              <article className="pr-family-card" id={`family-${family.id}`} key={family.id}>
                <div className="pr-family-media">
                  {image ? (
                    <BrandedPhoto
                      src={image.src}
                      alt={image.alt}
                      caption={image.caption}
                      className="fs-story-photo pr-family-photo"
                      sizes="(max-width: 720px) 92vw, (max-width: 1180px) 46vw, 30vw"
                    />
                  ) : (
                    <div className="pr-family-fallback" aria-hidden="true">
                      {FamilyIcon && <FamilyIcon size="xl" />}
                    </div>
                  )}
                  <span className="pr-family-index">
                    {String(i + 1).padStart(2, "0")} · {family.code}
                  </span>
                </div>

                <div className="pr-family-body">
                  {/* The heading's link covers the whole card via a stretched pseudo-element, so
                      the card is one target with one accessible name rather than several. */}
                  <h3 className="pr-family-title">
                    {FamilyIcon && <FamilyIcon size="md" />}
                    <a href={localeHref(locale, family.href)}>{family.name}</a>
                  </h3>

                  <p className="pr-family-desc">{family.descriptor}</p>

                  <ul className="pr-family-ranges">
                    {preview.map((range) => (
                      <li key={range}>{range}</li>
                    ))}
                    {more > 0 && (
                      <li className="pr-family-more">+{more} more on the family page</li>
                    )}
                  </ul>

                  <span className="pr-family-go" aria-hidden="true">
                    View range
                    <Arrow size={15} />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
