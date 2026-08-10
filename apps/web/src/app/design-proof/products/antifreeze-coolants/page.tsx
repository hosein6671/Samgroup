import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { getCategoryContent } from "@/features/products/category/data";

/**
 * Antifreeze & Coolants — the second instance of the shared category template, on the proof
 * route.
 *
 * **This file is deliberately identical to the Base Oils route but for one string.** That is the
 * result the category was built to demonstrate: a second category is a fixture and a slug, not a
 * second page architecture. When the real `app/[locale]/products/[categorySlug]/page.tsx` exists
 * both of these files are deleted rather than migrated — the slug arrives in `params` and the
 * registry lookup is already the code that resolves it.
 *
 * It sits under `/design-proof` for the same reasons as the homepage, the Products landing and
 * Base Oils: locale routing does not exist and the catalogue endpoints are not wired up. The
 * header still links to `/products/antifreeze-coolants`, not here.
 */
const SLUG = "antifreeze-coolants";

export const metadata: Metadata = {
  title: "Antifreeze & Coolants — Sam Group",
  description:
    "Monoethylene and monopropylene glycol coolants across the published inhibitor technologies, supplied as concentrate or ready-to-use.",
  // A proof route, as with the other three. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default function AntifreezeCoolantsProofPage(): ReactNode {
  const content = getCategoryContent(SLUG);
  if (!content) notFound();

  return <ProductCategoryTemplate content={content} />;
}
