import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PostTemplate } from "@/features/blog/post-template";
import { PostUnavailable } from "@/features/blog/post-unavailable";
import { resolvePost } from "@/features/blog/resolve-post";
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

  return result.ok ? { title: result.record.title } : {};
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
    return (
      <PostTemplate
        locales={locales}
        post={result.record}
        locale={locale}
        localeFallback={result.localeFallback}
      />
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
