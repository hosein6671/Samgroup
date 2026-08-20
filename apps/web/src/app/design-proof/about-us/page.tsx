import { AboutExperience } from "@/features/about/about-experience";
import { AboutUnavailable } from "@/features/about/about-unavailable";
import { getAboutUsContent } from "@/lib/content";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/** The proof tree sits outside `[locale]`, so it renders the default locale. */
const PROOF_LOCALE = "en";

/**
 * The About Us design proof — the same experience, on the transitional proof URL.
 *
 * ── It reads the CMS too, and that is the point ─────────────────────────────
 *
 * This route rendered a fixture module until the CMS-1 cutover. Keeping that module alive here
 * would have left the platform with two copies of one page's copy — the CMS's and a code one —
 * diverging the moment an editor saved anything. So the proof route reads the same endpoint as the
 * canonical route and shows exactly what a visitor would see, which is what a proof is for.
 *
 * The consequence is stated rather than hidden: while the CMS holds no published About Us document,
 * this route renders the same "not published yet" state as the canonical one. There is no About Us
 * copy anywhere in this repository to fall back to, deliberately — SITE_STRUCTURE §2's content is
 * an editorial deliverable, and the design system itself is proved by the seven other proof routes.
 *
 * `noindex, nofollow` stays, and the route remains live until ADR-010 §9's order retires it. That
 * retirement is its own gate, not a side effect of this one.
 */
export const metadata: Metadata = {
  title: "About Us — Sam Group",
  description:
    "Sam Group produces its own range of petroleum products, lubricants and base oils in Iran, across six published product families.",
  robots: { index: false, follow: false },
};

export default async function AboutUsProofPage(): Promise<ReactNode> {
  const result = await getAboutUsContent(PROOF_LOCALE);

  if (result.ok) {
    // The proof route asks for the default locale, so a fallback cannot arise here.
    return <AboutExperience content={result.content} locale={PROOF_LOCALE} />;
  }

  return (
    <AboutUnavailable
      locale={PROOF_LOCALE}
      reason={result.reason === "not-configured" ? "not-configured" : "service"}
    />
  );
}
