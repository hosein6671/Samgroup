import { classifyUnit, normalizeValue } from "./value-normalization";

describe("normalizeValue", () => {
  it("reads a plain number as a POINT", () => {
    expect(normalizeValue("15.1")).toMatchObject({
      valueType: "POINT",
      numericMin: "15.1",
      numericMax: null,
    });
    expect(normalizeValue("-36")).toMatchObject({ valueType: "POINT", numericMin: "-36" });
  });

  it("reads a range, in both the tight and the spaced form the sources print", () => {
    expect(normalizeValue("900-933")).toMatchObject({
      valueType: "RANGE",
      numericMin: "900",
      numericMax: "933",
    });
    expect(normalizeValue("1050 -1100")).toMatchObject({
      valueType: "RANGE",
      numericMin: "1050",
      numericMax: "1100",
    });
  });

  it("reads minima and maxima in prefix and suffix form", () => {
    expect(normalizeValue("≥ 170")).toMatchObject({ valueType: "MINIMUM", numericMin: "170" });
    expect(normalizeValue("Min 170")).toMatchObject({ valueType: "MINIMUM", numericMin: "170" });
    expect(normalizeValue("0.45 min")).toMatchObject({ valueType: "MINIMUM", numericMin: "0.45" });
    expect(normalizeValue("≤0.2")).toMatchObject({ valueType: "MAXIMUM", numericMax: "0.2" });
  });

  it("reads `Report` as REPORT_ONLY rather than as text or as a missing value", () => {
    expect(normalizeValue("Report").valueType).toBe("REPORT_ONLY");
    expect(normalizeValue("report").valueType).toBe("REPORT_ONLY");
  });

  it("reads a copper-strip result as a CODE", () => {
    expect(normalizeValue("1a").valueType).toBe("CODE");
    expect(normalizeValue("4b").valueType).toBe("CODE");
  });

  it("reads a foaming tendency/stability reading as a coupled PAIR when the property says so", () => {
    expect(normalizeValue("5/0", { allowPair: true })).toMatchObject({
      valueType: "PAIR",
      pairFirst: "5",
      pairSecond: "0",
    });
    expect(normalizeValue("20/0", { allowPair: true })).toMatchObject({
      valueType: "PAIR",
      pairFirst: "20",
    });
  });

  it("reads prose as TEXT with no numerics", () => {
    const result = normalizeValue("Clear viscous liquid");
    expect(result.valueType).toBe("TEXT");
    expect(result.numericMin).toBeNull();
    expect(result.numericMax).toBeNull();
  });
});

describe("the HSB solidus-decimal hazard", () => {
  it("REFUSES to convert `23/6` and flags it instead", () => {
    const result = normalizeValue("23/6");
    expect(result.numericMin).toBeNull();
    expect(result.numericMax).toBeNull();
    expect(result.valueType).toBe("TEXT");
    expect(result.flags.map((flag) => flag.code)).toEqual(["SOURCE_SLASH_DECIMAL"]);
    expect(result.flags[0]?.severity).toBe("conflict");
  });

  it("does not read it as 23.6, as a fraction, or as a date", () => {
    const result = normalizeValue("23/6");
    expect(result.numericMin).not.toBe("23.6");
    expect(result.numericMin).not.toBe("3.8333333333333335");
  });

  it("refuses `23/2` and `5/1` the same way", () => {
    for (const value of ["23/2", "5/1"]) {
      expect(normalizeValue(value).flags[0]?.code).toBe("SOURCE_SLASH_DECIMAL");
    }
  });

  it("does NOT confuse a coupled pair with a solidus decimal", () => {
    // `5/0` and `10/0` are foaming readings the METHOD defines as a pair, not decimals — and
    // the two are indistinguishable by shape, which is why the property decides.
    for (const value of ["5/0", "10/0", "20/0"]) {
      expect(normalizeValue(value, { allowPair: true }).valueType).toBe("PAIR");
      expect(normalizeValue(value, { allowPair: true }).flags).toEqual([]);
    }
  });

  it("treats the same shape as a solidus-decimal defect when no pair is expected", () => {
    // The safe default: an unmapped or non-foaming property never turns `23/6` into a pair.
    expect(normalizeValue("5/0").valueType).toBe("TEXT");
    expect(normalizeValue("5/0").flags[0]?.code).toBe("SOURCE_SLASH_DECIMAL");
  });
});

describe("an inverted range", () => {
  it("is refused rather than silently swapped", () => {
    const result = normalizeValue("933-900");
    expect(result.numericMin).toBeNull();
    expect(result.flags.map((flag) => flag.code)).toEqual(["SOURCE_RANGE_INVERTED"]);
  });
});

describe("classifyUnit", () => {
  it("says STATED when the source gives a unit the property allows", () => {
    expect(classifyUnit("cSt", ["cSt", "mm²/s"])).toBe("STATED");
  });

  it("says DIMENSIONLESS only when the dictionary says the property has no unit", () => {
    expect(classifyUnit("", [])).toBe("DIMENSIONLESS");
  });

  it("says ABSENT — not DIMENSIONLESS — when a unit-bearing property has an empty cell", () => {
    // This is the whole `Specific Gravity` finding: a genuinely blank cell is a fact about
    // the source, and calling it dimensionless would erase it.
    expect(classifyUnit("", ["g/cm³", "kg/m³"])).toBe("ABSENT");
  });

  it("says UNRECOGNIZED when the source gives a unit the property does not allow", () => {
    expect(classifyUnit("HCL", [])).toBe("UNRECOGNIZED");
    expect(classifyUnit("minutes", ["°C"])).toBe("UNRECOGNIZED");
  });

  it("accepts all three printed spellings of degrees Celsius", () => {
    const allowed = ["°C", "º" + "C", "℃"];
    for (const unit of allowed) expect(classifyUnit(unit, allowed)).toBe("STATED");
  });

  it("never converts between g/cm³ and kg/m³", () => {
    // Both are allowed for density_15c and they differ by 1000. Accepting both is not the
    // same as reconciling them; the printed unit is what is stored.
    expect(classifyUnit("g/cm³", ["g/cm³", "kg/m³"])).toBe("STATED");
    expect(classifyUnit("kg/m³", ["g/cm³", "kg/m³"])).toBe("STATED");
  });
});
