import type { ReactNode } from "react";

import { FormulationIcon, ManufacturerIcon, SupplyIcon } from "@/features/site/icons";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { BrandedPhoto } from "../branded-photo";
import { WHO_WE_ARE, type WhoWeAreClaim } from "../home-data";

/**
 * The three claims' glyphs — the same set the Trust Indicators and Why Choose cards draw from.
 *
 * The list was a bare `<dl>`: a 128px label column and a sentence, on a page where every other
 * enumeration is a glyph in a plate beside a title. It read as a table that had wandered into an
 * editorial section. Sharing the icon vocabulary is what puts it back in the same document.
 */
const GLYPHS: Record<
  WhoWeAreClaim["icon"],
  (props: { readonly size: "lg"; readonly draw: true }) => ReactNode
> = {
  produce: ManufacturerIcon,
  formulate: FormulationIcon,
  supply: SupplyIcon,
};

/**
 * 2 · Who We Are.
 *
 * The workbook's second Home segment, and its stated purpose is a single sentence: **"Introduce
 * Sam Group as a manufacturer, not a trading company."** Everything here serves that and nothing
 * else — no product range, no advantages, no customization story. Those are segments 4, 5 and 7,
 * and saying them here as well is the repetition the owner asked to remove.
 *
 * ── What this replaced ──────────────────────────────────────────────────────────────────────
 *
 * The `Story` section held this slot: a sticky statement column against five hover-disclosing
 * "module" panels describing the buyer's path through the catalogue. It is deleted rather than
 * reworded, because its subject — how a buyer moves from family to grade to enquiry — is what the
 * Product Portfolio and Custom Formulation segments now carry between them, and the workbook has
 * no segment for it. Its two-column editorial construction is kept: same `.fs-story-*` shell, same
 * masked heading lines, same branded photograph. The panels are gone.
 *
 * A Server Component. The `Story` version needed `"use client"` only for the panels' pointer tilt;
 * with the panels removed there is no client work left in this section at all.
 */
export function WhoWeAre({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec fs-story fs-who" id="who-we-are" data-surface="light">
      <div
        className="fs-blueprint fs-blueprint--light"
        aria-hidden="true"
        style={{ opacity: 0.7 }}
      />
      <div className="fs-wrap fs-grid12">
        <div className="fs-story-left fs-rv">
          <div className="fs-eyebrow">Who we are</div>
          <h2 className="fs-d2">
            <span className="fs-line-mask">
              <span>A manufacturer,</span>
            </span>
            <span className="fs-line-mask">
              <span>
                <i>not a trading company.</i>
              </span>
            </span>
          </h2>
          <p className="fs-lead" style={{ marginTop: 26 }}>
            SAM Group produces base oils, lubricants and additives, and supplies them to businesses
            that buy on specification. Dealing with the producer means the formulation, the
            packaging and the supply terms are all settled in the same conversation.
          </p>

          {/*
           * Each row carries `.fs-rv-l`, so the reveal engine staggers the three by 85ms as the
           * section arrives — the same orchestration the hero's eyebrow, headline and buttons use.
           * The delays are not written here: `motion/reveal-engine.tsx` assigns them by DOM order
           * inside the enclosing `.fs-rv` block, which is what keeps a section reading as one
           * moment instead of three independent fades.
           */}
          <dl className="fs-who-list">
            {WHO_WE_ARE.map((item) => {
              const Glyph = GLYPHS[item.icon];

              return (
                <div className="fs-rv-l" key={item.term}>
                  <span className="fs-who-glyph" aria-hidden="true">
                    <Glyph size="lg" draw />
                  </span>
                  <dt>
                    <span className="fs-who-index fs-tnum">{item.index}</span>
                    {item.term}
                  </dt>
                  <dd>{item.detail}</dd>
                </div>
              );
            })}
          </dl>

          {/*
           * `--outline`, not `--glass`. This section sits on the light surface, and `.fs-btn--glass`
           * is authored for midnight: white text on `rgba(255,255,255,.045)`. Measured on the light
           * ground it rendered white-on-white at 1:1 — a 296×52 button nobody could see.
           * `.fs-btn--outline` is the variant that exists for exactly this surface.
           */}
          <a
            href={localeHref(locale, ROUTES.aboutUs)}
            className="fs-btn fs-btn--outline fs-who-cta"
          >
            Learn more about SAM Group
            <Arrow size={14} />
          </a>
        </div>

        <div className="fs-story-right">
          <BrandedPhoto
            src="/images/home/story-product-portfolio.webp"
            alt="Industrial lubricant samples and packaging formats arranged in a clean warehouse"
            caption="SAM Group product portfolio"
            className="fs-story-photo fs-rv"
            sizes="(max-width: 1180px) calc(100vw - 40px), 46vw"
          />
        </div>
      </div>
    </section>
  );
}
