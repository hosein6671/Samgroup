import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SolutionsExperience } from "@/features/customized-solutions/solutions-experience";

/**
 * Customized Solutions, on the proof route.
 *
 * It sits under `/design-proof` for the same reasons the homepage, the Products landing and the
 * six category pages do: locale routing does not exist, and the copy this page carries belongs to
 * the Payload `CustomizedSolutions` Global, which arrives in M2. Its real home is
 * `app/[locale]/customized-solutions/page.tsx`.
 *
 * **The canonical route is deliberately left pointing elsewhere.** `ROUTES.customizedSolutions` is
 * `/customized-solutions`, and it is the destination of the primary nav item, of `ClosingCta`'s
 * gold button on the Products landing and all five published category pages, and of the category
 * contract's `customization` action. Every one of those still 404s, and repointing the canonical
 * table at this proof path to make them resolve would be faking the lift rather than doing it.
 */
export const metadata: Metadata = {
  title: "Customized Solutions — Sam Group",
  description:
    "Custom lubricant and base oil formulation developed against a stated specification, qualified by sample before commitment.",
  // A proof route, as with every page built so far. Indexing is enabled when this lifts to
  // app/[locale]. `Service` structured data (SITE_STRUCTURE §14) lands with the shared <JsonLd>
  // component (FRONTEND_ARCHITECTURE §4), which does not exist yet.
  robots: { index: false, follow: false },
};

export default function CustomizedSolutionsProofPage(): ReactNode {
  return <SolutionsExperience />;
}
