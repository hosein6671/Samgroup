import {
  classifyGradeSystem,
  decideGrades,
  isEntangledGradeLabel,
  isResultBasisHeader,
  offSeriesIsoVgNumber,
  REJECTED_GRADE_LABELS,
} from "./grade-classification";

import type { RawGrade } from "./catalog-import.types";

const grades = (...labels: string[]): RawGrade[] =>
  labels.map((label, sortOrder) => ({ label, sortOrder }));

describe("a result basis is not a grade", () => {
  it("recognises the King Power single-column header", () => {
    expect(isResultBasisHeader("Average Results")).toBe(true);
    expect(isResultBasisHeader("average results")).toBe(true);
    expect(isResultBasisHeader("Typical Values")).toBe(true);
    expect(isResultBasisHeader("ISO VG 32")).toBe(false);
  });

  it("creates NO grade for it, and says why", () => {
    const decisions = decideGrades(3, grades("Average Results"));
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.accepted).toBe(false);
    expect(decisions[0]?.flags[0]?.code).toBe("GRADE_REJECTED_RESULT_BASIS");
  });
});

describe("labels rejected because they are not a variant", () => {
  it("rejects `Quenching`, which only restates the product name", () => {
    expect(REJECTED_GRADE_LABELS.get(153)?.has("Quenching")).toBe(true);
    const decisions = decideGrades(153, grades("Quenching"));
    expect(decisions[0]?.accepted).toBe(false);
    expect(decisions[0]?.flags[0]?.code).toBe("GRADE_REJECTED_NOT_A_VARIANT");
  });

  it("rejects `TC`, which is a performance classification", () => {
    expect(REJECTED_GRADE_LABELS.get(219)?.has("TC")).toBe(true);
    const decisions = decideGrades(219, grades("TC"));
    expect(decisions[0]?.accepted).toBe(false);
    expect(decisions[0]?.flags[0]?.detail).toContain("CLASSIFICATION_STATED");
  });

  it("rejects them only under the rows where the evidence says so", () => {
    // The same string could legitimately be a grade elsewhere, so the rejection is keyed
    // to the row, not applied globally.
    const elsewhere = decideGrades(999, grades("Quenching"));
    expect(elsewhere[0]?.accepted).toBe(true);
  });
});

describe("no synthetic grade is ever created", () => {
  it("gives a product with no source grades no grades at all", () => {
    expect(decideGrades(249, [])).toEqual([]);
  });

  it("does not pad a single-grade product, nor invent one for uniformity", () => {
    const decisions = decideGrades(96, grades("10W40"));
    expect(decisions.filter((decision) => decision.accepted)).toHaveLength(1);
  });
});

describe("classifyGradeSystem", () => {
  it("recognises SAE viscosity grades", () => {
    for (const label of ["10W-40", "10W40", "5W60", "SAE 40", "SAE 15w-40", "40", "50"]) {
      expect(classifyGradeSystem(label)).toBe("SAE");
    }
  });

  it("recognises a performance class bolted onto an SAE grade as SAE", () => {
    for (const label of ["SM/CF 10W40", "SG/CD 20W50", "SF/CC 40", "CJ4 15W40", "SN 0W20"]) {
      expect(classifyGradeSystem(label)).toBe("SAE");
    }
  });

  it("recognises ISO VG and NLGI", () => {
    expect(classifyGradeSystem("ISO VG 320")).toBe("ISO_VG");
    expect(classifyGradeSystem("NLGI 2")).toBe("NLGI");
  });

  it("returns NULL for a product-specific designation rather than forcing one", () => {
    for (const label of ["ATF-3", "HSB-T-32 Plus", "HL 22", "VB- 22", "KD-32", "Iso-68"]) {
      expect(classifyGradeSystem(label)).toBeNull();
    }
  });

  it("flags a NULL classification for review instead of hiding it", () => {
    const decisions = decideGrades(234, grades("ATF-3"));
    expect(decisions[0]?.gradeSystem).toBeNull();
    expect(decisions[0]?.flags.map((flag) => flag.code)).toContain("GRADE_SYSTEM_UNCLASSIFIED");
  });
});

describe("entangled labels", () => {
  it("detects a performance class and a viscosity grade packed into one string", () => {
    expect(isEntangledGradeLabel("SM/CF 10W40")).toBe(true);
    expect(isEntangledGradeLabel("SF/CC 40")).toBe(true);
    expect(isEntangledGradeLabel("10W40")).toBe(false);
  });

  it("stores the label VERBATIM and flags it rather than splitting it", () => {
    const decisions = decideGrades(72, grades("SM/CF 10W40"));
    expect(decisions[0]?.label).toBe("SM/CF 10W40");
    expect(decisions[0]?.flags.map((flag) => flag.code)).toContain("GRADE_LABEL_ENTANGLED");
  });
});

describe("off-series ISO VG grades", () => {
  it("flags ISO VG numbers that are not in the ISO 3448 series", () => {
    expect(offSeriesIsoVgNumber("ISO VG 11")).toBe(11);
    expect(offSeriesIsoVgNumber("ISO VG 12")).toBe(12);
    expect(offSeriesIsoVgNumber("ISO VG 34")).toBe(34);
    expect(offSeriesIsoVgNumber("ISO VG 15")).toBeNull();
    expect(offSeriesIsoVgNumber("ISO VG 1000")).toBeNull();
  });

  it("keeps the label verbatim while reporting it", () => {
    const decisions = decideGrades(135, grades("ISO VG 11"));
    expect(decisions[0]?.accepted).toBe(true);
    expect(decisions[0]?.label).toBe("ISO VG 11");
    expect(decisions[0]?.flags.map((flag) => flag.code)).toContain("GRADE_ISO_VG_OFF_SERIES");
  });
});

describe("duplicate grade labels", () => {
  it("are refused rather than silently de-duplicated", () => {
    const decisions = decideGrades(102, grades("ISO VG 100", "ISO VG 100"));
    expect(decisions[0]?.accepted).toBe(true);
    expect(decisions[1]?.accepted).toBe(false);
    expect(decisions[1]?.flags[0]?.code).toBe("GRADE_DUPLICATE_LABEL");
    expect(decisions[1]?.flags[0]?.severity).toBe("conflict");
  });
});

describe("sort order", () => {
  it("preserves the source's own presentation order", () => {
    const decisions = decideGrades(102, grades("ISO VG 68", "ISO VG 100", "ISO VG 150"));
    expect(decisions.map((decision) => decision.label)).toEqual([
      "ISO VG 68",
      "ISO VG 100",
      "ISO VG 150",
    ]);
  });
});
