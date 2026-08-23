/**
 * The invariants every artefact must agree on.
 *
 * The plan, the manifest JSON, the Markdown summary and the CLI summary are four renderings
 * of one thing. A number that reconciles in three of them and not the fourth is a reporting
 * bug, and this file is what stops one from reaching a review.
 */

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { renderSummary } from "./dry-run";
import { buildImportPlan, sourceFactKey } from "./import-planner";
import { buildLedger, buildManifest } from "./manifest";
import { renderReviewSummary } from "./review-summary";
import { slugifyProductName } from "./slug-proposal";

import type { DryRunResult } from "./dry-run";

const plan = buildImportPlan({
  workbook: WORKBOOK_FIXTURE,
  workbookFileName: "wb.xlsx",
  workbookSha256: "0".repeat(64),
  workbookByteSize: 1,
  existingSlugKeys: new Set<string>(),
});
const manifest = buildManifest(plan);
const markdown = renderReviewSummary(manifest);
const ledger = buildLedger(plan);

const result: DryRunResult = {
  plan,
  countsBefore: new Map(),
  countsAfter: new Map(),
  changedTables: [],
  wroteNothing: true,
};
const cliSummary = renderSummary(result);

describe("the ratified shape of the catalogue", () => {
  it("has 100 manifest products, 100 sourceRefs and 100 slugs", () => {
    expect(manifest.rows).toHaveLength(100);
    expect(new Set(manifest.rows.map((row) => row.sourceRef)).size).toBe(100);
    expect(new Set(manifest.rows.map((row) => row.proposedSlug)).size).toBe(100);
    expect(ledger.entries).toHaveLength(100);
  });

  it("proposes 134 ProductGrade candidates", () => {
    expect(manifest.counts.gradeRecords).toBe(134);
    expect(manifest.rows.reduce((total, row) => total + row.gradeCandidates.length, 0)).toBe(134);
  });

  it("keeps every exact Excel name, with no SAM prefix and no invented translation", () => {
    for (const row of manifest.rows) {
      const source = WORKBOOK_FIXTURE.rows.find((item) => item.rowNumber === row.rowNumber);
      expect(row.publicProductName).toBe(source?.name);
      expect(row.publicProductName.startsWith("SAM ")).toBe(false);
    }
  });

  it("leaves Base Oils empty and invents no product for it", () => {
    expect(manifest.rows.some((row) => row.proposedProductFamilyKey === "base-oils")).toBe(false);
  });

  it("decomposes the Others block instead of inventing an Others type", () => {
    const others = manifest.rows.filter(
      (row) => row.excelCategory === "سایر محصولات Others products",
    );
    expect(others.length).toBeGreaterThan(0);
    for (const row of others) {
      expect(["antifreeze-coolants", "greases"]).toContain(row.proposedProductTypeKey);
    }
  });

  it("ratifies exactly four semantic duplicate slugs and no numeric suffix anywhere", () => {
    const ratified = manifest.rows.filter((row) => row.slugIsRatified);
    expect(ratified.map((row) => row.proposedSlug).sort()).toEqual([
      "sg-grade-gasoline",
      "sg-grade-motorcycle",
      "sn-grade-gasoline",
      "sn-grade-motorcycle",
    ]);
    // No disambiguating suffix is ever appended: every unratified slug is exactly what the
    // exact Excel name slugifies to. `ck-4-10w-40` ends in digits because the NAME does.
    for (const row of manifest.rows) {
      if (row.slugIsRatified) continue;
      expect(row.proposedSlug).toBe(slugifyProductName(row.publicProductName));
    }
  });

  it("keeps Quenching out of the grades and TC as a claim", () => {
    const quenching = manifest.rows.find((row) => row.rowNumber === 153);
    const twoStroke = manifest.rows.find((row) => row.rowNumber === 219);
    expect(quenching?.gradeCandidates).toEqual([]);
    expect(twoStroke?.gradeCandidates).toEqual([]);
    expect(twoStroke?.claimCandidates.some((claim) => claim.standardCode === "TC")).toBe(true);
  });

  it("carries the ratified Marine decision for the five gear rows, in the manifest", () => {
    for (const rowNumber of [234, 237, 240, 243, 246]) {
      const row = manifest.rows.find((item) => item.rowNumber === rowNumber);
      expect(row?.proposedProductFamilyKey).toBe("marine-oils-lubricants");
      expect(row?.proposedProductTypeKey).toBe("gear-oils");
      expect(row?.conflictsByCategory.TAXONOMY).toBe(0);
      expect(row?.action).toBe("INSERT");
      // The decision, and the evidence it overruled, must survive into the audit artefact.
      const decision = row?.flags.find((flag) => flag.code === "TAXONOMY_FAMILY_OWNER_DECISION");
      expect(decision?.severity).toBe("info");
      expect(decision?.detail).toContain("OWNER DECISION");
      expect(decision?.detail).toContain("GEAR section");
    }
  });

  it("leaves the whole plan free of taxonomy conflicts", () => {
    expect(plan.counts.conflictsByCategory.TAXONOMY).toBe(0);
    expect(plan.counts.products.conflict).toBe(0);
    expect(plan.counts.products.insert).toBe(100);
  });
});

