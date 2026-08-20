import "../home/flagship.css";
import "./about.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

import type { ReactNode } from "react";

/**
 * What `/about-us` renders when it has no content to render.
 *
 * ── Why this is not a 404, ever ─────────────────────────────────────────────
 *
 * `/about-us` is a structural route: it is in the header, in the footer, in the sitemap, and it is
 * the company's own address. A 404 on it states that the page does not exist — to a visitor, and to
 * a crawler that will act on it. Neither cause of an empty render is that statement:
 *
 * - **`not-configured`** — the CMS answered and holds no published About Us document. Editorial
 *   work is outstanding, which is a fact about a schedule, not about the URL.
 * - **`service`** — the API or the CMS behind it did not answer. Infrastructure failure must never
 *   become a canonical 404; the rule ADR-010 §7 fixes for Product Detail holds for every canonical
 *   route, and `LegalPageUnavailable` already applies it to legal pages.
 *
 * The two are separated because they are separate facts and the honest sentence differs: one asks
 * the reader to come back, the other says the page has not been published. Neither invents company
 * copy, and neither renders a blank page.
 *
 * The page keeps the site chrome, one `<h1>`, and a route out — the same shape as the legal
 * unavailable state, so a visitor who hits either meets one voice.
 */
export function AboutUnavailable({
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
        <section className="fs-sec ab-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />
          <div className="fs-wrap ab-unavailable-inner">
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
                : "The About Us page is being prepared and has not been published. Nothing has been removed, and the product range and contact routes below are unaffected."}
            </p>
            <p className="ab-unavailable-actions">
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
