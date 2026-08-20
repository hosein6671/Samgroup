import type { ReactNode } from "react";

import "../home/flagship.css";
import "./insights.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";
import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

/**
 * What `/{locale}/insights/{slug}` renders when the blog service could not answer.
 *
 * ── This page exists because a 404 here would be a lie ──────────────────────
 *
 * The rule is the one ADR-010 §7 freezes for Product Detail, and it holds for the same reason:
 * infrastructure failure must never become a canonical-content 404. A post's content lives only in
 * `sam_platform`, so when the API does not answer, the honest position is that this page's existence
 * is **unknown**, not that it is absent.
 *
 * A 404 would assert absence. It would also be acted on: a crawler that sees 404 de-indexes the URL,
 * and a shared article link that answers "this does not exist" is wrong in a way nobody catches. So
 * a transport failure, a timeout, a 5xx and a malformed payload all land here instead, and only the
 * API's own definitive NOT_FOUND produces a 404.
 *
 * ── What it says, and what it does not ──────────────────────────────────────
 *
 * It states the situation plainly and offers the two routes that are still reachable. It does **not**
 * name the post: nothing is known about the slug beyond its presence in the URL, and echoing
 * caller-supplied text back into a heading would put unvalidated input on the page while implying
 * the article is real. No API error code, status or message is displayed either — the cause is
 * logged server-side by the route, and a visitor cannot act on `ECONNREFUSED`.
 *
 * ── Status code, stated as a known limitation ───────────────────────────────
 *
 * This renders with a 200, exactly as `ProductUnavailable` does and with the same reasoning: a 5xx
 * would describe the situation better, and the App Router gives a page no supported way to set one
 * short of throwing into a Client Component `error.tsx` boundary. The whole `[locale]` tree is
 * `robots: noindex, nofollow`, so no crawler is interpreting these responses yet; revisiting it
 * belongs with the SEO launch gate.
 */
export function PostUnavailable({ locale, locales }: SiteNavProps): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <section className="fs-sec in-unavailable" data-surface="midnight">
          <div className="fs-blueprint" aria-hidden="true" />

          <div className="fs-wrap in-unavailable-inner">
            <p className="fs-eyebrow">Insights unavailable</p>

            <h1 className="fs-d2 in-unavailable-title">This article cannot be shown right now.</h1>

            <p className="fs-lead in-unavailable-lead">
              The service that holds our articles did not answer, so we cannot show this one. This
              is a temporary service condition, not a statement that the article does not exist —
              please try again shortly.
            </p>

            <div className="in-unavailable-routes">
              <a className="fs-btn fs-btn--gold" href={`/${locale}${ROUTES.insights}`}>
                All posts
                <Arrow size={13} />
              </a>
              <a className="fs-btn fs-btn--glass" href={`/${locale}${ROUTES.contactUs}`}>
                Contact us
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
