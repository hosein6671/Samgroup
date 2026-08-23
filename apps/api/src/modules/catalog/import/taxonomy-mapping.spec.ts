import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import {
  GEAR_FAMILY_CONFLICT_ROWS,
  mapTaxonomy,
  PRODUCT_FAMILY_KEYS,
  PROPOSED_PRODUCT_TYPE_KEYS,
  RATIFIED_MARINE_GEAR_DECISIONS,
} from "./taxonomy-mapping";

const mapped = WORKBOOK_FIXTURE.rows.map((row) => ({ row, taxonomy: mapTaxonomy(row) }));
const byRow = new Map(mapped.map((item) => [item.row.rowNumber, item.taxonomy]));

describe("the frozen Product Family set", () => {
  it("is exactly the six approved keys and gains none", () => {
    expect([...PRODUCT_FAMILY_KEYS]).toEqual([
      "base-oils",
      "lubricant-additives",
      "engine-oils-automotive-lubricants",
      "industrial-oils-lubricants",
      "marine-oils-lubricants",
      "antifreeze-coolants",
    ]);
  });

  it("never proposes a family outside that set", () => {
    for (const { taxonomy } of mapped) {
      if (taxonomy.productFamilyKey === null) continue;
      expect(PRODUCT_FAMILY_KEYS).toContain(taxonomy.productFamilyKey);
    }
  });

  it("leaves Base Oils with ZERO imported products", () => {
    const baseOils = mapped.filter((item) => item.taxonomy.productFamilyKey === "base-oils");
    expect(baseOils).toHaveLength(0);
  });
});

describe("ProductType proposals", () => {
  it("uses only the eight approved keys", () => {
    for (const { taxonomy } of mapped) {
      if (taxonomy.productTypeKey === null) continue;
      expect(PROPOSED_PRODUCT_TYPE_KEYS).toContain(taxonomy.productTypeKey);
    }
  });

  it("has no `others` ProductType", () => {
    expect(PROPOSED_PRODUCT_TYPE_KEYS as readonly string[]).not.toContain("others");
    for (const { taxonomy } of mapped) {
      expect(taxonomy.productTypeKey).not.toBe("others");
    }
  });

  it("assigns a ProductType to all 100 rows", () => {
    const missing = mapped.filter((item) => item.taxonomy.productTypeKey === null);
    expect(missing).toHaveLength(0);
  });

  it("maps each workbook category block to the expected type", () => {
    const expected: Record<string, string> = {
      "روغن موتور Engine oil": "engine-oils",
      "روغن های صنعتی Industrial Oils": "industrial-oils",
      "روغن های سیستم هیدرولیک Hydraulic oils": "hydraulic-oils",
      "افرودنی ها Additives": "lubricant-additives",
    };
    for (const { row, taxonomy } of mapped) {
      const want = expected[row.categoryLabel];
      if (want) expect(taxonomy.productTypeKey).toBe(want);
    }
  });
});

describe("Others decomposition", () => {
  it("decomposes the three Others rows on row-level evidence, never into an Others type", () => {
    // 294 and 297 are ضد یخ (antifreeze); 300 is گریس (grease).
    expect(byRow.get(294)).toMatchObject({
      productTypeKey: "antifreeze-coolants",
      productFamilyKey: "antifreeze-coolants",
      conflict: null,
    });
    expect(byRow.get(297)).toMatchObject({
      productTypeKey: "antifreeze-coolants",
      productFamilyKey: "antifreeze-coolants",
      conflict: null,
    });
    expect(byRow.get(300)).toMatchObject({
      productTypeKey: "greases",
      productFamilyKey: "industrial-oils-lubricants",
      conflict: null,
    });
  });

  it("conflicts rather than guessing when an Others row is neither", () => {
    const row = { ...WORKBOOK_FIXTURE.rows[97]!, productTypeLabel: "چیز دیگر" };
    const taxonomy = mapTaxonomy(row);
    expect(taxonomy.productFamilyKey).toBeNull();
    expect(taxonomy.productTypeKey).toBeNull();
    expect(taxonomy.conflict).toContain("neither antifreeze nor grease");
  });
});

