import { describe, it, expect } from "vitest";
import { structuralSection, structuralList, structuralEditorDefaults } from "./structural-copy";
import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
describe("structural editorial content", () => {
  it("retains approved fallback copy and applies edited text", () => {
    expect(structuralSection("header", "brand").text("name")).toBe("SAM GROUP");
    expect(
      structuralSection("header", "brand", { brand: { name: "Edited brand" } }).text("name"),
    ).toBe("Edited brand");
  });
  it("seeds nested empty CMS groups without creating documents", () => {
    const value = structuralEditorDefaults("header", { brand: { name: null }, lists: null });
    expect(value.brand).toEqual(STRUCTURAL_DEFAULTS.header.brand);
    expect(value.lists).toHaveProperty("navigation");
  });
  it("allows editorial reorder/removal while retaining original links and icons", () => {
    const rows = [
      { label: "A", href: "/a", icon: "a" },
      { label: "B", href: "/b", icon: "b" },
    ];
    expect(
      structuralList(
        { lists: { navigation: [{ source: "1", label: "Updated" }] } },
        "navigation",
        rows,
      ),
    ).toEqual([{ label: "Updated", href: "/b", icon: "b" }]);
    expect(structuralList({ lists: { navigation: [] } }, "navigation", rows)).toEqual([]);
    expect(structuralList({}, "navigation", rows)).toEqual(rows);
  });
  it("maps editable tuple content without mutating fixtures", () => {
    const rows = [["Original", "Detail"]] as const;
    expect(
      structuralList(
        { lists: { packaging: [{ source: "0", title: "Updated", description: "New detail" }] } },
        "packaging",
        rows,
      ),
    ).toEqual([["Updated", "New detail"]]);
    expect(rows[0][0]).toBe("Original");
  });
});

it("refuses to change route and icon fields even if a malformed row reaches the browser", () => {
  const rows = [{ label: "A", href: "/a", icon: "a" }];
  expect(
    structuralList(
      {
        lists: {
          navigation: [{ source: "0", label: "B", href: "javascript:alert(1)", icon: "bad" }],
        },
      },
      "navigation",
      rows,
    ),
  ).toEqual([{ label: "B", href: "/a", icon: "a" }]);
});

it("distinguishes never-saved empty CMS arrays from an intentional saved removal", () => {
  const empty = { lists: { navigation: [] } };
  expect(
    (structuralEditorDefaults("header", empty, false).lists as { navigation: unknown[] }).navigation
      .length,
  ).toBe(6);
  expect(
    (structuralEditorDefaults("header", empty, true).lists as { navigation: unknown[] }).navigation,
  ).toEqual([]);
});
