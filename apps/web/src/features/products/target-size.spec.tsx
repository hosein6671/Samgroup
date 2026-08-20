import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { linksIn, renderHtml, ruleBlock } from "@test/rendered-links";

import { getCategoryContent } from "./category/data";
import { CategoryDocumentation } from "./category/sections/documentation";
import { CategoryFaq } from "./category/sections/faq";
import { CategoryHero } from "./category/sections/hero";
import { CategoryQuality } from "./category/sections/quality";
import { CategoryRelated } from "./category/sections/related";
import { ProductHero } from "./detail/sections/hero";
import { FAMILIES } from "./products-data";

import type { SectionProps } from "./category/category-section";
import type { ProductDetailResponse, SeoFields } from "@sam-group/types";

/**
 * WCAG 2.2 AA — SC 2.5.8 Target Size (Minimum) on the Product Family and Product Detail bodies.
 *
 * ## What these tests can and cannot prove
 *
 * **Runtime measurement is the authoritative evidence** and is recorded in the gate report: this
 * runner is `environment: "node"` with no DOM and no layout engine, so nothing here computes a box.
 *
 * What it *can* hold is the structural contract underneath the measurement — the rule is declared,
 * the anchor is still an anchor, the name is still the name, the address still carries the locale,
 * and the one link claiming the Inline exception is still surrounded by prose. Those are the things
 * a later edit would break silently; the pixel result is what a browser then re-confirms.
 *
 * Asserting on a named rule's declaration block rather than on a file snapshot is deliberate. A
 * snapshot of `category.css` would fail on every unrelated edit, and the habit it teaches is to
 * regenerate it without reading.
 */

const CATEGORY_CSS = readFileSync(
  fileURLToPath(new URL("./category/category.css", import.meta.url)),
  "utf8",
);

const DETAIL_CSS = readFileSync(
  fileURLToPath(new URL("./detail/product-detail.css", import.meta.url)),
  "utf8",
);

/**
 * The five sub-24px links the NAV-2 runtime pass found, and what each one is.
 *
 * The classification is the whole decision: SC 2.5.8's Inline exception covers a target "in a
 * sentence or [whose] size is otherwise constrained by the line-height of non-target text". A
 * breadcrumb, an action-list entry and a CTA alone in its own paragraph are none of those, however
 * text-like they are drawn — so four of the five are corrected and one is exempt.
 */
const TARGETS = [
  { selector: ".pc-trail a", css: "category", kind: "breadcrumb", exempt: false },
  { selector: ".pc-doc-link", css: "category", kind: "action-list entry", exempt: false },
  { selector: ".pc-faq-link a", css: "category", kind: "standalone CTA", exempt: false },
  { selector: ".pc-related-all", css: "category", kind: "section-header action", exempt: false },
  { selector: ".pd-crumbs a", css: "detail", kind: "breadcrumb", exempt: false },
  { selector: ".pc-tests-foot a", css: "category", kind: "inline in prose", exempt: true },
] as const;

function cssFor(which: (typeof TARGETS)[number]["css"]): string {
  return which === "category" ? CATEGORY_CSS : DETAIL_CSS;
}

describe("every non-exempt target declares a minimum size", () => {
  for (const target of TARGETS.filter((entry) => !entry.exempt)) {
    it(`${target.selector} (${target.kind}) still declares a >=24px box`, () => {
      const block = ruleBlock(cssFor(target.css), target.selector);

      expect(block).not.toBeNull();

      /*
       * Two compliant mechanisms, and the rule may use either. `.pd-crumbs a` uses padding because
       * its `ol` aligns on `baseline` and the current-page item is plain text with no box — a
       * centred flex box there would step the trail. Everything else grows a box it already had.
       */
      const declaresMinBox = /min-block-size:\s*2[4-9]px|min-block-size:\s*[3-9]\d px/.test(
        block ?? "",
      );
      const declaresPadding = /padding-block:\s*[5-9]px/.test(block ?? "");

      expect(declaresMinBox || declaresPadding).toBe(true);
    });
  }

  it("keeps every corrected rule on a logical property, so RTL is unaffected", () => {
    for (const target of TARGETS.filter((entry) => !entry.exempt)) {
      const block = ruleBlock(cssFor(target.css), target.selector) ?? "";

      expect(block).not.toMatch(/(^|[\s;])min-height:/);
      expect(block).not.toMatch(/(^|[\s;])padding-(top|bottom|left|right):/);
    }
  });

  it("gives the box to the link itself rather than to an overlay", () => {
    /*
     * A stretched `::after` is a legitimate technique — `.pl-card-link` uses one — but it is the
     * wrong one here: these links sit next to other content, and an `inset: 0` overlay would cover
     * a neighbour's text. None of the corrected rules may grow a pseudo-element.
     */
    for (const target of TARGETS.filter((entry) => !entry.exempt)) {
      const block = ruleBlock(cssFor(target.css), `${target.selector}::after`);

      expect(block).toBeNull();
    }
  });
});

