import { describe, expect, it } from "vitest";

import { familyColumns, familySections, familySpan, productCell } from "./family-matrix";

import type {
  ProductDetailResponse,
  ProductListItemResponse,
  ProductSpecificationResponse,
} from "@sam-group/types";

function spec(
  key: string,
  value: string,
  qualifier: string | null = null,
): ProductSpecificationResponse {
  return {
    id: `${key}-${value}`,
    key,
    value,
    unit: null,
    method: null,
    qualifier,
    resultBasis: "typical",
    valueType: null,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: null,
  };
}

function detail(
  slug: string,
  specifications: ProductSpecificationResponse[],
): ProductDetailResponse {
  return {
    id: slug,
    name: slug,
    slug,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    category: { id: "c", name: "Industrial", slug: "industrial", parentId: null },
    segments: [],
    productType: { name: "Industrial Oils", slug: "industrial-oils" },
    applicationGroup: null,
    grades: [],
    specifications,
    images: [],
    seo: {} as ProductDetailResponse["seo"],
  } as unknown as ProductDetailResponse;
}

function item(
  slug: string,
  group: ProductListItemResponse["applicationGroup"],
): ProductListItemResponse {
  return {
    id: slug,
    name: slug,
    slug,
    description: null,
    categoryId: "c",
    featuredImage: null,
    applicationGroup: group,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const compressor = detail("compressor", [
  spec("kv_40c", "31"),
  spec("kv_40c", "101"),
  spec("pour_point", "-18"),
  spec("pour_point", "-24"),
  spec("flash_point_coc", "214"),
  spec("flash_point_coc", "252"),
]);
const quench = detail("quench", [spec("kv_40c", "26"), spec("flash_point_oc", "190")]);
const grease = detail("grease", []);

describe("productCell", () => {
  it("shows the range across grades, the lowest pour point, and merges flash point methods", () => {
    expect(productCell(compressor, "kv_40c")).toBe("31–101");
    expect(productCell(compressor, "pour_point")).toBe("-24");
    expect(productCell(compressor, "flash_point")).toBe("214–252");
    expect(productCell(quench, "flash_point")).toBe("190");
    expect(productCell(grease, "kv_40c")).toBeNull();
  });

  it("ignores values measured under a condition", () => {
    expect(productCell(detail("x", [spec("kv_40c", "5", "After shear")]), "kv_40c")).toBeNull();
  });
});

describe("familyColumns", () => {
  it("chooses the properties most products publish, in importance order", () => {
    expect(familyColumns([compressor, quench, grease])).toEqual([
      "kv_40c",
      "pour_point",
      "flash_point",
    ]);
    expect(familyColumns([])).toEqual([]);
  });
});

describe("familySpan", () => {
  it("spans the whole family", () => {
    expect(familySpan([compressor, quench], "kv_40c")).toEqual({ low: "26", high: "101" });
    expect(familySpan([grease], "kv_40c")).toBeNull();
  });
});

describe("familySections", () => {
  it("groups by application group in the family's order, ungrouped products last", () => {
    const turbines = { slug: "turbines", name: "Turbines", sortOrder: 2 };
    const compressors = { slug: "compressors", name: "Compressors", sortOrder: 1 };
    const sections = familySections(
      [item("quench", null), item("t", turbines), item("compressor", compressors)],
      new Map([
        ["compressor", compressor],
        ["quench", quench],
      ]),
      ["kv_40c"],
    );
    expect(sections.map((section) => section.group?.slug ?? null)).toEqual([
      "compressors",
      "turbines",
      null,
    ]);
    expect(sections[0]?.rows[0]?.cells).toEqual(["31–101"]);
    expect(sections[1]?.rows[0]?.hasData).toBe(false);
  });
});
