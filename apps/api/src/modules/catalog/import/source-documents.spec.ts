import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { buildImportPlan } from "./import-planner";
import {
  buildDocumentInventory,
  checkDocumentIntegrity,
  documentRoleOf,
  partitionByEvidence,
  productPageDocumentKeyFor,
} from "./source-documents";

import type { DocumentCitation } from "./source-documents";

const WORKBOOK = {
  fileName: "wb.xlsx",
  sha256: "1".repeat(64),
  byteSize: 42,
  retrievedAt: "2026-08-22T00:00:00.000Z",
};

const inventory = buildDocumentInventory(WORKBOOK_FIXTURE.rows, WORKBOOK);

const plan = buildImportPlan({
  workbook: WORKBOOK_FIXTURE,
  workbookFileName: WORKBOOK.fileName,
  workbookSha256: WORKBOOK.sha256,
  workbookByteSize: WORKBOOK.byteSize,
  existingSlugKeys: new Set<string>(),
});

describe("a publisher is not a document, and a URL is not evidence", () => {
  it("addresses 119 candidates", () => {
    expect(inventory.candidates).toHaveLength(119);
  });

  it("splits the candidates into the expected logical set", () => {
    const byRole = new Map<string, number>();
    for (const document of inventory.candidates) {
      const key = `${document.publisher}|${documentRoleOf(document.documentKey)}`;
      byRole.set(key, (byRole.get(key) ?? 0) + 1);
    }
    expect(Object.fromEntries(byRole)).toEqual({
      "SAM Group|WORKBOOK": 1,
      "Hirmand Shimi Baharan|SUPPLIER_CATALOGUE": 1,
      "King Power Lubricants|TECHNICAL_DATA_SHEET": 51,
      "King Power Lubricants|PRODUCT_PAGE": 51,
      "Addilex|PRODUCT_PAGE": 15,
    });
  });

  it("plans only the 69 that carry evidence", () => {
    expect(plan.documents).toHaveLength(69);
    const byRole = new Map<string, number>();
    for (const document of plan.documents) {
      const key = `${document.publisher}|${documentRoleOf(document.documentKey)}`;
      byRole.set(key, (byRole.get(key) ?? 0) + 1);
    }
    expect(Object.fromEntries(byRole)).toEqual({
      "SAM Group|WORKBOOK": 1,
      "Hirmand Shimi Baharan|SUPPLIER_CATALOGUE": 1,
      "King Power Lubricants|TECHNICAL_DATA_SHEET": 51,
      "King Power Lubricants|PRODUCT_PAGE": 1,
      "Addilex|PRODUCT_PAGE": 15,
    });
  });

  it("keeps the other 50 King Power pages as provenance, never as rows", () => {
    expect(plan.provenanceLocators).toHaveLength(50);
    const plannedKeys = new Set(plan.documents.map((document) => document.documentKey));
    for (const locator of plan.provenanceLocators) {
      expect(locator.role).toBe("PRODUCT_PAGE");
      expect(locator.publisher).toBe("King Power Lubricants");
      expect(locator.locatorValue).toMatch(/^https:\/\/kingpowerlub\.com\/en\/products\//);
      expect(locator.rowNumber).not.toBeNull();
      expect(plannedKeys.has(locator.documentKey)).toBe(false);
    }
  });

  it("still exposes all 51 King Power page URLs for review, planned or not", () => {
    const plannedPages = plan.documents
      .filter((document) => document.documentKey.endsWith("-PAGE"))
      .map((document) => document.locatorValue);
    const provenancePages = plan.provenanceLocators.map((locator) => locator.locatorValue);
    const all = new Set([...plannedPages, ...provenancePages]);
    expect(all.size).toBe(51);
    const workbookUrls = new Set(
      WORKBOOK_FIXTURE.rows
        .filter((row) => row.technicalReferenceEn.includes("kingpowerlub.com"))
        .map((row) => row.technicalReferenceEn),
    );
    expect(all).toEqual(workbookUrls);
  });

  it("names why each planned document earned its row", () => {
    const bases = new Map(
      plan.documentRetention.map((entry) => [entry.documentKey, entry.retentionBasis]),
    );
    // The workbook is cited by the name-designation claims, so it earns its row on evidence
    // like everything else; IMPORT_RUN_SOURCE is the fallback that keeps it when it is not.
    expect(bases.get("SAM-CATALOG-WORKBOOK")).toBe("CITED_BY_FACT");
    expect(bases.get("PD1-060-PAGE")).toBe("CITED_BY_FACT");
    for (const entry of plan.documentRetention) {
      expect(entry.technicalFacts + entry.claims).toBeGreaterThan(0);
    }
  });

  it("keeps the workbook when nothing happens to cite it", () => {
    const citations: DocumentCitation[] = [{ documentKey: "PD1-001", citationKind: "technical" }];
    const { planned, provenanceLocators } = partitionByEvidence(inventory, citations);
    const workbook = planned.find((entry) => entry.document.documentKey === "SAM-CATALOG-WORKBOOK");
    expect(workbook?.retentionBasis).toBe("IMPORT_RUN_SOURCE");
    expect(planned).toHaveLength(2);
    expect(provenanceLocators).toHaveLength(117);
  });

  it("keeps a King Power product page and its TDS as two documents with two locators", () => {
    const pageKey = productPageDocumentKeyFor(180);
    expect(pageKey).toBe("PD1-060-PAGE");
    const page = plan.documents.find((d) => d.documentKey === pageKey);
    const tds = plan.documents.find((d) => d.documentKey === "PD1-060");
    expect(page?.locatorValue).toBe("https://kingpowerlub.com/en/products/aa66xhpl32ss3yg");
    expect(tds?.locatorValue).toContain(".pdf");
    expect(page?.locatorValue).not.toBe(tds?.locatorValue);
    expect(page?.mediaType).toBe("text/html");
    expect(tds?.mediaType).toBe("application/pdf");
  });

  it("gives Addilex ONE document, because its page carries the specification sheet", () => {
    // Splitting it would invent a second document that does not exist.
    expect(productPageDocumentKeyFor(249)).toBeNull();
    expect(plan.documents.filter((d) => d.documentKey.startsWith("ADX-"))).toHaveLength(15);
  });

  it("derives every King Power page locator from the workbook's own cell", () => {
    for (const [rowNumber, key] of inventory.productPageKeyByRow) {
      const row = WORKBOOK_FIXTURE.rows.find((item) => item.rowNumber === rowNumber);
      const document = inventory.candidates.find((item) => item.documentKey === key);
      expect(document?.locatorValue).toBe(row?.technicalReferenceEn);
    }
    expect(inventory.productPageKeyByRow.size).toBe(51);
    expect(inventory.kingPowerRowsWithoutPageDocument).toEqual([]);
  });

  it("finds no locator that disagrees with the workbook", () => {
    expect(inventory.locatorMismatches).toEqual([]);
    expect(plan.counts.sourceRetrievalMismatch).toBe(0);
  });
});

describe("document integrity, over the PLANNED set", () => {
  const integrity = plan.documentIntegrity;

  it("plans no document that carries no evidence", () => {
    expect(integrity.documentsWithZeroEvidence).toEqual([]);
    expect(integrity.totalDocuments).toBe(69);
    expect(integrity.candidateDocuments).toBe(119);
    expect(integrity.provenanceLocators).toBe(50);
    expect(integrity.totalDocuments + integrity.provenanceLocators).toBe(
      integrity.candidateDocuments,
    );
  });

  it("gives every planned document a unique locator", () => {
    expect(integrity.uniqueLocators).toBe(69);
    expect(integrity.duplicateLocators).toEqual([]);
  });

  it("separates captured documents from cited locators, and counts assets accordingly", () => {
    // 51 TDS PDFs + the HSB catalogue + the workbook were hashed; nothing else was captured.
    expect(integrity.capturedDocuments).toBe(53);
    expect(integrity.sourceAssets).toBe(53);
    expect(integrity.locatorOnlyDocuments).toBe(16);
    expect(integrity.capturedDocuments + integrity.locatorOnlyDocuments).toBe(
      integrity.totalDocuments,
    );
  });

  it("gives every planned fact exactly one owning document that exists", () => {
    expect(integrity.evidenceWithoutDocument).toEqual([]);
    const cited = integrity.factsByDocument.reduce(
      (total, entry) => total + entry.technical + entry.claims,
      0,
    );
    // One CITATION per planned technical reading and per planned claim. That is larger than
    // the distinct `source_facts` row count, because one spreadsheet cell can be cited by
    // several claims — the sharing is the point, and both numbers are reported.
    expect(cited).toBe(plan.counts.technical.rawTechnicalFacts + plan.counts.claims);
    expect(plan.counts.sourceFacts).toBeLessThan(cited);
  });

  it("finds no statement cited to a TDS and no reading cited to a marketing page", () => {
    expect(integrity.claimsCitingTechnicalDataSheet).toEqual([]);
    expect(integrity.technicalFactsCitingProductPage).toEqual([]);
  });

  it("cites the one page-borne King Power claim to the PAGE, not to the TDS", () => {
    const dct = plan.products.find((product) => product.rowNumber === 180);
    const pageClaims = dct?.claims.filter(
      (claim) => claim.sourceFact.documentKey === "PD1-060-PAGE",
    );
    expect(pageClaims?.length).toBeGreaterThan(0);
    const tdsFacts = dct?.technicalFacts.every((fact) => fact.sourceFact.documentKey === "PD1-060");
    expect(tdsFacts).toBe(true);
  });

  it("catches a fact citing a document that was never planned", () => {
    const planned = partitionByEvidence(inventory, [
      { documentKey: "PD1-001", citationKind: "technical" },
    ]).planned;
    const report = checkDocumentIntegrity(
      planned,
      [{ documentKey: "NOT-A-DOCUMENT", citationKind: "technical" }],
      new Set(),
    );
    expect(report.evidenceWithoutDocument).toEqual(["NOT-A-DOCUMENT"]);
  });

  it("catches two documents claiming one locator", () => {
    const first = inventory.candidates[1];
    const duplicated = [
      { document: first!, retentionBasis: "CITED_BY_FACT" as const, technicalFacts: 1, claims: 0 },
      {
        document: { ...first!, documentKey: "PD1-001-COPY" },
        retentionBasis: "CITED_BY_FACT" as const,
        technicalFacts: 1,
        claims: 0,
      },
    ];
    const report = checkDocumentIntegrity(duplicated, [], new Set());
    expect(report.duplicateLocators).toHaveLength(1);
    expect(report.duplicateLocators[0]?.documentKeys).toEqual(["PD1-001", "PD1-001-COPY"]);
  });
});
