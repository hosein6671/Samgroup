import type { Metadata } from "next";
import type { ReactNode } from "react";

import { InsightsTemplate } from "@/features/blog/insights-template";
import { readInsightsQuery } from "@/features/blog/insights-query";
import { structuralAlternates, localePath } from "@/features/seo/alternates";
import { JsonLd } from "@/features/seo/json-ld";
import { absoluteUrl } from "@/features/seo/site";
import { collectionPageJsonLd } from "@/features/seo/structured-data";
import { ROUTES } from "@/features/site/site-routes";
import { getBlogPosts } from "@/lib/blog";
import { getActiveLocales } from "@/lib/locales";

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

const TITLE = "Insights | SAM Group";
const DESCRIPTION = "Articles published by SAM Group.";

/**
 * The title and description are this page's own — it has no record to be titled after — but the
 * **canonical is not optional**, and this route had none.
 *
 * That mattered more here than on a plain structural page: the index accepts `?category=` and
 * `?page=`, so every filter and every page of results is a distinct URL for what is one listing.
 * SEO_ARCHITECTURE.md §7's rule is that a filtered or paginated list canonicalises to the clean,
 * unfiltered, page-1 URL, and that is exactly what is emitted here — deliberately built from the
 * route rather than from `searchParams`, so no query string can ever reach it.
 *
 * `robots` is still not declared. `app/[locale]/layout.tsx` owns that for the whole tree and a
 * route-level override would be a second answer to a settled question. No `hreflang`: the index's
 * own chrome is code-owned English in all three locales.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: structuralAlternates(locale, ROUTES.insights),
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: TITLE,
      description: DESCRIPTION,
      url: absoluteUrl(localePath(locale, ROUTES.insights)),
      locale,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

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
  const locales = await getActiveLocales();
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

  return (
    <>
      {/*
       * `CollectionPage`, and nothing about the collection's contents: the list varies per request,
       * per locale and per filter, and structured data that disagrees with the rendered page is
       * worse than none (SEO_ARCHITECTURE.md §9). The `url` is the clean canonical, matching the
       * tag `generateMetadata` emits.
       */}
      <JsonLd
        data={collectionPageJsonLd({
          url: absoluteUrl(localePath(locale, ROUTES.insights)),
          name: TITLE,
          description: DESCRIPTION,
          locale,
        })}
      />
      <InsightsTemplate locales={locales} posts={posts} locale={locale} query={query} />
    </>
  );
}
