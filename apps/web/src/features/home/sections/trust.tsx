import type { ReactNode } from "react";

import {
  FormulationIcon,
  ManufacturerIcon,
  PackagingIcon,
  SampleIcon,
} from "@/features/site/icons";

import { TRUST_INDICATORS, type Indicator } from "../home-data";

/**
 * 3 · Company Statistics — rendered as **Trust Indicators**, with no statistics.
 *
 * ── Why there are no numbers here ───────────────────────────────────────────────────────────
 *
 * The workbook's third Home segment is titled "Trust Indicators" and its purpose is "Create
 * immediate credibility". Its **Supporting Text and Buttons cells are empty**: the sheet says a
 * credibility block belongs in this position and does not say what goes in it.
 *
 * Filling that silence with figures would mean inventing them. The previous homepage did exactly
 * that across five sections — blending capacity, countries served, production lines, lab
 * instruments, on-time percentages — and had to carry a rendered banner admitting the numbers were
 * illustrative. Every one of those is now gone, and so is the banner.
 *
 * What is here instead is four things the workbook itself supports: the manufacturer position (the
 * Who We Are segment's stated purpose), the sample-first step (the `Notes` sheet says it twice,
 * for engine oil and for base oil), formulation to requirement (the Customized Solutions sheet),
 * and packaging flexibility (the Export & Logistics sheet). When audited figures exist they belong
 * in this shape — the section is built to take them.
 *
 * A Server Component. No state, no JavaScript.
 */
const GLYPHS: Record<Indicator["icon"], (props: { readonly size: "lg" }) => ReactNode> = {
  manufacturer: ManufacturerIcon,
  sample: SampleIcon,
  formulation: FormulationIcon,
  packaging: PackagingIcon,
};

export function Trust(): ReactNode {
  return (
    <section className="fs-sec fs-trust" id="trust-indicators" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap">
        <div className="fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">Trust indicators</div>
            <h2 className="fs-d2">What buying from the producer changes.</h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: "34ch" }}>
            Four things that follow from dealing with the company that makes the product.
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
        <ul className="fs-cards fs-rv" data-columns="4">
          {TRUST_INDICATORS.map((item) => {
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
