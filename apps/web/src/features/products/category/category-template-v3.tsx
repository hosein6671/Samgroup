import { Suspense } from "react";
import type { ReactNode } from "react";

/*
 * Stylesheets: `flagship.css` declares the brand scope, `products.css` carries the shared closing
 * CTA's `.pr-close*` constructions, and `category-v3.css` this page's own.
 */
import "../../home/flagship.css";
import "../products.css";
import "./category-v3.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { ClosingCta } from "../sections/closing-cta";

import {
  FamilyCatalogue,
  FamilyCatalogueSkeleton,
  FamilyHero,
  FamilyReference,
} from "./sections/v3/family-sections";

import type { ProductCategoryContent } from "./category-contract";
import type { ProductFamily } from "../products-data";

/**
 * The redesigned Product Family page (owner-approved design, 28 October 2026), in every family and
 * every locale.
 *
 * The catalogue lists the whole family grouped by application group (ADR-029) with the headline
 * values each product publishes, read through the API like every other catalogue page; editorial
 * copy (hero, quality, supply, documents, FAQ) still comes from the family's CMS content. The
 * catalogue streams behind its own Suspense boundary, so the hero never waits for the API.
 */
export function ProductCategoryTemplateV3({
  content,
  family,
  locale,
  locales,
}: {
  readonly content: ProductCategoryContent;
  readonly family: ProductFamily;
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />
      <main id="main-content">
        <FamilyHero content={content} family={family} locale={locale} />
        <Suspense fallback={<FamilyCatalogueSkeleton locale={locale} />}>
          <FamilyCatalogue family={family} locale={locale} />
        </Suspense>
        <FamilyReference content={content} locale={locale} />
        <ClosingCta locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
