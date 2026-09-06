import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ReactElement } from "react";

import { hrefsIn, idsIn, renderHtml } from "@test/rendered-links";

import { FAMILIES } from "../products-data";

import { getCategoryContent, publishedCategorySlugs } from "./data";
import { CategoryProperties } from "./sections/properties";
import { CategoryCatalogV2 } from "./sections/v2/catalog-v2";
import { Guidance } from "./sections/v2/guidance";
import { HeroV2 } from "./sections/v2/hero-v2";
import { CatalogRail } from "./sections/v2/rail";

import type { SectionProps } from "./category-section";

import type { ProductListItemResponse } from "@sam-group/types";
import type { ProductListResult } from "@/lib/products";

/**
 * Base Oils v2 pilot.
 *
 * The template itself is not rendered here — it imports stylesheets and wraps an async section in
 * Suspense, neither of which this `environment: "node"` runner handles. Every other products spec
 * follows the same rule: assert the section components and their contract, not the composition
 * shell. Composition order is a reading of `category-template-v2.tsx` and is checked in the
 * browser during the gate.
 */

const CATEGORY_V2_CSS = readFileSync(
  fileURLToPath(new URL("./category-v2.css", import.meta.url)),
  "utf8",
);

/** Rendered markup as readable text — entities decoded, tags stripped, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function propsFor(locale: string, slug = "base-oils"): SectionProps {
  const content = getCategoryContent(slug);
  const family = FAMILIES.find((entry) => entry.id === slug);
  if (!content || !family) throw new Error(`No fixture for "${slug}"`);
  return { content, family, locale };
}

function product(overrides: Partial<ProductListItemResponse>): ProductListItemResponse {
  return {
    id: "id-1",
    name: "Base Oil Group I",
    slug: "base-oil-group-i",
    description: "Group I paraffinic solvent-neutral base oil, published by SN designation.",
    categoryId: "cat-1",
    createdAt: "2026-09-05T14:59:26.786Z",
    ...overrides,
  };
}

const TWO_PRODUCTS: ProductListResult = {
  ok: true,
  total: 2,
  page: 1,
  limit: 20,
  products: [
    product({ id: "a", name: "Base Oil Group I", slug: "base-oil-group-i" }),
    product({
      id: "b",
      name: "Bright Stock",
      slug: "bright-stock",
      description: "High-viscosity base-stock family, published as BS 150.",
    }),
  ],
};

describe("only Base Oils opts into the v2 layout", () => {
  it("marks base-oils v2 and leaves the other five families untouched", () => {
    expect(getCategoryContent("base-oils")?.layout).toBe("v2");

    for (const slug of publishedCategorySlugs()) {
      if (slug === "base-oils") continue;
      expect(getCategoryContent(slug)?.layout).toBeUndefined();
    }
  });

  it("still publishes the six canonical family slugs, unchanged", () => {
    expect([...publishedCategorySlugs()].sort()).toEqual(FAMILIES.map((f) => f.id).sort());
  });

  it("names the Base Oils process Thin Film Evaporation, not the demoted 'polishing' mis-name", () => {
    const named = getCategoryContent("base-oils")?.quality.namedProcess;
    expect(named?.name).toBe("Thin Film Evaporation");
    expect(JSON.stringify(named)).not.toMatch(/polish/i);
    expect(FAMILIES.find((f) => f.id === "base-oils")?.namedBlock).toBe("Thin Film Evaporation");
  });
});

describe("HeroV2 — image-led intro", () => {
  const html = renderHtml(<HeroV2 {...propsFor("en")} />);

  it("uses the short approved headline and lead", () => {
    expect(html).toContain("Base oils, by group and grade.");
    expect(html).toContain("The base-fluid families that go into finished lubricants.");
  });

  it("captions the photograph as representative and drops the SAM wordmark overlay", () => {
    expect(html).toContain("Representative image — shown for illustration");
    expect(html).not.toContain("fs-photo-brand");
    expect(html).not.toContain("SAM GROUP");
  });

  it("carries the locale into the breadcrumb and both actions", () => {
    const hrefs = hrefsIn(renderHtml(<HeroV2 {...propsFor("fa")} />));
    expect(hrefs).toContain("/fa/products");
    expect(hrefs).toContain("/fa/contact-us/request-a-quote");
    expect(hrefs).toContain("/fa/contact-us");
  });

  it("links down to the published-products block", () => {
    expect(hrefsIn(html)).toContain("#products");
  });

  it("carries a single h1 and no reveal class", () => {
    expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(html).not.toContain("reveal-");
  });
});

describe("Guidance — compact selection guidance, content preserved", () => {
  const html = renderHtml(<Guidance {...propsFor("en")} />);
  const content = getCategoryContent("base-oils")!;

  it("keeps the legacy #overview and #specifications-adjacent anchors, plus each #range-<id>", () => {
    const ids = idsIn(html);
    expect(ids).toContain("overview");
    expect(ids).toContain("classification");
    for (const subRange of content.range.subRanges) {
      expect(ids).toContain(`range-${subRange.id}`);
    }
  });

  it("shows every overview paragraph (the markers move to the rail, not shown twice)", () => {
    for (const paragraph of content.overview.body) {
      expect(html).toContain(paragraph);
    }
    expect(html).not.toContain("pcv2-markers");
    expect(html).not.toContain("pcv2-rail-facts");
  });

  it("shows every sub-range designation, qualifier and grade, plus the classification axes", () => {
    const text = textOf(html);
    for (const subRange of content.range.subRanges) {
      expect(text).toContain(subRange.designation);
      if (subRange.qualifier) expect(text).toContain(subRange.qualifier);
      for (const grade of subRange.grades) expect(text).toContain(grade.designation);
    }
    for (const axis of content.range.classificationAxes ?? []) {
      expect(text).toContain(axis);
    }
  });

  it("presents the classification as a scannable table with a row per group", () => {
    expect(html).toContain("<table");
    expect([...html.matchAll(/<tr\b/g)].length).toBe(content.range.subRanges.length + 1); // + header
  });

  it("labels each data cell so it survives the mobile card transform", () => {
    expect(html).toContain('data-label="Classification"');
    expect(html).toContain('data-label="Published grades"');
  });

  it("puts each sub-range summary in a native details/summary, still in the DOM", () => {
    expect([...html.matchAll(/<details\b/g)].length).toBe(content.range.subRanges.length);
    const text = textOf(html);
    for (const subRange of content.range.subRanges) {
      expect(text).toContain(textOf(subRange.summary));
    }
  });

  it("frames the register as classification, not availability", () => {
    expect(html).toContain("Classification, not availability");
  });

  it("carries no reveal class", () => {
    expect(html).not.toContain("reveal-");
  });
});

describe("CatalogRail — the sticky companion", () => {
  const html = renderHtml(<CatalogRail {...propsFor("en")} />);
  const content = getCategoryContent("base-oils")!;

  it("carries the family quick-facts (the fixture's markers)", () => {
    for (const marker of content.overview.markers) {
      expect(html).toContain(marker.label);
      expect(html).toContain(marker.value);
    }
  });

  it("carries both enquiry actions with the locale, and an in-page jump list", () => {
    const hrefs = hrefsIn(renderHtml(<CatalogRail {...propsFor("fa")} />));
    expect(hrefs).toContain("/fa/contact-us/request-a-quote");
    expect(hrefs).toContain("/fa/contact-us");

    const own = hrefsIn(html);
    expect(own).toContain("#products");
    expect(own).toContain("#classification");
    expect(own).toContain("#specifications");
  });

  it("is a labelled complementary landmark and carries no reveal class", () => {
    expect(html).toMatch(/<aside\b[^>]*aria-label=/);
    expect(html).not.toContain("reveal-");
  });
});

describe("CategoryProperties is reused unchanged — the conditional table survives", () => {
  it("keeps id=specifications and renders the pending state when no values are published", () => {
    const html = renderHtml(<CategoryProperties {...propsFor("en")} />);
    expect(idsIn(html)).toContain("specifications");
    // base-oils publishes no values today → the "how values are confirmed" note, not a table.
    expect(html).toContain("How values are confirmed");
    expect(html).not.toContain("<table");
  });

  it("renders a real <table> when a group carries values", () => {
    const base = getCategoryContent("base-oils")!;
    const group = base.properties.groups[0]!;
    const firstRow = base.range.subRanges[0]!.grades[0]!.id;
    const withValues: SectionProps = {
      ...propsFor("en"),
      content: {
        ...base,
        properties: {
          ...base.properties,
          groups: [
            {
              ...group,
              values: { [firstRow]: { [group.columns[0]!.key]: "12.5" } },
            },
          ],
        },
      },
    };
    const html = renderHtml(<CategoryProperties {...withValues} />);
    expect(html).toContain("<table");
    expect(html).toContain("12.5");
  });
});

describe("CategoryCatalogV2 — products first, Base-Oils-only filter/reset", () => {
  async function render(result: ProductListResult, activeSegment: string | null): Promise<string> {
    const element = await CategoryCatalogV2({
      products: Promise.resolve(result),
      locale: "en",
      familySlug: "base-oils",
      activeSegment,
    });
    return renderHtml(element as ReactElement);
  }

  it("lists both real products with no segment chip row in the default view", async () => {
    const html = await render(TWO_PRODUCTS, null);
    expect(idsIn(html)).toContain("products");
    expect(html).toContain("Base Oil Group I");
    expect(html).toContain("Bright Stock");
    expect(hrefsIn(html)).toContain("/en/products/base-oil-group-i");
    expect(html).toContain("Showing all published base-oil products.");
    expect(html).not.toContain("pl-filter"); // the shared 8-chip filter is not rendered
  });

  it("shows an active-filter notice and a reset for a bookmarked ?segment= URL", async () => {
    const html = await render(TWO_PRODUCTS, "marine");
    expect(html).toContain("Filtered by segment");
    expect(html).toContain("Marine");
    expect(hrefsIn(html)).toContain("/en/products/base-oils");
  });

  it("keeps the reset when a segment matches nothing", async () => {
    const html = await render({ ok: true, total: 0, page: 1, limit: 20, products: [] }, "marine");
    expect(html).toContain("No products match this segment");
    expect(hrefsIn(html)).toContain("/en/products/base-oils");
  });

  it("renders a restrained notice, not a 404, when the API is unreachable", async () => {
    const html = await render({ ok: false, reason: "unreachable" }, null);
    expect(html).toContain("Product list unavailable");
  });

  it("names an unrecognised segment and offers the reset", async () => {
    const html = await render(
      { ok: false, reason: "unknown-filter", field: "segment" },
      "nonsense",
    );
    expect(html).toContain("That segment is not recognised");
    expect(hrefsIn(html)).toContain("/en/products/base-oils");
  });
});

describe("category-v2.css — scoped, tokenised, motion-safe", () => {
  it("scopes every style rule under the pilot root", () => {
    const stripped = CATEGORY_V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@media[^{]*\{/g, "")
      .replace(/@supports[^{]*\{/g, "");
    const ruleSelectors = [...stripped.matchAll(/(?:^|\})\s*([^{}@]+?)\s*\{/g)].map((match) =>
      match[1]!.trim(),
    );

    expect(ruleSelectors.length).toBeGreaterThan(20);
    for (const selector of ruleSelectors) {
      for (const part of selector.split(",")) {
        expect(part.trim()).toContain('[data-layout="v2"]');
      }
    }
  });

  it("cancels the reused sections' reveal animations under the pilot root", () => {
    expect(CATEGORY_V2_CSS).toMatch(
      /\[data-layout="v2"\][^{]*\.reveal-fade-rise[\s\S]*?animation:\s*none/,
    );
  });

  it("declares no raw hex colour, px type size or ms duration", () => {
    // rgba() shadows/gradients are the one allowed literal, matching category.css convention.
    const withoutRgba = CATEGORY_V2_CSS.replace(/rgba\([^)]*\)/g, "");
    expect(withoutRgba).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(withoutRgba).not.toMatch(/font-size:\s*\d+px/);
    expect(withoutRgba).not.toMatch(/(?:transition|animation)[^;]*\b\d+m?s\b/);
  });

  it("gives every new standalone link at least a 24px minimum target", () => {
    for (const selector of [
      ".pcv2-trail a",
      ".pcv2-hero-jump a",
      ".pcv2-filter-reset",
      ".pcv2-rail-jump a",
      ".pcv2-cls-desc-item summary",
    ]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`${escaped}\\s*\\{[^}]*?min-block-size:\\s*(\\d+)px`).exec(
        CATEGORY_V2_CSS,
      );
      expect(match, `${selector} declares min-block-size`).not.toBeNull();
      expect(Number(match![1]), `${selector} target >= 24px`).toBeGreaterThanOrEqual(24);
    }
  });
});
