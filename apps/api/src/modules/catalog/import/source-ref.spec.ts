import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import {
  isSourceRef,
  normalizeNameForMatching,
  proposeSourceRef,
  WORKBOOK_LINEAGE,
} from "./source-ref";

describe("proposeSourceRef", () => {
  it("is deterministic: the same row always yields the same PROPOSAL", () => {
    expect(proposeSourceRef(3)).toBe("SAMCAT-W1-R003");
    expect(proposeSourceRef(3)).toBe(proposeSourceRef(3));
    expect(proposeSourceRef(300)).toBe("SAMCAT-W1-R300");
  });

  it("mints a distinct proposal for every one of the 100 rows", () => {
    const refs = WORKBOOK_FIXTURE.rows.map((product) => proposeSourceRef(product.rowNumber));
    expect(new Set(refs).size).toBe(100);
    expect(refs.every(isSourceRef)).toBe(true);
  });

  it("names the workbook LINEAGE, not a particular file", () => {
    // Re-saving the workbook changes its bytes and its SHA-256 but not which workbook it is.
    // A hash in the identity would re-mint all 100 proposals on every save.
    expect(proposeSourceRef(3, WORKBOOK_LINEAGE)).not.toContain("922c689d");
    expect(proposeSourceRef(3, "W2")).toBe("SAMCAT-W2-R003");
  });

  it("refuses a row number that is not a positive integer", () => {
    expect(() => proposeSourceRef(0)).toThrow();
    expect(() => proposeSourceRef(-1)).toThrow();
    expect(() => proposeSourceRef(1.5)).toThrow();
  });
});

describe("normalizeNameForMatching", () => {
  it("is a matching aid only, and folds the compatibility characters the sources use", () => {
    expect(normalizeNameForMatching("SN , SM , SL , SJ , SF…SC Engine oil additive")).toBe(
      "sn sm sl sj sf sc engine oil additive",
    );
    expect(normalizeNameForMatching("CK-4  10W-40")).toBe("ck 4 10w 40");
  });

  it("keeps the two duplicate-name pairs indistinguishable, which is why it is not identity", () => {
    expect(normalizeNameForMatching("SN Grade")).toBe(normalizeNameForMatching("SN Grade"));
  });
});
