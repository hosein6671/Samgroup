import { notFound } from "next/navigation";
import { cache } from "react";

import { CmsPageTemplate } from "@/features/cms-proof/cms-page-template";
import { CmsPageUnavailable } from "@/features/cms-proof/cms-page-unavailable";
import { getContentPage } from "@/lib/content";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getActiveLocales } from "@/lib/locales";
import { gateCmsProofRouteForProduction, isProductionRuntime } from "@/features/site/proof-routes";

/**
 * The CMS content proof — `/{locale}/cms-proof/{slug}`.
 *
 * ── What this route is for, and what it is not ──────────────────────────────
 *
 * It renders a page owned by Payload, fetched through NestJS, in the requested locale. That is the
 * whole purpose: it demonstrates the Payload → NestJS → Next.js path end to end, including locale
 * fallback and the not-found / unavailable distinction.
 *
 * **It is not a canonical route and must not become one.** The `Pages` collection holds legal pages
 * (PAYLOAD_CONTENT_ARCHITECTURE.md §1), and every one of them is blocked on approved, legally
 * reviewed text in three locales that does not exist (SITE_STRUCTURE.md §12; the launch blockers in
 * ROADMAP.md). `/{locale}/privacy-policy` is created by the gate that has that content — pointing it
 * at this data now would publish whatever is in the CMS as though it were policy. When that gate
 * arrives, this route follows ADR-010 §9's transition order (implement → validate → redirect →
 * remove) and is deleted.
 *
 * ── Namespace ───────────────────────────────────────────────────────────────
 *
 * `cms-proof/` is its own segment, separate from `products/` and `insights/`. ADR-010 and ADR-011
 * govern `/{locale}/products/{slug}` alone — their triggers read `categories`, `products` and
 * `content_translations` for those two entity types — so nothing here claims, reserves or consults
 * a `ProductSlugClaim`. Payload's `pages.slug` is unique within `sam_cms` and that is the only
 * uniqueness this route depends on.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * Both absent, for the reason the products and insights `[slug]` routes record: with
 * `generateStaticParams` present, Next answers anything outside the enumerated set at the router,
 * before this file runs, which would take the 404 decision away from the only code that can make it
 * correctly. Nothing is lost — the fetch beneath this route is `cache: "no-store"`, so it renders
 * per request either way. `/xx/cms-proof/anything` still 404s at the router, because the `[locale]`
 * segment keeps its own enumeration.
 *
 * ── Which failure may become a 404, and which may never ─────────────────────
 *
 * Exactly one. `not-found` is the API stating that the CMS answered and holds no published page for
 * this slug — the only honest reason to serve a canonical 404. An unpublished page produces it too,
 * by design: whether a draft exists is not something a public route should reveal.
 *
 * A stopped API, a stopped **Payload**, a timeout, a 5xx, a rejected service credential and a
 * malformed payload all render `CmsPageUnavailable` instead. That is ADR-010 §7 applied to a chain
 * one service longer than the one it was written for, and it is the reason the API distinguishes
 * NOT_FOUND from UPSTREAM_UNAVAILABLE in the first place.
 */

/**
 * One lookup per request, shared by `generateMetadata` and the component.
 *
 * `cache` is React's per-request memo — the same arrangement `resolvePost` uses for the article
 * route. Without it this page would issue two identical requests to NestJS and, through it, two to
 * Payload, and the two could disagree.
 */
const resolveCmsPage = cache(getContentPage);

