import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";
import { translator } from "@/i18n/translate";

import { BidiText } from "../bidi-text";
import { gradeSlug } from "../grade-selection";
import { propertyLabel } from "../property-labels";
import { ProductGallery } from "./gallery";

import type { KeyMetric } from "../spec-matrix";
import type { ProductDetailResponse, ProductGradeSummaryResponse } from "@sam-group/types";

/**
 * The redesigned Product Detail hero (owner-approved design, 28 October 2026): dark, grade-led.
 *
 * Identity on one side and the product imagery on the other; under them, the headline values of
 * the grade being viewed, each with a bar showing where that grade sits within the product's own
 * published range. Choosing a grade is a link (`?grade=`), so the page stays server-rendered and
 * every grade has its own shareable URL.
 *
 * The lead is the description's first paragraph only — the full text is the Overview card below,
 * so the page never prints the same paragraph twice.
 */
export function ProductHeroV2({
  product,
  locale,
  dir,
  activeGrade,
  metrics,
  showFallback,
  quoteHref,
}: {
  readonly product: ProductDetailResponse;
  readonly locale: string;
  /** The page language's writing direction, from the `Locale` table. */
  readonly dir: "ltr" | "rtl";
  readonly activeGrade: ProductGradeSummaryResponse | null;
  readonly metrics: readonly KeyMetric[];
  /** True only when the product's own content is not in this language (see the template). */
  readonly showFallback: boolean;
  readonly quoteHref: string;
}): ReactNode {
  const t = translator(locale);
  const lead = product.description?.split(/\n\s*\n/)[0]?.trim() ?? "";
  const familyHref = `/${locale}${ROUTES.products}/${product.category.slug}`;
  const canonical = `/${locale}${ROUTES.products}/${product.slug}`;

  return (
    <section className="fs-sec pd2-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      {activeGrade !== null && (
        <span className="pd2-hero-ghost" aria-hidden="true" dir="ltr">
          {activeGrade.label}
        </span>
      )}

      <div className="fs-wrap pd2-hero-inner">
        <div className="pd2-hero-identity">
          <nav className="pd-crumbs" aria-label={t("Breadcrumb")}>
            <ol>
              <li>
                <a href={`/${locale}${ROUTES.products}`}>{t("Products")}</a>
              </li>
              <li>
                <a href={familyHref}>{t(product.category.name)}</a>
              </li>
              <li aria-current="page">
                <bdi>{product.name}</bdi>
              </li>
            </ol>
          </nav>

          <h1 className="pd2-title">
            <bdi>{product.name}</bdi>
          </h1>

          {lead !== "" && (
            <p className="pd2-lead" dir={dir}>
              <BidiText text={lead} dir={dir} />
            </p>
          )}

          {product.grades.length > 1 && (
            <nav className="pd2-grades" aria-label={t("Select a grade")}>
              <ul>
                {product.grades.map((grade) => {
                  const isActive = activeGrade?.id === grade.id;
                  return (
                    <li key={grade.id}>
                      <a
                        href={`${canonical}?grade=${gradeSlug(grade.label)}#overview`}
                        aria-current={isActive ? "true" : undefined}
                        data-active={isActive ? "true" : undefined}
                        dir="ltr"
                      >
                        {grade.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <div className="pd2-hero-actions">
            <a className="fs-btn fs-btn--gold" href={quoteHref}>
              {activeGrade === null
                ? t("Request a quote")
                : t("Request a quote for {grade}", { grade: activeGrade.label })}
              <Arrow />
            </a>
            <a className="fs-btn fs-btn--glass" href="#documents">
              {t("Request TDS")}
            </a>
          </div>

          {showFallback && (
            <p className="pd-fallback-note">
              {t(
                "Some details are shown in the site’s default language because this product has not been translated yet.",
              )}
            </p>
          )}
        </div>

        <div className="pd2-hero-media">
          <ProductGallery
            images={product.images}
            productName={product.name}
            familySlug={product.category.slug}
            locale={locale}
          />
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="fs-wrap">
          <ul className="pd2-metrics" id="overview">
            {metrics.map((metric) => (
              <li key={metric.key}>
                <span className="pd2-metric-name">{propertyLabel(metric.key, t)}</span>
                <span className="pd2-metric-value" dir="ltr">
                  {metric.value}
                  {metric.unit !== null && <span className="pd2-metric-unit">{metric.unit}</span>}
                </span>
                {metric.position !== null && (
                  <span className="pd2-metric-track" aria-hidden="true">
                    <span style={{ inlineSize: `${Math.max(6, metric.position)}%` }} />
                  </span>
                )}
                {metric.method !== null && (
                  <span className="pd2-metric-method" dir="ltr">
                    {metric.method}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
