import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { JsonLd } from "@/features/seo/json-ld";
import { robotsMetadata } from "@/features/seo/indexing";
import { siteJsonLd } from "@/features/seo/structured-data";
import { siteUrl } from "@/features/seo/site";
import { getActiveLocales, getLocaleByCode } from "@/lib/locales";

import { FONT_VARIABLES } from "../fonts";

import "../globals.css";

/**
 * The canonical tree's **root layout** — it owns `<html>` and `<body>`.
 *
 * ── Why this is a root layout, and why `app/layout.tsx` had to go ───────────
 *
 * In the App Router the root layout is **positional**: the first `layout` file found walking down
 * from `app/` owns the document for every page beneath it, and it is the one Next validates the
 * `<html>`/`<body>` tags on. While `app/layout.tsx` existed it was unavoidably that file, this
 * layout would have been nested inside it, and a nested layout cannot own `<html>` — so there was
 * no supported way to set a per-locale `lang`/`dir` from here. Deleting it is what makes this a
 * root layout rather than a child.
 *
 * The consequence is two root layouts during the transition: this one, and
 * `app/design-proof/layout.tsx`. Navigating between the two trees performs a full page load, which
 * is accepted because nothing links across — `site-routes.ts` contains no proof path. Changing
 * locale *within* this tree does not: the framework compares a dynamic segment's name and type and
 * ignores its value, so `/en/…` → `/fa/…` stays a client-side transition under one root layout.
 * The second root layout disappears when the proof routes are removed (ADR-010 §9 step 4).
 *
 * ── Not indexed, and that is deliberate for P1 ──────────────────────────────
 *
 * `robots: { index: false, follow: false }` is inherited by every page in this tree, exactly as it
 * was inherited from the old root layout. P1 is a routing and topology milestone, not the SEO
 * launch: most canonical pages do not exist yet, the header and footer link to routes that 404,
 * the language switcher is still presentational, and `fa`/`ar` typography is unresolved. Indexing
 * is enabled by a later, explicit launch gate — not as a side effect of a page becoming reachable.
 */

/**
 * The route set, generated from the `Locale` table by way of `GET /api/v1/locales`.
 *
 * **Never a hardcoded `['en','fa','ar']`, and never a static fixture** — `site-routes.ts` used to
 * carry one for the language switcher, and it was deleted rather than reused when that switcher
 * started navigating. The locale list is data and adding a language must not require a code change
 * (PROJECT_HANDOFF §6.9), so the route tree is generated from the same table every other consumer
 * reads, this layout and the switcher included.
 *
 * **This throws rather than degrading.** `getActiveLocales` fails loudly for a missing
 * `API_INTERNAL_URL`, an unreachable API, a non-2xx, a malformed payload, an empty set, or a set
 * with no single default — and none of those is caught here. A build that cannot establish which
 * locales exist must fail; the alternative is a build that succeeds while silently emitting either
 * a single-locale site or no pages at all.
 */
export async function generateStaticParams(): Promise<{ locale: string }[]> {
  const locales = await getActiveLocales();

  return locales.map((locale) => ({ locale: locale.code }));
}

/**
 * Unknown locale segments 404 instead of being rendered on demand.
 *
 * This is what makes `/xx` a 404 without the middleware having to recognise `xx` as
 * locale-shaped — the approved policy passes unknown paths through untouched and lets routing
 * answer them. It also means a new locale requires a rebuild, which
 * INTERNATIONALIZATION_STRATEGY.md §1 already states as the accepted cost of generating routes
 * from the table.
 */
export const dynamicParams = false;

/**
 * Site-wide metadata, resolved per request rather than declared as a literal.
 *
 * Two values changed and both for the same reason — neither may be a hard-coded string any more.
 *
 * **`metadataBase`** comes from `features/seo/site.ts`, the one place the public origin is decided.
 * It was `new URL("https://samgp.com")` here and the same literal in ten other files; every
 * canonical URL, JSON-LD `@id` and sitemap entry is now built from one value that cannot disagree
 * with itself.
 *
 * **`robots`** comes from `features/seo/indexing.ts`, which `app/robots.ts` also reads. The
 * directive is unchanged in every environment today — the gate defaults to closed, so this still
 * resolves to `noindex, nofollow` exactly as the literal did. What changed is that `robots.txt` and
 * the pages can no longer contradict each other, and that opening the site is one environment
 * variable rather than an edit in two files.
 *
 * A function rather than a `const`: a literal is evaluated once when this module is first imported,
 * which would bake the deployed container's gate state in at whatever it was at process start.
 */
export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    applicationName: "SAM Group",
    authors: [{ name: "SAM Group", url: siteUrl().href }],
    creator: "SAM Group",
    publisher: "SAM Group",
    // Inherited by every page in this tree. See the module note: P1 is not the SEO launch.
    robots: robotsMetadata(),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const record = await getLocaleByCode(locale);

  /*
   * Unreachable while `dynamicParams = false` holds, and kept anyway: it is the difference between
   * a 404 and an `undefined` reaching `<html lang>` if that ever changes. `notFound()` rather than
   * a throw, because an unrecognised locale segment is a missing page, not a fault.
   */
  if (!record) notFound();

  return (
    <html lang={record.code} dir={record.direction} className={FONT_VARIABLES}>
      <body>
        {/*
         * `Organization` + `WebSite`, once per page, for every route in the canonical tree
         * (SEO_ARCHITECTURE.md §8 makes both global types). Emitted here rather than per route so
         * the two nodes exist exactly once and every page-level node can reference them by `@id`.
         *
         * It asserts no company fact — name, origin and logo file only. The Contact Us page adds
         * the confirmed contact channels to the same `@id` when the CMS is serving them.
         */}
        <JsonLd data={siteJsonLd(record.code)} />
        {/* Same skip link the single root layout carried; `HomeExperience` supplies the target. */}
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
