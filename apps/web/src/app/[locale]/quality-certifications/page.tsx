import { cache } from "react";

import { QualityExperience } from "@/features/quality/quality-experience";
import { QualityUnavailable } from "@/features/quality/quality-unavailable";
import { getQualityCertificationsContent } from "@/lib/content";
import { defaultLocale } from "@/lib/locale-contract";
import { getActiveLocales } from "@/lib/locales";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The Quality & Certifications page, on its canonical route — `/{locale}/quality-certifications`.
 *
 * ── CMS-backed as of the CMS-2B gate ────────────────────────────────────────
 *
 * The page reads the Payload `QualityCertifications` Global through NestJS —
 * `GET /api/v1/content/globals/quality-certifications` — and renders what it serves. The fixture
 * module this route used to render, `quality-data.ts`, was **deleted** with the cutover rather than
 * kept as a fallback: two sources of truth for one published page is the failure mode the cutover
 * policy exists to prevent, and a page that silently fell back to code would hide from everyone that
 * the CMS is empty or unreachable.
 *
 * `apps/web` calls NestJS and nothing else. The browser makes no request to the CMS, and no Payload
 * origin, credential or shape exists anywhere in this app (ADR-003).
 *
 * ── What the cutover did not soften ─────────────────────────────────────────
 *
 * The certifications band still publishes one statement and no list, because the CMS cannot hold a
 * list: the Global models five localized strings for that section, the wire type has no array, and
 * the projection iterates nothing. No certificate, standard, licence, accreditation, issuing body,
 * number, validity date or mark exists anywhere along this path. SITE_STRUCTURE §7 is emphatic that
 * no placeholder certification is ever published, and moving editorial control of this page into the
 * CMS was precisely the moment not to weaken that.
 *
 * ── Three outcomes, and none of them is `notFound()` ────────────────────────
 *
 * - **Content** — rendered.
 * - **Unpublished** (the API answered 200 with `available: false`) — the "not published yet" state.
 * - **Unreachable or an API error, 503 included** — the "unavailable" state.
 *
 * `/quality-certifications` is a structural URL that the footer and About Us both point at, and it is
 * the address the platform gives for the certification question. A canonical 404 on it would state
 * that the company has no such page. Neither an empty CMS nor a failed request is that statement.
 * This is ADR-010 §7's rule — infrastructure failure must never become a canonical 404 — held for a
 * corporate route.
 *
 * ── One fetch, two consumers ────────────────────────────────────────────────
 *
 * `cache` de-duplicates the read between `generateMetadata` and the component, exactly as the About
 * Us and privacy-policy routes do. Without it the page would call the API twice per request.
 *
 * ── Metadata ────────────────────────────────────────────────────────────────
 *
 * Composed from the Global's `SeoFields`, falling back to the hero title — the same mapping the two
 * CMS-backed pages before it use, and no second vocabulary for it. **No `robots`**:
 * `app/[locale]/layout.tsx` declares `noindex, nofollow` for this whole tree. **No canonical and no
 * `hreflang`** — both ADR-010 Non-Goals, and the SEO launch is not this gate. **No JSON-LD** —
 * `AboutPage` structured data waits on the shared `<JsonLd>` component FRONTEND_ARCHITECTURE §4
 * specifies, which does not exist.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment is the parent's; `app/[locale]/layout.tsx` generates it from the `Locale`
 * table and closes it with `dynamicParams = false`. This route introduces no dynamic segment of its
 * own.
 */
const resolveQuality = cache(getQualityCertificationsContent);

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const result = await resolveQuality(locale);

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

export default async function QualityCertificationsPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const locales = await getActiveLocales();
  const result = await resolveQuality(locale);

  if (result.ok) {
    /*
     * A fallback changes what language the content is in, never what language the page is. The
     * document's `lang`/`dir` stay the route's, set by the layout from the `Locale` table; the
     * served locale is passed down so the content itself can be annotated with it.
     */
    const served = result.localeFallback ? defaultLocale(await getActiveLocales()) : null;

    return (
      <QualityExperience
        locales={locales}
        content={result.content}
        locale={locale}
        fallbackLocale={served === null ? null : { code: served.code, direction: served.direction }}
      />
    );
  }

  if (result.reason === "not-configured") {
    return <QualityUnavailable locales={locales} locale={locale} reason="not-configured" />;
  }

  console.warn(
    `[quality-certifications] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the platform API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : result.status === 503
          ? "the platform API answered 503 — the CMS did not respond to it"
          : `the platform API answered, but not with page content (HTTP ${String(result.status)})`),
  );

  return <QualityUnavailable locales={locales} locale={locale} reason="service" />;
}
