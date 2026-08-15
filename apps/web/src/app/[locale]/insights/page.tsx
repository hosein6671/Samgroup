import type { Metadata } from "next";
import type { ReactNode } from "react";

import { InsightsTemplate } from "@/features/blog/insights-template";
import { readInsightsQuery } from "@/features/blog/insights-query";
import { getBlogPosts } from "@/lib/blog";

/**
 * The Insights index — `/{locale}/insights`.
 *
 * The route segment is the fixed English string `insights` in every locale, per
 * FRONTEND_ARCHITECTURE.md §2 ([CONFIRMED]): structural page URLs are identical across locales, and
 * localized slugs are reserved for Products, Categories and Blog ARTICLES. The article's slug is
 * localized; the index's path is not.
 *
 * The page is served entirely from `GET /api/v1/blog/posts` through NestJS. `apps/web` reaches no
 * database and no CMS — Blog is Prisma-owned and NestJS is the only API surface.
 */

/**
 * A static title and description: this page has no record to be titled after.
 *
 * No `robots`, no canonical and no `hreflang`. `app/[locale]/layout.tsx` declares
 * `robots: { index: false, follow: false }` for this whole tree and every page inherits it, so a
 * route-level override would be a second answer to a settled question. Canonical and `hreflang`
 * belong to the SEO launch gate — the same position the product routes hold.
 */
export const metadata: Metadata = {
  title: "Insights",
  description: "Articles published by SAM Group.",
};

export default async function InsightsPage({
  params,
  searchParams,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string }>;
  /**
   * Reading this opts the route into dynamic rendering, which costs nothing here: every fetch this
   * page issues is `cache: "no-store"`, so the route was already dynamic.
   */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale }, rawQuery] = await Promise.all([params, searchParams]);
  const query = readInsightsQuery(rawQuery);

  /*
   * Started here and deliberately NOT awaited. Data access stays at the route
   * (FRONTEND_ARCHITECTURE §7) while the promise travels down to a `Suspense` boundary in the
   * template, so a slow blog service delays one section instead of the whole page. It cannot reject
   * — `getBlogPosts` reports every API condition as a value.
   *
   * There is no `notFound()` anywhere on this route, under any condition. The index exists whether
   * or not anything is published and whether or not the API answers; what varies is what the list
   * section is able to say, which is its own decision to make.
   */
  const posts = getBlogPosts(locale, {
    ...(query.category === null ? {} : { category: query.category }),
    page: query.page,
  });

  return <InsightsTemplate posts={posts} locale={locale} query={query} />;
}
