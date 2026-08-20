import type { ReactNode } from "react";

import { HomeExperience } from "@/features/home/home-experience";
import { getActiveLocales } from "@/lib/locales";

/** The proof tree sits outside `[locale]`, so it renders the default locale. */
const PROOF_LOCALE = "en";

/**
 * The Sam Group flagship homepage, on a proof route.
 *
 * It lives here rather than at `app/[locale]/page.tsx` because locale routing does not exist
 * yet and the CMS that owns this copy arrives in M2. Building the real route now would mean
 * shipping a homepage whose content is hardcoded — the one thing the frozen decisions rule out
 * (docs/PROJECT_HANDOFF.md §6.7).
 *
 * ── Why it now reads the locale table ──────────────────────────────────────
 *
 * The shared chrome takes the route's locale and the active locale set (NAV-1). This tree has no
 * locale segment, so it passes the default-locale literal the sibling proof routes already use —
 * the same `PROOF_LOCALE = "en"` in `design-proof/about-us`, `customized-solutions` and
 * `quality-certifications`. The **set** is not literal and is not faked: it comes from
 * `GET /locales`, so the switcher here offers exactly the languages the platform has.
 *
 * The consequence is that this page now fails if the locale source is unreachable, which the three
 * content proof routes already did. That is the correct direction of travel: a proof route that
 * renders a language switcher it cannot populate is showing something the platform does not have.
 */
export default async function HomeProofPage(): Promise<ReactNode> {
  const locales = await getActiveLocales();

  return <HomeExperience locale={PROOF_LOCALE} locales={locales} />;
}
