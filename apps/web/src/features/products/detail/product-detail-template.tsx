import type { ReactNode } from "react";

/*
 * The same three-stylesheet arrangement the category template uses, and for the same stated
 * reasons: `flagship.css` declares the brand scope, `products.css` is imported because the shared
 * closing CTA below is a Products-landing component whose `.pr-close*` constructions live in it,
 * and `product-detail.css` holds this page's own constructions.
 */
import "../../home/flagship.css";
import "../products.css";
import "./product-detail.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { ClosingCta } from "../sections/closing-cta";

import { ProductGallery } from "./sections/gallery";
import { ProductHero } from "./sections/hero";
import { ProductSpecifications } from "./sections/specifications";
import { ProductSelectionGuide } from "./sections/selection-guide";
import { ProductTechnicalDocuments } from "./sections/technical-documents";
import { getProductDetailEditorial } from "./product-detail-content";

import type { ProductDetailResponse } from "@sam-group/types";

/**
 * The Product Detail template — one component, every product.
 *
 * The API owns product identity, taxonomy, specifications and product media. A local family-level
 * editorial registry contributes only reusable buyer guidance and explicitly labelled
 * representative photography; it never supplies a product formulation, approval, property value
 * or packaging claim. This lets every Product page answer the buyer's next question without
 * disguising unpublished technical data as fact.
 *
 * ── Both optional sections are gated on real content ────────────────────────
 *
 * `specifications.length > 0` and `images.length > 0`, checked here rather than inside each
 * section, so the decision to render a section and the decision about what a section says are not
 * split across two files. Neither section has an empty state, because neither should ever be asked
 * to draw one.
 *
 * ── The closing CTA is shared, and appropriate here ─────────────────────────
 *
 * SITE_STRUCTURE §3 specifies one closing block for the Products landing and every category page.
 * A Product Detail page is the deepest point of that same journey and its next steps are the same
 * three — find another grade, request a sample, request a quote — so it reuses the block rather
 * than introducing a fourth variant of the same idea. Its "Request Sample" action resolves to
 * Contact Us, exactly as it does everywhere else; there is still no product-scoped form on the
 * platform and this page still does not invent one.
 *
 * What it does now is pass the product along. `ClosingCta` takes an optional context, and this is
 * the one surface that has one: both inquiry actions carry `?product={slug}`, which the Contact Us
 * route resolves server-side into the `relatedProductId` the submission stores. Sample requests are
 * exactly what `Inquiry.relatedProductId` exists to record (DATA_MODEL.md §2). The slug is the
 * record's own, not the URL's — see `ProductHero`'s note on the same distinction for the breadcrumb.
 *
 * ── Entirely server-rendered ────────────────────────────────────────────────
 *
 * Not one component in this tree carries `"use client"`. The breadcrumb is links, the facts are a
 * `<dl>`, the specifications are a `<table>`, the gallery is `<img>` elements, and the reveals are
 * the design system's scroll-driven CSS. The only client JavaScript on the page is the header's,
 * inherited from the shared chrome — the same budget every other page on the platform holds to.
 */
export function ProductDetailTemplate({
  product,
  locale,
  locales,
  localeFallback,
}: {
  readonly product: ProductDetailResponse;
  /** The active locale segment, used to compose the breadcrumb's links. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /** The API's `meta.localeFallback`, passed through to the hero's notice. */
  readonly localeFallback: boolean;
}): ReactNode {
  const editorial = getProductDetailEditorial(product.category.slug);

  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <ProductHero product={product} locale={locale} localeFallback={localeFallback} />

        <ProductSelectionGuide editorial={editorial} />

        {product.specifications.length > 0 && (
          <ProductSpecifications specifications={product.specifications} />
        )}

        {product.images.length > 0 && (
          <ProductGallery images={product.images} productName={product.name} />
        )}

        <ProductTechnicalDocuments />

        <ClosingCta locale={locale} productSlug={product.slug} />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