describe("gear oils are mapped row by row", () => {
  it("sends automotive transmission and axle duty to the automotive family", () => {
    // Rows 165-177 are دنده دستی (manual transmission); 180-198 are اتوماتیک.
    for (const rowNumber of [165, 168, 171, 174, 177, 180, 183, 186, 189, 192, 195, 198]) {
      expect(byRow.get(rowNumber)).toMatchObject({
        productTypeKey: "gear-oils",
        productFamilyKey: "engine-oils-automotive-lubricants",
        conflict: null,
      });
    }
  });

  it("still lists the five evidence-conflicted rows", () => {
    expect(GEAR_FAMILY_CONFLICT_ROWS).toEqual([234, 237, 240, 243, 246]);
  });
});

/**
 * PRODUCT-DATA-2C-A. The evidence still conflicts; the OWNER resolved it, choosing the
 * authoritative Excel category as the authority for the public family. These tests hold that
 * decision to its terms: the family is decided, the gear evidence is still on the record, and
 * nothing else in either block moved.
 */
describe("the ratified Marine/Gear family decision", () => {
  const RATIFIED_REFS = [
    "SAMCAT-W1-R234",
    "SAMCAT-W1-R237",
    "SAMCAT-W1-R240",
    "SAMCAT-W1-R243",
    "SAMCAT-W1-R246",
  ] as const;

  const bySourceRef = new Map(
    RATIFIED_MARINE_GEAR_DECISIONS.map((decision) => {
      const row = WORKBOOK_FIXTURE.rows.find((item) => item.rowNumber === decision.ratifiedAtRow);
      if (!row) throw new Error(`fixture has no row ${String(decision.ratifiedAtRow)}`);
      return [decision.sourceRef, { row, taxonomy: mapTaxonomy(row, decision.sourceRef) }];
    }),
  );

  it("is the five exact reviewed sourceRefs and no others", () => {
    expect(RATIFIED_MARINE_GEAR_DECISIONS.map((d) => d.sourceRef)).toEqual([...RATIFIED_REFS]);
    expect(RATIFIED_MARINE_GEAR_DECISIONS.map((d) => d.ratifiedAtRow)).toEqual([
      ...GEAR_FAMILY_CONFLICT_ROWS,
    ]);
  });

  it("resolves all five exact sourceRefs to marine-oils-lubricants", () => {
    for (const sourceRef of RATIFIED_REFS) {
      expect(bySourceRef.get(sourceRef)?.taxonomy.productFamilyKey).toBe("marine-oils-lubricants");
    }
  });

  it("keeps ProductType gear-oils on all five", () => {
    for (const sourceRef of RATIFIED_REFS) {
      expect(bySourceRef.get(sourceRef)?.taxonomy.productTypeKey).toBe("gear-oils");
    }
  });

  it("clears the conflict on all five", () => {
    for (const sourceRef of RATIFIED_REFS) {
      expect(bySourceRef.get(sourceRef)?.taxonomy.conflict).toBeNull();
    }
  });

  it("preserves the raw Excel Marine category verbatim as provenance", () => {
    for (const sourceRef of RATIFIED_REFS) {
      expect(bySourceRef.get(sourceRef)?.row.categoryLabel).toBe("روغن های دریایی Marine Oils");
      expect(bySourceRef.get(sourceRef)?.taxonomy.basis).toContain("روغن های دریایی Marine Oils");
    }
  });

  it("keeps the contradicting HSB Gear and API GL/ATF evidence on the record", () => {
    for (const sourceRef of RATIFIED_REFS) {
      const basis = bySourceRef.get(sourceRef)?.taxonomy.basis ?? "";
      expect(basis).toContain("GEAR section");
      expect(basis).toContain("API GL/ATF");
      // The decision must not dress itself up as a technical finding.
      expect(basis).toContain("NOT claimed to be proven");
      expect(basis).toContain("OWNER DECISION");
      expect(basis).toContain(sourceRef);
    }
  });

  it("follows the sourceRef rather than the row, so a moved row keeps its decision", () => {
    const row = WORKBOOK_FIXTURE.rows.find((item) => item.rowNumber === 234);
    if (!row) throw new Error("fixture has no row 234");
    // Same product, now sitting somewhere else entirely.
    const moved = { ...row, rowNumber: 999 };
    expect(mapTaxonomy(moved, "SAMCAT-W1-R234").productFamilyKey).toBe("marine-oils-lubricants");
    // And a DIFFERENT product that happens to land on row 234 inherits nothing.
    expect(mapTaxonomy({ ...row, rowNumber: 234 }, "SAMCAT-W1-R900").conflict).toContain(
      "not evidenced and is not assumed",
    );
  });

  it("changes no other Gear or Marine row", () => {
    // Every automotive gear row keeps the automotive family it was decided on row evidence.
    for (const rowNumber of [165, 168, 171, 174, 177, 180, 183, 186, 189, 192, 195, 198]) {
      expect(byRow.get(rowNumber)?.productFamilyKey).toBe("engine-oils-automotive-lubricants");
      expect(byRow.get(rowNumber)?.productTypeKey).toBe("gear-oils");
    }
    // Every genuinely marine row keeps marine-oils, not gear-oils.
    for (const rowNumber of [213, 216, 219, 222, 225, 228, 231]) {
      expect(byRow.get(rowNumber)?.productFamilyKey).toBe("marine-oils-lubricants");
      expect(byRow.get(rowNumber)?.productTypeKey).toBe("marine-oils");
    }
  });

  it("leaves no taxonomy conflict anywhere in the workbook", () => {
    const conflicted = WORKBOOK_FIXTURE.rows
      .map((row) => ({
        row,
        taxonomy: mapTaxonomy(row, `SAMCAT-W1-R${String(row.rowNumber).padStart(3, "0")}`),
      }))
      .filter((item) => item.taxonomy.conflict !== null);
    expect(conflicted.map((item) => item.row.rowNumber)).toEqual([]);
  });

  it("still maps the genuinely marine rows of the same block", () => {
    for (const rowNumber of [213, 216, 219, 222, 225, 228, 231]) {
      expect(byRow.get(rowNumber)).toMatchObject({
        productTypeKey: "marine-oils",
        productFamilyKey: "marine-oils-lubricants",
        conflict: null,
      });
    }
  });
});

