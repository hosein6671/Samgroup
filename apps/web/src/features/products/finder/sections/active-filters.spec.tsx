import { describe, expect, it } from "vitest";
import { hrefsIn, renderHtml } from "@test/rendered-links";
import { ActiveFilters } from "./active-filters";
import { NO_FILTERS } from "../finder-query";

describe("active filter removal", () => {
  it("removes one axis, preserves search and other axes, and resets pagination in RTL routes", () => {
    const html = renderHtml(
      <ActiveFilters
        locale="fa"
        query={{
          category: "base-oils",
          segment: "marine",
          productType: "gear-oils",
          q: "SN 150",
          page: 3,
        }}
      />,
    );
    const links = hrefsIn(html).map((href) => new URL(href, "https://example.test"));
    expect(links).toHaveLength(4);
    for (const key of ["category", "segment", "productType", "q"]) {
      const link = links.find((url) => !url.searchParams.has(key))!;
      expect(link.pathname).toBe("/fa/products/finder");
      expect(link.searchParams.has("page")).toBe(false);
      expect([...link.searchParams.keys()]).toHaveLength(3);
    }
  });
  it("omits the navigation when no selection exists", () => {
    expect(renderHtml(<ActiveFilters locale="en" query={NO_FILTERS} />)).toBe("");
  });
});
