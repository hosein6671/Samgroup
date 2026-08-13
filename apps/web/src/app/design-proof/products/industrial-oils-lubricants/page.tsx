import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { resolveCategoryPage } from "@/features/products/category/resolve-category-page";

/**
 * Industrial Oils & Lubricants — the third instance of the shared category template, on the proof
 * route.
 *
 * Identical to the other two route files but for the slug, which is the whole point: the category
 * that forced the largest contract change so far — property groups, because a grease is not
 * described on the same axis as a hydraulic fluid — still needed no page of its own.
 *
 * It sits under `/design-proof` for the same reasons as the rest: locale routing does not exist
 * and the Product catalogue endpoints are not wired up. The Category identity call is —
 * `resolveCategoryPage` merges `GET /api/v1/categories/:slug` over the fixture and falls back to
 * it on any failure. The header still links to `/products/industrial-oils-lubricants`, not here.
 */
const SLUG = "industrial-oils-lubricants";

export const metadata: Metadata = {
  title: "Industrial Oils & Lubricants — Sam Group",
  description:
    "Hydraulic, gear, compressor, metalworking, heat transfer, pneumatic and slideway fluids, stationary engine oils and industrial greases.",
  // A proof route, as with the others. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default async function IndustrialOilsProofPage(): Promise<ReactNode> {
  const page = await resolveCategoryPage(SLUG);
  if (!page) notFound();

  return <ProductCategoryTemplate content={page.content} family={page.family} />;
}