/**
 * The page's metadata, mapped from the normalized `SeoFields` record NestJS serves.
 *
 * ── What this demonstrates, and what it deliberately does not ──────────────
 *
 * It is the proof that CMS-authored SEO data reaches Next's Metadata API through NestJS and nothing
 * else — SEO_ARCHITECTURE.md §4's "the metadata always comes from the normalized SEO shape". It is
 * **not** the site-wide SEO implementation: no `hreflang` alternates, no canonical, no JSON-LD, no
 * `metadataBase`. Those are the SEO gate's, they apply to every route rather than this one, and
 * `alternates` in particular needs a public origin this route has no business choosing.
 *
 * ── The fallback chain is applied here, not invented here ──────────────────
 *
 * §11 defines it: the entity's own SEO value first, then a value derived from the entity's own
 * content. So `metaTitle` falls back to the page title, and the OG and Twitter values fall back
 * through their documented order — which the API has already partly applied, because those steps are
 * contract rules rather than rendering choices. Nothing is fabricated: where no value exists at any
 * step, the key is omitted rather than filled with a guess.
 *
 * Every non-success outcome returns `{}`. A 404 and an unavailable page have nothing to describe,
 * and naming the requested slug in a `<title>` would echo caller-supplied text while implying the
 * page is real.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  /*
   * In production this route is 404 and has nothing to describe, so it returns before the fetch.
   *
   * The 404 itself is the page component's — `notFound()` there is what sets the status. This is
   * only about not issuing an upstream request for a response that is already decided: Next runs
   * `generateMetadata` alongside the component rather than after it, so without this the gate would
   * still cost one NestJS call, and through it one Payload call, per request.
   */
  if (isProductionRuntime()) return {};

  const { locale, slug } = await params;
  const result = await resolveCmsPage(slug, locale);

  if (!result.ok) return {};

  const { seo, title } = result.page;

  /*
   * The image URLs are origin-relative — `/media/cms/<file>`, served by nginx from the public bucket
   * — because `apps/api` does not compose public URLs and the production object store is undecided.
   * Open Graph requires absolute URLs, and Next resolves a relative one against `metadataBase`.
   * `metadataBase` is not set here: it is a site-wide value belonging to the root layout and the SEO
   * gate, so on this proof route Next resolves against the request origin and logs that it did. That
   * is the honest state — the URL is correct and same-origin, and making it absolute is a decision
   * this route does not own.
   *
   * `alt`, `width` and `height` are mapped straight onto Next's `OGImage`, which emits
   * `og:image:alt`, `og:image:width` and `og:image:height`. That is the point of the API carrying
   * them: §Image SEO and §6 are unimplementable from a bare URL. Each is omitted when null rather
   * than emitted empty — an `og:image:alt` with no text is worse than none.
   */
  const ogImage = seo.socialImage
    ? {
        url: seo.socialImage.url,
        ...(seo.socialImage.alt !== null && { alt: seo.socialImage.alt }),
        ...(seo.socialImage.width !== null && { width: seo.socialImage.width }),
        ...(seo.socialImage.height !== null && { height: seo.socialImage.height }),
      }
    : undefined;

  const twitterImage = seo.twitterImage
    ? {
        url: seo.twitterImage.url,
        ...(seo.twitterImage.alt !== null && { alt: seo.twitterImage.alt }),
      }
    : undefined;

  return {
    title: seo.metaTitle ?? title,
    ...(seo.metaDescription !== null && { description: seo.metaDescription }),
    /*
     * `robots` is deliberately NOT mapped here, and the omission is the whole point.
     *
     * Next's Metadata API resolves by taking the NEAREST value, so a `robots` key on this page would
     * override — not merge with — the `noindex, nofollow` the `[locale]` layout sets for the entire
     * tree. Since `robotsIndex`/`robotsFollow` default to `true` in the contract, mapping them
     * straight through would make this demo route publicly indexable the moment any page reached it,
     * which is exactly what a non-canonical proof route carrying NON-AUTHORITATIVE placeholder
     * content must never be. Measured, not assumed: with the mapping in place the rendered tag read
     * `index, follow`.
     *
     * The fields are still served and still tested; honouring them belongs to the SEO gate, on
     * canonical routes, where an editor's `noindex` is a real instruction rather than a way to
     * escape a blanket one.
     */
    openGraph: {
      title: seo.ogTitle ?? seo.metaTitle ?? title,
      ...(seo.ogDescription !== null || seo.metaDescription !== null
        ? { description: seo.ogDescription ?? seo.metaDescription ?? undefined }
        : {}),
      ...(ogImage !== undefined && { images: [ogImage] }),
    },
    twitter: {
      card: seo.twitterCardType,
      title: seo.twitterTitle ?? seo.ogTitle ?? seo.metaTitle ?? title,
      ...(seo.twitterDescription !== null || seo.ogDescription !== null
        ? { description: seo.twitterDescription ?? seo.ogDescription ?? undefined }
        : {}),
      ...(twitterImage !== undefined && { images: [twitterImage] }),
    },
  };
}

export default async function CmsProofPage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<ReactNode> {
  /*
   * Production answers 404 here, ahead of `params` and every fetch — owner decision, 2 September
   * 2026, implemented in `features/site/proof-routes.ts`. This is the one proof route with no
   * canonical target to redirect to: its counterparts are the legal pages, and every one of them
   * is blocked on approved, legally reviewed text that does not exist. The gate becomes a redirect
   * when that content is published, then a deletion, per ADR-010 §9.
   */
  gateCmsProofRouteForProduction();

  const { locale, slug } = await params;
  const locales = await getActiveLocales();

  /*
   * No `Suspense` boundary, for the reason the article route gives: the fetch decides whether the
   * page exists at all, so there is nothing that could honestly render before it resolves.
   */
  const result = await resolveCmsPage(slug, locale);

  if (result.ok) {
    return (
      <CmsPageTemplate
        locales={locales}
        page={result.page}
        locale={locale}
        localeFallback={result.localeFallback}
      />
    );
  }

  // The ONE condition allowed to 404 — see the module note.
  if (result.reason === "not-found") notFound();

  /*
   * Everything else. The page's existence is UNKNOWN, and reporting unknown as absent is what
   * ADR-010 §7 forbids. Reported server-side, and specific about WHICH service failed: a 503 is
   * NestJS saying Payload did not answer, while `unreachable` is NestJS itself not answering — the
   * difference between restarting the CMS and restarting the API.
   */
  console.warn(
    `[cms-proof:${slug}] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the platform API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : result.status === 503
          ? "the platform API answered 503 — the CMS did not respond to it"
          : `the platform API answered, but not with a page (HTTP ${String(result.status)})`),
  );

  return <CmsPageUnavailable locales={locales} locale={locale} />;
}
