import { notFound } from "next/navigation";

import { LegalPageTemplate } from "@/features/legal/legal-page-template";
import { LegalPageUnavailable } from "@/features/legal/legal-page-unavailable";
import { PRIVACY_POLICY_SLUG, resolvePrivacyPolicy } from "@/features/legal/privacy-policy";
import { pageAlternates, structuralAlternates } from "@/features/seo/alternates";
import { ROUTES } from "@/features/site/site-routes";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getActiveLocales } from "@/lib/locales";

/**
 * The canonical Privacy Policy — `/{locale}/privacy-policy`.
 *
 * ── The URL is frozen, and it is flat ───────────────────────────────────────
 *
 * SITE_STRUCTURE.md §0 lists `/privacy-policy`; FRONTEND_ARCHITECTURE.md §1's route tree places it
 * at `app/[locale]/privacy-policy/page.tsx`; §3's [CONFIRMED] note fixes the segment as an English
 * string identical in every locale, because localized slugs are reserved for products, categories
 * and blog articles (PROJECT_HANDOFF.md §6.12). So `/fa/privacy-policy` and `/ar/privacy-policy`
 * carry the same segment as `/en/privacy-policy` — the locale changes the document, never the path.
 *
 * ── This route publishes no policy, and cannot ──────────────────────────────
 *
 * **No approved Privacy Policy text exists in this repository or in the CMS.** SITE_STRUCTURE.md
 * §12 states the four legal pages are "specifications for a legal drafter, not finished legal text"
 * and require actual legal review before publication; its Outstanding Confirmations list and the
 * ROADMAP launch blockers say the same. Nothing here drafts, seeds, approximates or falls back to
 * any policy text, and there is deliberately no hardcoded body: the page's entire content comes
 * from a published `Pages` document whose slug is `privacy-policy`, authored and published by a
 * human editor in Payload after legal review.
 *
 * Until such a document is published, this route answers **404 in every locale**, and that is the
 * already-approved semantics rather than a new decision — see the failure table below. A 404 is the
 * honest answer while the page genuinely does not exist; a placeholder would be a page pretending
 * to be a policy, which is the outcome every document about this gate forbids.
 *
 * ── It is not the proof route, and does not read the proof route's data ─────
 *
 * `/{locale}/cms-proof/{slug}` renders any `Pages` document by slug and carries a DEMO band saying
 * so. This route is slug-fixed: `PRIVACY_POLICY_SLUG` is a constant, not a segment, so no demo or
 * draft document can ever be served here by asking for it in the URL. The proof route stays where
 * it is until the transition in ADR-010 §9 is completed by the gate that has approved content.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * There is no dynamic segment to enumerate — `[locale]` keeps its own — and the fetch beneath this
 * route is `cache: "no-store"`, so the page renders per request. `/xx/privacy-policy` still 404s at
 * the router, because the `[locale]` segment's `dynamicParams = false` closes it.
 *
 * ── Which failure may become a 404, and which may never ─────────────────────
 *
 * | Condition                                              | Behaviour                    |
 * | ------------------------------------------------------ | ---------------------------- |
 * | A published `privacy-policy` page exists                | 200, rendered from the CMS   |
 * | The CMS answered and holds no published page (404)      | Canonical 404                |
 * | Only a draft exists                                     | Canonical 404 — drafts are not public, and whether one exists is not something a public route reveals |
 * | API unreachable, 5xx, 503 (Payload down), malformed     | `LegalPageUnavailable`, never a 404 |
 *
 * The last row is ADR-010 §7 applied to a chain one service longer than the one it was written for,
 * and this is the page it matters most on: a Payload outage turning into a 404 would tell crawlers
 * the company had withdrawn its privacy policy.
 */

/*
 * The slug and the lookup both live in `features/legal/privacy-policy.ts`, and are imported rather
 * than declared here.
 *
 * They moved when the footer and the two consent labels started linking this route: the slug is a
 * constant three other surfaces now have to agree with, and the lookup is a per-request memo that
 * dedupes only if every consumer shares one instance of it. A second `cache(getContentPage)` in
 * this file would issue a second request to NestJS — and, through it, to Payload — on every render
 * of this page, and the two could disagree about whether the policy exists.
 *
 * Nothing about this route's behaviour changed with the move. The slug is still a constant rather
 * than a URL segment, so no demo or draft document can be served here by asking for it in the URL.
 */

