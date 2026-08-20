import { Arrow } from "@/features/site/logo-mark";
import { contentRouteHref } from "@/features/site/site-routes";

import type { QualityApproach, QualityCertificationsHero } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 1 · Hero — SITE_STRUCTURE §7's 'Hero ("Quality You Can Verify")'.
 *
 * ── The right column ────────────────────────────────────────────────────────
 *
 * Every hero on this platform puts an index there: the Products landing a riser diagram, a
 * category page a stratigraphic column, Customized Solutions a numbered sequence, About Us the
 * facility figure.
 *
 * This page is about verification, and verification here is a sequence — so the index is the chain
 * itself, read off the approach section's own stages rather than restated. The hero and §2 cannot
 * disagree about how many stages there are or what they are called, because there is only one list
 * and the CMS holds it once.
 *
 * **The hero reserves no image**, and the Global models none. The chain is what occupies this
 * column, and a hero image field with nothing to render into is a field an editor eventually fills
 * and then wonders why nothing changed.
 *
 * ── The chain is absent when the stages are ─────────────────────────────────
 *
 * `approach` is nullable like every section below the hero, so a page published in stages can have
 * a hero and no stages yet. The column is then simply not rendered — never an empty frame, never a
 * heading over nothing.
 *
 * ── Motion ──────────────────────────────────────────────────────────────────
 *
 * `reveal-fade-rise` and `reveal-stagger` from `packages/ui`'s `motion.css` — scroll-driven CSS,
 * no JavaScript, and both are disabled under `prefers-reduced-motion`.
 */
export function QualityHero({
  hero,
  approach,
  locale,
}: {
  readonly hero: QualityCertificationsHero;
  readonly approach: QualityApproach | null;
  readonly locale: string;
}): ReactNode {
  const stages = approach?.stages ?? [];

  return (
    <section className="qc-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-hero-inner" data-chain={stages.length > 0 ? "yes" : "no"}>
        <div className="qc-hero-copy reveal-fade-rise">
          {hero.eyebrow !== null && <p className="fs-eyebrow">{hero.eyebrow}</p>}

          <h1 className="fs-d1">{hero.title}</h1>
          {hero.supportingText !== null && <p className="fs-lead">{hero.supportingText}</p>}

          {(hero.primaryCta !== null || hero.secondaryCta !== null) && (
            <div className="qc-hero-actions">
              {hero.primaryCta !== null && (
                <a
                  href={contentRouteHref(locale, hero.primaryCta.route)}
                  className="fs-btn fs-btn--gold"
                >
                  {hero.primaryCta.label}
                  <Arrow size={15} />
                </a>
              )}
              {hero.secondaryCta !== null && (
                <a
                  href={contentRouteHref(locale, hero.secondaryCta.route)}
                  className="fs-btn fs-btn--glass"
                >
                  {hero.secondaryCta.label}
                </a>
              )}
            </div>
          )}
        </div>

        {/*
          The chain. An ordered list because the order is the content — a batch meets these
          stages in sequence, and rendering them as an unordered set would drop the one
          structural fact the section carries.
        */}
        {stages.length > 0 && (
          <div
            className="qc-chain reveal-fade-rise"
            {...(hero.indexLabel !== null && { "aria-labelledby": "qc-chain-title" })}
          >
            {/*
              The group is named only when the CMS supplied a name for it. `aria-labelledby`
              pointing at an element that holds a bare count would give the region a label of "03",
              which is worse than leaving the list unlabelled — no invented English string stands in
              for missing copy on a page served in three languages.
            */}
            {hero.indexLabel !== null && (
              <p className="qc-chain-head" id="qc-chain-title">
                <span>{hero.indexLabel}</span>
                <span className="fs-tnum">{String(stages.length).padStart(2, "0")}</span>
              </p>
            )}

            <ol className="qc-chain-list reveal-stagger">
              {stages.map((stage, i) => (
                <li className="qc-chain-step" key={stage.name}>
                  <span className="qc-chain-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                  <span className="qc-chain-body">
                    <b>{stage.name}</b>
                    <small>{stage.when}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
