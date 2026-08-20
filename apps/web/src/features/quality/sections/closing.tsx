import { Arrow } from "@/features/site/logo-mark";
import { contentRouteHref } from "@/features/site/site-routes";

import { ANCHORS } from "../quality-anchors";

import type { QualityClosing } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 7 · Final CTA — SITE_STRUCTURE §7's closing row.
 *
 * ── Established vocabulary, no fourth device ────────────────────────────────
 *
 * The Products landing's `ClosingCta` is deliberately not imported, for the reason About Us records:
 * its heading answers a question a *range* has just asked, and its staircase belongs to a page
 * arguing about products. This page argues about evidence, so it closes on one action and a short
 * list of routes in the shared button vocabulary, and adds nothing structural to the platform.
 *
 * ── Destinations are keys, resolved here ────────────────────────────────────
 *
 * Every action carries a `ContentRouteKey`, never a URL: structural page URLs stay fixed English
 * across locales and belong to `site-routes.ts`, not to a CMS text field (PROJECT_HANDOFF §6.12).
 * `contentRouteHref` applies the locale prefix, so one stored key is three URLs.
 *
 * An action the editor left incomplete never reaches this component — the API drops a label with no
 * destination and a destination with no label — so there is no button here that goes nowhere.
 *
 * ── The route list's own label is code, exactly as About Us's is ────────────
 *
 * "Or take another route" is chrome over a set of destinations, not editorial copy, and `AboutClosing`
 * carries the identical string for the identical list after its own CMS cutover. It is what names
 * the `<nav>` landmark, so it is not optional the way a published heading is. It is **not
 * translated**, and neither is About Us's — a shared home for this page-chrome vocabulary is owed,
 * and is recorded rather than invented inside a page gate.
 */
export function QualityClosingSection({
  closing,
  locale,
}: {
  readonly closing: QualityClosing;
  readonly locale: string;
}): ReactNode {
  const { eyebrow, heading, lead, primaryCta, routes } = closing;

  return (
    <section className="fs-sec qc-close" id={ANCHORS.next} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-close-grid">
        <div className="qc-close-copy reveal-fade-rise">
          {eyebrow !== null && <p className="fs-eyebrow">{eyebrow}</p>}
          {heading !== null && <h2 className="fs-d2">{heading}</h2>}
          {lead !== null && <p className="fs-lead">{lead}</p>}

          {primaryCta !== null && (
            <p className="qc-close-primary">
              <a href={contentRouteHref(locale, primaryCta.route)} className="fs-btn fs-btn--gold">
                {primaryCta.label}
                <Arrow size={15} />
              </a>
            </p>
          )}
        </div>

        {routes.length > 0 && (
          <nav className="qc-close-routes reveal-fade-rise" aria-labelledby="qc-close-routes-title">
            <p className="qc-close-head" id="qc-close-routes-title">
              <span>Or take another route</span>
              <span className="fs-tnum">{String(routes.length).padStart(2, "0")}</span>
            </p>

            <ul>
              {routes.map((route) => (
                <li key={route.route}>
                  <a href={contentRouteHref(locale, route.route)}>
                    <span>{route.label}</span>
                    <Arrow size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
