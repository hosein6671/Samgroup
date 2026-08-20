import { cache } from "react";

import { SolutionsExperience } from "@/features/customized-solutions/solutions-experience";
import { SolutionsUnavailable } from "@/features/customized-solutions/solutions-unavailable";
import { getCustomizedSolutionsContent } from "@/lib/content";
import { defaultLocale } from "@/lib/locale-contract";
import { getActiveLocales } from "@/lib/locales";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The Customized Solutions page, on its canonical route — `/{locale}/customized-solutions`.
 *
 * ── CMS-backed as of the CMS-2A gate ────────────────────────────────────────
 *
 * The page's editorial copy comes from the Payload `CustomizedSolutions` Global through NestJS —
 * `GET /api/v1/content/globals/customized-solutions`. The fixture module this route used to render
 * was deleted with the cutover rather than kept as a fallback: two sources of truth for one
 * published page is the failure mode the cutover policy exists to prevent.
 *
 * **The request form is not part of that.** It renders from code in every branch below, including
 * both failure states, because it is Prisma's and the API's and takes no CMS input at all.
 *
 * ── Three outcomes, and none of them is `notFound()` ────────────────────────
 *
 * - **Content** — rendered.
 * - **Unpublished** (the API answered 200 with `available: false`) — the "not published yet" state.
 * - **Unreachable or an API error, 503 included** — the "unavailable" state.
 *
 * `/customized-solutions` is a structural URL that the header, the footer and the sitemap all point
 * at, so a canonical 404 on it would state that the service does not exist. Neither an empty CMS nor
 * a failed request is that statement (ADR-010 §7, held for a corporate route).
 *
 * ── Metadata ────────────────────────────────────────────────────────────────
 *
 * Composed from the Global's `SeoFields`, falling back to the hero title — the same mapping the
 * About Us and legal routes use. **No `robots`**: the tree's layout declares `noindex, nofollow` and
 * a route-level override would be a second answer. **No canonical, no `hreflang`, no JSON-LD** —
 * ADR-010 Non-Goals, and the SEO launch is not this gate.
 */
const resolveSolutions = cache(getCustomizedSolutionsContent);

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const result = await resolveSolutions(locale);

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

export default async function CustomizedSolutionsPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const result = await resolveSolutions(locale);

  if (result.ok) {
    /*
     * A fallback changes what language the content is in, never what language the page is. The
     * document's `lang`/`dir` stay the route's, set by the layout from the `Locale` table; the
     * served locale is passed down so the content itself can be annotated with it.
     */
    const served = result.localeFallback ? defaultLocale(await getActiveLocales()) : null;

    return (
      <SolutionsExperience
        content={result.content}
        locale={locale}
        fallbackLocale={served === null ? null : { code: served.code, direction: served.direction }}
      />
    );
  }

  if (result.reason === "not-configured") {
    return <SolutionsUnavailable locale={locale} reason="not-configured" />;
  }

  console.warn(
    `[customized-solutions] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the platform API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : result.status === 503
          ? "the platform API answered 503 — the CMS did not respond to it"
          : `the platform API answered, but not with page content (HTTP ${String(result.status)})`),
  );

  return <SolutionsUnavailable locale={locale} reason="service" />;
}
