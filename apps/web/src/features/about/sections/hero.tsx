import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { INTRO, MEDIA, type MediaSlot } from "../about-data";

/**
 * 1 · Hero — SITE_STRUCTURE §2's "Hero Section", specified as "same as Home".
 *
 * ── The right column ────────────────────────────────────────────────────────
 *
 * Every page built before this one puts an index in the hero's right column: the Products landing
 * a riser diagram, a category page a stratigraphic column, Customized Solutions a numbered
 * sequence. Each indexes the thing its page is about.
 *
 * This page is about the company, and the thing it is missing is a picture of it. So the right
 * column is the hero media slot — the same compositional weight, holding the commission for an
 * asset that does not exist yet rather than a diagram of five short sections. That is honest about
 * what an About page needs and what this one is waiting on.
 *
 * ── The copy claims three things ────────────────────────────────────────────
 *
 * Direct producer, production in Iran, six published families. `about-data.ts` records why there
 * is no fourth: everything else SITE_STRUCTURE §2 lists for this page is marked as an estimate or
 * is unwritten.
 *
 * ── Motion ──────────────────────────────────────────────────────────────────
 *
 * `reveal-fade-rise` from `packages/ui`'s `motion.css` — scroll-driven CSS, no JavaScript. The
 * homepage's `RevealEngine` stays homepage-only, as on the four pages before this.
 */
export function AboutHero(): ReactNode {
  return (
    <section className="ab-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap ab-hero-inner">
        <div className="ab-hero-copy reveal-fade-rise">
          <p className="fs-eyebrow">{INTRO.eyebrow}</p>

          <h1 className="fs-d1">{INTRO.heading}</h1>
          <p className="fs-lead">{INTRO.lead}</p>

          <div className="ab-hero-actions">
            <a href={INTRO.primary.href} className="fs-btn fs-btn--gold">
              {INTRO.primary.label}
              <Arrow size={15} />
            </a>
            <a href={INTRO.secondary.href} className="fs-btn fs-btn--glass">
              {INTRO.secondary.label}
            </a>
          </div>
        </div>

        <MediaFrame slot={MEDIA.hero} className="ab-hero-media reveal-fade-rise" ratio="portrait" />
      </div>
    </section>
  );
}

/**
 * A designed media slot: the frame this page reserves for an asset that does not exist yet.
 *
 * ── Why it is drawn rather than left blank ──────────────────────────────────
 *
 * Three of this page's compositions need a photograph, and SITE_STRUCTURE's Outstanding
 * Confirmations lists facility, production and laboratory photography as a launch blocker. An
 * empty box would say the layout is unfinished. This says the *asset* is unfinished, and states
 * what has been commissioned: the intent, the caption the finished asset carries, and the alt text
 * it will inherit.
 *
 * **Nothing here is an image.** No photograph, no illustration of a facility, no generated or
 * stock imagery — the project has none of those and inventing one would be inventing a building.
 * What is drawn is drafting-table furniture: a hairline frame, a finer blueprint field than the
 * section grounds use, gold registration marks at two opposite corners, and the pending state as
 * real text rather than as a visual cue only.
 *
 * ── Where it lives ──────────────────────────────────────────────────────────
 *
 * In the hero file because the hero is the first section that renders one, and imported from here
 * by Who We Are and Quality & Standards. The same arrangement `ClosingCta` has on the Products
 * landing: it sits in the feature that first needed it, and moves up a level when a second page
 * does — not copied down, and not promoted speculatively inside a page task.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * `<figure>`/`<figcaption>`, because that is what this is. The registration marks are
 * `aria-hidden`; the intent, the pending state and the caption are all real text, so a screen
 * reader is told the frame is empty and what it is for instead of being told nothing. `alt` is
 * carried in the data and applied to nothing — there is no `<img>` yet — and it is shown here as
 * part of the commission, which is the audience this page has today.
 */
export function MediaFrame({
  slot,
  className,
  ratio = "landscape",
}: {
  readonly slot: MediaSlot;
  readonly className?: string;
  readonly ratio?: "landscape" | "portrait";
}): ReactNode {
  return (
    <figure className={className ? `ab-slot ${className}` : "ab-slot"} data-ratio={ratio}>
      <div className="ab-slot-frame">
        <div className="ab-grid" aria-hidden="true" />

        <p className="ab-slot-intent">{slot.intent}</p>

        <p className="ab-slot-state">
          <span className="ab-slot-dot" aria-hidden="true" />
          {slot.pending ? "Image pending" : "Image attached"}
        </p>
      </div>

      <figcaption className="ab-slot-caption">
        <span className="ab-slot-cap">{slot.caption}</span>
        <span className="ab-slot-alt">
          <b>Alt</b>
          {slot.alt}
        </span>
      </figcaption>
    </figure>
  );
}
