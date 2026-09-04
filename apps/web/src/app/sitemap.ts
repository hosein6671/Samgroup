import { PRIVACY_POLICY_SLUG, resolvePrivacyPolicy } from "@/features/legal/privacy-policy";
import { localePath } from "@/features/seo/alternates";
import { absoluteUrl } from "@/features/seo/site";
import { ROUTES } from "@/features/site/site-routes";
import { getBlogPosts } from "@/lib/blog";
import { defaultLocale } from "@/lib/locale-contract";
import { getActiveLocales } from "@/lib/locales";
import { CATEGORY_ENTITY_TYPE, getSitemapEntries } from "@/lib/seo";

import type { MetadataRoute } from "next";

/**
 * `/sitemap.xml` — SEO_ARCHITECTURE.md §4's `sitemap.ts` convention.
 *
 * ── The one rule this file is built on ──────────────────────────────────────
 *
 * **A URL appears here only if it is a real, published, canonical page.** A sitemap is a set of
 * assertions to a search engine, and each of the four ways it can lie has a cost the platform has
 * already decided not to pay elsewhere: a URL that 404s, a URL that is unpublished, a URL carrying
 * placeholder content, and a URL whose `hreflang` claims a translation that does not exist.
 *
 * ── What is included ────────────────────────────────────────────────────────
 *
 * 1. **Structural routes, in the default locale.** Their paths are `apps/web`'s own — they exist in
 *    no table, so they are read from `ROUTES`, the single route registry, rather than from the API.
 * 2. **Product Family pages, in every locale the API says the Category is translated into.** From
 *    `GET /seo/sitemap-entries`, which already excludes any entity an editor marked `noindex`.
 * 3. **Published blog articles, in the default locale**, from `GET /blog/posts` — an endpoint that
 *    serves only posts with `publishedAt` set and in the past.
 * 4. **The Privacy Policy, only when the CMS is actually serving a published one.** Checked through
 *    the same per-request lookup the footer and the consent labels use, so the sitemap, the footer
 *    link and the route itself cannot disagree about whether the policy exists.
 *
 * ── What is deliberately excluded, and why ──────────────────────────────────
 *
 * - **Non-default locales of structural routes.** `/fa/export-logistics` returns 200 and serves
 *   **English** copy: structural page text is code-owned and untranslated. Submitting all three
 *   locales would submit three near-identical English pages, which is a duplicate-content signal
 *   rather than an international one. The default locale is the honest single entry until the
 *   structural copy is translated — see `features/seo/alternates.ts` for the same reasoning applied
 *   to `hreflang`.
 * - **Product detail pages.** The canonical route exists and the 100 `Product` rows are the real
 *   imported catalog — ROADMAP.md's line about a DEMO/PLACEHOLDER product set is stale and was
 *   measured against the database on 30 August 2026 (zero rows match `sam-demo-%`). They are still
 *   excluded, for a different and current reason: **not one of them carries a description**, so
 *   every product detail page would be thin, near-identical content, and no Persian or Arabic copy
 *   exists for any of them. Including them also needs `GET /seo/sitemap-entries` to enumerate
 *   products, which it deliberately does not — that is a change in `apps/api`, its own gate.
 * - **The Product Finder, and any filtered or paginated view.** SEO_ARCHITECTURE.md §7: only clean,
 *   unfiltered list URLs are submitted, never query-parameter combinations.
 * - **`/products#documentation`.** A fragment on the Products landing page, not a URL of its own.
 * - **Terms of Use, Cookie Notice, General Sales Conditions.** No route exists for any of them.
 * - **`/design-proof/*` and `/{locale}/cms-proof/*`.** Not canonical surfaces; `robots.ts`
 *   disallows both.
 * - **The Admin Dashboard.** Authenticated staff surface.
 *
 * ── It never throws, and never guesses ──────────────────────────────────────
 *
 * Every read here is allowed to fail, and each failure removes entries rather than replacing them.
 * `getActiveLocales` is the one call that throws by design — it is the routing bootstrap, and a
 * build with no locale list must fail rather than generate a different site — but a *sitemap* that
 * answers 500 while the site itself serves fine is a worse outcome than a sitemap that is briefly
 * empty, so it is caught here and reported. An empty sitemap is valid XML and a crawler treats it
 * as "nothing new", which is exactly true when the platform cannot say what exists.
 *
 * ── `lastModified` is omitted where nothing records it ──────────────────────
 *
 * Only blog articles carry a real timestamp (`publishedAt`). `categories` has no timestamp column
 * at all — the API's own DTO says so and declines to invent one — and structural routes are code,
 * not records. Emitting today's date for a page that has not changed in a year is a false freshness
 * signal, so the field is simply absent. `changeFrequency` and `priority` are omitted everywhere for
 * the same reason: Google ignores both, and a value nobody derived from anything is noise.
 */

