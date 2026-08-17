import type { ReactNode } from "react";

import "../home/flagship.css";
import "./cms-proof.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

/**
 * What the CMS proof route renders when the content path could not answer.
 *
 * ── A 404 here would be a lie, and this route is where that matters most ────
 *
 * There are now three services between a visitor and this page — Next, NestJS and Payload — and any
 * of them can be down. ADR-010 §7's rule does not weaken as the chain lengthens: infrastructure
 * failure must never become a canonical-content 404. The specific failure this guards against is a
 * **Payload outage becoming apparent absence**: the CMS stops, NestJS answers 503, and a route that
 * mapped "no page" onto 404 would tell every crawler that the company's legal pages had been
 * withdrawn.
 *
 * Only the API's own definitive 404 — the CMS answered, and holds no published page for the slug —
 * produces a canonical 404. Everything else lands here.
 *
 * ── What it says, and what it does not ──────────────────────────────────────
 *
 * It does not name the page: nothing is known about the slug beyond its presence in the URL, and
 * echoing caller-supplied text into a heading would put unvalidated input on the page while implying
 * the page is real. No status code, error code or upstream name is shown — a visitor cannot act on
 * `ECONNREFUSED`, and which of three services failed is a fact for the server log, which the route
 * writes.
 *
 * ── Status code, stated as a known limitation ───────────────────────────────
 *
 * Rendered with a 200, exactly as `PostUnavailable` and `ProductUnavailable` are, and for the same
 * reason: the App Router gives a page no supported way to set a 5xx short of throwing into a Client
 * Component `error.tsx` boundary. The whole `[locale]` tree is `robots: noindex, nofollow`, so no
 * crawler is interpreting these responses yet; revisiting it belongs with the SEO launch gate.
 */
export function CmsPageUnavailable({ locale }: { readonly locale: string }): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <section className="fs-sec cms-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />

          <div className="fs-wrap cms-unavailable-inner">
            <p className="fs-eyebrow">Page unavailable</p>

            <h1 className="fs-d2 cms-unavailable-title">This page cannot be shown right now.</h1>

            <p className="fs-lead">
              The service that holds this page&rsquo;s content did not answer. This is a temporary
              service condition, not a statement that the page does not exist — please try again
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

      <SiteFooter />
    </div>
  );
}
