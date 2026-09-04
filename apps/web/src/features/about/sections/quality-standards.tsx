import { Arrow } from "@/features/site/logo-mark";
import { contentRouteHref } from "@/features/site/site-routes";

import { ANCHORS } from "../about-anchors";

import type { AboutUsQualityStandards } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * Quality & Standards — a compact supporting section, not a fourth full-width argument.
 *
 * ── Why this shrank ───────────────────────────────────────────────────────────
 *
 * `_v2`'s `About Us` sheet has no segment for this at all; it survives on the page by owner
 * decision, kept as a pointer toward the dedicated Quality & Certifications page rather than as a
 * third telling of the same claims. The previous construction was a two-column grid — a ruled list
 * of full description rows beside an optional photograph — the same visual weight as Expertise or
 * the Team section either side of it. That made a page section the owner called "supporting" read
 * as equal in importance to the page's main argument.
 *
 * Nothing about the CMS record changed to shrink it: `qualityStandards.figure` is still part of
 * `AboutUsQualityStandards` and still populated when an editor uploads one, and every item still
 * carries its own optional `note`. This component simply stops spending a two-column layout, a
 * photograph slot and full description rows on a section whose job is now to hand the reader to
 * `/quality-certifications` quickly — the item names become a short tag row, the item notes and the
 * figure are not rendered here, and the footnote sits directly beside the button it explains rather
 * than as its own paragraph.
 */
export function AboutQualityStandards({
  qualityStandards,
  locale,
}: {
  readonly qualityStandards: AboutUsQualityStandards;
  readonly locale: string;
}): ReactNode {
  const { footnote, footnoteCta } = qualityStandards;

  return (
    <section className="fs-sec ab-quality" id={ANCHORS.quality} data-surface="light">
      <div className="fs-wrap ab-quality-compact">
        <div className="ab-quality-compact-copy reveal-fade-rise">
          <p className="fs-eyebrow">Quality &amp; standards</p>
          {qualityStandards.heading !== null && (
            <h2 className="fs-d3">{qualityStandards.heading}</h2>
          )}
          {qualityStandards.lead !== null && (
            <p className="ab-quality-compact-lead">{qualityStandards.lead}</p>
          )}

          {qualityStandards.items.length > 0 && (
            <ul className="ab-quality-tags">
              {qualityStandards.items.map((item) => (
                <li key={item.name}>{item.name}</li>
              ))}
            </ul>
          )}
        </div>

        {(footnote !== null || footnoteCta !== null) && (
          <div className="ab-quality-compact-action reveal-fade-rise">
            {footnote !== null && <p className="ab-quality-compact-foot">{footnote}</p>}
            {footnoteCta !== null && (
              <a
                href={contentRouteHref(locale, footnoteCta.route)}
                className="fs-btn fs-btn--outline"
              >
                {footnoteCta.label}
                <Arrow size={14} />
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
