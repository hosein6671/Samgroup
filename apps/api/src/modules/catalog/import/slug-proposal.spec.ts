import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import {
  checkSlugNamespace,
  proposeSlug,
  RATIFIED_SLUGS,
  RESERVED_SLUGS,
  slugifyProductName,
  slugKey,
} from "./slug-proposal";

const allProposals = WORKBOOK_FIXTURE.rows.map((row) => ({
  rowNumber: row.rowNumber,
  ...proposeSlug(row.rowNumber, row.name),
}));

describe("the four ratified semantic slugs", () => {
  it("are exactly the four the Architect ratified, on exactly the four duplicate-name rows", () => {
    expect([...RATIFIED_SLUGS.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [69, "sn-grade-gasoline"],
      [81, "sg-grade-gasoline"],
      [96, "sn-grade-motorcycle"],
      [99, "sg-grade-motorcycle"],
    ]);
  });

  it("are applied to rows 69, 81, 96 and 99 and to no others", () => {
    const ratified = allProposals.filter((proposal) => proposal.isRatified);
    expect(ratified.map((proposal) => proposal.rowNumber).sort((a, b) => a - b)).toEqual([
      69, 81, 96, 99,
    ]);
    expect(ratified.map((proposal) => proposal.slug)).toEqual([
      "sn-grade-gasoline",
      "sg-grade-gasoline",
      "sn-grade-motorcycle",
      "sg-grade-motorcycle",
    ]);
  });

  it("do not change the display name", () => {
    for (const rowNumber of [69, 81, 96, 99]) {
      const row = WORKBOOK_FIXTURE.rows.find((item) => item.rowNumber === rowNumber);
      expect(row?.name).toMatch(/^S[NG] Grade$/);
    }
  });
});

describe("slugifyProductName", () => {
  it("is deterministic and derived from the exact name", () => {
    expect(slugifyProductName("CK-4 10W-40")).toBe("ck-4-10w-40");
    expect(slugifyProductName("COMPRESSOR TECH Polyalphaolefin- Synthetic (PAO-S)")).toBe(
      "compressor-tech-polyalphaolefin-synthetic-pao-s",
    );
    expect(slugifyProductName("SN , SM , SL , SJ , SF…SC Engine oil additive")).toBe(
      "sn-sm-sl-sj-sf-sc-engine-oil-additive",
    );
  });

  it("adds no numeric suffix, ever", () => {
    expect(slugifyProductName("SN Grade")).toBe("sn-grade");
    expect(slugifyProductName("SN Grade")).not.toMatch(/-\d+$/);
  });

  it("matches the database slug_key() normalization for the values it produces", () => {
    for (const proposal of allProposals) {
      expect(slugKey(proposal.slug)).toBe(proposal.slug);
    }
  });
});

describe("the 100 proposed slugs", () => {
  it("are 100 distinct keys with no collision", () => {
    const keys = allProposals.map((proposal) => slugKey(proposal.slug));
    expect(new Set(keys).size).toBe(100);
  });

  it("hit none of the ADR-011 reserved segments", () => {
    for (const proposal of allProposals) {
      expect(RESERVED_SLUGS).not.toContain(slugKey(proposal.slug));
    }
  });

  it("produce no empty slug", () => {
    expect(allProposals.filter((proposal) => proposal.slug.length === 0)).toHaveLength(0);
  });

  it("do not collide with the six frozen Product Family category slugs", () => {
    const families = new Set([
      "base-oils",
      "lubricant-additives",
      "engine-oils-automotive-lubricants",
      "industrial-oils-lubricants",
      "marine-oils-lubricants",
      "antifreeze-coolants",
    ]);
    const issues = checkSlugNamespace(allProposals, families);
    expect(issues).toEqual([]);
  });
});

describe("checkSlugNamespace", () => {
  it("REPORTS a within-import collision instead of resolving it", () => {
    const issues = checkSlugNamespace(
      [
        { rowNumber: 10, slug: "sn-grade" },
        { rowNumber: 20, slug: "sn-grade" },
      ],
      new Set(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("SLUG_COLLISION_WITHIN_IMPORT");
    expect(issues[0]?.rows).toEqual([10, 20]);
    // No suffix was invented to make them both fit.
    expect(issues[0]?.slug).toBe("sn-grade");
  });

  it("reports a collision with an entity that already holds the key", () => {
    const issues = checkSlugNamespace(
      [{ rowNumber: 10, slug: "sam-demo-engine-oil-a" }],
      new Set(["sam-demo-engine-oil-a"]),
    );
    expect(issues.map((issue) => issue.code)).toEqual(["SLUG_COLLISION_WITH_EXISTING"]);
  });

  it("reports a reserved segment", () => {
    const issues = checkSlugNamespace([{ rowNumber: 10, slug: "finder" }], new Set());
    expect(issues.map((issue) => issue.code)).toContain("SLUG_RESERVED");
  });

  it("is order-independent, so the report does not depend on row order", () => {
    const forwards = checkSlugNamespace(allProposals, new Set());
    const backwards = checkSlugNamespace([...allProposals].reverse(), new Set());
    expect(forwards).toEqual(backwards);
  });
});

describe("ProductGrade and the namespace", () => {
  it("keeps `iso-vg-32` claimable by exactly one Product", () => {
    // Rows 201-210 are NAMED after viscosity grades, and the same strings are grade labels
    // under four other products. That is safe only because a grade has no slug: if it did,
    // five entities would claim this key and ADR-011 INV-1 would reject four of them.
    const claimants = allProposals.filter((proposal) => slugKey(proposal.slug) === "iso-vg-32");
    expect(claimants).toHaveLength(1);
    expect(claimants[0]?.rowNumber).toBe(201);
  });
});
