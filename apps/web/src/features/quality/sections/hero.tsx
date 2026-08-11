import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { APPROACH, INTRO } from "../quality-data";

/**
 * 1 · Hero — SITE_STRUCTURE §7's 'Hero ("Quality You Can Verify")'.
 *
 * ── The right column ────────────────────────────────────────────────────────
 *
 * Every hero on this platform puts an index there: the Products landing a riser diagram, a
 * category page a stratigraphic column, Customized Solutions a numbered sequence, About Us the
 * facility media slot. Each indexes the thing its page is about.
 *
 * This page is about verification, and verification here is a sequence — so the index is the
 * chain itself, read off `APPROACH.stages` rather than retyped. The hero and §2 cannot disagree
 * about how many stages there are or what they are called, because there is only one list.
 *
 * `quality-data.ts` records why this column is not a second media frame.
 *
 * ── The heading is the source's own ─────────────────────────────────────────
 *
 * "Quality You Can Verify" is quoted verbatim from SITE_STRUCTURE §7, title case and all. It is
 * the only heading on this page not written in the platform's sentence-case register, and it is
 * left as the source wrote it rather than restyled to match.
 *
 * ── Motion ──────────────────────────────────────────────────────────────────
 *
 * `reveal-fade-rise` and `reveal-stagger` from `packages/ui`'s `motion.css` — scroll-driven CSS,
 * no JavaScript. The homepage's `RevealEngine` stays homepage-only, as on the five pages before
 * this.
 */
export function QualityHero(): ReactNode {
  return (
    <section className="qc-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-hero-inner">
        <div className="qc-hero-copy reveal-fade-rise">
          <p className="fs-eyebrow">{INTRO.eyebrow}</p>

          <h1 className="fs-d1">{INTRO.heading}</h1>
          <p className="fs-lead">{INTRO.lead}</p>

          <div className="qc-hero-actions">
            <a href={INTRO.primary.href} className="fs-btn fs-btn--gold">
              {INTRO.primary.label}
              <Arrow size={15} />
            </a>
            <a href={INTRO.secondary.href} className="fs-btn fs-btn--glass">
              {INTRO.secondary.label}
            </a>
          </div>
        </div>

        {/*
          The chain. An ordered list because the order is the content — a batch meets these
          stages in sequence, and rendering them as an unordered set would drop the one
          structural fact the section carries.
        */}
        <div className="qc-chain reveal-fade-rise" aria-labelledby="qc-chain-title">
          <p className="qc-chain-head" id="qc-chain-title">
            <span>{INTRO.indexLabel}</span>
            <span className="fs-tnum">{String(APPROACH.stages.length).padStart(2, "0")}</span>
          </p>

          <ol className="qc-chain-list reveal-stagger">
            {APPROACH.stages.map((stage, i) => (
              <li className="qc-chain-step" key={stage.id}>
                <span className="qc-chain-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                <span className="qc-chain-body">
                  <b>{stage.name}</b>
                  <small>{stage.when}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