describe("Excel category membership", () => {
  it("is preserved untouched on every row, even where the family conflicts", () => {
    for (const { row } of mapped) {
      expect(row.categoryLabel.length).toBeGreaterThan(0);
    }
    const conflicted = WORKBOOK_FIXTURE.rows.find((row) => row.rowNumber === 234);
    expect(conflicted?.categoryLabel).toBe("روغن های دریایی Marine Oils");
  });
});

describe("Segment proposals", () => {
  it("proposes motorcycle-atv only where نوع محصول states motorcycle duty", () => {
    const motorcycle = mapped.filter((item) =>
      item.taxonomy.segmentKeys.includes("motorcycle-atv"),
    );
    expect(motorcycle.map((item) => item.row.rowNumber)).toEqual([93, 96, 99]);
  });

  it("proposes NEITHER passenger-cars NOR trucks-buses from a fuel type", () => {
    // بنزینی and دیزلی name a fuel, not a vehicle class. Reading a segment out of one would
    // put a heavy-duty diesel oil in front of a car owner on the evidence of nothing.
    for (const { taxonomy } of mapped) {
      expect(taxonomy.segmentKeys).not.toContain("passenger-cars");
      expect(taxonomy.segmentKeys).not.toContain("trucks-buses");
    }
  });

  it("proposes industry for the industrial and hydraulic blocks, and marine for marine", () => {
    expect(byRow.get(102)?.segmentKeys).toEqual(["industry"]);
    expect(byRow.get(201)?.segmentKeys).toEqual(["industry"]);
    expect(byRow.get(213)?.segmentKeys).toEqual(["marine"]);
  });
});

describe("an unrecognised category", () => {
  it("proposes nothing and says so", () => {
    const taxonomy = mapTaxonomy({ ...WORKBOOK_FIXTURE.rows[0]!, categoryLabel: "Something new" });
    expect(taxonomy.categoryRecognised).toBe(false);
    expect(taxonomy.productFamilyKey).toBeNull();
    expect(taxonomy.productTypeKey).toBeNull();
    expect(taxonomy.conflict).toContain("not one of the seven known blocks");
  });
});
