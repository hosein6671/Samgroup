import type { Metadata } from "next";
import type { ReactNode } from "react";

import { QualityExperience } from "@/features/quality/quality-experience";

/**
 * Quality & Certifications, on a proof route.
 *
 * It sits under `/design-proof` for the same reason the five pages before it do: locale routing
 * does not exist yet, and the Payload `QualityCertifications` Global that owns this copy arrives in
 * M2. Its real home is `app/[locale]/quality-certifications/page.tsx`, and the header's canonical
 * table already points there — `ROUTES.qualityCertifications` is `/quality-certifications`, not
 * this path, and is deliberately left that way. The footer's Company column links resolving is the
 * lift, not something to fake by pointing the canonical table at a proof URL.
 */
export const metadata: Metadata = {
  title: "Quality & Certifications — Sam Group",
  description:
    "Testing at three stages, the properties the laboratory tests for, and the documentation issued with every batch.",
  // A proof route, as with every page before it. Indexing is enabled when this lifts to
  // app/[locale]. `AboutPage` structured data lands with the shared <JsonLd> component
  // (FRONTEND_ARCHITECTURE §4), which does not exist yet.
  robots: { index: false, follow: false },
};

export default function QualityCertificationsProofPage(): ReactNode {
  return <QualityExperience />;
}