describe("evidence integrity", () => {
  it("gives every fact exactly one owning SourceDocument, and that document exists", () => {
    const keys = new Set(plan.documents.map((document) => document.documentKey));
    for (const product of plan.products) {
      for (const fact of product.technicalFacts) {
        expect(keys.has(fact.sourceFact.documentKey)).toBe(true);
      }
      for (const claim of product.claims) {
        expect(keys.has(claim.sourceFact.documentKey)).toBe(true);
      }
    }
    expect(plan.documentIntegrity.evidenceWithoutDocument).toEqual([]);
  });

  it("plans no SourceDocument that carries no evidence", () => {
    expect(plan.documentIntegrity.documentsWithZeroEvidence).toEqual([]);
    for (const entry of plan.documentRetention) {
      const earned = entry.technicalFacts + entry.claims > 0;
      expect(earned || entry.retentionBasis === "IMPORT_RUN_SOURCE").toBe(true);
    }
    expect(plan.documentRetention).toHaveLength(plan.documents.length);
  });

  it("accounts for every addressed candidate as either planned or provenance", () => {
    const integrity = plan.documentIntegrity;
    expect(integrity.totalDocuments + integrity.provenanceLocators).toBe(
      integrity.candidateDocuments,
    );
    expect(plan.provenanceLocators).toHaveLength(integrity.provenanceLocators);
    const plannedKeys = new Set(plan.documents.map((document) => document.documentKey));
    for (const locator of plan.provenanceLocators) {
      expect(plannedKeys.has(locator.documentKey)).toBe(false);
    }
  });

  it("cites no provenance locator from any planned fact", () => {
    const provenanceKeys = new Set(plan.provenanceLocators.map((locator) => locator.documentKey));
    for (const product of plan.products) {
      for (const fact of product.technicalFacts) {
        expect(provenanceKeys.has(fact.sourceFact.documentKey)).toBe(false);
      }
      for (const claim of product.claims) {
        expect(provenanceKeys.has(claim.sourceFact.documentKey)).toBe(false);
      }
    }
  });

  it("gives every Specification candidate at least one evidence link", () => {
    for (const product of plan.products) {
      for (const fact of product.technicalFacts) {
        if (fact.specification === null) continue;
        expect(fact.sourceFact.rawValue).toBe(fact.specification.displayValue);
      }
    }
  });

  it("gives every Claim candidate at least one evidence link", () => {
    for (const product of plan.products) {
      for (const claim of product.claims) {
        expect(claim.sourceFact.rawValue.length).toBeGreaterThan(0);
      }
    }
  });

  it("creates no duplicate evidence link", () => {
    // `specification_evidence` and `claim_evidence` are keyed on (entity, source fact). One
    // SourceFact legitimately supports several entities — a product name stating six
    // designations is ONE spreadsheet cell behind six claims — so the duplicate to look for
    // is the same entity linked to the same fact twice.
    const links = new Set<string>();
    for (const product of plan.products) {
      product.technicalFacts.forEach((fact, index) => {
        if (fact.specification === null) return;
        const key = `${product.sourceRef}|spec:${String(index)}|${sourceFactKey(fact.sourceFact)}`;
        expect(links.has(key)).toBe(false);
        links.add(key);
      });
      product.claims.forEach((claim, index) => {
        const key = `${product.sourceRef}|claim:${String(index)}|${sourceFactKey(claim.sourceFact)}`;
        expect(links.has(key)).toBe(false);
        links.add(key);
      });
    }
    expect(links.size).toBe(
      plan.counts.specificationEvidenceLinks + plan.counts.claimEvidenceLinks,
    );
  });

  it("counts DISTINCT source_facts rows rather than counting a shared cell twice", () => {
    const global = new Set<string>();
    let perRowTotal = 0;
    for (const product of plan.products) {
      const own = new Set<string>();
      for (const fact of product.technicalFacts) own.add(sourceFactKey(fact.sourceFact));
      for (const claim of product.claims) own.add(sourceFactKey(claim.sourceFact));
      perRowTotal += own.size;
      for (const key of own) global.add(key);
    }
    expect(plan.counts.sourceFacts).toBe(global.size);
    // No SourceFact is shared between two products, so the per-row totals sum to the global.
    expect(perRowTotal).toBe(global.size);
  });

  it("lets no unknown property create a Specification", () => {
    for (const product of plan.products) {
      for (const fact of product.technicalFacts) {
        if (fact.resolvedPropertyKey !== null) continue;
        expect(fact.specification).toBeNull();
      }
    }
  });

  it("emits no approval and no ratification", () => {
    const json = JSON.stringify({ manifest, ledger });
    expect(json).not.toContain('"APPROVED"');
    expect(json).not.toContain('"RATIFIED"');
    for (const entry of ledger.entries) expect(entry.state).toBe("PROPOSED");
  });
});