/**
 * Metadata, mapped from the normalized `SeoFields` record NestJS serves.
 *
 * ── Nothing is invented ─────────────────────────────────────────────────────
 *
 * SEO_ARCHITECTURE.md §11's fallback chain runs: the entity's own SEO value, then a value derived
 * from the entity's own content. Both steps are already satisfied by data — `metaTitle` falls back
 * to the page's own CMS title, and the OG/Twitter values fall back through their documented order,
 * which the API has partly applied because those steps are contract rules rather than rendering
 * choices. Where no value exists at any step the key is omitted rather than filled with a guess, so
 * this route never writes meta copy about a legal document.
 *
 * Every non-success outcome returns `{}`. A 404 and an unavailable page have nothing to describe,
 * and naming the route in a `<title>` would imply a policy exists.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const result = await resolvePrivacyPolicy(PRIVACY_POLICY_SLUG, locale);
  const alternates = structuralAlternates(locale, ROUTES.privacyPolicy);

  /*
   * **The canonical is emitted; the title still is not.** Both halves are deliberate.
   *
   * The address is canonical whether or not a policy is published there — a canonical describes
   * which URL is authoritative for a page, which is true of the unavailable state too. What must
   * NOT appear is a `<title>` naming the route, because on a page with no published policy that
   * would imply one exists. So this returns the address and nothing that describes content.
   *
   * On `not-found` the component calls `notFound()` immediately afterwards and Next renders its
   * own not-found page, so the canonical never reaches a rendered document in that case.
   */
  if (!result.ok) return { alternates };

  const { seo, title } = result.page;

  /*
   * The image URLs are origin-relative — `/media/cms/<file>`, served by nginx from the public
   * bucket — because `apps/api` does not compose public URLs and the production object store is
   * undecided. Open Graph requires absolute URLs, and Next resolves a relative one against
   * `metadataBase`, which is a site-wide value belonging to the root layout and the SEO gate. Until
   * that gate sets it, Next resolves against the request origin and logs that it did; the URL is
   * correct and same-origin either way.
   *
   * `alt`, `width` and `height` map straight onto Next's `OGImage`, each omitted when null rather
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
     * An editor's explicit override still wins. Its absence no longer means "no canonical": the
     * §2 fallback is "the entity's own resolved URL", which is a URL-composition step belonging to
     * the frontend, and `structuralAlternates` is that step. This route previously emitted a
     * canonical only when an editor had set one, so the common case emitted none at all.
     */
    alternates:
      seo.canonicalUrl === null ? alternates : pageAlternates({ canonicalPath: seo.canonicalUrl }),
    /*
     * `robots` is deliberately NOT mapped, and the omission is load-bearing.
     *
     * Next's Metadata API resolves by taking the NEAREST value, so a `robots` key here would
     * override — not merge with — the `noindex, nofollow` the `[locale]` layout sets for the whole
     * tree. `robotsIndex`/`robotsFollow` default to `true` in the contract, so mapping them straight
     * through would make this page publicly indexable the moment it existed, escaping a blanket
     * directive the platform has not yet lifted. Honouring an editor's per-page `noindex` belongs to
     * the SEO launch gate, which is the thing that removes the blanket one.
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

export default async function PrivacyPolicyPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const locales = await getActiveLocales();

  /*
   * No `Suspense` boundary, for the reason the article and CMS proof routes give: the fetch decides
   * whether the page exists at all, so there is nothing that could honestly render before it
   * resolves.
   */
  const result = await resolvePrivacyPolicy(PRIVACY_POLICY_SLUG, locale);

  if (result.ok) {
    return (
      <LegalPageTemplate
        locales={locales}
        page={result.page}
        locale={locale}
        localeFallback={result.localeFallback}
      />
    );
  }

  // The ONE condition allowed to 404 — see the module note's failure table.
  if (result.reason === "not-found") notFound();

  /*
   * Everything else. The document's existence is UNKNOWN, and reporting unknown as absent is what
   * ADR-010 §7 forbids. Reported server-side, and specific about WHICH service failed: a 503 is
   * NestJS saying Payload did not answer, while `unreachable` is NestJS itself not answering — the
   * difference between restarting the CMS and restarting the API.
   */
  console.warn(
    `[privacy-policy] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the platform API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : result.status === 503
          ? "the platform API answered 503 — the CMS did not respond to it"
          : `the platform API answered, but not with a page (HTTP ${String(result.status)})`),
  );

  return <LegalPageUnavailable locales={locales} locale={locale} />;
}
