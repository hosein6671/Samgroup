import type { ReactNode } from "react";

import "../home/flagship.css";
import "./legal.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

/**
 * What a canonical legal route renders when the content path could not answer.
 *
 * ── The one page where a false 404 is worst ─────────────────────────────────
 *
 * ADR-010 §7 freezes it: infrastructure failure must never be converted into a canonical-content
 * 404. Three services stand between a visitor and this page — Next, NestJS and Payload — and any of
 * them can stop. The specific failure this exists for is a **Payload outage becoming apparent
 * absence**: the CMS stops, NestJS answers 503 UPSTREAM_UNAVAILABLE, and a route that mapped "no
 * page" onto 404 would tell every crawler, and every visitor following a consent link, that the
 * company had withdrawn its privacy policy.
 *
 * Only the API's own definitive NOT_FOUND — the CMS answered, and holds no published page for this
 * slug — produces a canonical 404. Everything else lands here.
 *
 * ── Separate from `CmsPageUnavailable`, on purpose ──────────────────────────
 *
 * `features/cms-proof/` is a demonstration surface scheduled for deletion under ADR-010 §9 step 4.
 * A canonical route may not depend on a component that is going away, and folding the two together
 * would be a refactor of the proof route rather than a part of this gate.
 *
 * ── What it says, and what it does not ──────────────────────────────────────
 *
 * It does not name the document: on a failed fetch nothing is known about the slug beyond its
 * presence in the URL, and echoing caller-supplied text into a heading would put unvalidated input
 * on the page while implying the page is real. No status code, error code or upstream name is
 * shown — a visitor cannot act on `ECONNREFUSED`, and which of three services failed is a fact for
 * the server log, which the route writes.
 *
 * ── Status code, stated as a known limitation ───────────────────────────────
 *
 * Rendered with a 200, exactly as `PostUnavailable`, `ProductUnavailable` and `CmsPageUnavailable`
 * are, and for the same reason: the App Router gives a page no supported way to set a 5xx short of
 * throwing into a Client Component `error.tsx` boundary. The whole `[locale]` tree is
 * `robots: noindex, nofollow`, so no crawler is interpreting these responses yet; revisiting it
 * belongs with the SEO launch gate.
 */
export function LegalPageUnavailable({ locale, locales }: SiteNavProps): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <section className="fs-sec lg-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />

          <div className="fs-wrap lg-unavailable-inner">
            <p className="fs-eyebrow">Page unavailable</p>

            <h1 className="fs-d2 lg-unavailable-title">This page cannot be shown right now.</h1>

            <p className="fs-lead">
              The service that holds this document did not answer. This is a temporary service
              condition, not a statement that the document does not exist — please try again
              shortly.
            </p>

            <p>
              <a className="fs-btn fs-btn--glass" href={`/${locale}${ROUTES.home}`}>
                Home
              </a>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
