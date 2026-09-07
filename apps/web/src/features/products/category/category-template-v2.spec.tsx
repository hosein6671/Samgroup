import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ReactElement } from "react";

import { hrefsIn, idsIn, renderHtml } from "@test/rendered-links";

import { FAMILIES } from "../products-data";

import { getCategoryContent, publishedCategorySlugs } from "./data";
import { CategoryApplications } from "./sections/applications";
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

const V2_SLUGS = ["base-oils", "engine-oils-automotive-lubricants", "industrial-oils-lubricants"];

describe("which families opt into the v2 layout", () => {
  it("marks the three migrated families v2, and leaves the other three untouched", () => {
    for (const slug of V2_SLUGS) {
      expect(getCategoryContent(slug)?.layout).toBe("v2");
    }
    for (const slug of publishedCategorySlugs()) {
      if (V2_SLUGS.includes(slug)) continue;
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

  it("answers to both the v2 #classification and the legacy v1 #range, once each, on every v2 family", () => {
    for (const slug of V2_SLUGS) {
      const familyHtml = renderHtml(<Guidance {...propsFor("en", slug)} />);
      const ids = idsIn(familyHtml);
      expect(ids, `${slug}: #classification`).toContain("classification");
      expect(ids, `${slug}: legacy #range`).toContain("range");
      // no duplicate ids — each destination appears exactly once
      expect(familyHtml.match(/id="classification"/g), `${slug}: one #classification`).toHaveLength(
        1,
      );
      expect(familyHtml.match(/id="range"/g), `${slug}: one #range`).toHaveLength(1);
      // the legacy anchor carries no visible text and is hidden from assistive tech
      expect(familyHtml).toContain('<span id="range" aria-hidden="true"></span>');
      // every per-item anchor is still present and distinct from the block anchor
      for (const subRange of getCategoryContent(slug)!.range.subRanges) {
        expect(ids, `${slug}: #range-${subRange.id}`).toContain(`range-${subRange.id}`);
      }
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

describe("Engine Oils on v2 — adapts to a family with no classification and 45 products", () => {
  const eo = (locale = "en"): SectionProps => propsFor(locale, "engine-oils-automotive-lubricants");
  const content = getCategoryContent("engine-oils-automotive-lubricants")!;

  it("Guidance renders the segment-list variant, not the classification table", () => {
    const html = renderHtml(<Guidance {...eo()} />);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("pcv2-cls-table");
    expect(html).toContain("pcv2-seg-list");
    // every segment and its full summary are shown, each row anchored
    const ids = idsIn(html);
    expect(ids).toContain("overview");
    expect(ids).toContain("classification");
    const text = textOf(html);
    for (const subRange of content.range.subRanges) {
      expect(ids).toContain(`range-${subRange.id}`);
      expect(text).toContain(subRange.designation);
      expect(text).toContain(textOf(subRange.summary));
    }
  });

  it("Guidance uses a family-neutral framing line for the list variant", () => {
    const html = renderHtml(<Guidance {...eo()} />);
    expect(html).not.toContain("Classification, not availability");
    expect(html).toContain("This is how the range is organised");
  });

  it("the rail jump list points at #quality (no Applications block) and labels the range plainly", () => {
    const own = hrefsIn(renderHtml(<CatalogRail {...eo()} />));
    expect(own).toContain("#products");
    expect(own).toContain("#classification");
    expect(own).toContain("#specifications");
    expect(own).toContain("#quality");
    expect(own).not.toContain("#applications");
    expect(renderHtml(<CatalogRail {...eo()} />)).not.toContain("Classification");
    expect(renderHtml(<CatalogRail {...eo()} />)).toContain("The range");
  });

  it("Base Oils' rail is unchanged — still 'Classification' and '#applications'", () => {
    const html = renderHtml(<CatalogRail {...propsFor("en")} />);
    expect(html).toContain("Classification");
    expect(hrefsIn(html)).toContain("#applications");
  });

  it("has no Applications block, so CategoryApplications self-suppresses and #applications is absent", () => {
    expect(content.applications).toBeUndefined();
    // The shared section returns null when the fixture has no `applications` — no empty band,
    // and no `id="applications"` for the rail to have linked to.
    expect(renderHtml(<CategoryApplications {...eo()} />)).toBe("");
  });

  it("supplies no processImage, so the template's photo slot falls back to the labelled placeholder", () => {
    // ProcessMedia renders unconditionally (composition verified in the browser gate); with no
    // `processImage` it shows the deliberate 'Image placeholder' plate, same as Base Oils.
    expect(content.processImage).toBeUndefined();
    expect(getCategoryContent("base-oils")!.processImage).toBeUndefined();
  });
});

describe("Industrial Oils on v2 — a list range grouped by specification family", () => {
  const io = (locale = "en"): SectionProps => propsFor(locale, "industrial-oils-lubricants");
  const content = getCategoryContent("industrial-oils-lubricants")!;

  it("takes the list variant, not the classification table (no axes, no qualifier, no grades)", () => {
    const html = renderHtml(<Guidance {...io()} />);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("pcv2-cls-table");
    expect(html).toContain("pcv2-seg-list");
    expect(html).toContain("This is how the range is organised");
    expect(html).not.toContain("Classification, not availability");
  });

  it("groups the nine sub-ranges under their Fluids / Greases axis with a continuous ordinal", () => {
    const html = renderHtml(<Guidance {...io()} />);
    const text = textOf(html);
    // both specification families are labelled, from the fixture's own axis values
    expect(html).toContain("pcv2-seg-axis");
    expect(text).toContain("Fluids");
    expect(text).toContain("Greases");
    // every sub-range shown, anchored, in order — and the grease row keeps ordinal 09
    for (const subRange of content.range.subRanges) {
      expect(idsIn(html)).toContain(`range-${subRange.id}`);
      expect(text).toContain(subRange.designation);
    }
    expect(html).toContain('start="9"'); // the Greases group's <ol> continues the count
    expect(html).not.toContain("vehicle segment");
    expect(html).not.toContain("base-stock");
  });

  it("Engine Oils stays a single flat list — no axis label, ordinal starts at 1", () => {
    const html = renderHtml(<Guidance {...propsFor("en", "engine-oils-automotive-lubricants")} />);
    expect(html).not.toContain("pcv2-seg-axis");
    expect(html).toContain('start="1"');
  });

  it("the rail jump list points at #quality and labels the range 'The range'", () => {
    const rail = renderHtml(<CatalogRail {...io()} />);
    const own = hrefsIn(rail);
    expect(own).toContain("#quality");
    expect(own).not.toContain("#applications");
    expect(rail).toContain("The range");
    expect(rail).not.toContain("Classification");
  });

  it("has no Applications block and no processImage", () => {
    expect(content.applications).toBeUndefined();
    expect(content.processImage).toBeUndefined();
    expect(renderHtml(<CategoryApplications {...io()} />)).toBe("");
  });

  it("keeps its two published property groups (Fluids and Greases) intact", () => {
    const html = renderHtml(<CategoryProperties {...io()} />);
    expect(idsIn(html)).toContain("specifications");
    const text = textOf(html);
    expect(text).toContain("Fluids");
    expect(text).toContain("Greases");
  });
});

describe("CatalogMoreLink — the path to a multi-page catalogue", () => {
  async function render(
    result: ProductListResult,
    activeSegment: string | null = null,
  ): Promise<string> {
    const { CatalogMoreLink } = await import("./sections/v2/catalog-more-link");
    const element = await CatalogMoreLink({
      products: Promise.resolve(result),
      familySlug: "engine-oils-automotive-lubricants",
      locale: "en",
      activeSegment,
    });
    return element === null ? "" : renderHtml(element as ReactElement);
  }

  /** A page of `count` list items out of `total`, as the API would return for page 1. */
  function page(total: number, count = 20): ProductListResult {
    return {
      ok: true,
      total,
      page: 1,
      limit: 20,
      products: Array.from({ length: count }, (_, i) => product({ id: `p${i}`, slug: `p${i}` })),
    };
  }

  it("links to the Product Finder scoped to this family when more than one page exists", async () => {
    const html = await render(page(45));
    expect(html).toContain("See all 45 products in the Product Finder");
    expect(hrefsIn(html)).toContain(
      "/en/products/finder?category=engine-oils-automotive-lubricants",
    );
  });

  it("carries the active segment into the Finder URL, so the count and the destination filter alike", async () => {
    // 32 products matched this family+segment; the first page shows 20, so the link must appear
    // AND it must keep the segment — a link that dropped it would send the visitor to a
    // 45-product view while the "See all 32" beside it counted the filtered set.
    const html = await render(page(32), "passenger-cars");
    expect(html).toContain("See all 32 products in the Product Finder");
    expect(hrefsIn(html)).toContain(
      "/en/products/finder?category=engine-oils-automotive-lubricants&segment=passenger-cars",
    );
  });

  it("renders nothing when the whole (filtered) catalogue fits on one page", async () => {
    expect(await render(page(2, 2))).toBe("");
    expect(await render(page(15, 15), "passenger-cars")).toBe("");
  });

  it("renders nothing on an API failure", async () => {
    expect(await render({ ok: false, reason: "unreachable" })).toBe("");
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

describe("CategoryCatalogV2 — products first, no chip row, reset kept for a bookmarked ?segment=", () => {
  async function render(
    result: ProductListResult,
    activeSegment: string | null,
    familySlug = "base-oils",
  ): Promise<string> {
    const element = await CategoryCatalogV2({
      products: Promise.resolve(result),
      locale: "en",
      familySlug,
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
    expect(html).toContain("Showing every published product in this family.");
    expect(html).not.toContain("pl-filter"); // the shared 8-chip filter is not rendered
    expect(html).not.toMatch(/base[- ]oil products/i); // no family-specific wording
  });

  it("drops the 'showing every product' line when the list is only the API's first page", async () => {
    const html = await render(
      {
        ok: true,
        total: 45,
        page: 1,
        limit: 20,
        products: Array.from({ length: 20 }, (_, i) => product({ id: `p${i}`, slug: `p${i}` })),
      },
      null,
      "engine-oils-automotive-lubricants",
    );
    expect(html).not.toContain("Showing every published product");
    expect(html).toContain("first page only"); // the honest count still says so
    expect(html).not.toContain("pl-filter");
  });

  it("shows an active-filter notice and a reset for a bookmarked ?segment= URL", async () => {
    const html = await render(TWO_PRODUCTS, "marine");
    expect(html).toContain("Filtered by segment");
    expect(html).toContain("Marine");
    expect(hrefsIn(html)).toContain("/en/products/base-oils");
  });

  it("keeps the reset when a segment matches nothing — including on Engine Oils", async () => {
    const html = await render(
      { ok: true, total: 0, page: 1, limit: 20, products: [] },
      "passenger-cars",
      "engine-oils-automotive-lubricants",
    );
    expect(html).toContain("No products match this segment");
    expect(hrefsIn(html)).toContain("/en/products/engine-oils-automotive-lubricants");
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
