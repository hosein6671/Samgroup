import { describe, expect, it } from "vitest";

import { gradeSlug, resolveActiveGrade, specificationsForGrade } from "./grade-selection";

import type { ProductGradeSummaryResponse, ProductSpecificationResponse } from "@sam-group/types";

const SN150: ProductGradeSummaryResponse = {
  id: "grade-1",
  label: "SN 150",
  gradeSystem: null,
  hasApprovedData: true,
};
const SN350: ProductGradeSummaryResponse = {
  id: "grade-2",
  label: "SN 350",
  gradeSystem: null,
  hasApprovedData: false,
};
const GRADES = [SN150, SN350];

function spec(overrides: Partial<ProductSpecificationResponse>): ProductSpecificationResponse {
  return {
    id: "spec-x",
    key: "Kinematic viscosity",
    value: "1",
    unit: null,
    method: null,
    qualifier: null,
    resultBasis: "unspecified",
    valueType: null,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: null,
    ...overrides,
  };
}

describe("gradeSlug", () => {
  it("lowercases and hyphenates a label", () => {
    expect(gradeSlug("SN 150")).toBe("sn-150");
  });

  it("strips characters that are not letters or numbers, and trims leading/trailing hyphens", () => {
    expect(gradeSlug(" Bright Stock (BS 150) ")).toBe("bright-stock-bs-150");
  });
});

describe("resolveActiveGrade", () => {
  it("resolves the grade whose slug matches the request", () => {
    expect(resolveActiveGrade(GRADES, "sn-350")).toBe(SN350);
  });

  it("defaults to the first published grade when no parameter is given", () => {
    expect(resolveActiveGrade(GRADES, null)).toBe(SN150);
  });

  it("defaults to the first published grade — never another grade's data — when the parameter matches nothing", () => {
    expect(resolveActiveGrade(GRADES, "does-not-exist")).toBe(SN150);
  });

  it("returns null for a leaf product with no grades", () => {
    expect(resolveActiveGrade([], "anything")).toBeNull();
  });
});

describe("specificationsForGrade", () => {
  const productLevel = spec({ id: "p-1", grade: null });
  const sn150Spec = spec({ id: "g-1", grade: { label: "SN 150", gradeSystem: null } });
  const sn350Spec = spec({ id: "g-2", grade: { label: "SN 350", gradeSystem: null } });
  const all = [productLevel, sn150Spec, sn350Spec];

  it("keeps Product-level rows and only the active grade's own rows", () => {
    expect(specificationsForGrade(all, SN150)).toEqual([productLevel, sn150Spec]);
  });

  it("never substitutes another grade's rows when the active grade has none", () => {
    const noSn350Data = [productLevel, sn150Spec];
    expect(specificationsForGrade(noSn350Data, SN350)).toEqual([productLevel]);
  });

  it("returns every row unfiltered for a leaf product (activeGrade null)", () => {
    expect(specificationsForGrade(all, null)).toEqual(all);
  });
});
