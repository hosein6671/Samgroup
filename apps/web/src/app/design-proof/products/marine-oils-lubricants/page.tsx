import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { getCategoryContent } from "@/features/products/category/data";

/**
 * Marine Oils & Lubricants — the fourth instance of the shared category template, on the proof
 * route.
 *
 * Identical to the other three route files but for the slug, and this time that is the entire
 * story: the category needed no contract field, no component change and no new section. Fluids
 * beside greases is the split Industrial Oils already proved, and terminal-with-no-selection-
 * sequence is the Applications handling it already established.
 *
 * It sits under `/design-proof` for the same reasons as the rest: locale routing does not exist
 * and the catalogue endpoints are not wired up. The header still links to
 * `/products/marine-oils-lubricants`, not here.
 */
const SLUG = "marine-oils-lubricants";

export const metadata: Metadata = {
  title: "Marine Oils & Lubricants — Sam Group",
  description:
    "TPEO, cylinder oils, system oils, stern tube and gear oils, deck hydraulic and marine greases.",
  // A proof route, as with the others. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default function MarineOilsProofPage(): ReactNode {
  const content = getCategoryContent(SLUG);
  if (!content) notFound();

  return <ProductCategoryTemplate content={content} />;
}
