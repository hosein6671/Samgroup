import { notFound } from "next/navigation";
import { cache } from "react";

import { CmsPageTemplate } from "@/features/cms-proof/cms-page-template";
import { CmsPageUnavailable } from "@/features/cms-proof/cms-page-unavailable";
import { getContentPage } from "@/lib/content";

import type { Metadata } from "next";
import type { ReactNode } from "react";

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
 * The page's `<title>`, read from the record.
 *
 * Every non-success outcome returns `{}` rather than inventing one: a 404 and an unavailable page
 * have nothing to describe, and naming the requested slug in a `<title>` would echo caller-supplied
 * text while implying the page is real.
 *
 * No description is emitted. The `SeoFields` group is not implemented on the collection yet
 * (`apps/cms/src/collections/pages.ts`), and deriving one by cutting the body would publish a
 * sentence the editor never wrote.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await resolveCmsPage(slug, locale);

  return result.ok ? { title: result.page.title } : {};
}

export default async function CmsProofPage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<ReactNode> {
  const { locale, slug } = await params;

  /*
   * No `Suspense` boundary, for the reason the article route gives: the fetch decides whether the
   * page exists at all, so there is nothing that could honestly render before it resolves.
   */
  const result = await resolveCmsPage(slug, locale);

  if (result.ok) {
    return (
      <CmsPageTemplate page={result.page} locale={locale} localeFallback={result.localeFallback} />
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

  return <CmsPageUnavailable locale={locale} />;
}
