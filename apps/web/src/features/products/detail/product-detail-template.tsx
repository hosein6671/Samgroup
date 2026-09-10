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

import { getProductDetailEditorial } from "./product-detail-content";
import { resolveActiveGrade, specificationsForGrade } from "./grade-selection";
import { GradeSelector } from "./sections/grade-selector";
import { ProductHero } from "./sections/hero";
import { ProductPackaging } from "./sections/packaging";
import { ProductSelectionGuide } from "./sections/selection-guide";
import { ProductSpecifications } from "./sections/specifications";
import { ProductStandards } from "./sections/standards";
import { ProductTechnicalDocuments } from "./sections/technical-documents";
import { ProductEditorialFaq, ProductEditorialPoints } from "./sections/editorial-sections";

import type { ProductDetailResponse } from "@sam-group/types";

/**
 * The Product Detail template — one component, every product.
 *
 * ── The owner's required section order ──────────────────────────────────────
 *
 * 1. Image-led product hero (`ProductHero`, which renders the image/fallback and the identity
 *    block together — see its own doc comment for why those are one section, not two).
 * 2. Product identity, family, type and selected grade — inside `ProductHero`.
 * 3. Product overview — `product.description`, the one real per-product descriptive field on
 *    the wire; omitted when null, never replaced with invented copy.
 * 4–5. Published English product applications and features, when supplied by the editor.
 *    Empty sections are omitted. The existing family-level selection guidance remains separate;
 *    product editorial text is not a technical approval. Published product FAQ precedes the CTA.
 * 6. Standards and classifications — `ProductStandards`, derived from `productType`/`grades`.
 * 7. Grade/variant selector — `GradeSelector`, rendered only for 2+ grades.
 * 8. Complete structured Technical Data for the selected grade — `ProductSpecifications`, given
 *    the grade-filtered array `specificationsForGrade` produces.
 * 9. Packaging options — `ProductPackaging`, the shared generic supply-format/Incoterm
 *    vocabulary every Family page's own Supply section already publishes.
 * 11. Request Quote / Technical Consultation CTA — the shared `ClosingCta`, unchanged.
 *
 * ── Nothing forced ───────────────────────────────────────────────────────────
 *
 * Every section above omits itself on its own when it has nothing real to show: `ProductHero`'s
 * facts block, `ProductStandards`, `GradeSelector` (fewer than two grades) and the Overview
 * paragraph below all return early rather than render an empty frame. `ProductSpecifications` is
 * the one exception by design — an empty result is its own real, distinct "Technical data is
 * under review." state, not an absence (see its own doc comment).
 *
 * ── The closing CTA is shared, and appropriate here ─────────────────────────
 *
 * Unchanged from the previous gate: `ClosingCta` carries `?product={slug}` into Contact Us for
 * `Inquiry.relatedProductId`, and there is still no product-scoped form on the platform.
 *
 * ── Entirely server-rendered ────────────────────────────────────────────────
 *
 * Not one component in this tree carries `"use client"`. The Grade selector is links, exactly
 * like the Product Family page's own Segment filter; the gallery's thumbnail selection is CSS
 * (`:target`), not a click handler. The only client JavaScript on the page is the header's,
 * inherited from the shared chrome.
 */
export function ProductDetailTemplate({
  product,
  locale,
  locales,
  localeFallback,
  activeGradeParam,
}: {
  readonly product: ProductDetailResponse;
  /** The active locale segment, used to compose the breadcrumb's links. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /** The API's `meta.localeFallback`, passed through to the hero's notice. */
  readonly localeFallback: boolean;
  /** The raw `?grade=` request value, resolved here rather than at the route — see
   * `grade-selection.ts` for the resolution rule (defaults to the first published grade; never
   * a fallback to another grade's data). */
  readonly activeGradeParam: string | null;
}): ReactNode {
  const editorial = getProductDetailEditorial(product.category.slug);
  const activeGrade = resolveActiveGrade(product.grades, activeGradeParam);
  const visibleSpecifications = specificationsForGrade(product.specifications, activeGrade);
  const canonicalPath = `/${locale}/products/${product.slug}`;

  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <ProductHero
          product={product}
          locale={locale}
          localeFallback={localeFallback}
          activeGrade={activeGrade}
        />

        {product.description !== null && product.description !== "" && (
          <section className="fs-sec pd-overview" id="overview" data-surface="light">
            <div className="fs-wrap">
              <header className="pd-section-head reveal-fade-rise">
                <p className="fs-eyebrow">Overview</p>
                <h2 className="fs-d2">{product.name}</h2>
              </header>
              <p className="fs-lead pd-overview-body reveal-fade-rise">{product.description}</p>
            </div>
          </section>
        )}

        {locale === "en" && product.editorial && (
          <>
            <ProductEditorialPoints
              items={product.editorial.applications}
              id="applications"
              title="Applications"
            />
            <ProductEditorialPoints
              items={product.editorial.features}
              id="features"
              title="Features"
            />
          </>
        )}
        <ProductSelectionGuide editorial={editorial} />

        <ProductStandards product={product} />

        {product.grades.length > 1 && (
          <div className="fs-wrap pd-grade-selector-wrap">
            <GradeSelector
              grades={product.grades}
              activeGrade={activeGrade}
              baseHref={canonicalPath}
            />
          </div>
        )}

        <ProductSpecifications specifications={visibleSpecifications} />

        <ProductPackaging />

        <ProductTechnicalDocuments locale={locale} productSlug={product.slug} />
        {locale === "en" && product.editorial && (
          <ProductEditorialFaq items={product.editorial.faq} />
        )}

        <ClosingCta locale={locale} productSlug={product.slug} />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
