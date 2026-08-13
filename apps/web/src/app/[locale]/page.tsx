import type { Metadata } from "next";
import type { ReactNode } from "react";

import { HomeExperience } from "@/features/home/home-experience";

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
 * It is the verification route for P1's topology: three generated locales, a locale-correct
 * `<html lang dir>`, and a canonical tree that is genuinely separate from the proof tree. It is
 * **not** a launched page. Three things visible on it are known, accepted P1 gaps, each fixed by
 * its own later gate:
 *
 * - the header and footer link to canonical routes that are not promoted yet, so those links
 *   redirect through middleware and then 404;
 * - the language switcher is still presentational and navigates nowhere;
 * - `fa` and `ar` render in a browser fallback font, because the three self-hosted families carry
 *   no Arabic or Persian coverage (see `app/fonts.ts`).
 *
 * That is why the `[locale]` layout keeps `robots: { index: false, follow: false }`.
 *
 * The title and description are the ones the deleted `app/layout.tsx` carried. They moved here
 * rather than to the layout because they describe this page rather than the tree — the proof
 * homepage inherited them from the root layout only because it had no metadata of its own.
 */
export const metadata: Metadata = {
  title: "Sam Group — Engineering Premium Energy Solutions",
  description:
    "Sam Group delivers advanced petroleum products, lubricants, base oils and industrial solutions engineered for global industries.",
};

export default function HomePage(): ReactNode {
  return <HomeExperience />;
}
