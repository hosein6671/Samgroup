import { Suspense } from "react";
import type { ReactNode } from "react";

/*
 * The same two-stylesheet arrangement the product templates use, and for the same stated reason:
 * `flagship.css` declares the brand scope and its `fs-` vocabulary, and `insights.css` holds this
 * page's own constructions. `products.css` is deliberately NOT imported — nothing on this page is a
 * Products-landing construction, and importing a stylesheet for one class would be borrowing a page.
 */
import "../home/flagship.css";
import "./insights.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import { InsightsHero } from "./sections/hero";
import { InsightsList, InsightsListSkeleton } from "./sections/list";

import type { InsightsQuery } from "./insights-query";
import type { BlogPostListResult } from "@/lib/blog";

/**
 * The Insights index template — `/{locale}/insights`.
 *
 * ── A short page, on purpose ────────────────────────────────────────────────
 *
 * Hero, then the list, then the site footer. There is no category rail, no featured article, no
 * newsletter block and no editorial-plan section, and none of those is an oversight: a category rail
 * would publish an unapproved taxonomy, a featured article needs a `featured` column that does not
 * exist, and the newsletter form's endpoint is contracted but unbuilt. Every one of them would need
 * content or a column the platform does not have.
 *
 * ── The list streams; the hero does not wait for it ─────────────────────────
 *
 * The route starts the request and passes the promise down unawaited. The `Suspense` boundary here
 * is what lets a slow or hung blog service delay one section instead of the whole page — and unlike
 * the article route, nothing on this page's existence depends on the answer, so there is something
 * honest to render before it arrives.
 *
 * Entirely server-rendered. Not one component in this tree carries `"use client"`; the only client
 * JavaScript on the page is the header's, inherited from the shared chrome.
 */
export function InsightsTemplate({
  posts,
  locale,
  query,
}: {
  /** Started by the route and deliberately not awaited there — see the note above. */
  readonly posts: Promise<BlogPostListResult>;
  readonly locale: string;
  readonly query: InsightsQuery;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <InsightsHero />

        <Suspense fallback={<InsightsListSkeleton />}>
          <InsightsList posts={posts} locale={locale} query={query} />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
