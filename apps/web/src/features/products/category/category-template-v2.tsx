import Image from "next/image";
import { Suspense } from "react";
import type { ReactNode } from "react";

/*
 * Same stylesheet base the original template uses, for the same reasons: `flagship.css` declares
 * the brand scope, `products.css` carries the shared closing CTA's `.pr-close*` constructions,
 * `product-list.css` carries `ProductCard`'s `.pl-*`, `category.css` styles the reused
 * applications/quality/supply/documentation/FAQ sections. `category-v2.css` adds only the
 * v2-specific constructions and, scoped entirely under `[data-layout="v2"]`, the compacting and
 * the reveal-cancelling this layout needs. Nothing here modifies a shared stylesheet.
 */
import "../../home/flagship.css";
import "../products.css";
import "../product-list.css";
import "./category.css";
import "./category-v2.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import type { ProductListResult } from "@/lib/products";

import { ClosingCta } from "../sections/closing-cta";

import type { ProductFamily } from "../products-data";

import type { ProductCategoryContent } from "./category-contract";
import { CategoryApplications } from "./sections/applications";
import { CategoryDocumentation } from "./sections/documentation";
import { CategoryFaq } from "./sections/faq";
import { CategoryProperties } from "./sections/properties";
import { CategoryQuality } from "./sections/quality";
import { CategorySupply } from "./sections/supply";
import { CategoryCatalogV2, CategoryCatalogV2Skeleton } from "./sections/v2/catalog-v2";
import { Guidance } from "./sections/v2/guidance";
import { HeroV2 } from "./sections/v2/hero-v2";
import { CatalogRail } from "./sections/v2/rail";

/**
 * The v2 Product Category template — the "Catalog Rail" composition, currently Base Oils only.
 *
 * ── Structure ─────────────────────────────────────────────────────────────
 *
 *  Hero (full width)          → `HeroV2` — compact, image-led, two actions, jump to products.
 *
 *  Rail shell (two columns)   → the browse-and-select zone:
 *    · left column            → `CategoryCatalogV2` inside a Suspense boundary (the API-backed
 *                               product list, immediately after the hero, with the
 *                               Base-Oils-only filter/reset behaviour) then `Guidance`
 *                               (Overview + Classification, the classification as a scannable
 *                               table with the group descriptions in native `<details>`).
 *    · sticky rail            → `CatalogRail` — the family quick-facts, the two enquiry actions,
 *                               and an in-page jump list. Sticky on desktop; on mobile it
 *                               collapses to the facts strip and flows above the products.
 *
 *  Full width, below the shell → the reference material, reused unchanged:
 *    · `CategoryProperties`   → the specification axis and the conditional typical-properties
 *                               table (keeps `id="specifications"` and its populated-table
 *                               behaviour).
 *    · applications/process   → `ProcessMedia` (a labelled photography slot) then
 *                               `CategoryApplications` and `CategoryQuality`.
 *    · `CategorySupply`
 *    · `CategoryDocumentation`, `CategoryFaq` — drawn restrained by `category-v2.css`, before
 *                               the final CTA.
 *    · `ClosingCta`           → the shared closing CTA, unchanged.
 *
 * ── Removed on this page ──────────────────────────────────────────────────
 *
 * The hero's stratigraphic range index (it duplicated the range register) and the
 * related-families strip (the mega menu and footer already list the six). No content string is
 * dropped — see the gate report.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 *
 * v2-authored sections carry no `reveal-*` class. The reused sections do; `category-v2.css`
 * cancels those animations under `[data-layout="v2"]` only, so every block is legible at rest
 * with no dependence on a scroll timeline, and `motion.css` is untouched.
 *
 * ── Data access stays at the route ────────────────────────────────────────
 *
 * The route creates the product-list promise and does not await it; this template forwards it
 * into the Suspense boundary. This component awaits nothing and fetches nothing.
 *
 * Entirely server-rendered. The only client JavaScript on the page is the shared header's.
 */
export function ProductCategoryTemplateV2({
  content,
  family,
  locale,
  locales,
  products,
  activeSegment,
}: {
  readonly content: ProductCategoryContent;
  readonly family: ProductFamily;
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  readonly products: Promise<ProductListResult>;
  readonly activeSegment: string | null;
}): ReactNode {
  const props = { content, family, locale } as const;
  const catalog = { locale, familySlug: family.id, activeSegment } as const;

  return (
    <div data-brand="flagship" data-layout="v2">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <HeroV2 {...props} />

        <div className="pcv2-shell" data-surface="light">
          <div className="pcv2-col">
            <Suspense fallback={<CategoryCatalogV2Skeleton />}>
              <CategoryCatalogV2 {...catalog} products={products} />
            </Suspense>
            <Guidance {...props} />
          </div>

          <CatalogRail {...props} />
        </div>

        <CategoryProperties {...props} />

        <div className="pcv2-appsproc">
          <ProcessMedia content={content} />
          <CategoryApplications {...props} />
          <CategoryQuality {...props} />
        </div>

        <CategorySupply {...props} />

        <div className="pcv2-reference">
          <CategoryDocumentation {...props} />
          <CategoryFaq {...props} />
        </div>

        <ClosingCta locale={locale} />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}

/**
 * Block 4's photography slot.
 *
 * With `content.processImage` set — a real photograph, or a separately approved representative
 * one — it renders that image and its caption in the frame. Unset, it renders a deliberate
 * placeholder: a restrained neutral plate (`media-slot-empty`, the shared photography-slot
 * treatment from `packages/ui/src/styles/surfaces.css`) at the intended 16:9 composition, a
 * short "Image placeholder" label, and nothing else — no broken-image icon, no fabricated
 * photograph, no claim about a SAM facility. Swapping the placeholder for an image later is a
 * one-line fixture change with no layout change.
 */
function ProcessMedia({ content }: { readonly content: ProductCategoryContent }): ReactNode {
  const { processImage } = content;

  return (
    <div className="fs-wrap pcv2-proc-wrap">
      <figure className="pcv2-proc-media">
        {processImage ? (
          <>
            <span className="pcv2-proc-frame">
              <Image
                src={processImage.src}
                alt={processImage.alt}
                fill
                sizes="(max-width: 900px) calc(100vw - 40px), 60vw"
              />
            </span>
            <figcaption>{processImage.caption}</figcaption>
          </>
        ) : (
          <>
            <span className="pcv2-proc-frame media-slot-empty" aria-hidden="true" />
            <figcaption>Image placeholder</figcaption>
          </>
        )}
      </figure>
    </div>
  );
}
