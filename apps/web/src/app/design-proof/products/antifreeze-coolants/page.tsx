import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { resolveCategoryPage } from "@/features/products/category/resolve-category-page";

/**
 * Antifreeze & Coolants — the second instance of the shared category template, on the proof
 * route.
 *
 * **This file is deliberately identical to the Base Oils route but for one string.** That is the
 * result the category was built to demonstrate: a second category is a fixture and a slug, not a
 * second page architecture. When the real `app/[locale]/products/[categorySlug]/page.tsx` exists
 * both of these files are deleted rather than migrated — the slug arrives in `params` and
 * `resolveCategoryPage` is already the code that resolves it.
 *
 * It sits under `/design-proof` for the same reasons as the homepage, the Products landing and
 * Base Oils: locale routing does not exist and the Product catalogue endpoints are not wired up.
 * The Category identity call is — `resolveCategoryPage` merges `GET /api/v1/categories/:slug` over
 * the fixture and falls back to it on any failure. The header still links to
 * `/products/antifreeze-coolants`, not here.
 */
const SLUG = "antifreeze-coolants";

export const metadata: Metadata = {
  title: "Antifreeze & Coolants — Sam Group",
  description:
    "Monoethylene and monopropylene glycol coolants across the published inhibitor technologies, supplied as concentrate or ready-to-use.",
  // A proof route, as with the other three. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default async function AntifreezeCoolantsProofPage(): Promise<ReactNode> {
  const page = await resolveCategoryPage(SLUG);
  if (!page) notFound();

  return <ProductCategoryTemplate content={page.content} family={page.family} />;
}
