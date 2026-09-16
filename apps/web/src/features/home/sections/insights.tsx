import { structuralSection, type StructuralFields } from "@/features/content/structural-copy";
import type { ReactNode } from "react";

import "../../blog/insights.css";

import { InsightCard } from "@/features/blog/insight-card";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import type { BlogPostListItemResponse } from "@sam-group/types";

/**
 * 8 · Editorial insights — the workbook's "Latest News / Insights" segment.
 *
 * ── History: the articles were invented, then removed, then made real ───────
 *
 * This section was originally a magazine well of entirely fabricated articles (a specific,
 * dated market claim attributed to nobody — the kind of invented fact CLAUDE.md §4 forbids
 * outright) and was cut down to a CTA-only heading for exactly that reason. It stayed CTA-only
 * for a while after that: `GET /blog/posts` existed and could have been wired in, but doing so
 * from this leaf component would have meant making it async, threading `locale` down from the
 * route, and adding a Suspense boundary — judged a homepage/blog integration, not a tiny reuse,
 * and out of scope for the gate that made the cut.
 *
 * That integration is now done, at the route: `app/[locale]/page.tsx` fetches the newest
 * published posts (`findRecentPosts`, the same best-effort pattern `insights/[slug]/page.tsx`
 * uses for its "Recent articles" sidebar) and hands them down as `recentPosts`, already resolved
 * by the time this component runs — no fetch, no Suspense boundary, and no client JavaScript
 * needed here. Every card is `InsightCard`, the same component the real Insights index renders,
 * so a post looks identical whether it is read here or there.
 *
 * `recentPosts` empty — no posts published yet, or the blog service did not answer — renders the
 * CTA alone, same as before this integration existed. No placeholder card, no fabricated row.
 */
/**
 * `locale` is the route's own locale segment, threaded down from `HomeExperience`.
 *
 * The one action on this section is a structural route, and it was rendered raw — so from `/fa`
 * it left the reader's language to `middleware.ts` to guess. `ROUTES.insights` stays locale-less;
 * `localeHref` applies the prefix here, as it does in the chrome.
 */
export function Insights({
  locale,
  editorial,
  recentPosts,
}: {
  readonly locale: string;
  readonly editorial?: StructuralFields;
  readonly recentPosts: readonly BlogPostListItemResponse[];
}): ReactNode {
  const copy = structuralSection("home", "insights", editorial);

  return (
    <section className="fs-sec fs-insights" id="insights" data-surface="light">
      <div className="fs-wrap">
        <div className="fs-ins-head fs-section-head fs-rv">
          <div>
            <div className="fs-eyebrow">{copy.text("sam_group_insights")}</div>
            <h2 className="fs-d2" style={{ marginTop: 22, maxWidth: "20ch" }}>
              {copy.text("practical_knowledge_for_better_product")}
            </h2>
            <p className="fs-lead fs-ins-lede">{copy.text("read_clear_guidance_on_product")}</p>
          </div>

          <a href={localeHref(locale, ROUTES.insights)} className="fs-btn fs-btn--outline">
            {copy.text("explore_insights")}
            <Arrow />
          </a>
        </div>

        {recentPosts.length > 0 && (
          <div className="in-grid reveal-stagger">
            {recentPosts.map((post) => (
              <InsightCard key={post.id} post={post} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
