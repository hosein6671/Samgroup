import type { ReactNode } from "react";

import "../home/flagship.css";
import "./legal.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import type { ContentPageResponse } from "@sam-group/types";

/**
 * The shared shell for a canonical legal page — Privacy Policy today, and the three that follow it.
 *
 * ── One template, four pages, zero content assumptions ──────────────────────
 *
 * SITE_STRUCTURE.md §12 lists Privacy Policy, Terms of Use, Cookie Notice and General Sales
 * Conditions as structurally interchangeable — title, rich text, last-updated date — which is the
 * same observation that made `Pages` one Payload collection instead of four
 * (PAYLOAD_CONTENT_ARCHITECTURE.md §1). So this component takes a `ContentPageResponse` and knows
 * nothing about which of the four it is rendering: no page-specific heading, no per-policy copy, no
 * `pageType` branch. Terms of Use is a route file away, not a component away.
 *
 * ── Everything on the page came from the CMS ────────────────────────────────
 *
 * The only strings this file contributes are the "last updated" label and the untranslated notice,
 * both of which describe the document rather than assert anything in it. There is deliberately no
 * table of contents (the body's structure is the editor's, and a TOC generated from headings this
 * component has not parsed would be a guess), no legal contact block (SITE_STRUCTURE's Outstanding
 * Confirmations still lists head-office address, phone and email as unconfirmed), and no icon or
 * badge implying a compliance fact.
 *
 * ── Not the CMS proof template ──────────────────────────────────────────────
 *
 * `features/cms-proof/` renders the same response shape behind a DEMO band and is explicitly not a
 * canonical surface (FRONTEND_ARCHITECTURE.md §10). This one has no band, because a canonical legal
 * route only ever renders approved, published content — and if that content does not exist, the
 * route serves a 404 rather than a page carrying a disclaimer.
 */
export function LegalPageTemplate({
  page,
  locale,
  localeFallback,
}: {
  readonly page: ContentPageResponse;
  readonly locale: string;
  /** The API's `meta.localeFallback`, surfaced as a notice rather than hidden. */
  readonly localeFallback: boolean;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <article>
          <header className="lg-head" data-surface="midnight">
            <div className="fs-blueprint" aria-hidden="true" />

            <div className="fs-wrap lg-head-inner">
              <h1 className="fs-d1 lg-title">{page.title}</h1>

              {/*
               * Rendered only when the editor set one. `lastUpdatedDate` is nullable on the wire and
               * the revision date of a legal document is a factual claim about that document —
               * substituting today's date, or the fetch time, would state something nobody asserted,
               * on the one page where a wrong date is a compliance problem rather than a typo.
               */}
              {page.lastUpdatedDate !== null && (
                <p className="lg-updated">
                  Last updated{" "}
                  <time dateTime={page.lastUpdatedDate}>
                    {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                      new Date(page.lastUpdatedDate),
                    )}
                  </time>
                </p>
              )}

              {/*
               * Payload is configured `fallback: true`, so an untranslated locale is served the
               * default locale's text and the API reports that in `meta.localeFallback`. On an
               * editorial page that is a convenience; on a legal page it means the visitor is
               * reading a document in a language it was not reviewed in.
               *
               * The notice therefore states the fact and stops there. It does NOT say which version
               * governs, which language is authoritative, or that the translation is legally
               * equivalent — every one of those is a legal assertion, and this application has no
               * approved source for any of them. INTERNATIONALIZATION_STRATEGY.md requires human
               * review for legal copy in all three locales; nothing here substitutes for it.
               */}
              {localeFallback && (
                <p className="lg-fallback-note" role="note">
                  This document has not been translated into this language. It is shown in the
                  site&rsquo;s default language.
                </p>
              )}
            </div>
          </header>

          <section className="fs-sec lg-body" data-surface="light">
            {/*
             * `bodyHtml` is markup, and `apps/web` renders it in exactly two places — here and on
             * the CMS proof route.
             *
             * **It is sanitized server-side, by NestJS, before it reaches this application** —
             * `apps/api`'s `rich-text.sanitizer.ts`, an allow-list rebuild that admits headings,
             * emphasis, lists, links, quotes and tables, and admits no script host, no
             * event-handler attribute, no `style`, no embed and no URL scheme outside
             * `http`/`https`/`mailto`/`tel` (API_CONTRACT_FINAL.md §2.4a).
             *
             * The boundary is in the API deliberately: NestJS is the only public contract
             * (ADR-003), so every consumer inherits the same policy and none of them can forget to
             * apply it. Sanitizing again here would add no safety, only a second policy to keep in
             * step with the first.
             */}
            <div
              className="fs-wrap lg-body-inner"
              dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
            />
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
