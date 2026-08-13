import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

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
 * **Never a hardcoded `['en','fa','ar']`**, and never the `LOCALES` fixture in `site-routes.ts`.
 * The locale list is data and adding a language must not require a code change
 * (PROJECT_HANDOFF §6.9), so the route tree is generated from the same table every other consumer
 * reads.
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

export const metadata: Metadata = {
  // Inherited by every page in this tree. See the module note: P1 is not the SEO launch.
  robots: { index: false, follow: false },
};

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
        {/* Same skip link the single root layout carried; `HomeExperience` supplies the target. */}
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
