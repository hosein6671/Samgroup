/**
 * The row payload, with no database anywhere near it.
 *
 * Every count the gate confirms is a property of the PLAN, so it can be checked here — and
 * checking it here is what makes the integration suite's job "did PostgreSQL agree" rather
 * than "how many rows should there be". The two must never derive the number separately.
 */

import { TechnicalReviewStatus } from "../../../../prisma/generated/enums";

import { WORKBOOK_FIXTURE } from "../__fixtures__/workbook-rows.fixture";
import { buildImportPlan } from "../import-planner";
import { buildLedger } from "../manifest";

import { APPROVED_PLAN_EXPECTATIONS } from "./apply-engine";
import { dbEnum } from "./executor";
import * as ids from "./identities";
import { assertRowsNeverApproved, buildApplyRows, ApplyRowsError, type ReferenceIds } from "./rows";

import type { ImportPlan } from "../catalog-import.types";

const MANIFEST_HASH = "a".repeat(64);

/** The six Categories and eight Segments, with stable stand-in ids. */
const REFERENCE: ReferenceIds = {
  categoryIdBySlug: new Map(
    [
      "base-oils",
      "lubricant-additives",
      "engine-oils-automotive-lubricants",
      "industrial-oils-lubricants",
      "marine-oils-lubricants",
      "antifreeze-coolants",
    ].map((slug, index) => [slug, `00000000-0000-4000-8000-00000000000${index}`]),
  ),
  segmentIdBySlug: new Map(
    [
      "passenger-cars",
      "trucks-buses",
      "construction-mining",
      "agriculture",
      "gardening",
      "motorcycle-atv",
      "industry",
      "marine",
    ].map((slug, index) => [slug, `10000000-0000-4000-8000-00000000000${index}`]),
  ),
};

function planFromFixture(): ImportPlan {
  const base = {
    workbook: WORKBOOK_FIXTURE,
    workbookFileName: "frozen-fixture.workbook",
    workbookSha256: "0".repeat(64),
    workbookByteSize: 0,
    workbookProvenance: "FROZEN_FIXTURE" as const,
    existingSlugKeys: new Set<string>(),
    existingSourceRefs: new Set<string>(),
  };
  // Replayed against its own ledger, so every identity is settled the way an apply requires.
  const first = buildImportPlan(base);
  return buildImportPlan({ ...base, ledger: buildLedger(first).entries });
}

const plan = planFromFixture();
const rows = buildApplyRows(plan, MANIFEST_HASH, REFERENCE);

