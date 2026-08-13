import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { resolveCategoryPage } from "@/features/products/category/resolve-category-page";

/**
 * Base Oils — the first Product Category page, on the proof route.
 *
 * It sits under `/design-proof` because locale routing does not exist and the Product catalogue
 * this page describes is served by endpoints that are not wired up. Its real home is
 * `app/[locale]/products/[categorySlug]/page.tsx`, one dynamic route for all six categories, and
 * the header already links there — `PRODUCT_CATEGORIES[0].href` is `/products/base-oils`, not
 * this path, and is deliberately left that way. The nav's links resolving is the lift, not
 * something to fake by pointing the canonical route table at a proof URL.
 *
 * **The Category identity call IS wired up.** `resolveCategoryPage` fetches
 * `GET /api/v1/categories/:slug` server-side and merges the API-owned fields over the fixture; the
 * editorial content is still the fixture's. Every failure renders the fixture, so this page has
 * the same output whether or not the API is running.
 *
 * **The slug is resolved, not hardcoded.** It goes through the same resolver the dynamic route
 * will use, so the lift is a rename of this file plus `params` — not a rewrite. `notFound()` on a
 * miss is the behaviour the dynamic route needs and it is worth having correct from the first
 * instance; it answers a missing fixture only, never a failed fetch.
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

export default async function BaseOilsProofPage(): Promise<ReactNode> {
  const page = await resolveCategoryPage(SLUG);
  if (!page) notFound();

  return <ProductCategoryTemplate content={page.content} family={page.family} />;
}
