import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { resolveCategoryPage } from "@/features/products/category/resolve-category-page";

/**
 * Lubricant Additives & Components — the fifth instance of the shared category template, on the
 * proof route.
 *
 * Identical to the other four route files but for the slug. This is the second category to render
 * the downstream manifold, and the first whose two axes are product groups rather than
 * specification families — both handled by mechanisms that already existed, so again no component
 * changed.
 *
 * It sits under `/design-proof` for the same reasons as the rest: locale routing does not exist
 * and the Product catalogue endpoints are not wired up. The Category identity call is —
 * `resolveCategoryPage` merges `GET /api/v1/categories/:slug` over the fixture and falls back to
 * it on any failure. The header still links to `/products/lubricant-additives`, not here.
 */
const SLUG = "lubricant-additives";

export const metadata: Metadata = {
  title: "Lubricant Additives & Components — Sam Group",
  description:
    "Additive packages by application — engine oil, driveline and gear, ATF, grease, anti-freeze, brake fluid and fuel — with transformer oil, white oil and rubber process oil.",
  // A proof route, as with the others. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default async function LubricantAdditivesProofPage(): Promise<ReactNode> {
  const page = await resolveCategoryPage(SLUG);
  if (!page) notFound();

  return <ProductCategoryTemplate content={page.content} family={page.family} />;
}
