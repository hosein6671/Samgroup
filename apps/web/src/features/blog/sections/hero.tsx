import type { ReactNode } from "react";

/**
 * The Insights index hero.
 *
 * ── What it is allowed to say ───────────────────────────────────────────────
 *
 * SITE_STRUCTURE.md §8 specifies an index hero, a category rail and an editorial plan. Only the hero
 * exists here, and it carries the page's own name and one sentence describing what the page is —
 * nothing about how often the company publishes, how many articles there are, or what they cover.
 * The publishing cadence in §8 is `[TO CONFIRM]`, the editorial plan is a plan rather than content,
 * and CLAUDE.md §4 rules out seeding either into a page as if settled.
 *
 * No newsletter form: DATA_MODEL.md records a Subscribe CTA on Insights, and
 * `POST /newsletter/subscribe` is contracted but unbuilt. A form that posts nowhere is worse than no
 * form.
 *
 * A Server Component. No state, no JavaScript.
 */
export function InsightsHero(): ReactNode {
  return (
    <section className="in-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap in-hero-inner">
        <p className="fs-eyebrow">Insights</p>

        <h1 className="fs-d1 in-hero-title">Technical and industry writing</h1>

        <p className="fs-lead in-hero-lead">Articles published by SAM Group, newest first.</p>
      </div>
    </section>
  );
}
