import type { Metadata } from "next";
import type { ReactNode } from "react";

import { HomeExperience } from "@/features/home/home-experience";
import { getActiveLocales } from "@/lib/locales";

/**
 * The Sam Group flagship homepage, on its canonical route.
 *
 * `HomeExperience` is rendered **unchanged** — its own header note already said the lift would be
 * "this file unchanged", and it is: the component takes no props, reads no locale, and supplies
 * the `#main-content` target the root layout's skip link points at. Swapping `home-data.ts` from
 * fixtures to a Payload fetch is still the separate change it always was.
 *
 * ── What this route does and does not prove ─────────────────────────────────
 *
 * It began as the verification route for P1's topology: generated locales, a locale-correct
 * `<html lang dir>`, and a canonical tree separate from the proof tree. It is **not** a launched
 * page yet. The remaining visible launch gaps are reviewed Persian/Arabic copy and their approved
 * Arabic-script typeface pairing; until those gates close, those locale routes still render this
 * English editorial draft.
 *
 * That is why the `[locale]` layout keeps `robots: { index: false, follow: false }`.
 *
 * The title and description are the ones the deleted `app/layout.tsx` carried. They moved here
 * rather than to the layout because they describe this page rather than the tree — the proof
 * homepage inherited them from the root layout only because it had no metadata of its own.
 */
const HOME_TITLE = "Petroleum Products & Lubricants | SAM Group";
const HOME_DESCRIPTION =
  "Explore SAM Group petroleum products, lubricant components, finished lubricants, marine oils, coolants, technical information, and enquiry routes.";

/**
 * Locale-aware homepage metadata.
 *
 * The canonical points to the current locale only. `hreflang` is deliberately absent while the
 * homepage body is still the same English editorial draft in all three locale routes: advertising
 * unreviewed translations as language alternatives would be a false signal. The launch-content
 * gate can add alternates as each locale receives reviewed copy.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = `/${locale}`;

  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: canonical,
      locale,
      images: [
        {
          url: "/images/home/journey-requirement-to-supply.png",
          width: 1672,
          height: 941,
          alt: "SAM Group petroleum product review and supply planning",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      images: ["/images/home/journey-requirement-to-supply.png"],
    },
  };
}

/* Kept as named constants above so visible copy and social metadata cannot drift independently. */
export const HOME_SEO = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
} as const;

/**
 * The two values the shared chrome needs, and the reason this page became `async`.
 *
 * `HomeExperience` renders `SiteNav`/`SiteFooter`, and NAV-1 made both of those take the route's
 * locale and the active locale set rather than guessing. The locale is this route's own segment;
 * the set is `GET /locales` through the same memoized reader `app/[locale]/layout.tsx` already
 * awaits on every render, so this adds no request — it reads a promise that is already resolved
 * by the time this component runs.
 */
export default async function HomePage({
  params,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const locales = await getActiveLocales();

  return <HomeExperience locale={locale} locales={locales} />;
}
