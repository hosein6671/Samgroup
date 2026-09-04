import { isIndexingEnabled } from "@/features/seo/indexing";
import { absoluteUrl, siteOrigin } from "@/features/seo/site";

import type { MetadataRoute } from "next";

/**
 * `/robots.txt` — SEO_ARCHITECTURE.md §4's `robots.ts` convention.
 *
 * ── It agrees with the pages, because both read one switch ──────────────────
 *
 * Every page in the canonical tree carries the `robots` directive that
 * `features/seo/indexing.ts` produces, and so does this file. That is the whole design: a
 * `robots.txt` inviting a crawl while every page answers `noindex` burns crawl budget on pages that
 * then refuse to be indexed, and the reverse silently hides a launched site. One switch cannot
 * produce that disagreement.
 *
 * **Closed by default.** With `SITE_SEO_INDEXING` unset — which is every environment today — this
 * serves `Disallow: /`, matching the blanket `noindex, nofollow` the locale layout has carried
 * since locale routing shipped. Opening the site is one environment variable in the deployed
 * container, and it opens the pages and this file together.
 *
 * ── The sitemap is named in both states, deliberately ───────────────────────
 *
 * A `Sitemap:` line beside `Disallow: /` is not a contradiction: `robots.txt` disallows *crawling*,
 * while the sitemap tells a crawler what exists. Keeping the line means the sitemap URL is already
 * correct and discoverable on the day the gate opens, and it is how the file can be validated
 * before launch rather than after.
 *
 * ── What stays disallowed even after launch ─────────────────────────────────
 *
 * - `/admin/` — the Admin Dashboard, an authenticated staff surface inside `apps/web`.
 * - `/api/` — server routes; nginx also proxies `/api/` to NestJS, which no crawler should follow.
 * - `/design-proof/` — the temporary proof tree, which is not a canonical surface and is scheduled
 *   for removal (ADR-010 §9).
 * - `/*​/cms-proof/` — the CMS demonstration route, which renders explicitly NON-AUTHORITATIVE
 *   placeholder content and is locale-prefixed, hence the wildcard.
 *
 * Payload's own admin at `cms.samgp.com` is **not** listed here and must not be: it is a different
 * host, so this file does not govern it. SEO_ARCHITECTURE.md §4 keeps it out of the index with an
 * `X-Robots-Tag` at the nginx layer instead — see "Remaining production configuration".
 *
 * ── Why it is dynamic ───────────────────────────────────────────────────────
 *
 * Next would otherwise generate this once at build time and bake in whatever `SITE_SEO_INDEXING`
 * was set to on the build machine. The launch gate is a property of the running deployment, not of
 * the build, so the file is rendered per request. It is a few hundred bytes and is requested rarely.
 */
export const dynamic = "force-dynamic";

/** Paths that are never for crawlers, in either state. */
const ALWAYS_DISALLOWED = ["/admin/", "/api/", "/design-proof/", "/*/cms-proof/"];

export default function robots(): MetadataRoute.Robots {
  const indexable = isIndexingEnabled();

  return {
    rules: indexable
      ? [{ userAgent: "*", allow: "/", disallow: ALWAYS_DISALLOWED }]
      : /*
         * One rule, and no `allow`. A bare `Disallow: /` is the unambiguous form; listing the
         * always-disallowed paths beside it would imply the rest of the site is permitted.
         */
        [{ userAgent: "*", disallow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
    /*
     * `host` is non-standard and ignored by Google, but it is harmless, it is what Next's type
     * offers, and it states the canonical origin for the crawlers that do read it — the same origin
     * every canonical tag on the site is built from.
     */
    host: siteOrigin(),
  };
}
