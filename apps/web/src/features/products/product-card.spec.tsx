import { describe, expect, it } from "vitest";

import { hrefsIn, renderHtml } from "@test/rendered-links";

import { ProductCard } from "./product-card";

import type { ProductListItemResponse } from "@sam-group/types";

/**
 * The card's contract after the reserved-media-area change.
 *
 * The area holds a DECORATIVE glyph and nothing else today — `GET /products` carries no image
 * field, so there is nothing real to put there. These assertions pin the two things that keep it
 * honest: it is `aria-hidden` (never announced as a picture of the product), and it is a family
 * glyph only where the caller passed a family, the neutral catalogue glyph otherwise. The rest
 * guard the fields that must survive untouched — name, description and the canonical link.
 */

function product(overrides: Partial<ProductListItemResponse> = {}): ProductListItemResponse {
  return {
    id: "p1",
    name: "SAM Demo Engine Oil 5W-30",
    slug: "sam-demo-engine-oil-5w-30",
    description: "DEMO / PLACEHOLDER CONTENT — a seeded row, not an approved product.",
    categoryId: "cat-1",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProductCard — the reserved media area", () => {
  it("renders one decorative, aria-hidden media area before the name", () => {
    const html = renderHtml(
      <ProductCard
        product={product()}
        locale="en"
        familySlug="engine-oils-automotive-lubricants"
      />,
    );
    // exactly one media element, and it is hidden from assistive tech
    expect(html.match(/pl-card-media/g)).toHaveLength(1);
    expect(html).toMatch(/<span class="pl-card-media" aria-hidden="true">/);
    // it precedes the product name in document order
    expect(html.indexOf("pl-card-media")).toBeLessThan(html.indexOf("pl-card-name"));
    // it carries a glyph, not an <img> and no caption/alt text
    expect(html).toContain("<svg");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/alt=/);
  });

  it("uses the family's own glyph when the caller knows the family", () => {
    const html = renderHtml(
      <ProductCard
        product={product()}
        locale="en"
        familySlug="engine-oils-automotive-lubricants"
      />,
    );
    // AutomotiveIcon → lucide Car
    expect(html).toContain("lucide-car");
    expect(html).not.toContain("lucide-boxes");
  });

  it("falls back to the neutral catalogue glyph when no family is given", () => {
    const html = renderHtml(<ProductCard product={product()} locale="en" />);
    // CatalogueIcon → lucide Boxes
    expect(html).toContain("lucide-boxes");
  });

  it("falls back to the neutral catalogue glyph for a slug that is not one of the six", () => {
    const html = renderHtml(
      <ProductCard product={product()} locale="en" familySlug="not-a-family" />,
    );
    expect(html).toContain("lucide-boxes");
  });

  it("leaves name, description and the canonical link exactly as before", () => {
    const html = renderHtml(<ProductCard product={product()} locale="fa" familySlug="base-oils" />);
    expect(html).toContain("SAM Demo Engine Oil 5W-30");
    expect(html).toContain("DEMO / PLACEHOLDER CONTENT");
    expect(hrefsIn(html)).toEqual(["/fa/products/sam-demo-engine-oil-5w-30"]);
    // the name is still the link's accessible text, not the media area
    expect(html).toMatch(
      /<a class="pl-card-link" href="\/fa\/products\/sam-demo-engine-oil-5w-30">SAM Demo Engine Oil 5W-30<\/a>/,
    );
  });

  it("still omits the summary when the row has no description", () => {
    const html = renderHtml(
      <ProductCard product={product({ description: null })} locale="en" familySlug="base-oils" />,
    );
    expect(html).not.toContain("pl-card-summary");
    // the media area and name are unaffected
    expect(html).toContain("pl-card-media");
    expect(html).toContain("pl-card-name");
  });
});
