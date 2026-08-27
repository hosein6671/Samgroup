import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

/**
 * 8 · Editorial insights.
 *
 * ── The articles were invented, and are gone ────────────────────────────────
 *
 * This section was a magazine well: one lead article with a generated cover, four secondaries in a
 * numbered stack. **Every word of it was fabricated.** The lead was titled "Why Group III supply is
 * rewriting lubricant procurement in 2026", tagged "Base oils · Market", labelled "12 Min read ·
 * Market Analysis", and carried a specific market claim about hydrocracker capacity additions in
 * the Gulf narrowing the Group II–III price gap. The four secondaries were the same in miniature.
 *
 * None of it corresponded to anything: not to a `BlogPost` row, not to the demo blog dataset, not
 * to any approved editorial content. It was prototype filler that read as published analysis, and a
 * dated market assertion attributed to nobody is the kind of invented fact CLAUDE.md §4 forbids
 * outright — arguably worse than an invented statistic, because it is presented as this company's
 * professional judgement.
 *
 * ── Why a CTA and not a real feed ───────────────────────────────────────────
 *
 * `GET /blog/posts` exists and `/{locale}/insights` renders it, so wiring the five real (explicitly
 * DEMO-prefixed) posts in here would be possible. It is deliberately not done: this component is a
 * leaf of a homepage tree that receives no locale and performs no fetch, so consuming the blog
 * would mean making it async, plumbing `locale` down from the route, and adding a Suspense boundary
 * — a homepage/blog integration, not a tiny reuse. Subtraction was the instruction and is the right
 * call; the section now points at the page that already lists the real posts.
 *
 * ── What that removed with it ───────────────────────────────────────────────
 *
 * The generated cover canvas went too. It existed to give a fabricated lead article an image, and
 * with no article there is nothing for it to be the cover of. Losing it is what lets this file drop
 * `"use client"` — it is now a Server Component shipping no JavaScript, which is the honest end
 * state for a section that is a heading and a link.
 *
 * The "All articles" action also pointed at `#insights`, this section, rather than anywhere. It now
 * resolves to the real route.
 */
/**
 * `locale` is the route's own locale segment, threaded down from `HomeExperience`.
 *
 * The one action on this section is a structural route, and it was rendered raw — so from `/fa`
 * it left the reader's language to `middleware.ts` to guess. `ROUTES.insights` stays locale-less;
 * `localeHref` applies the prefix here, as it does in the chrome.
 */
export function Insights({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec fs-insights" id="insights" data-surface="light">
      <div className="fs-wrap">
        <div className="fs-ins-head fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">SAM Group insights</div>
            <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "14ch" }}>
              Practical knowledge for better product decisions.
            </h2>
            <p className="fs-lead fs-ins-lede">
              Read clear guidance on product selection, technical terminology, documentation,
              packaging, and export enquiry preparation.
            </p>
          </div>

          <a href={localeHref(locale, ROUTES.insights)} className="fs-btn fs-btn--outline">
            Explore insights
            <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}
