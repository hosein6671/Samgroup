import type { ReactNode } from "react";

import {
  AdditivesIcon,
  AutomotiveIcon,
  BaseOilsIcon,
  CatalogueIcon,
  IndustrialIcon,
} from "@/features/site/icons";

import { INDUSTRIES, type Industry } from "../home-data";

/**
 * 6 · Industries We Serve.
 *
 * The workbook's sixth Home segment — five industries, in its order — and the homepage had no
 * counterpart at all before this gate. Its stated purpose is "Improve SEO and show market
 * understanding", which is why each entry says **what that industry buys** rather than repeating
 * the family names: the Product Portfolio segment two above already lists those, and restating
 * them here would be the duplication the owner asked to remove.
 *
 * ── Placed between the advantages and the customization story on purpose ────────────────────
 *
 * It answers the question the previous section leaves open. "Six reasons buyers work with us" is
 * an assertion about the seller; "here is who those buyers actually are" is the evidence for it,
 * and it hands over to Custom Formulation with the reader already thinking about their own
 * application. That ordering is the workbook's, and it turns out to be the reason it works.
 *
 * ── No market or region is named ────────────────────────────────────────────────────────────
 *
 * Industries are not markets. The workbook's geographic claims live on other sheets and are
 * governed by the `Notes` sheet, which the owner made the factual authority; nothing here asserts
 * where these industries are served.
 *
 * A Server Component. No state, no JavaScript.
 */
const GLYPHS: Record<Industry["icon"], (props: { readonly size: "lg" }) => ReactNode> = {
  automotive: AutomotiveIcon,
  manufacturing: IndustrialIcon,
  blenders: BaseOilsIcon,
  petrochemical: AdditivesIcon,
  packaging: CatalogueIcon,
};

export function Industries(): ReactNode {
  return (
    <section className="fs-sec fs-ind" id="industries" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap">
        <div className="fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">Industries we serve</div>
            <h2 className="fs-d2">Where these products go to work.</h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: "36ch" }}>
            The same catalogue reaches five kinds of buyer, each starting from a different question.
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
        <ul className="fs-cards fs-rv" data-columns="5">
          {INDUSTRIES.map((item) => {
            const Glyph = GLYPHS[item.icon];

            return (
              <li className="fs-card fs-card--compact fs-rv-l" key={item.name}>
                <span className="fs-card-glyph">
                  <Glyph size="lg" />
                </span>
                <h3 className="fs-card-title">{item.name}</h3>
                <p className="fs-card-body">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
