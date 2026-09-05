import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

import { ProductGallery } from "./gallery";

import type { ProductDetailResponse, ProductGradeSummaryResponse } from "@sam-group/types";

/**
 * The Product Detail hero — image-led, per the owner's required section order (item 1: "Image-
 * led product hero"; item 2: "Product identity, family, type, and selected grade").
 *
 * ── Image first, identity beside it ──────────────────────────────────────────
 *
 * `ProductGallery` renders first in markup and is the visually dominant element (the desktop
 * grid gives it the wider column — see `product-detail.css`'s `.pd-hero-inner` rule); the
 * identity block — breadcrumb, name, description, family/type/grade facts — sits beside it on
 * desktop and beneath it on mobile (this file emits one markup order; the reflow is CSS only,
 * matching the SPECIFICATIONS section's own established convention of one order for both
 * breakpoints rather than two DOM trees).
 *
 * ── Everything here is API-backed ───────────────────────────────────────────
 *
 * Name, description, category, segments, productType and grades all come from
 * `GET /products/:slug`. Nothing is invented for an empty field — a product with no Segments
 * renders no Segment row, a null `productType` renders no Product Type row, and a leaf product
 * with no `ProductGrade` children renders no Grade row (a grade already baked into the product's
 * own name is not manufactured into a second layer here).
 *
 * ── The breadcrumb is logical, not a URL hierarchy ──────────────────────────
 *
 * Unchanged from the previous gate: Products → Family → Product, built from `product.category`
 * (the record the API resolved), with the canonical URL staying flat per ADR-007 §4/ADR-010 §2.
 *
 * A Server Component. No state, no JavaScript.
 */
export function ProductHero({
  product,
  locale,
  localeFallback,
  activeGrade,
}: {
  readonly product: ProductDetailResponse;
  readonly locale: string;
  /** True when part of this response was served in the default locale. Rendered as a notice. */
  readonly localeFallback: boolean;
  /** The grade this page is currently showing technical data for — `null` for a leaf product
   * with no `ProductGrade` children. Named here so a visitor never has to infer which grade the
   * page beneath the hero describes. */
  readonly activeGrade: ProductGradeSummaryResponse | null;
}): ReactNode {
  return (
    <section className="fs-sec pd-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pd-hero-inner">
        <div className="pd-hero-media">
          <ProductGallery
            images={product.images}
            productName={product.name}
            familySlug={product.category.slug}
          />
        </div>

        <div className="pd-hero-identity">
          <nav className="pd-crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <a href={`/${locale}${ROUTES.products}`}>Products</a>
              </li>
              <li>
                <a href={`/${locale}${ROUTES.products}/${product.category.slug}`}>
                  {product.category.name}
                </a>
              </li>
              <li aria-current="page">{product.name}</li>
            </ol>
          </nav>

          <h1 className="fs-d1 pd-title">{product.name}</h1>

          {product.description !== null && product.description !== "" && (
            <p className="fs-lead pd-lead">{product.description}</p>
          )}

          {(product.segments.length > 0 ||
            product.productType !== null ||
            activeGrade !== null) && (
            <dl className="pd-facts">
              <div>
                <dt>Product family</dt>
                <dd>
                  <a href={`/${locale}${ROUTES.products}/${product.category.slug}`}>
                    {product.category.name}
                    <Arrow size={12} />
                  </a>
                </dd>
              </div>

              {product.segments.length > 0 && (
                <div>
                  <dt>{product.segments.length === 1 ? "Segment" : "Segments"}</dt>
                  <dd>
                    <ul className="pd-segments">
                      {product.segments.map((segment) => (
                        <li key={segment.slug}>{segment.name}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}

              {product.productType !== null && (
                <div>
                  <dt>Product type</dt>
                  <dd>{product.productType.name}</dd>
                </div>
              )}

              {activeGrade !== null && (
                <div>
                  <dt>Grade</dt>
                  <dd>{activeGrade.label}</dd>
                </div>
              )}
            </dl>
          )}

          {localeFallback && (
            <p className="pd-fallback-note">
              Some details are shown in the site&rsquo;s default language because this product has
              not been translated yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
