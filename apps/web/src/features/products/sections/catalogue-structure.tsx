import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import {
  CatalogueIcon,
  FamiliesIcon,
  GradeIcon,
  TechnicalDataIcon,
  type IconProps,
} from "@/features/site/icons";

/**
 * 3 · The catalogue structure — a factual schematic, not a decoration.
 *
 * ── What it explains ─────────────────────────────────────────────────────────
 *
 * The four levels the schema and the live catalogue actually fix, in the exact terms
 * `docs/content/PRODUCT_TECHNICAL_BASELINE_V2_SOURCES.md`'s terminology correction settled on:
 *
 *   Family (`Category`, 6, fixed) → Product (`Product`, a catalogue record within it) →
 *   Grade (`ProductGrade`, the published variant, where more than one exists) →
 *   Technical Data (`Specification`, reviewed and published on that grade's own page).
 *
 * A reader who has just scanned six family cards and is about to open a Family page benefits from
 * knowing, in one glance, what they will find underneath a family — a product, which may itself
 * hold more than one grade, each with its own reviewed technical values. Nothing here is a metric
 * or a claim about the business; it is the shape of the data, stated once.
 *
 * ── Construction ─────────────────────────────────────────────────────────────
 *
 * Four short entries in a row, each an icon already in use elsewhere on this page (or the Product
 * Detail page it describes) paired with its name and one factual sentence, connected by the same
 * `Arrow` glyph the rest of the Flagship vocabulary uses for "leads to". No new icon meaning is
 * invented beyond `TechnicalDataIcon`, added once to `features/site/icons.tsx` under the same
 * one-stroke, `--fs-icon-*` contract every other glyph on this page already follows.
 *
 * ── Framed, on the midnight surface ──────────────────────────────────────────
 *
 * The first cut sat the row directly on the same light surface the family grid above it already
 * uses — two consecutive `data-surface="light"` sections with nothing to tell them apart, and four
 * short lines of text with no enclosure of their own inside a full section's standard vertical
 * rhythm. Measured live, that read as a large empty gap around something too thin to fill it,
 * which is exactly the "controlled visual rhythm between navy, lighter, and framed surfaces"
 * requirement this page was asked to keep. The row now sits on `data-surface="midnight"` — the
 * same alternation the hero and Documentation already use — inside `.pr-struct-panel`, a framed
 * panel built on the same bordered-box device `.pr-arch` established for the hero's own family
 * index. Not `.pr-arch`'s exact glass-fill, though: see `.pr-struct-panel`'s own CSS comment for
 * why that near-transparent fill, legible against the hero's gradient ground, nearly disappeared
 * against this section's flat one, and why the panel uses a genuinely lighter surface instead.
 */
type StructureStage = {
  readonly label: string;
  readonly note: string;
  readonly Icon: (props: IconProps) => ReactNode;
};

const STAGES: readonly StructureStage[] = [
  {
    label: "Family",
    note: "One of the six approved product families.",
    Icon: FamiliesIcon,
  },
  {
    label: "Product",
    note: "A catalogue record within that family — a product line or type.",
    Icon: CatalogueIcon,
  },
  {
    label: "Grade",
    note: "The published SAE, ISO VG or NLGI variant, where more than one exists.",
    Icon: GradeIcon,
  },
  {
    label: "Technical data",
    note: "The approved structured properties, reviewed and published on that grade's page.",
    Icon: TechnicalDataIcon,
  },
];

export function CatalogueStructure(): ReactNode {
  return (
    <section className="fs-sec pr-struct" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap">
        <header className="pr-struct-head reveal-fade-rise">
          <p className="fs-eyebrow">How the catalogue is organised</p>
          <h2 className="fs-d3">Family, product, grade, technical data.</h2>
        </header>

        <div className="pr-struct-panel reveal-fade-rise">
          {/*
            The connector is a plain sibling `<li>`, not an absolutely positioned overlay — see
            `.pr-struct-row`'s own CSS comment for why a free-wrapping row could strand one stage
            (and the arrow pointing at it) alone on a second line, and why the fix is an explicit
            2-column grid at a fixed breakpoint rather than a wrap-dependent one.
          */}
          <ol className="pr-struct-row">
            {STAGES.flatMap((stage, index) => {
              const item = (
                <li className="pr-struct-stage" key={stage.label}>
                  <div className="pr-struct-mark">
                    <stage.Icon size="lg" />
                  </div>
                  <p className="pr-struct-label">{stage.label}</p>
                  <p className="pr-struct-note">{stage.note}</p>
                </li>
              );

              if (index === 0) return [item];

              return [
                <li className="pr-struct-connector" aria-hidden="true" key={`arrow-${stage.label}`}>
                  <Arrow size={16} />
                </li>,
                item,
              ];
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
