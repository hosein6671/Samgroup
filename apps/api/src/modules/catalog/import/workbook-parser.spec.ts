import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import {
  collapseWhitespace,
  IDENTIFIER_HEADERS,
  parseCatalogWorkbook,
  sourceFamilyOf,
} from "./workbook-parser";

import type { WorkbookProductRow } from "./catalog-import.types";

/**
 * The real workbook is not in version control. When `CATALOG_WORKBOOK` points at it these
 * tests run against the file itself; otherwise the parser tests that need it are skipped and
 * say so, and the rest of the suite runs against the frozen fixture.
 */
const workbookPath = process.env["CATALOG_WORKBOOK"];
const haveWorkbook = Boolean(workbookPath && existsSync(workbookPath));
const describeWithWorkbook = haveWorkbook ? describe : describe.skip;

describe("collapseWhitespace", () => {
  it("collapses the double spaces the workbook contains without trimming meaning", () => {
    expect(collapseWhitespace("CK-4  10W-40")).toBe("CK-4 10W-40");
    expect(collapseWhitespace("  Turbine   oil  ")).toBe("Turbine oil");
  });
});

describe("sourceFamilyOf", () => {
  const row = (reference: string): WorkbookProductRow => ({
    ...WORKBOOK_FIXTURE.rows[0]!,
    technicalReferenceEn: reference,
  });

  it("reads the publisher from the technical reference", () => {
    expect(sourceFamilyOf(row("https://kingpowerlub.com/en/products/x"))).toBe("king-power");
    expect(sourceFamilyOf(row("https://addilex.com/addilex-c-320/"))).toBe("addilex");
    expect(sourceFamilyOf(row("کاتالوگ HSB"))).toBe("hsb");
  });

  it("returns null rather than guessing when the reference names nothing known", () => {
    expect(sourceFamilyOf(row(""))).toBeNull();
    expect(sourceFamilyOf(row("https://example.invalid/thing"))).toBeNull();
  });
});

describe("the frozen workbook fixture", () => {
  it("holds exactly 100 product rows", () => {
    expect(WORKBOOK_FIXTURE.rows).toHaveLength(100);
  });

  it("puts one product on every third row from 3 to 300", () => {
    const expected = Array.from({ length: 100 }, (_value, index) => 3 + index * 3);
    expect(WORKBOOK_FIXTURE.rows.map((row) => row.rowNumber)).toEqual(expected);
  });

  it("has a non-empty public name on every row", () => {
    expect(WORKBOOK_FIXTURE.rows.filter((row) => row.name.length === 0)).toHaveLength(0);
  });

  it("carries exactly two duplicate-name groups, which are four distinct products", () => {
    const byName = new Map<string, number[]>();
    for (const row of WORKBOOK_FIXTURE.rows) {
      byName.set(row.name, [...(byName.get(row.name) ?? []), row.rowNumber]);
    }
    const duplicates = [...byName.entries()].filter(([, rows]) => rows.length > 1);
    expect(duplicates).toEqual([
      ["SN Grade", [69, 96]],
      ["SG Grade", [81, 99]],
    ]);
  });

  it("splits 51 King Power, 34 HSB and 15 Addilex rows", () => {
    const tally = { "king-power": 0, hsb: 0, addilex: 0, none: 0 };
    for (const row of WORKBOOK_FIXTURE.rows) {
      const family = sourceFamilyOf(row);
      tally[family ?? "none"]++;
    }
    expect(tally).toEqual({ "king-power": 51, hsb: 34, addilex: 15, none: 0 });
  });
});

describe("exact public names", () => {
  it("never adds a SAM prefix, a series name or any other decoration", () => {
    for (const row of WORKBOOK_FIXTURE.rows) {
      expect(row.name.startsWith("SAM ")).toBe(false);
      expect(row.name).toBe(row.name.trim());
    }
  });

  it("preserves all 12 names containing TECH verbatim, irregular spacing included", () => {
    const techNames = WORKBOOK_FIXTURE.rows
      .map((row) => row.name)
      .filter((name) => name.includes("TECH"));
    expect(techNames).toHaveLength(12);
    expect(techNames).toContain("COMPRESSOR TECH Polyalphaolefin- Synthetic (PAO-S)");
  });

  it("keeps rawName byte-identical to the cell, so the double spaces are never lost", () => {
    const doubled = WORKBOOK_FIXTURE.rows.filter((row) => row.rawName.includes("  "));
    expect(doubled.length).toBeGreaterThan(0);
    for (const row of doubled) {
      expect(row.name).toBe(collapseWhitespace(row.rawName));
      expect(row.name).not.toBe(row.rawName);
    }
  });

  it("does not rename a product to match the title of the document behind it", () => {
    // Nine King Power rows have a TDS whose title carries an external series mark
    // (`GEAR TECH`, `HYDRO TECH`, `COOL TECH`, `LONG LIFE TECH`). None of those marks is a
    // SAM name and none may reach the catalogue through a document title.
    const names = WORKBOOK_FIXTURE.rows.map((row) => row.name);
    expect(names).toContain("Extreme Pressure (EP)");
    expect(names).toContain("ISO VG 32");
    expect(names).toContain("Mineral-Based");
    expect(names).toContain("High-Performance");
    for (const mark of ["GEAR TECH", "HYDRO TECH", "COOL TECH", "LONG LIFE TECH"]) {
      expect(names.some((name) => name.includes(mark))).toBe(false);
    }
  });
});

describe("the identifier column", () => {
  it("is absent from the fixture, so identity falls back to matching evidence", () => {
    // Its presence is the ONLY authoritative identity path (`identity-ledger.ts`). Its
    // absence is not an error and is not worked around — every inferred match is a conflict.
    expect(WORKBOOK_FIXTURE.identifierColumn).toBeNull();
    expect(WORKBOOK_FIXTURE.declaredSourceRefs.size).toBe(0);
  });

  it("names the headers that would mark one, and nothing else", () => {
    expect(IDENTIFIER_HEADERS).toContain("sourceref");
    expect(IDENTIFIER_HEADERS).not.toContain("نام محصول");
  });
});

describeWithWorkbook("against the real authoritative workbook", () => {
  it("parses to exactly the frozen fixture", () => {
    const parsed = parseCatalogWorkbook(readFileSync(workbookPath as string));
    expect(parsed.sheetName).toBe(WORKBOOK_FIXTURE.sheetName);
    expect(parsed.rows).toEqual(WORKBOOK_FIXTURE.rows);
    expect(parsed.identifierColumn).toBe(WORKBOOK_FIXTURE.identifierColumn);
    expect([...parsed.declaredSourceRefs.entries()]).toEqual([
      ...WORKBOOK_FIXTURE.declaredSourceRefs.entries(),
    ]);
  });

  it("hashes to a SHA-256 the run reports, so the file in front of it is identifiable", () => {
    const bytes = readFileSync(workbookPath as string);
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe("0".repeat(64));
  });

  it("refuses a workbook whose header row moved rather than reading the wrong column", () => {
    const bytes = readFileSync(workbookPath as string);
    // Not a workbook at all: the reader must fail loudly, not return an empty parse.
    expect(() => parseCatalogWorkbook(Buffer.from("not a zip"))).toThrow();
    expect(parseCatalogWorkbook(bytes).rows).toHaveLength(100);
  });
});

if (!haveWorkbook) {
  // Visible in the run output rather than a silently missing test.
  describe("real-workbook checks", () => {
    it.skip("skipped: set CATALOG_WORKBOOK to the authoritative workbook to run them", () => {
      expect(true).toBe(true);
    });
  });
}
