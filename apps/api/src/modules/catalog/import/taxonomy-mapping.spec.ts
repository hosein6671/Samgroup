import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import {
  GEAR_FAMILY_CONFLICT_ROWS,
  mapTaxonomy,
  PRODUCT_FAMILY_KEYS,
  PROPOSED_PRODUCT_TYPE_KEYS,
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

  it("CONFLICTS on the five gear rows the workbook files under Marine", () => {
    expect(GEAR_FAMILY_CONFLICT_ROWS).toEqual([234, 237, 240, 243, 246]);
    for (const rowNumber of GEAR_FAMILY_CONFLICT_ROWS) {
      const taxonomy = byRow.get(rowNumber);
      expect(taxonomy?.productFamilyKey).toBeNull();
      expect(taxonomy?.productTypeKey).toBe("gear-oils");
      expect(taxonomy?.conflict).toContain("not evidenced and is not assumed");
    }
  });

  it("does not silently place those five in the marine family", () => {
    for (const rowNumber of GEAR_FAMILY_CONFLICT_ROWS) {
      expect(byRow.get(rowNumber)?.productFamilyKey).not.toBe("marine-oils-lubricants");
    }
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
