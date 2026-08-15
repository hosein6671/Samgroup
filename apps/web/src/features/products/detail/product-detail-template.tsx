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
import { SiteNav } from "@/features/site/site-nav";

import { ClosingCta } from "../sections/closing-cta";

import { ProductGallery } from "./sections/gallery";
import { ProductHero } from "./sections/hero";
import { ProductSpecifications } from "./sections/specifications";

import type { ProductDetailResponse } from "@sam-group/types";

/**
 * The Product Detail template — one component, every product.
 *
 * ── A short page, on purpose ────────────────────────────────────────────────
 *
 * Hero, then whatever the record actually carries, then the shared closing CTA. There is no
 * documentation register, no packaging block, no approvals list, no OEM table and no related-
 * products strip, and none of those is an oversight: every one would need content that neither the
 * API nor any approved document supplies, and CLAUDE.md §4 forbids seeding an unverified commercial
 * fact into a page. When a Product genuinely carries specifications, imagery or documents, the
 * sections below render them — which is why this file is a composition rather than a layout.
 *
 * On the current data every product renders as hero + CTA, because the demo seed deliberately
 * creates no `Specification`, `Media` or `ProductType` row. That is the honest rendering of what
 * exists, and it is also the clearest possible signal of what still has to be populated.
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
  localeFallback,
}: {
  readonly product: ProductDetailResponse;
  /** The active locale segment, used to compose the breadcrumb's links. */
  readonly locale: string;
  /** The API's `meta.localeFallback`, passed through to the hero's notice. */
  readonly localeFallback: boolean;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <ProductHero product={product} locale={locale} localeFallback={localeFallback} />

        {product.specifications.length > 0 && (
          <ProductSpecifications specifications={product.specifications} />
        )}

        {product.images.length > 0 && (
          <ProductGallery images={product.images} productName={product.name} />
        )}

        <ClosingCta context={{ locale, productSlug: product.slug }} />
      </main>

      <SiteFooter />
    </div>
  );
}
