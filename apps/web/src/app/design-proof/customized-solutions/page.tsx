import { SolutionsExperience } from "@/features/customized-solutions/solutions-experience";
import { SolutionsUnavailable } from "@/features/customized-solutions/solutions-unavailable";
import { getCustomizedSolutionsContent } from "@/lib/content";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getActiveLocales } from "@/lib/locales";
import { gateProofRouteForProduction } from "@/features/site/proof-routes";

/** The proof tree sits outside `[locale]`, so it renders the default locale. */
const PROOF_LOCALE = "en";

/**
 * The Customized Solutions design proof — the same experience, on the transitional proof URL.
 *
 * It reads the same endpoint as the canonical route, exactly as the About Us proof route does.
 * Keeping a fixture alive here would leave the platform with two copies of one page's copy,
 * diverging the moment an editor saved anything, so the proof shows what a visitor would see —
 * including the unavailable state, while no editor has published this page.
 *
 * `noindex, nofollow` stays, and the route remains live until ADR-010 §9's order retires it.
 */
export const metadata: Metadata = {
  title: "Customized Solutions — Sam Group",
  description:
    "Custom lubricant and base oil formulation developed against a stated specification, qualified by sample before commitment.",
  robots: { index: false, follow: false },
};

export default async function CustomizedSolutionsProofPage(): Promise<ReactNode> {
  gateProofRouteForProduction("/design-proof/customized-solutions");

  const locales = await getActiveLocales();
  const result = await getCustomizedSolutionsContent(PROOF_LOCALE);

  if (result.ok) {
    // The proof route asks for the default locale, so a fallback cannot arise here.
    return <SolutionsExperience locales={locales} content={result.content} locale={PROOF_LOCALE} />;
  }

  return (
    <SolutionsUnavailable
      locales={locales}
      locale={PROOF_LOCALE}
      reason={result.reason === "not-configured" ? "not-configured" : "service"}
    />
  );
}
