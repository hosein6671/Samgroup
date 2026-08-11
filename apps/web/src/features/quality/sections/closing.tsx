import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, CLOSING } from "../quality-data";

/**
 * 7 · Final CTA — SITE_STRUCTURE §7's closing row.
 *
 * ── Established vocabulary, no fourth device ────────────────────────────────
 *
 * The Products landing's `ClosingCta` is deliberately not imported, for the reason About Us
 * records: its heading answers a question a *range* has just asked, and its staircase belongs to a
 * page arguing about products. This page argues about evidence, so it closes on one action and
 * three routes in the shared button vocabulary and adds nothing structural to the platform.
 *
 * ── No self-reference ───────────────────────────────────────────────────────
 *
 * Four destinations, none of them this page. `ROUTES.qualityCertifications` appears nowhere in
 * this feature. Every href resolves through the canonical table, so no path is retyped and none is
 * a proof path — they 404 today for the same reason every canonical link on every proof page does,
 * and pointing them at `/design-proof/*` would be faking the lift rather than doing it.
 */
export function QualityClosing(): ReactNode {
  return (
    <section className="fs-sec qc-close" id={ANCHORS.next} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-close-grid">
        <div className="qc-close-copy reveal-fade-rise">
          <p className="fs-eyebrow">{CLOSING.eyebrow}</p>
          <h2 className="fs-d2">{CLOSING.heading}</h2>
          <p className="fs-lead">{CLOSING.lead}</p>

          <p className="qc-close-primary">
            <a href={CLOSING.primary.href} className="fs-btn fs-btn--gold">
              {CLOSING.primary.label}
              <Arrow size={15} />
            </a>
          </p>
        </div>

        <nav className="qc-close-routes reveal-fade-rise" aria-labelledby="qc-close-routes-title">
          <p className="qc-close-head" id="qc-close-routes-title">
            <span>Or take another route</span>
            <span className="fs-tnum">{String(CLOSING.routes.length).padStart(2, "0")}</span>
          </p>

          <ul>
            {CLOSING.routes.map((route) => (
              <li key={route.id}>
                <a href={route.href}>
                  <span>{route.label}</span>
                  <Arrow size={16} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
