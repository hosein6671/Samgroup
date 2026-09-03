import type { ReactNode } from "react";

import {
  ExpertiseIcon,
  FormulationIcon,
  ManufacturerIcon,
  PartnershipIcon,
  QualityIcon,
  SupplyIcon,
} from "@/features/site/icons";

import { ADVANTAGES, type Advantage } from "../home-data";

/**
 * 5 · Why Choose Sam Group.
 *
 * The workbook's fifth Home segment, and the only one it specifies as a flat six-item grid. The
 * six advantages are its own, in its order; the wording is tightened into the page's voice and one
 * of them is changed in substance — see `ADVANTAGES` in `home-data.ts` for why "worldwide" is not
 * reproduced.
 *
 * ── What this replaced ──────────────────────────────────────────────────────────────────────
 *
 * The `Why` section: 419 lines of scroll-driven machinery — an animated review gauge, a properties
 * table, a four-step path, a bar chart of illustrative line output, and a trust row of invented
 * figures. It is deleted rather than adapted. Its subject was the buyer's decision path, which the
 * workbook has no segment for, and half its content was the unaudited prototype data this gate
 * removes. A six-item grid is what the specified segment is, and building one out of that section's
 * apparatus would have been the more expensive way to say less.
 *
 * The grid is the same `.fs-cards` construction the Trust Indicators and Industries segments use,
 * at three columns instead of four and five. One card shape, three call sites — which is what
 * makes those three segments read as one page rather than three visiting designs.
 *
 * A Server Component. No state, no JavaScript, no canvas.
 */
const GLYPHS: Record<Advantage["icon"], (props: { readonly size: "lg" }) => ReactNode> = {
  manufacturer: ManufacturerIcon,
  formulation: FormulationIcon,
  quality: QualityIcon,
  supply: SupplyIcon,
  expertise: ExpertiseIcon,
  partnership: PartnershipIcon,
};

export function Advantages(): ReactNode {
  return (
    <section className="fs-sec fs-adv" id="why-sam-group" data-surface="light">
      <div
        className="fs-blueprint fs-blueprint--light"
        aria-hidden="true"
        style={{ opacity: 0.6 }}
      />
      <div className="fs-wrap">
        <div className="fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">Why businesses choose SAM Group</div>
            <h2 className="fs-d2">Six reasons buyers work with us directly.</h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: "34ch" }}>
            The practical differences between buying from a producer and buying from the market.
          </p>
        </div>

        {/*
         * `fs-rv` on the list, not only `fs-rv-l` on the cards.
         *
         * The engine in `motion/reveal-engine.tsx` assigns stagger delays to the `.fs-rv-l`
         * descendants of an observed `.fs-rv` block; a loose `.fs-rv-l` is observed on its own
         * and gets `.in` with no delay at all. With the cards' only ancestor reveal being the
         * section head — their sibling, not their parent — they were loose. Measured at 1440:
         * every card's `transitionDelay` read empty and all of them turned `in` on the same
         * frame, while the Who We Are rows one section above read 170ms / 255ms / 340ms. The
         * grid appeared as one block. Making the list the orchestration unit is what sequences it.
         */}
        <ul className="fs-cards fs-rv" data-columns="3">
          {ADVANTAGES.map((item) => {
            const Glyph = GLYPHS[item.icon];

            return (
              <li className="fs-card fs-rv-l" key={item.title}>
                <span className="fs-card-glyph">
                  <Glyph size="lg" />
                </span>
                <h3 className="fs-card-title">{item.title}</h3>
                <p className="fs-card-body">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