describe("the row payload the apply would persist", () => {
  it("carries exactly the approved number of rows in every table", () => {
    expect(rows.products).toHaveLength(APPROVED_PLAN_EXPECTATIONS.products);
    expect(rows.productGrades).toHaveLength(APPROVED_PLAN_EXPECTATIONS.productGrades);
    expect(rows.sourceFacts).toHaveLength(APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts);
    expect(rows.specifications).toHaveLength(APPROVED_PLAN_EXPECTATIONS.specifications);
    expect(rows.productClaims).toHaveLength(APPROVED_PLAN_EXPECTATIONS.productClaims);
    expect(rows.specificationEvidence).toHaveLength(
      APPROVED_PLAN_EXPECTATIONS.specificationEvidence,
    );
    expect(rows.claimEvidence).toHaveLength(APPROVED_PLAN_EXPECTATIONS.claimEvidence);
    expect(rows.sourceAssets).toHaveLength(APPROVED_PLAN_EXPECTATIONS.sourceAssets);
    expect(rows.sourceDocuments).toHaveLength(APPROVED_PLAN_EXPECTATIONS.sourceDocuments);
    expect(rows.productTypes).toHaveLength(8);
    expect(rows.specProperties).toHaveLength(28);
    expect(rows.specPropertyMappings).toHaveLength(75);
  });

  it("computes the ProductSegment count from the plan rather than from a constant", () => {
    const fromPlan = plan.products.reduce(
      (total, product) => total + product.proposedSegmentKeys.length,
      0,
    );
    expect(rows.productSegments).toHaveLength(fromPlan);
    // Stated so a change in the taxonomy shows up as a failing number and not as a silent
    // difference between two things that are both "the plan".
    expect(rows.productSegments).toHaveLength(41);
  });

  it("gives every Product a ratified sourceRef, a Category and a distinct slug", () => {
    expect(new Set(rows.products.map((row) => row.sourceRef)).size).toBe(rows.products.length);
    expect(new Set(rows.products.map((row) => row.slug)).size).toBe(rows.products.length);
    expect(new Set(rows.products.map((row) => row.id)).size).toBe(rows.products.length);
    for (const row of rows.products) {
      expect(row.sourceRef).toMatch(/^SAMCAT-W1-R\d+$/);
      expect([...REFERENCE.categoryIdBySlug.values()]).toContain(row.categoryId);
    }
  });

  it("derives every id from identity alone, so a second build produces the same rows", () => {
    const again = buildApplyRows(planFromFixture(), MANIFEST_HASH, REFERENCE);
    expect(again.products.map((row) => row.id)).toEqual(rows.products.map((row) => row.id));
    expect(again.sourceFacts.map((row) => row.id)).toEqual(rows.sourceFacts.map((row) => row.id));
    expect(again.specifications.map((row) => row.id)).toEqual(
      rows.specifications.map((row) => row.id),
    );
    expect(again.productClaims.map((row) => row.id)).toEqual(
      rows.productClaims.map((row) => row.id),
    );
    expect(again.importRun.id).toBe(rows.importRun.id);
  });

  it("never turns a withheld reading into a Specification", () => {
    const withheld = plan.products.flatMap((product) =>
      product.technicalFacts.filter((fact) => fact.specification === null),
    );
    expect(withheld).toHaveLength(126);
    // All 126 are still recorded as evidence, and none of them backs a Specification.
    const backing = new Set(rows.specificationEvidence.map((row) => row.evidenceIdentity));
    expect(backing.size).toBe(APPROVED_PLAN_EXPECTATIONS.specifications);
    expect(rows.sourceFacts.length).toBeGreaterThan(backing.size);
  });

  it("gives every Specification and every Claim exactly one evidence link", () => {
    expect(new Set(rows.specificationEvidence.map((row) => row.subjectId)).size).toBe(
      rows.specifications.length,
    );
    expect(new Set(rows.claimEvidence.map((row) => row.subjectId)).size).toBe(
      rows.productClaims.length,
    );
  });

  it("writes only SOURCE_RECORDED or NEEDS_REVIEW, never APPROVED", () => {
    const permitted = [TechnicalReviewStatus.SOURCE_RECORDED, TechnicalReviewStatus.NEEDS_REVIEW];
    for (const row of rows.specifications) expect(permitted).toContain(row.reviewStatus);
    for (const row of rows.productClaims) expect(permitted).toContain(row.reviewStatus);
    for (const row of rows.specPropertyMappings) {
      expect(row.reviewStatus).toBe(TechnicalReviewStatus.SOURCE_RECORDED);
    }
    expect(() => {
      assertRowsNeverApproved(rows);
    }).not.toThrow();
  });

  it("refuses a payload that carries an APPROVED row", () => {
    const poisoned = {
      ...rows,
      specifications: rows.specifications.map((row, index) =>
        index === 0 ? { ...row, reviewStatus: TechnicalReviewStatus.APPROVED } : row,
      ),
    };
    expect(() => {
      assertRowsNeverApproved(poisoned);
    }).toThrow(/review status the importer may never write/);
  });

  it("stores no document bytes: an asset is a hash, a size and a media type", () => {
    for (const asset of rows.sourceAssets) {
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(asset).sort()).toEqual([
        "byteSize",
        "id",
        "mediaType",
        "pageCount",
        "sha256",
      ]);
    }
  });

  it("refuses a Product whose Family names no reconciled Category", () => {
    expect(() =>
      buildApplyRows(plan, MANIFEST_HASH, {
        categoryIdBySlug: new Map(),
        segmentIdBySlug: REFERENCE.segmentIdBySlug,
      }),
    ).toThrow(ApplyRowsError);
  });

  it("refuses a Segment membership naming no reconciled Segment", () => {
    expect(() =>
      buildApplyRows(plan, MANIFEST_HASH, {
        categoryIdBySlug: REFERENCE.categoryIdBySlug,
        segmentIdBySlug: new Map(),
      }),
    ).toThrow(/no Segment exists with slug/);
  });

  it("names the ImportRun after the manifest and nothing else", () => {
    expect(rows.importRun.id).toBe(ids.importRunId(MANIFEST_HASH));
    expect(rows.importRun.manifestHash).toBe(MANIFEST_HASH);
    // A different plan of the same manifest is the same run; a different manifest is not.
    expect(ids.importRunId("b".repeat(64))).not.toBe(rows.importRun.id);
  });

  it("gives every SpecPropertyMapping a real uuid, not its identity key", () => {
    for (const row of rows.specPropertyMappings) {
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
    expect(new Set(rows.specPropertyMappings.map((row) => row.id)).size).toBe(
      rows.specPropertyMappings.length,
    );
  });
});

describe("enum marshalling", () => {
  it("lowercases every Prisma enum value to its Postgres label", () => {
    expect(dbEnum("SOURCE_RECORDED")).toBe("source_recorded");
    expect(dbEnum("ISO_VG")).toBe("iso_vg");
    expect(dbEnum("UPLOADED_FILE")).toBe("uploaded_file");
    expect(dbEnum("NOT_APPLICABLE")).toBe("not_applicable");
    expect(dbEnum("PRIMARY")).toBe("primary");
  });

  it("refuses anything that is not an enum identifier", () => {
    expect(() => dbEnum("not an enum")).toThrow(/not a mappable enum label/);
    expect(() => dbEnum("'; DROP TABLE products; --")).toThrow(/not a mappable enum label/);
    expect(() => dbEnum("")).toThrow(/not a mappable enum label/);
  });
});
