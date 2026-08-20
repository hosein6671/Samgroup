import { cache } from "react";

import { AboutExperience } from "@/features/about/about-experience";
import { AboutUnavailable } from "@/features/about/about-unavailable";
import { getAboutUsContent } from "@/lib/content";
import { defaultLocale } from "@/lib/locale-contract";
import { getActiveLocales } from "@/lib/locales";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The About Us page, on its canonical route — `/{locale}/about-us`.
 *
 * ── CMS-backed as of the CMS-1 gate ─────────────────────────────────────────
 *
 * The page reads the Payload `AboutUs` Global through NestJS — `GET /api/v1/content/globals/about-us`
 * — and renders what it serves. The fixture module this route used to render was deleted with the
 * cutover rather than kept as a fallback: two sources of truth for one published page is the failure
 * mode the cutover policy exists to prevent, and a page that silently falls back to code would hide
 * from everyone that the CMS is empty or unreachable.
 *
 * `apps/web` calls NestJS and nothing else. The browser makes no request to the CMS, and no Payload
 * origin, credential or shape exists anywhere in this app (ADR-003).
 *
 * ── Three outcomes, and none of them is `notFound()` ────────────────────────
 *
 * - **Content** — rendered.
 * - **Unpublished** (the API answered 200 with `available: false`) — the "not published yet" state.
 * - **Unreachable or an API error, 503 included** — the "unavailable" state.
 *
 * `/about-us` is a structural URL that the header, the footer and the sitemap all point at, so a
 * canonical 404 on it would state that the company has no About page. Neither an empty CMS nor a
 * failed request is that statement. This is ADR-010 §7's rule — infrastructure failure must never
 * become a canonical 404 — held for a corporate route.
 *
 * ── One fetch, two consumers ────────────────────────────────────────────────
 *
 * `cache` de-duplicates the read between `generateMetadata` and the component, exactly as the
 * privacy-policy route does. Without it the page would call the API twice per request.
 *
 * ── Metadata ────────────────────────────────────────────────────────────────
 *
 * Composed from the Global's `SeoFields`, falling back to the hero title — the same mapping the
 * legal route uses, and no second vocabulary for it. **No `robots`**: `app/[locale]/layout.tsx`
 * declares `noindex, nofollow` for this whole tree and a route-level override would be a second
 * answer to a settled question. **No canonical and no `hreflang`** — ADR-010 Non-Goals, and the SEO
 * launch is not this gate. **No JSON-LD** — `AboutPage` + `Organization` structured data waits on
 * the shared `<JsonLd>` component FRONTEND_ARCHITECTURE §4 specifies, which does not exist.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment is the parent's; `app/[locale]/layout.tsx` generates it from the `Locale`
 * table and closes it with `dynamicParams = false`. This route introduces no dynamic segment of its
 * own.
 */
const resolveAboutUs = cache(getAboutUsContent);

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const result = await resolveAboutUs(locale);

  if (!result.ok) return {};

  const { hero, seo } = result.content;

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
    title: seo.metaTitle ?? hero.title,
    ...(seo.metaDescription !== null && { description: seo.metaDescription }),
    ...(seo.canonicalUrl !== null && { alternates: { canonical: seo.canonicalUrl } }),
    openGraph: {
      title: seo.ogTitle ?? seo.metaTitle ?? hero.title,
      ...(seo.ogDescription !== null || seo.metaDescription !== null
        ? { description: seo.ogDescription ?? seo.metaDescription ?? undefined }
        : {}),
      ...(ogImage !== undefined && { images: [ogImage] }),
    },
    twitter: {
      card: seo.twitterCardType,
      title: seo.twitterTitle ?? seo.ogTitle ?? seo.metaTitle ?? hero.title,
      ...(seo.twitterDescription !== null || seo.ogDescription !== null
        ? { description: seo.twitterDescription ?? seo.ogDescription ?? undefined }
        : {}),
      ...(twitterImage !== undefined && { images: [twitterImage] }),
    },
  };
}

export default async function AboutUsPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const locales = await getActiveLocales();
  const result = await resolveAboutUs(locale);

  if (result.ok) {
    /*
     * A fallback changes what language the content is in, never what language the page is. The
     * document's `lang`/`dir` stay the route's, set by the layout from the `Locale` table; the
     * served locale is passed down so the content itself can be annotated with it.
     */
    const served = result.localeFallback ? defaultLocale(await getActiveLocales()) : null;

    return (
      <AboutExperience
        locales={locales}
        content={result.content}
        locale={locale}
        fallbackLocale={served === null ? null : { code: served.code, direction: served.direction }}
      />
    );
  }

  if (result.reason === "not-configured") {
    return <AboutUnavailable locales={locales} locale={locale} reason="not-configured" />;
  }

  console.warn(
    `[about-us] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the platform API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : result.status === 503
          ? "the platform API answered 503 — the CMS did not respond to it"
          : `the platform API answered, but not with page content (HTTP ${String(result.status)})`),
  );

  return <AboutUnavailable locales={locales} locale={locale} reason="service" />;
}
