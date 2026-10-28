import { describe, expect, it } from "vitest";

import { buildSpecMatrix, keyMetrics } from "./spec-matrix";

import type { ProductGradeSummaryResponse, ProductSpecificationResponse } from "@sam-group/types";

function spec(
  key: string,
  value: string,
  grade: string | null,
  extra: Partial<ProductSpecificationResponse> = {},
): ProductSpecificationResponse {
  return {
    id: `${key}-${grade ?? "p"}-${value}`,
    key,
    value,
    unit: key === "viscosity_index" ? null : "°C",
    method: "ASTM D97",
    qualifier: null,
    resultBasis: "typical",
    valueType: null,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: grade === null ? null : { label: grade, gradeSystem: null },
    ...extra,
  };
}

const grades: ProductGradeSummaryResponse[] = ["T-32", "T-46"].map((label) => ({
  id: label,
  label,
  gradeSystem: null,
  hasApprovedData: true,
}));

describe("buildSpecMatrix", () => {
  it("pivots one row per property with a column per grade, priority properties first", () => {
    const matrix = buildSpecMatrix(
      [
        spec("tan", "0.1", "T-32"),
        spec("pour_point", "-18", "T-32"),
        spec("pour_point", "-15", "T-46"),
        spec("viscosity_index", "100", "T-46"),
      ],
      grades,
    );
    expect(matrix.columns).toEqual(["T-32", "T-46"]);
    expect(matrix.rows.map((row) => row.key)).toEqual(["viscosity_index", "pour_point", "tan"]);
    const pour = matrix.rows[1];
    expect(pour?.unit).toBe("°C");
    expect([...(pour?.cells ?? [])]).toEqual([
      ["T-32", "-18"],
      ["T-46", "-15"],
    ]);
  });

  it("uses one unnamed column for a product without grades, and keeps conditions apart", () => {
    const matrix = buildSpecMatrix(
      [spec("kv_100c", "13.5", null), spec("kv_100c", "12.9", null, { qualifier: "After shear" })],
      [],
    );
    expect(matrix.columns).toEqual([""]);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]?.cells.get("")).toBe("13.5");
  });
});

describe("keyMetrics", () => {
  it("returns the active grade's headline values with its place in the product's range", () => {
    const matrix = buildSpecMatrix(
      [
        spec("pour_point", "-18", "T-32"),
        spec("pour_point", "-12", "T-46"),
        spec("flash_point_oc", "210", "T-32"),
        spec("flash_point_coc", "212", "T-32"),
        spec("tan", "0.1", "T-32"),
      ],
      grades,
    );
    const metrics = keyMetrics(matrix, "T-32");
    expect(metrics.map((metric) => metric.key)).toEqual(["pour_point", "flash_point_coc"]);
    expect(metrics[0]).toMatchObject({ value: "-18", position: 0 });
    expect(metrics[1]?.position).toBeNull();
  });
});