/**
 * Rendered per request rather than baked at build time.
 *
 * Every read beneath this is `cache: "no-store"`, so the route was already dynamic; stating it means
 * a published article or a newly published Privacy Policy appears in the sitemap when it is
 * published, not at the next deployment.
 */
export const dynamic = "force-dynamic";

/**
 * The structural routes that are indexable pages.
 *
 * An explicit list rather than every value of `ROUTES`, because that object also holds a fragment
 * (`documentation`), a filtered view (`productFinder`) and a route whose inclusion is conditional
 * (`privacyPolicy`). Explicit is what makes each omission reviewable — the paths themselves still
 * come from the one registry, so a renamed route cannot leave a stale string here.
 */
const STRUCTURAL_ROUTES: readonly string[] = [
  ROUTES.home,
  ROUTES.aboutUs,
  ROUTES.products,
  ROUTES.customizedSolutions,
  ROUTES.exportLogistics,
  ROUTES.qualityCertifications,
  ROUTES.insights,
  ROUTES.contactUs,
  ROUTES.requestQuote,
];

/** How many pages of articles to walk before stopping. 20 × the page size is far beyond today's index. */
const MAX_BLOG_PAGES = 20;

/** Every published article's slug in one locale, paged through, or `[]` if the API did not answer. */
async function blogEntries(locale: string): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  let page = 1;

  while (page <= MAX_BLOG_PAGES) {
    const result = await getBlogPosts(locale, { page });

    if (!result.ok) break;

    for (const post of result.posts) {
      entries.push({
        url: absoluteUrl(`${localePath(locale, ROUTES.insights)}/${post.slug}`),
        lastModified: new Date(post.publishedAt),
      });
    }

    // `limit` can be 0 only on an empty page, which the length check already ended.
    if (result.posts.length === 0 || page * result.limit >= result.total) break;

    page += 1;
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let locales;

  try {
    locales = await getActiveLocales();
  } catch (error) {
    /*
     * The only fatal read, made non-fatal here. Reported with the reason so an operator sees why the
     * sitemap emptied rather than discovering it in Search Console weeks later.
     */
    console.warn(
      `[sitemap] serving an empty sitemap — the active locale set could not be resolved: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return [];
  }

  const primary = defaultLocale(locales).code;
  const activeCodes = new Set(locales.map((locale) => locale.code));

  const [entries, articles, privacyPolicy] = await Promise.all([
    getSitemapEntries(),
    blogEntries(primary),
    resolvePrivacyPolicy(PRIVACY_POLICY_SLUG, primary),
  ]);

  const urls: MetadataRoute.Sitemap = STRUCTURAL_ROUTES.map((path) => ({
    url: absoluteUrl(localePath(primary, path)),
  }));

  /*
   * Only when the CMS is serving a published policy. `result.ok` is false for a definitive 404, for
   * a draft-only document (drafts are not public and the API never asks for one), and for every
   * infrastructure failure — all four of which mean "do not submit this URL".
   */
  if (privacyPolicy.ok) {
    urls.push({ url: absoluteUrl(localePath(primary, ROUTES.privacyPolicy)) });
  }

  for (const entry of entries ?? []) {
    /*
     * Case-insensitive, because the entity type is the API's enum spelling and this build must not
     * break if it is served as `category`. An entity type this build cannot turn into a URL is
     * skipped rather than guessed at — there is no route for a type it does not know.
     */
    if (entry.entityType.toLowerCase() !== CATEGORY_ENTITY_TYPE.toLowerCase()) continue;

    // A locale the `Locale` table does not have would produce a route that 404s at the router.
    if (!activeCodes.has(entry.locale)) continue;

    urls.push({
      url: absoluteUrl(`${localePath(entry.locale, ROUTES.products)}/${entry.slug}`),
    });
  }

  urls.push(...articles);

  /*
   * A duplicate `<url>` is a sitemap error, and two sources could in principle produce one — a
   * Category slug colliding with a structural path, say. The namespace registry (ADR-011) makes that
   * impossible for the product namespace, so this is a guard rather than a fix, and it keeps the
   * first occurrence so the structural routes stay at the top of the document.
   */
  const seen = new Set<string>();

  return urls.filter((entry) => {
    if (seen.has(entry.url)) return false;

    seen.add(entry.url);

    return true;
  });
}
