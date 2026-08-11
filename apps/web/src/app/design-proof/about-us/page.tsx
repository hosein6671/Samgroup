import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutExperience } from "@/features/about/about-experience";

/**
 * About Us, on the proof route.
 *
 * It sits under `/design-proof` for the same reasons the homepage, the Products landing, the six
 * category pages and Customized Solutions do: locale routing does not exist, and the copy this
 * page carries belongs to the Payload `AboutUs` Global, which arrives in M2. Its real home is
 * `app/[locale]/about-us/page.tsx`.
 *
 * **The canonical route is deliberately left pointing elsewhere.** `ROUTES.aboutUs` is
 * `/about-us`, and as of this page it is also the destination of the footer's Company column,
 * which now consumes `SECONDARY_NAV`. That link 404s, exactly as every other canonical route on
 * every proof page does. Repointing the canonical table at this proof path to make it resolve
 * would be faking the lift rather than doing it.
 */
export const metadata: Metadata = {
  title: "About Us — Sam Group",
  description:
    "Sam Group produces its own range of petroleum products, lubricants and base oils in Iran, across six published product families.",
  // A proof route, as with every page built so far. Indexing is enabled when this lifts to
  // app/[locale]. `AboutPage` + `Organization` structured data (SITE_STRUCTURE §14) lands with the
  // shared <JsonLd> component (FRONTEND_ARCHITECTURE §4), which does not exist yet.
  robots: { index: false, follow: false },
};

export default function AboutUsProofPage(): ReactNode {
  return <AboutExperience />;
}
