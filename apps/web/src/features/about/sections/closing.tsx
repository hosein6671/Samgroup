import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, CLOSING } from "../about-data";

/**
 * 5 · Final CTA — SITE_STRUCTURE §2's last row, Payload's `finalCtaText`/`finalCtaButton`.
 *
 * ── Established vocabulary, not new copy ────────────────────────────────────
 *
 * The lead is the standing closing sentence already published on the Products landing and all six
 * category pages. A visitor arriving here from any of them should not meet a second voice at the
 * moment they are asked to act. `about-data.ts` records where it comes from.
 *
 * ── Not the Products staircase ──────────────────────────────────────────────
 *
 * `ClosingCta` is deliberately not imported. Its heading — "Can't find exactly what you need?" —
 * answers a question the reader has just been asked by a *range*, and its three-step staircase is
 * a device that belongs to a page arguing about products. This page argues about the company, so
 * it closes on one action and three routes in the shared button vocabulary, and adds no fourth
 * structural device to the platform.
 *
 * ── No self-reference ───────────────────────────────────────────────────────
 *
 * Four destinations, none of them About Us. `ROUTES.aboutUs` appears nowhere in this feature
 * outside `site-routes.ts` itself. Every href resolves through the canonical table, so no path is
 * retyped here and none of them is a proof path — they 404 today for the same reason every other
 * canonical link on every proof page does, and pointing them at `/design-proof/*` would be faking
 * the lift rather than doing it.
 */
export function AboutClosing(): ReactNode {
  return (
    <section className="fs-sec ab-close" id={ANCHORS.next} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap ab-close-grid">
        <div className="ab-close-copy reveal-fade-rise">
          <p className="fs-eyebrow">{CLOSING.eyebrow}</p>
          <h2 className="fs-d2">{CLOSING.heading}</h2>
          <p className="fs-lead">{CLOSING.lead}</p>

          <p className="ab-close-primary">
            <a href={CLOSING.primary.href} className="fs-btn fs-btn--gold">
              {CLOSING.primary.label}
              <Arrow size={15} />
            </a>
          </p>
        </div>

        <nav className="ab-close-routes reveal-fade-rise" aria-labelledby="ab-close-routes-title">
          <p className="ab-close-head" id="ab-close-routes-title">
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
