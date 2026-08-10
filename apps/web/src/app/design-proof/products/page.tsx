import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductsExperience } from "@/features/products/products-experience";

/**
 * The Products landing page, on the proof route.
 *
 * It sits under `/design-proof` for the same reason the homepage does: locale routing does not
 * exist, and the catalogue this page describes is served by endpoints that are not wired up yet.
 * Its real home is `app/[locale]/products/page.tsx`, and the header already links there —
 * `ROUTES.products` is `/products`, not this path, and is deliberately left that way. The nav's
 * links resolving is the lift, not something to fake by pointing the canonical route table at a
 * proof URL.
 */
export const metadata: Metadata = {
  title: "Products — Sam Group",
  description:
    "Base oils, lubricant additives, engine oils, industrial and marine lubricants, antifreeze and coolants — six product families from Sam Group.",
  // A proof route, as with the homepage. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default function ProductsProofPage(): ReactNode {
  return <ProductsExperience />;
}
