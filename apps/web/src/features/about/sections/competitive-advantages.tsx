import {
  ExpertiseIcon,
  FormulationIcon,
  ManufacturerIcon,
  PartnershipIcon,
  QualityIcon,
  SupplyIcon,
} from "@/features/site/icons";

import { ANCHORS } from "../about-anchors";

import type { AboutUsCompetitiveAdvantages, CompetitiveAdvantageIconKey } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * "Why Partner with SAM Group?" — six reasons a buyer deals with the producer directly.
 *
 * `Sam Group Website Structure_v2.xlsx`'s `About Us` sheet is the source: it names this segment,
 * gives it that title, and gives it exactly six name/reason pairs. Nothing here is written beyond
 * what the sheet states.
 *
 * ── A glyph plate replaced the ordinal ───────────────────────────────────────
 *
 * Each row carried a bare `01`–`06` counter. A glyph does the same wayfinding job — six distinct
 * marks down the column — while also saying something about the reason next to it, which a number
 * cannot. The plate is the same 44px construction the Expertise flow and the Home page's card grids
 * already use, so an icon reads the same size everywhere on the site rather than carrying a second,
 * private scale.
 *
 * `item.icon` is a CMS-authored concept key, exactly as `sections/expertise.tsx` explains for its
 * own glyphs — never inferred from the row's name.
 */
const GLYPHS: Record<CompetitiveAdvantageIconKey, (props: { readonly size: "lg" }) => ReactNode> = {
  manufacturer: ManufacturerIcon,
  customization: FormulationIcon,
  quality: QualityIcon,
  supply: SupplyIcon,
  expertise: ExpertiseIcon,
  partnership: PartnershipIcon,
};

export function AboutCompetitiveAdvantages({
  advantages,
}: {
  readonly advantages: AboutUsCompetitiveAdvantages;
}): ReactNode {
  return (
    <section className="fs-sec ab-adv" id={ANCHORS.advantages} data-surface="light">
      <div className="fs-wrap ab-adv-inner">
        {/*
         * `data-lead="no"`: `_v2` gives this segment a title and six reasons, nothing else — no
         * lead sentence. `.ab-adv-head` reserves a second grid column for one, and a single child
         * dropped into a two-column grid occupies only the first column, leaving the second an
         * empty, equally-wide blank band beside the heading. Inventing a lead to fill it would be
         * exactly the invented content this page's copy pass was written to remove; not reserving
         * the column when there is nothing to put in it is the actual fix.
         */}
        <header
          className="ab-adv-head reveal-fade-rise"
          data-lead={advantages.lead === null ? "no" : "yes"}
        >
          <div>
            <p className="fs-eyebrow">Why partner with us</p>
            {advantages.heading !== null && <h2 className="fs-d2">{advantages.heading}</h2>}
          </div>
          {advantages.lead !== null && <p className="fs-lead">{advantages.lead}</p>}
        </header>

        {/*
         * A two-column ruled grid, not one full-width column of six short rows. Every row's text —
         * a name and one sentence — filled under half the measure at this section's width, so a
         * single column read as a list of short lines adrift in a wide, mostly empty band. Two
         * columns is the same construction `.ab-team-functions` already uses one section below,
         * not a fourth different pattern.
         */}
        {advantages.items.length > 0 && (
          <ul className="ab-commitments ab-commitments--icon reveal-stagger">
            {advantages.items.map((item) => {
              const Glyph = item.icon !== null ? GLYPHS[item.icon] : null;

              return (
                <li className="ab-commitment" key={item.name}>
                  <span className="ab-commitment-icon" aria-hidden="true">
                    {Glyph !== null && <Glyph size="lg" />}
                  </span>
                  <span className="ab-commitment-body">
                    <b>{item.name}</b>
                    <small>{item.note}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
