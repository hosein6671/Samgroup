import type { ReactNode } from "react";

import "../home/flagship.css";
import "./cms-proof.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import type { ContentPageResponse } from "@sam-group/types";

/**
 * Renders one CMS-owned page — the Payload → NestJS → Next.js proof, and nothing more.
 *
 * ── Why this is a proof route and not a real page ───────────────────────────
 *
 * The `Pages` collection holds legal pages (PAYLOAD_CONTENT_ARCHITECTURE.md §1), and every one of
 * them — Privacy Policy above all — is blocked on approved legal text that does not exist
 * (SITE_STRUCTURE.md §12, and the launch blockers in ROADMAP.md). Pointing `/privacy-policy` at this
 * data now would publish whatever happens to be in the CMS as though it were policy. So the read
 * path is proven on a route that is unmistakably not one, and the canonical legal routes are
 * created by the gate that has the content for them.
 *
 * ── The DEMO band is rendered, not documented ───────────────────────────────
 *
 * It is the first thing inside `<main>`, above the content, for the reason the homepage's
 * `DemoDataNotice` exists: a note that a page carries placeholder data is worth nothing if the note
 * only lives in a comment.
 */
export function CmsPageTemplate({
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
        <p className="cms-demo-band" role="note">
          <strong>Demonstration route.</strong> This page renders CMS content through the platform
          API to prove the integration. It is not part of the public site and its content is not
          approved copy.
        </p>

        <article>
          <header className="cms-head" data-surface="midnight">
            <div className="fs-blueprint" aria-hidden="true" />

            <div className="fs-wrap cms-head-inner">
              <p className="fs-eyebrow">Content API proof</p>

              <h1 className="fs-d1 cms-title">{page.title}</h1>

              {/*
               * Rendered only when the editor set one. `lastUpdatedDate` is nullable on the wire and
               * a date is a factual claim — substituting today's, or the fetch time, would state
               * something about the content that nobody asserted.
               */}
              {page.lastUpdatedDate !== null && (
                <p className="cms-updated">
                  Last updated{" "}
                  <time dateTime={page.lastUpdatedDate}>
                    {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                      new Date(page.lastUpdatedDate),
                    )}
                  </time>
                </p>
              )}

              {localeFallback && (
                <p className="cms-fallback-note">
                  This page is shown in the site&rsquo;s default language because it has not been
                  translated yet.
                </p>
              )}
            </div>
          </header>

          <section className="fs-sec cms-body" data-surface="light">
            {/*
             * `bodyHtml` is markup, and this is the one place in `apps/web` that renders any.
             *
             * **It is sanitized server-side, by NestJS, before it reaches this application** —
             * `apps/api`'s `rich-text.sanitizer.ts`, an allow-list rebuild that admits headings,
             * emphasis, lists, links, quotes and tables, and admits no script host, no event-handler
             * attribute, no `style`, no embed and no URL scheme outside `http`/`https`/`mailto`/
             * `tel`.
             *
             * The boundary is in the API deliberately. NestJS is the only public contract (ADR-003),
             * so sanitizing there means every consumer — this page, a future Admin Dashboard view,
             * the RAG export — receives the same safe HTML and none of them can forget to. A
             * sanitizer here would have to be repeated per consumer and would leave the unsafe form
             * on the wire.
             *
             * Sanitizing a second time here would add no safety, only a second policy to keep in
             * step with the first. The alternative to rendering markup at all — parsing the HTML
             * into React elements here — would be a second hand-written renderer for a document
             * format this application does not own.
             */}
            <div
              className="fs-wrap cms-body-inner"
              dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
            />
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
