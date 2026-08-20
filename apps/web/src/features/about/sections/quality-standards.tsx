import { Arrow } from "@/features/site/logo-mark";
import { contentRouteHref } from "@/features/site/site-routes";

import { ANCHORS } from "../about-anchors";

import { SectionFigure } from "./hero";

import type { AboutUsQualityStandards } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * Quality & Standards — the commitments that accompany a batch, and the footnote beneath them.
 *
 * The commitments are a list rather than a grid of cards for the same reason the expertise register
 * is an ordered list: they are a set of statements, and the numbering is positional. Each may carry
 * an optional second line, which renders only when the editor wrote one.
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
      <div
        className="fs-wrap ab-quality-grid"
        data-figure={qualityStandards.figure === null ? "no" : "yes"}
      >
        <header className="ab-quality-head reveal-fade-rise">
          <p className="fs-eyebrow">Quality &amp; standards</p>
          {qualityStandards.heading !== null && (
            <h2 className="fs-d2">{qualityStandards.heading}</h2>
          )}
          {qualityStandards.lead !== null && <p className="fs-lead">{qualityStandards.lead}</p>}
        </header>

        <div className="ab-quality-body">
          {qualityStandards.items.length > 0 && (
            <ul className="ab-commitments reveal-stagger">
              {qualityStandards.items.map((item, index) => (
                <li className="ab-commitment" key={item.name}>
                  <span className="ab-commitment-num fs-tnum">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="ab-commitment-body">
                    <b>{item.name}</b>
                    {item.note !== null && <small>{item.note}</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {footnote !== null && (
            <p className="ab-quality-foot reveal-fade-rise">
              {footnote}
              {footnoteCta !== null && (
                <>
                  {" "}
                  <a href={contentRouteHref(locale, footnoteCta.route)}>
                    {footnoteCta.label}
                    <Arrow size={13} />
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        {qualityStandards.figure !== null && (
          <SectionFigure
            figure={qualityStandards.figure}
            className="ab-quality-media reveal-fade-rise"
          />
        )}
      </div>
    </section>
  );
}