describe("the Inline exception is a claim about structure, and stays one", () => {
  it("keeps the footnote link surrounded by prose rather than alone in its own block", () => {
    const html = renderHtml(<CategoryQuality {...propsFor("fa")} />);
    const paragraph = /<p class="pc-tests-foot">([\s\S]*?)<\/p>/.exec(html);

    expect(paragraph).not.toBeNull();

    const inner = paragraph?.[1] ?? "";
    const proseBeforeLink = inner
      .slice(0, inner.indexOf("<a"))
      .replace(/<[^>]*>/g, "")
      .trim();

    // The exception rests on this: real sentence text, in the same block, before the target.
    expect(proseBeforeLink.length).toBeGreaterThan(40);
    expect(inner.indexOf("<a")).toBeGreaterThan(0);
  });

  it("does not give the exempt link a minimum box it does not need", () => {
    const block = ruleBlock(CATEGORY_CSS, ".pc-tests-foot a") ?? "";

    expect(block).not.toContain("min-block-size");
    expect(block).not.toContain("padding-block");
  });
});

/* ------------------------------------------------------- what must not move */

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
  description: null,
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

function propsFor(locale: string, slug = "base-oils"): SectionProps {
  const content = getCategoryContent(slug);
  const family = FAMILIES.find((entry) => entry.id === slug);

  if (!content || !family) throw new Error(`No fixture for "${slug}"`);

  return { content, family, locale };
}

/** The corrected links, as the surfaces that own them render them. */
function correctedSurfaces(locale: string): string {
  const props = propsFor(locale);

  return [
    renderHtml(<CategoryHero {...props} />),
    renderHtml(<CategoryQuality {...props} />),
    renderHtml(<CategoryDocumentation {...props} />),
    renderHtml(<CategoryFaq {...props} />),
    renderHtml(<CategoryRelated {...props} />),
    renderHtml(<ProductHero product={PRODUCT} locale={locale} localeFallback={false} />),
  ].join("");
}

describe("the correction changed a box and nothing else", () => {
  const EXPECTED_NAMES = [
    "Products", // .pc-trail a and .pd-crumbs a
    "Quality & Certifications", // the exempt footnote link
    "Open", // .pc-doc-link
    "Request a Sample", // .pc-faq-link a
    "Customized Solutions", // .pc-faq-link a
    "All products", // .pc-related-all
    "Base Oils", // .pd-crumbs a
  ];

  it("keeps every accessible name it had", () => {
    const names = linksIn(correctedSurfaces("fa")).map((link) => link.text);

    for (const expected of EXPECTED_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it("names every link — none was emptied by the box change", () => {
    for (const link of linksIn(correctedSurfaces("fa"))) {
      expect(link.text.length).toBeGreaterThan(0);
    }
  });

  it("keeps every corrected href locale-prefixed", () => {
    for (const link of linksIn(correctedSurfaces("fa"))) {
      if (link.href.startsWith("#")) continue;

      expect(link.href.startsWith("/fa/")).toBe(true);
    }
  });

  it("leaves them anchors — nothing became a button", () => {
    const html = correctedSurfaces("fa");

    for (const selector of ["pc-trail", "pc-doc-link", "pc-faq-link", "pc-related-all"]) {
      expect(html).toContain(selector);
    }

    // The only `<button>` on these surfaces would be a new one; there is none.
    expect(html).not.toContain("<button");
  });

  it("holds for every family, not only the one measured in the browser", () => {
    for (const family of FAMILIES) {
      const props = propsFor("ar", family.id);
      const html = [
        renderHtml(<CategoryHero {...props} />),
        renderHtml(<CategoryDocumentation {...props} />),
        renderHtml(<CategoryFaq {...props} />),
        renderHtml(<CategoryRelated {...props} />),
      ].join("");

      expect(html).toContain('class="pc-trail"');
      expect(html).toContain("pc-doc-link");

      for (const link of linksIn(html)) {
        if (link.href.startsWith("#")) continue;

        expect(link.href.startsWith("/ar/")).toBe(true);
        expect(link.text.length).toBeGreaterThan(0);
      }
    }
  });
});
