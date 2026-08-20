import "../home/flagship.css";
import "./quality.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

import type { ReactNode } from "react";

/**
 * What `/quality-certifications` renders when it has no content to render.
 *
 * ── Why this is not a 404, ever ─────────────────────────────────────────────
 *
 * `/quality-certifications` is a structural route: the footer's Company column points at it, About
 * Us's quality footnote points at it, and SITE_STRUCTURE §2 and §7 both send a reader here for the
 * certification question. A 404 on it states that the page does not exist — to a visitor, and to a
 * crawler that will act on it. Neither cause of an empty render is that statement:
 *
 * - **`not-configured`** — the CMS answered and holds no published Quality document. Editorial work
 *   is outstanding, which is a fact about a schedule, not about the URL.
 * - **`service`** — the API or the CMS behind it did not answer. Infrastructure failure must never
 *   become a canonical 404; the rule ADR-010 §7 fixes for Product Detail holds for every canonical
 *   route, and `AboutUnavailable` and `LegalPageUnavailable` already apply it.
 *
 * The two are separated because they are separate facts and the honest sentence differs: one asks
 * the reader to come back, the other says the page has not been published.
 *
 * ── What this page must not say, given which page it is ─────────────────────
 *
 * Nothing here mentions certifications, standards or testing. This is the address the platform gives
 * for the certification question, so an unavailable state that volunteered "our certifications are
 * being prepared" would publish, in the one place it matters most, a claim the company has not made.
 * It says the page is unpublished or unreachable, and offers a route out — nothing more.
 */
export function QualityUnavailable({
  locale,
  reason,
}: {
  readonly locale: string;
  readonly reason: "not-configured" | "service";
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <section className="fs-sec qc-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />
          <div className="fs-wrap qc-unavailable-inner">
            <p className="fs-eyebrow">
              {reason === "service" ? "Page unavailable" : "Not published yet"}
            </p>
            <h1 className="fs-d2">
              {reason === "service"
                ? "This page cannot be shown right now."
                : "This page has not been published yet."}
            </h1>
            <p className="fs-lead">
              {reason === "service"
                ? "The service that holds this page did not answer. This is a temporary service condition, not a statement that the page does not exist — please try again shortly."
                : "The Quality & Certifications page is being prepared and has not been published. Nothing has been removed, and the product range and contact routes below are unaffected."}
            </p>
            <p className="qc-unavailable-actions">
              <a className="fs-btn fs-btn--gold" href={`/${locale}${ROUTES.products}`}>
                See the product range
              </a>
              <a className="fs-btn fs-btn--glass" href={`/${locale}${ROUTES.contactUs}`}>
                Contact us
              </a>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
