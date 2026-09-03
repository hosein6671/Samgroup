import type { ReactNode } from "react";

import { CatalogueIcon, EnquiryRouteIcon, FamiliesIcon } from "@/features/site/icons";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { type FactIcon, HERO_SPEC } from "../home-data";
import { OilField } from "../visuals/oil-field";
import { ProductRouteSchematic } from "../visuals/product-route-schematic";

/**
 * The specification panel's glyphs, keyed by the name the fixture carries.
 *
 * A map rather than a field on the data: `home-data.ts` is the shape of a real fetch and an API
 * cannot send a React reference. It is also exhaustive by type, so adding a fourth `FactIcon`
 * without a glyph is a compile error rather than a blank square.
 */
const SPEC_GLYPHS: Record<FactIcon, (props: { readonly size: "sm" }) => ReactNode> = {
  families: FamiliesIcon,
  catalogue: CatalogueIcon,
  "enquiry-route": EnquiryRouteIcon,
};

/**
 * 1 · Hero.
 *
 * Full viewport over the oil field, with the veil grading it down at top and bottom so display
 * type never sits on a bright crest. Copy occupies seven columns, the live telemetry panel four
 * — the asymmetry is what keeps it from reading as a centred banner.
 *
 * The headline is server-rendered text in three masked lines. That makes it the LCP element and
 * keeps it crawlable; only the canvas and the counters are client work, and both sit behind it.
 */
export function Hero({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-hero" id="top" data-surface="midnight">
      <OilField />
      <div className="fs-hero-veil" aria-hidden="true" />
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-hero-body">
        <div className="fs-wrap fs-grid12 fs-hero-grid">
          <div className="fs-hero-copy">
            <div className="fs-eyebrow fs-rv-l">Petroleum products for professional buyers</div>

            {/*
             * Three lines, three masks — each travels up from behind its own overflow box.
             *
             * The workbook's title for this segment is "Advanced Petroleum Solutions for Global
             * Industries". It is not reproduced. "Global" is a market claim the `Notes` sheet does
             * not support — it names Africa, the countries around India, and Türkiye — and the
             * owner made that sheet the factual authority on markets. "Advanced" asserts nothing
             * checkable. What the segment's stated purpose actually asks for is three answers:
             * what SAM Group produces, who it is, and why a buyer should trust it. These are those
             * three, in that order, and the third is the page's whole differentiator.
             */}
            <h1 className="fs-d1">
              <span className="fs-line-mask">
                <span>Base oils and lubricants.</span>
              </span>
              <span className="fs-line-mask">
                <span>Produced, not traded.</span>
              </span>
              <span className="fs-line-mask">
                <span>
                  <em>Specified with you.</em>
                </span>
              </span>
            </h1>

            <p className="fs-hero-lead fs-rv-l">
              SAM Group produces and supplies base oils, engine oils, industrial and marine
              lubricants, additives and coolants — and develops formulations to meet the technical
              and commercial requirements behind an order.
            </p>

            <div className="fs-hero-cta fs-rv-l">
              <a href={localeHref(locale, ROUTES.products)} className="fs-btn fs-btn--gold">
                Explore our products
                <Arrow />
              </a>
              <a href={localeHref(locale, ROUTES.requestQuote)} className="fs-btn fs-btn--glass">
                Request a quotation
              </a>
            </div>
          </div>

          {/*
           * The right rail. It spans the full height of the hero body and holds the schematic at
           * the top and the specification panel at the bottom — see `.fs-hero-side` in
           * `flagship.css` for why that is what closed the 348-505px dead band this hero carried.
           */}
          <aside className="fs-hero-side fs-rv-l">
            <ProductRouteSchematic />

            <div className="fs-hero-spec">
              {/*
               * `h2`, not the prototype's `h4`. The panel sits directly after the `h1`, and
               * jumping two levels breaks the document outline that screen-reader users
               * navigate by. The visual is unchanged — size lives on the CSS class, not on the
               * tag, which is exactly the role/element separation the design system is built on.
               */}
              <h2>Portfolio at a glance</h2>
              <dl style={{ margin: 0 }}>
                {HERO_SPEC.map((row) => {
                  const Glyph = row.icon ? SPEC_GLYPHS[row.icon] : null;

                  return (
                    <div className="fs-spec-row" key={row.label}>
                      <dt>
                        {Glyph ? <Glyph size="sm" /> : null}
                        {row.label}
                      </dt>
                      <dd className="fs-tnum">{row.value}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </aside>
        </div>
      </div>

      <div className="fs-scroll-hint" aria-hidden="true">
        <i />
        <span>Explore the SAM Group portfolio</span>
      </div>

      {/*
       * The animated statistics band that closed the hero is removed.
       *
       * Two reasons, and the second is the one that matters. It counted the same three values the
       * specification panel above it already lists, three hundred pixels away — the duplication the
       * owner asked to remove. And the workbook gives credibility figures their own segment,
       * "Trust Indicators", immediately after Who We Are; a hero that pre-empts it leaves that
       * segment with nothing to say. `sections/trust.tsx` is that segment.
       */}
    </section>
  );
}
