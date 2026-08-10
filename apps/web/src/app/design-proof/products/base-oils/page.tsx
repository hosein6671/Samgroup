import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { getCategoryContent } from "@/features/products/category/data";

/**
 * Base Oils — the first Product Category page, on the proof route.
 *
 * It sits under `/design-proof` for the same reasons the homepage and the Products landing do:
 * locale routing does not exist, and the catalogue this page describes is served by endpoints
 * that are not wired up yet. Its real home is `app/[locale]/products/[categorySlug]/page.tsx`,
 * one dynamic route for all six categories, and the header already links there —
 * `PRODUCT_CATEGORIES[0].href` is `/products/base-oils`, not this path, and is deliberately left
 * that way. The nav's links resolving is the lift, not something to fake by pointing the
 * canonical route table at a proof URL.
 *
 * **The slug is resolved, not hardcoded.** Content comes through `getCategoryContent`, the same
 * registry the dynamic route will use, so the lift is a rename of this file plus `params` — not
 * a rewrite. `notFound()` on a miss is the behaviour the dynamic route needs and it is worth
 * having correct from the first instance.
 */
const SLUG = "base-oils";

export const metadata: Metadata = {
  title: "Base Oils — Sam Group",
  description:
    "Paraffinic and naphthenic base stocks across API Groups I to III, with bright stock and synthetic base fluids — organised by group and by grade.",
  // A proof route, as with the homepage and the Products landing. Indexing is enabled when this
  // lifts to app/[locale]. `Product` + `FAQPage` structured data lands with the shared <JsonLd>
  // component (FRONTEND_ARCHITECTURE §4), which does not exist yet.
  robots: { index: false, follow: false },
};

export default function BaseOilsProofPage(): ReactNode {
  const content = getCategoryContent(SLUG);
  if (!content) notFound();

  return <ProductCategoryTemplate content={content} />;
}
