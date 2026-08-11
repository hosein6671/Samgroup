import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { getCategoryContent } from "@/features/products/category/data";

/**
 * Engine Oils & Automotive Lubricants — the sixth and last instance of the shared category
 * template, on the proof route.
 *
 * Identical to the other five route files but for the slug. The category needed no contract field,
 * no component change and no new section: it is a single hierarchy of six sub-ranges with no
 * published designations inside them, which is the shape Industrial Oils and Marine Oils already
 * proved, and its Applications section is absent for the reason those two established.
 *
 * With this file the template's claim is settled — one component, six pages, five of them a
 * fixture and a route each.
 *
 * It sits under `/design-proof` for the same reasons as the rest: locale routing does not exist
 * and the catalogue endpoints are not wired up. The header still links to
 * `/products/engine-oils-automotive-lubricants`, not here.
 */
const SLUG = "engine-oils-automotive-lubricants";

export const metadata: Metadata = {
  title: "Engine Oils & Automotive Lubricants — Sam Group",
  /*
   * The six vehicle segments, in the casing the frozen Products landing publishes them in. The
   * category's second dimension is not described here — its members are not published, and a meta
   * description is not the place to introduce a taxonomy the page itself withholds.
   */
  description:
    "Automotive lubricants by vehicle segment — passenger cars, trucks and buses, motorcycle and ATV, agriculture, construction and mining, and gardening.",
  // A proof route, as with the others. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default function EngineOilsProofPage(): ReactNode {
  const content = getCategoryContent(SLUG);
  if (!content) notFound();

  return <ProductCategoryTemplate content={content} />;
}
