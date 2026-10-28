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
import "./product-detail-v2.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { ClosingCta } from "../sections/closing-cta";

import { resolveActiveGrade } from "./grade-selection";
import { buildSpecMatrix, keyMetrics } from "./spec-matrix";
import { ProductDataComparison } from "./sections/data-comparison";
import { ProductFaqDocs } from "./sections/faq-docs";
import { ProductHeroV2 } from "./sections/hero-v2";
import { ProductRelated } from "./sections/related";
import { ProductSectionNav } from "./sections/section-nav";
import { ProductUseCards } from "./sections/use-cards";

import type { ProductDetailResponse, ProductListItemResponse } from "@sam-group/types";

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
  related = [],
}: {
  readonly product: ProductDetailResponse;
  /** The active locale segment, used to compose the breadcrumb's links. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /** The API's `meta.localeFallback`. */
  readonly localeFallback: boolean;
  /** The raw `?grade=` request value, resolved here rather than at the route — see
   * `grade-selection.ts` for the resolution rule (defaults to the first published grade; never
   * a fallback to another grade's data). */
  readonly activeGradeParam: string | null;
  /** Other products of the same application group (ADR-029), already excluding this one. */
  readonly related?: readonly ProductListItemResponse[];
}): ReactNode {
  const activeGrade = resolveActiveGrade(product.grades, activeGradeParam);
  const matrix = buildSpecMatrix(product.specifications, product.grades);
  const activeColumn = activeGrade?.label ?? (product.grades.length === 0 ? "" : null);
  const metrics = activeColumn === null ? [] : keyMetrics(matrix, activeColumn);
  const canonicalPath = `/${locale}/products/${product.slug}`;
  const dir = locales.find((entry) => entry.code === locale)?.direction === "rtl" ? "rtl" : "ltr";
  const quoteHref = `${localeHref(locale, ROUTES.requestQuote)}?product=${encodeURIComponent(product.slug)}`;
  const documentsHref = `${localeHref(locale, ROUTES.contactUs)}?type=product_inquiry&product=${encodeURIComponent(product.slug)}`;

  /*
   * The fallback notice speaks about the product's OWN content. Names are never translated
   * (ADR-027 §2) and taxonomy labels have their own approvals, so the API's flag alone would show
   * the notice on every fully translated product; the language the editorial content was served in
   * is the precise signal when there is any.
   */
  const showFallback =
    product.editorialLocale !== undefined ? product.editorialLocale !== locale : localeFallback;

  const faq = product.editorial?.faq ?? [];
  const hasUse =
    (product.description ?? "").trim() !== "" ||
    (product.editorial?.applications.length ?? 0) > 0 ||
    (product.editorial?.features.length ?? 0) > 0;
  const sections = [
    { id: "data", label: "Grades & data" },
    ...(hasUse ? [{ id: "applications", label: "Applications" }] : []),
    ...(faq.length > 0 ? [{ id: "faq", label: "FAQ" }] : []),
    { id: "documents", label: "Documents" },
    ...(related.length > 0 ? [{ id: "related", label: "Related" }] : []),
  ];

  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <ProductHeroV2
          product={product}
          locale={locale}
          dir={dir}
          activeGrade={activeGrade}
          metrics={metrics}
          showFallback={showFallback}
          quoteHref={quoteHref}
        />

        <ProductSectionNav
          locale={locale}
          sections={sections}
          gradeLabel={activeGrade?.label ?? null}
          quoteHref={quoteHref}
        />

        <ProductDataComparison
          matrix={matrix}
          locale={locale}
          activeColumn={activeColumn}
          canonicalPath={canonicalPath}
        />

        <ProductUseCards
          locale={locale}
          dir={dir}
          description={product.description}
          editorial={product.editorial}
          editorialLocale={product.editorialLocale}
        />

        <ProductFaqDocs
          locale={locale}
          dir={dir}
          faq={faq}
          editorialLocale={product.editorialLocale}
          documentsHref={documentsHref}
          logisticsHref={localeHref(locale, ROUTES.exportLogistics)}
        />

        {product.applicationGroup !== null && (
          <ProductRelated
            locale={locale}
            groupName={product.applicationGroup.name}
            familyName={product.category.name}
            familySlug={product.category.slug}
            products={related}
          />
        )}

        <ClosingCta locale={locale} productSlug={product.slug} />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
