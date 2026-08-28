import { describe, expect, it } from "vitest";

import { getProductDetailEditorial } from "./product-detail-content";

const FAMILY_SLUGS = [
  "lubricant-additives",
  "engine-oils-automotive-lubricants",
  "industrial-oils-lubricants",
  "marine-oils-lubricants",
  "antifreeze-coolants",
] as const;

describe("product detail editorial registry", () => {
  it.each(FAMILY_SLUGS)("provides a complete, labelled buyer guide for %s", (familySlug) => {
    const editorial = getProductDetailEditorial(familySlug);

    expect(editorial.image.src).toMatch(/^\/images\/.+\.webp$/u);
    expect(editorial.image.alt.length).toBeGreaterThan(20);
    expect(editorial.image.caption).toContain("not product packaging");
    expect(editorial.selection.heading.length).toBeGreaterThan(20);
    expect(editorial.selection.introduction.length).toBeGreaterThan(80);
    expect(editorial.selection.criteria).toHaveLength(4);
    expect(editorial.selection.criteria.every((criterion) => criterion.detail.length > 20)).toBe(
      true,
    );
  });

  it("uses the industrial guide as a safe fallback for an unknown family", () => {
    expect(getProductDetailEditorial("unknown-family")).toBe(
      getProductDetailEditorial("industrial-oils-lubricants"),
    );
  });
});
