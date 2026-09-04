import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PostTemplate } from "@/features/blog/post-template";
import { PostUnavailable } from "@/features/blog/post-unavailable";
import { resolvePost } from "@/features/blog/resolve-post";
import { pageAlternates, localePath } from "@/features/seo/alternates";
import { JsonLd } from "@/features/seo/json-ld";
import { absoluteUrl } from "@/features/seo/site";
import { articleJsonLd, breadcrumbJsonLd } from "@/features/seo/structured-data";
import { ROUTES } from "@/features/site/site-routes";
import { getActiveLocales } from "@/lib/locales";

/**
 * One article — `/{locale}/insights/{post-slug}`.
 *
 * ── A flat route, and a namespace of its own ────────────────────────────────
 *
 * The path is flat: the category is a relationship, never URL ancestry, exactly as Segment is for a
 * Product. `{post-slug}` is the LOCALE-SPECIFIC slug, resolved server-side against
 * `content_translations` — FRONTEND_ARCHITECTURE.md §2 names blog articles as one of the three
 * content types that carry localized slugs.
 *
 * This namespace is `/{locale}/insights/{slug}` and is **separate from the products namespace**.
 * ADR-010 and ADR-011 govern `/{locale}/products/{slug}` and nothing else — their triggers read
 * `categories`, `products` and `content_translations` where `entity_type IN ('Category','Product')`.
 * A blog slug is unique by `blog_posts.slug` alone, no value is reserved here, and no discriminator
 * is needed because only one entity type occupies this segment.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * Both are absent for the reason the products `[slug]` route records at length: with
 * `generateStaticParams` present, Next builds the closed cross-product of *locales × those slugs*
 * and answers anything outside it at the router, before this file runs — which would take the 404
 * decision away from the only code that can make it correctly. Nothing is lost: every fetch beneath
 * this route is `cache: "no-store"`, so it renders per request either way.
 *
 * `/xx/insights/anything` still 404s at the router, because the `[locale]` segment keeps its own
 * `generateStaticParams` and `dynamicParams = false`. What reaches this file is a known locale with
 * an arbitrary slug, and deciding what that means is exactly this file's job.
 *
 * ── Which failures may become a 404, and which may never ────────────────────
 *
 * Only one. `not-found` is the API stating that no PUBLISHED post answers this slug in this locale —
 * a fact about the blog, and the only honest reason to serve a canonical 404. An unpublished post
 * produces it too, by design: whether a draft exists is not something a public route should reveal.
 *
 * `unreachable` and `api-error` — a stopped service, a timeout, a 5xx, a malformed payload — render
 * `PostUnavailable` instead. This is the principle ADR-010 §7 freezes for Product Detail, applied
 * unchanged: infrastructure failure must never become a canonical-content 404.
 */

/**
 * The page's `<title>`, read from the record.
 *
 * This costs no extra request: `resolvePost` is memoized per request with React's `cache`, so this
 * call and the component's below are one round trip that cannot disagree.
 *
 * Every non-success outcome returns `{}` rather than inventing a title. A 404 and an unavailable
 * page have nothing to describe, and naming the requested slug in a `<title>` would echo
 * caller-supplied text while implying the article is real.
 *
 * No description is emitted. `BlogPost` has no `excerpt` column, and cutting the body at a character
 * count to produce one would publish a sentence the editor never wrote — the same rule the card
 * holds to.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await resolvePost(slug, locale);

  if (!result.ok) return {};

  /*
   * The canonical is built from the record's **resolved** slug, not from the requested one.
   *
   * The API resolves an article's slug per locale, so a request can legitimately arrive on one
   * spelling and resolve to the record's own — and the canonical must name the record, or two URLs
   * claim to be the same page without either pointing at the other.
   *
   * No `hreflang`. Article slugs are localized and `BlogPostResponse` carries no alternates list, so
   * there is no record of which locales this post is genuinely translated into; inventing the set by
   * assuming every active locale would be the false-language signal
   * `features/seo/alternates.ts` exists to prevent.
   */
  return {
    title: result.record.title,
    alternates: pageAlternates({
      canonicalPath: articlePath(locale, result.record.slug),
    }),
  };
}

/** One article's site-relative path. The index's segment is structural; the slug is localized. */
function articlePath(locale: string, slug: string): string {
  return `${localePath(locale, ROUTES.insights)}/${slug}`;
}

export default async function InsightPostPage({
  params,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<ReactNode> {
  const { locale, slug } = await params;
  const locales = await getActiveLocales();

  /*
   * There is no `Suspense` boundary around this. A boundary streams a *part* of a page while the
   * rest renders — but here the fetch decides whether the page exists at all, so there is nothing
   * that could honestly render before it resolves. Streaming a shell and then replacing it with a
   * 404 would emit a page that says an article exists and then retract it.
   */
  const result = await resolvePost(slug, locale);

  if (result.ok) {
    const url = absoluteUrl(articlePath(locale, result.record.slug));

    return (
      <>
        {/*
         * `Article` + `BreadcrumbList` — SEO_ARCHITECTURE.md §8's rows for a blog post detail page,
         * which this route emitted neither of before.
         *
         * Everything in them is a value this page already renders: the record's own title, its own
         * `publishedAt`, and the two-step trail the reader can actually see. No author, no
         * `dateModified` and no image are asserted — see `articleJsonLd` for why each is absent
         * rather than filled in.
         */}
        <JsonLd
          data={articleJsonLd({
            url,
            headline: result.record.title,
            datePublished: result.record.publishedAt,
            locale,
          })}
        />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Insights", path: localePath(locale, ROUTES.insights) },
            { name: result.record.title, path: articlePath(locale, result.record.slug) },
          ])}
        />
        <PostTemplate
          locales={locales}
          post={result.record}
          locale={locale}
          localeFallback={result.localeFallback}
        />
      </>
    );
  }

  // The ONE condition allowed to 404 — see the module note.
  if (result.reason === "not-found") notFound();

  /*
   * Everything else. The page's existence is UNKNOWN, and reporting unknown as absent is what
   * ADR-010 §7 forbids. Reported server-side so the condition is visible in logs rather than only to
   * the visitor.
   */
  console.warn(
    `[insight:${slug}] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : `the API answered, but not with a post (HTTP ${String(result.status)})`),
  );

  return <PostUnavailable locales={locales} locale={locale} />;
}
