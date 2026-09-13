import {
  structuralList,
  structuralSection,
  type StructuralFields,
} from "@/features/content/structural-copy";
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
export function WhoWeAre({
  locale,
  editorial,
}: { readonly locale: string } & { readonly editorial?: StructuralFields }): ReactNode {
  const copy = structuralSection("home", "who-we-are", editorial);

  return (
    <section className="fs-sec fs-story fs-who" id="who-we-are" data-surface="light">
      <div
        className="fs-blueprint fs-blueprint--light"
        aria-hidden="true"
        style={{ opacity: 0.7 }}
      />
      <div className="fs-wrap fs-grid12">
        <div className="fs-story-left fs-rv">
          <div className="fs-eyebrow">{copy.text("who_we_are")}</div>
          <h2 className="fs-d2">
            <span className="fs-line-mask">
              <span>{copy.text("a_manufacturer")}</span>
            </span>
            <span className="fs-line-mask">
              <span>
                <i>{copy.text("not_a_trading_company")}</i>
              </span>
            </span>
          </h2>
          <p className="fs-lead" style={{ marginTop: 26 }}>
            {copy.text("sam_group_produces_base_oils")}
          </p>

          {/*
           * Each row carries `.fs-rv-l`, so the reveal engine staggers the three by 85ms as the
           * section arrives — the same orchestration the hero's eyebrow, headline and buttons use.
           * The delays are not written here: `motion/reveal-engine.tsx` assigns them by DOM order
           * inside the enclosing `.fs-rv` block, which is what keeps a section reading as one
           * moment instead of three independent fades.
           */}
          <dl className="fs-who-list">
            {structuralList(editorial, "who_we_are", WHO_WE_ARE).map((item) => {
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
            {copy.text("learn_more_about_sam_group")}
            <Arrow size={14} />
          </a>
        </div>

        <div className="fs-story-right">
          <BrandedPhoto
            src="/images/home/story-product-portfolio.webp"
            alt={copy.text("industrial_lubricant_samples_and_packaging")}
            caption={copy.text("caption_6")}
            className="fs-story-photo fs-rv"
            sizes="(max-width: 1180px) calc(100vw - 40px), 46vw"
          />
        </div>
      </div>
    </section>
  );
}
