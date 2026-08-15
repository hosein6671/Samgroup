import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, INTRO } from "../contact-data";

/**
 * 1 · Contact hero.
 *
 * The same construction the other corporate pages open with — eyebrow, display heading, lead, one
 * action — on the midnight surface with the blueprint field behind it. Its single action is an
 * in-page anchor rather than a route, for the reason `solutions-data.ts` states about its own hero:
 * the thing it is asking for is directly below.
 *
 * A Server Component. No state, no JavaScript.
 */
export function ContactHero(): ReactNode {
  return (
    <section className="fs-sec ct-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap ct-hero-inner">
        <p className="fs-eyebrow">{INTRO.eyebrow}</p>
        <h1 className="fs-d1">{INTRO.heading}</h1>
        <p className="fs-lead ct-hero-lead">{INTRO.lead}</p>

        <p className="ct-hero-action">
          <a href={`#${ANCHORS.form}`} className="fs-btn fs-btn--gold">
            Go to the form
            <Arrow size={15} />
          </a>
        </p>
      </div>
    </section>
  );
}
