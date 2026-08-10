import type { CSSProperties, ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ACTION_HREF } from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 8 · Packaging and supply — SITE_STRUCTURE §4 item 8.
 *
 * That item reads "formats, MOQ/lead time `[TO CONFIRM]`, Incoterms" — and the marker is doing
 * real work there. **Neither an MOQ nor a lead time appears on this page**, and the contract has
 * no field to put one in. What appears instead is one sentence about how they are established,
 * which is a description of a process rather than an unverified figure.
 *
 * The formats are §6's own list — bulk, flexitank, drums, IBC, pails and retail packs,
 * customized — and the Incoterms are the four §6 names as the ones the site explains. Both are
 * stated as the vocabulary a quotation is written in, not as a capability claim about volumes.
 *
 * The Incoterms are laid out as a ladder rather than a row of equal chips because they are not
 * peers: EXW through CIF is a sequence of increasing seller responsibility, and drawing it as
 * one is the same reasoning the frozen landing's closing staircase uses.
 */
export function CategorySupply({ content }: SectionProps): ReactNode {
  const { supply } = content;

  return (
    <section className="fs-sec pc-supply" id="supply" data-surface="light">
      <div className="fs-blueprint fs-blueprint--light" aria-hidden="true" />

      <div className="fs-wrap pc-supply-grid">
        <div className="pc-supply-copy reveal-fade-rise">
          <p className="fs-eyebrow">Packaging &amp; supply</p>
          <h2 className="fs-d2">{supply.heading}</h2>
          <p className="fs-lead">{supply.intro}</p>

          <ul className="pc-formats">
            {supply.formats.map((format) => (
              <li key={format}>{format}</li>
            ))}
          </ul>

          <p className="pc-terms">{supply.terms}</p>

          <p className="pc-supply-link">
            <a href={ACTION_HREF[supply.link.route]} className="fs-btn fs-btn--outline">
              {supply.link.label}
              <Arrow size={15} />
            </a>
          </p>
        </div>

        <div className="pc-incoterms reveal-fade-rise">
          <p className="pc-incoterms-head">
            <span>Quoted against</span>
            <span>{String(supply.incoterms.length).padStart(2, "0")}</span>
          </p>

          <ol className="pc-incoterm-list">
            {supply.incoterms.map((term, i) => (
              <li className="pc-incoterm" key={term} style={{ "--pc-rung": i } as CSSProperties}>
                <span className="pc-incoterm-num">{String(i + 1).padStart(2, "0")}</span>
                <b>{term}</b>
              </li>
            ))}
          </ol>

          <p className="pc-incoterms-foot">
            Increasing seller responsibility, top to bottom. Which one applies is settled in the
            quotation, not here.
          </p>
        </div>
      </div>
    </section>
  );
}
