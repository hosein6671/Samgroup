import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, INTRO, PROCESS_STEPS } from "../solutions-data";

/**
 * 1 · Hero — SITE_STRUCTURE §5's "Heading".
 *
 * ── The right column ────────────────────────────────────────────────────────
 *
 * Both pages built before this one put an index in the hero's right column: the Products landing
 * draws a riser diagram over the six families, and a category page draws a stratigraphic column
 * over its sub-ranges. Each indexes the thing its page is actually about, and each doubles as the
 * page's table of contents — which is why neither page needs a separate one.
 *
 * This page is about a sequence, so its index is a sequence: the six process steps, numbered, in
 * order, anchored into the rail below. That keeps the established device without repeating either
 * drawing, and it is honest about what this page holds — six names, and no claim beyond them.
 *
 * ── The primary action points at this page ──────────────────────────────────
 *
 * Every other hero's primary CTA resolves to a `ROUTES` entry. This one is an in-page anchor to
 * the request form, because the form is the thing the CTA asks for and it is directly below. That
 * is stated in `solutions-data.ts` rather than left to be inferred from a `#` in the markup.
 *
 * ── Motion ──────────────────────────────────────────────────────────────────
 *
 * `reveal-fade-rise` from `packages/ui`'s `motion.css` — scroll-driven CSS, no JavaScript. The
 * homepage's `RevealEngine` stays homepage-only, as it does on the two pages built before this.
 */
export function SolutionsHero(): ReactNode {
  return (
    <section className="cs-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap cs-hero-inner">
        <div className="cs-hero-copy reveal-fade-rise">
          <p className="fs-eyebrow">{INTRO.eyebrow}</p>

          <h1 className="fs-d1">{INTRO.heading}</h1>
          <p className="fs-lead">{INTRO.lead}</p>

          <div className="cs-hero-actions">
            <a href={INTRO.primary.href} className="fs-btn fs-btn--gold">
              {INTRO.primary.label}
              <Arrow size={15} />
            </a>
            <a href={INTRO.secondary.href} className="fs-btn fs-btn--glass">
              {INTRO.secondary.label}
            </a>
          </div>
        </div>

        <ProcessIndex />
      </div>
    </section>
  );
}

/**
 * The process index — the hero's right-hand element and the page's contents.
 *
 * Names and positions only. The step descriptions Payload specifies alongside them are pending
 * editorial copy (see `solutions-data.ts`), so there is nothing to put under each name and
 * nothing is put there.
 *
 * CSS only — borders and pseudo-elements on tokenised colours. No SVG to keep in sync with the
 * data, no canvas, nothing added to the first-load JavaScript budget.
 */
function ProcessIndex(): ReactNode {
  return (
    <aside className="cs-index reveal-fade-rise" aria-labelledby="cs-index-title">
      <p className="fs-eyebrow" id="cs-index-title">
        The process
      </p>

      <p className="cs-index-note">
        {PROCESS_STEPS.length} steps, from a stated requirement to a delivered batch.
      </p>

      <ol className="cs-index-list">
        {PROCESS_STEPS.map((step, i) => (
          <li className="cs-index-step" key={step.id}>
            <a href={`#${ANCHORS.process}`}>
              <span className="cs-index-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="cs-index-name">{step.name}</span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
