import {
  BaseOilProcessingIcon,
  BaseStockIcon,
  BlendIcon,
  FormulationIcon,
  GradeIcon,
  PackagingIcon,
  QualityIcon,
} from "@/features/site/icons";

import { ANCHORS } from "../about-anchors";

import type { AboutUsExpertise, ExpertiseIconKey } from "@sam-group/types";
import type { CSSProperties, ReactNode } from "react";

/**
 * Our Expertise — a labelled capability flow, not a numbered register.
 *
 * ── What this replaced ───────────────────────────────────────────────────────
 *
 * The section was an `<ol>` of bare names under a "Capability map" counter — six rows of text and
 * nothing else, the construction the owner asked this page to move away from. `_v2`'s `About Us`
 * sheet gives each expertise area both a name *and* a one-sentence description, which the old
 * layout never rendered: `AboutUsExpertise.items[].note` existed for Quality & Standards' items but
 * had no equivalent here until this pass added one.
 *
 * ── A diagram, in the precise sense ──────────────────────────────────────────
 *
 * Each area sits behind a glyph, connected by one hairline that runs the length of the row (a
 * column on narrow viewports) — SAM Group's stated capability chain read left to right rather than
 * top to bottom. It is conceptual, not a process with a measured duration or a manufacturing claim:
 * nothing here asserts a sequence, a capacity or a technical value, and every node's glyph is
 * `aria-hidden` — the name and the description are the content, read by a screen reader in document
 * order exactly as a sighted reader sees them.
 *
 * `--exp-count` (below) sets the row's own column count to `items.length` rather than a literal
 * four: this page was first built against a four-area version of the copy, `.ab-exp-flow`'s CSS
 * grid was written for exactly that count, and the connecting hairline breaks the moment a row
 * wraps — a fifth or sixth area is not a hypothetical, `_v2` already grew to six.
 *
 * ── The glyph is chosen content, not inferred from the name ─────────────────
 *
 * `item.icon` is a CMS-authored concept key (`ExpertiseIconKey`), the same construction a call to
 * action's `route` already is. Matching a Lucide component to an item by testing its *name* string
 * would silently stop working the day an editor rewords "Custom Formulation" to "Formulation
 * Services" — a fact this page's own icon module warns against for exactly this reason. A missing or
 * unrecognised key (older content, or a value from a schema newer than this file) renders the node
 * with no glyph rather than guessing one.
 *
 * `ExpertiseIconKey` widened from four values to six alongside `_v2`'s expertise list growing to
 * six areas — `blend` covers the base-oil-and-additive row and `documentation` the
 * technical-and-batch-records row, neither of which the original four (built for an older,
 * four-item version of this copy) had a meaning for. `processing` is a seventh, narrowly scoped
 * concept added for the owner-approved Base Oil Processing item — thin-film vacuum distillation —
 * and used for nothing else.
 */

const GLYPHS: Record<ExpertiseIconKey, (props: { readonly size: "lg" }) => ReactNode> = {
  product: BaseStockIcon,
  application: GradeIcon,
  blend: BlendIcon,
  formulation: FormulationIcon,
  documentation: QualityIcon,
  supply: PackagingIcon,
  processing: BaseOilProcessingIcon,
};

export function AboutExpertise({ expertise }: { readonly expertise: AboutUsExpertise }): ReactNode {
  return (
    <section className="fs-sec ab-expertise" id={ANCHORS.expertise} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap ab-expertise-inner">
        <header className="ab-expertise-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Our expertise</p>
            {expertise.heading !== null && <h2 className="fs-d2">{expertise.heading}</h2>}
          </div>
          {expertise.lead !== null && <p className="fs-lead">{expertise.lead}</p>}
        </header>

        {expertise.items.length > 0 && (
          <ol
            className="ab-exp-flow reveal-stagger"
            aria-label="Areas of expertise"
            style={{ "--exp-count": expertise.items.length } as CSSProperties}
          >
            {expertise.items.map((item) => {
              const Glyph = item.icon !== null ? GLYPHS[item.icon] : null;

              return (
                <li className="ab-exp-node" key={item.name}>
                  <span className="ab-exp-plate" aria-hidden="true">
                    {Glyph !== null && <Glyph size="lg" />}
                  </span>
                  <h3>{item.name}</h3>
                  {item.note !== null && <p>{item.note}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