describe("the four renderings agree", () => {
  const technical = manifest.counts.technical;

  it("reconciles the technical totals inside the plan", () => {
    expect(technical.validSpecificationCandidates + technical.withheldFromSpecification).toBe(
      technical.rawTechnicalFacts,
    );
    expect(technical.highConfidenceMapped + technical.unmappedOrLowConfidence).toBe(
      technical.rawTechnicalFacts,
    );
    expect(manifest.counts.specificationEvidenceLinks).toBe(technical.validSpecificationCandidates);
    expect(manifest.counts.claimEvidenceLinks).toBe(manifest.counts.claims);
  });

  it("reconciles per-row totals with the plan totals", () => {
    const sum = (pick: (row: (typeof manifest.rows)[number]) => number): number =>
      manifest.rows.reduce((total, row) => total + pick(row), 0);
    expect(sum((row) => row.specificationCandidateCount)).toBe(
      technical.validSpecificationCandidates,
    );
    expect(sum((row) => row.withheldFactCount)).toBe(technical.withheldFromSpecification);
    expect(sum((row) => row.rawTechnicalFactCount)).toBe(technical.rawTechnicalFacts);
    expect(sum((row) => row.claimCandidates.length)).toBe(manifest.counts.claims);
    expect(sum((row) => row.sourceFactCount)).toBe(manifest.counts.sourceFacts);
    expect(sum((row) => row.specificationCandidates.length)).toBe(
      technical.validSpecificationCandidates,
    );
    expect(sum((row) => row.withheldSourceFacts.length)).toBe(technical.withheldFromSpecification);
  });

  it("reconciles the product action totals", () => {
    const actions = manifest.counts.products;
    expect(actions.insert + actions.update + actions.skip + actions.conflict).toBe(100);
    for (const action of ["INSERT", "UPDATE", "SKIP", "CONFLICT"] as const) {
      const key = action.toLowerCase() as keyof typeof actions;
      expect(manifest.rows.filter((row) => row.action === action)).toHaveLength(actions[key]);
    }
  });

  it("prints the same numbers in the CLI summary and the Markdown summary", () => {
    for (const value of [
      technical.rawTechnicalFacts,
      technical.validSpecificationCandidates,
      technical.withheldFromSpecification,
      manifest.counts.gradeRecords,
      manifest.documentIntegrity.totalDocuments,
      manifest.counts.products.conflict,
    ]) {
      expect(cliSummary).toContain(String(value));
      expect(markdown).toContain(String(value));
    }
  });

  it("puts every product in the Markdown summary too", () => {
    for (const row of manifest.rows) {
      expect(markdown).toContain(row.sourceRef);
    }
  });

  it("renders both artefacts identically on a repeat build", () => {
    const again = buildManifest(
      buildImportPlan({
        workbook: WORKBOOK_FIXTURE,
        workbookFileName: "wb.xlsx",
        workbookSha256: "0".repeat(64),
        workbookByteSize: 1,
        existingSlugKeys: new Set<string>(),
      }),
    );
    expect(again.manifestHash).toBe(manifest.manifestHash);
    expect(renderReviewSummary(again)).toBe(markdown);
  });
});
