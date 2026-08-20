import { QualityExperience } from "@/features/quality/quality-experience";
import { QualityUnavailable } from "@/features/quality/quality-unavailable";
import { getQualityCertificationsContent } from "@/lib/content";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getActiveLocales } from "@/lib/locales";

/** The proof tree sits outside `[locale]`, so it renders the default locale. */
const PROOF_LOCALE = "en";

/**
 * The Quality & Certifications design proof — the same experience, on the transitional proof URL.
 *
 * ── It reads the CMS too, and that is the point ─────────────────────────────
 *
 * This route rendered `quality-data.ts` until the CMS-2B cutover. Keeping that module alive here
 * would have left the platform with two copies of one page's copy — the CMS's and a code one —
 * diverging the moment an editor saved anything, and on this page the divergence would be between
 * two statements about what the company can prove. So the proof route reads the same endpoint as the
 * canonical route and shows exactly what a visitor would see, which is what a proof is for.
 *
 * The consequence is stated rather than hidden: while the CMS holds no published Quality document,
 * this route renders the same "not published yet" state as the canonical one. There is no Quality
 * copy anywhere in this repository to fall back to, deliberately.
 *
 * `noindex, nofollow` stays, and the route remains live until ADR-010 §9's order retires it. That
 * retirement is its own gate, not a side effect of this one.
 */
export const metadata: Metadata = {
  title: "Quality & Certifications — Sam Group",
  description:
    "Testing at three stages, the properties the laboratory tests for, and the documentation issued with every batch.",
  robots: { index: false, follow: false },
};

export default async function QualityCertificationsProofPage(): Promise<ReactNode> {
  const locales = await getActiveLocales();
  const result = await getQualityCertificationsContent(PROOF_LOCALE);

  if (result.ok) {
    // The proof route asks for the default locale, so a fallback cannot arise here.
    return <QualityExperience locales={locales} content={result.content} locale={PROOF_LOCALE} />;
  }

  return (
    <QualityUnavailable
      locales={locales}
      locale={PROOF_LOCALE}
      reason={result.reason === "not-configured" ? "not-configured" : "service"}
    />
  );
}
