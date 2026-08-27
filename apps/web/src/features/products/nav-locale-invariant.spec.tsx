import { describe, expect, it } from "vitest";

import { hrefsIn, isInternalPath, localeEscapees, renderHtml } from "@test/rendered-links";

import { Ecosystem } from "@/features/home/sections/ecosystem";
import { Hero as HomeHero } from "@/features/home/sections/hero";
import { Insights } from "@/features/home/sections/insights";
import { Lab } from "@/features/home/sections/lab";
import { Partnership } from "@/features/home/sections/partnership";

import { getCategoryContent } from "./category/data";
import { CategoryApplications } from "./category/sections/applications";
import { CategoryDocumentation } from "./category/sections/documentation";
import { CategoryFaq } from "./category/sections/faq";
import { CategoryHero } from "./category/sections/hero";
import { CategoryQuality } from "./category/sections/quality";
import { CategoryRelated } from "./category/sections/related";
import { CategorySupply } from "./category/sections/supply";
import { ProductHero } from "./detail/sections/hero";
import { FAMILIES } from "./products-data";
import { ClosingCta } from "./sections/closing-cta";
import { Documentation } from "./sections/documentation";
import { FinderTeaser } from "./sections/finder-teaser";
import { ProductsHero } from "./sections/hero";
import { ProductRegister } from "./sections/register";

import type { SectionProps } from "./category/category-section";
import type { ProductDetailResponse, SeoFields } from "@sam-group/types";

/**
 * NAV-2 — the cross-surface invariant.
 *
 * One assertion, stated once for all four public surfaces NAV-2 touches: **no internal link a page
 * body emits may escape the locale that page was rendered in.** Everything else in this gate's
 * specs is a statement about a particular link; this is the statement about the property, and it is
 * the one that would have caught NAV-2 while NAV-1 was being written.
 *
 * ## The three admitted exceptions, and why each is not an escape
 *
 * - **Same-page fragments** (`#products`, `#family-*`, `#range-*`). A fragment is a position on the
 *   page already being read, not a route; prefixing one would stop it working.
 * - **External and protocol addresses.** None exist in these bodies today — the assertion is
 *   written to admit them rather than to assume their absence.
 * - **Shared chrome.** Header, footer and the skip link are NAV-1's, closed and separately tested;
 *   only body sections are rendered here.
 *
 * `fa` throughout, for the reason the per-surface specs use a non-default locale: a regression that
 * prefixed everything with `en` would pass an `en` spec.
 */

const SEO: SeoFields = {
  locale: "fa",
  metaTitle: null,
  metaDescription: null,
  canonicalUrl: null,
  ogTitle: null,
  ogDescription: null,
  socialImage: null,
  twitterCardType: "summary_large_image",
  twitterTitle: null,
  twitterDescription: null,
  twitterImage: null,
  robotsIndex: true,
  robotsFollow: true,
  keywords: [],
  structuredDataOverride: null,
  alternates: [],
};

const PRODUCT: ProductDetailResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "VERIFICATION PRODUCT",
  slug: "verification-product",
  description: "VERIFICATION DESCRIPTION",
  createdAt: "2026-01-01T00:00:00.000Z",
  category: {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Base Oils",
    slug: "base-oils",
    parentId: null,
  },
  segments: [],
  productType: null,
  specifications: [],
  images: [],
  seo: SEO,
};

function categoryProps(locale: string): SectionProps {
  const content = getCategoryContent("base-oils");
  const family = FAMILIES.find((entry) => entry.id === "base-oils");

  if (!content || !family) throw new Error("No base-oils fixture");

  return { content, family, locale };
}

/** The four public surfaces NAV-2 touched, each rendered as the body a reader receives. */
function surfaces(locale: string): Record<string, string> {
  const category = categoryProps(locale);

  return {
    home: [
      renderHtml(<HomeHero locale={locale} />),
      renderHtml(<Ecosystem locale={locale} />),
      renderHtml(<Lab />),
      renderHtml(<Insights locale={locale} />),
      renderHtml(<Partnership locale={locale} />),
    ].join(""),

    "products landing": [
      renderHtml(<ProductsHero locale={locale} />),
      renderHtml(<ProductRegister locale={locale} />),
      renderHtml(<FinderTeaser locale={locale} />),
      renderHtml(<Documentation locale={locale} />),
      renderHtml(<ClosingCta locale={locale} />),
    ].join(""),

    "product family": [
      renderHtml(<CategoryHero {...category} />),
      renderHtml(<CategoryQuality {...category} />),
      renderHtml(<CategoryApplications {...category} />),
      renderHtml(<CategorySupply {...category} />),
      renderHtml(<CategoryDocumentation {...category} />),
      renderHtml(<CategoryFaq {...category} />),
      renderHtml(<CategoryRelated {...category} />),
    ].join(""),

    "product detail": [
      renderHtml(<ProductHero product={PRODUCT} locale={locale} localeFallback={false} />),
      renderHtml(<ClosingCta locale={locale} productSlug={PRODUCT.slug} />),
    ].join(""),
  };
}

describe("no page-body internal link escapes the route locale", () => {
  for (const [name, html] of Object.entries(surfaces("fa"))) {
    it(`${name} emits every internal href under /fa`, () => {
      expect(localeEscapees(html, "fa")).toEqual([]);
    });

    it(`${name} emits at least one internal link, so the assertion is not vacuous`, () => {
      expect(hrefsIn(html).filter(isInternalPath).length).toBeGreaterThan(0);
    });

    it(`${name} emits nothing but paths and same-page fragments`, () => {
      for (const href of hrefsIn(html)) {
        expect(isInternalPath(href) || href.startsWith("#")).toBe(true);
      }
    });
  }
});
