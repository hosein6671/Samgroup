/**
 * The document inventory, and the integrity checks that keep it honest.
 *
 * ── A publisher is not a document ───────────────────────────────────────────
 *
 * The first cut of this importer registered ONE King Power product-page document because all
 * 51 King Power rows share a publisher. That is wrong twice over. The 51 product pages are 51
 * distinct URLs, one per product, and each is a different document; and a product page and
 * the TDS it links to are separate documents with separate content, separate revisions and
 * separate evidence. Collapsing them would make it impossible to say whether a claim came
 * from a marketing page or from a measured table.
 *
 ── Candidates versus planned rows ──────────────────────────────────────────
 *
 * A URL in a spreadsheet cell is PROVENANCE. It says where somebody looked; it does not, on
 * its own, give this system any content, and inserting a `source_documents` row for it would
 * manufacture a document out of an address. So this file builds CANDIDATES, and
 * `partitionByEvidence` decides which become rows:
 *
 *   planned    a planned SourceFact cites it — or it is the workbook the ImportRun was made
 *              from, the one durable relationship modelled without a fact
 *   provenance addressed and cited by nothing: kept in the review manifest, never written
 *
 * ── The candidate set ──────────────────────────────────────────────────────
 *
 *   WORKBOOK             1   the authoritative workbook itself, hashed at run time
 *   SUPPLIER_CATALOGUE   1   the supplied HSB catalogue PDF
 *   TECHNICAL_DATA_SHEET 51  the King Power TDS PDFs, transcribed in `data/king-power.data`
 *   PRODUCT_PAGE         51  the King Power product pages, DERIVED from the workbook's own
 *                            `مشخصات فنی-En` cell — one per King Power row. Exactly ONE of
 *                            them carries transcribed evidence (the unnamed-automaker claim
 *                            on the ATF-DCT page); the other 50 are provenance locators.
 *   PRODUCT_PAGE         15  the Addilex pages, which ARE the specification sheet: Addilex
 *                            publishes the table on the page, so page and sheet are one
 *                            document and splitting them would invent a second
 *
 * The 51 page candidates are DERIVED, not transcribed. Their locator is a workbook cell, so
 * they re-derive byte-identically on every run; hand-listing them in the reviewed dataset
 * would have made a machine-readable fact into a hand-maintained one. Their keys are stable,
 * so a later gate that does transcribe a page lands on the row it would have had.
 *
 * ── Locator-only documents ─────────────────────────────────────────────────
 *
 * A document with a SHA-256 was captured and hashed, and would carry a `SourceAsset`. A
 * document without one is a cited locator: it was addressed, not stored. `retrievedAt` on a
 * locator-only document records when the CITING document was read — the workbook, for the
 * derived pages — because this gate fetches nothing at run time.
 */

import { ResultBasis } from "../../../prisma/generated/enums";

import {
  ENTRIES_BY_WORKBOOK_ROW,
  DOCUMENTS_BY_KEY,
  WORKBOOK_DOCUMENT_KEY,
} from "./data/source-catalog.data";
import { sourceFamilyOf } from "./workbook-parser";

import type { SourceDocumentDescriptor, WorkbookProductRow } from "./catalog-import.types";

export { WORKBOOK_DOCUMENT_KEY };

/** The HSB catalogue's key. One catalogue, one document, 34 products citing it. */
export const HSB_CATALOGUE_KEY = "HSB-CAT";

/** What kind of thing a document is. Derived from its key in ONE place, by rule. */
export type DocumentRole =
  "WORKBOOK" | "SUPPLIER_CATALOGUE" | "TECHNICAL_DATA_SHEET" | "PRODUCT_PAGE";

/** The suffix that marks a King Power product page apart from its TDS. */
export const PRODUCT_PAGE_SUFFIX = "-PAGE";

export function documentRoleOf(documentKey: string): DocumentRole {
  if (documentKey === WORKBOOK_DOCUMENT_KEY) return "WORKBOOK";
  if (documentKey === HSB_CATALOGUE_KEY) return "SUPPLIER_CATALOGUE";
  if (documentKey.endsWith(PRODUCT_PAGE_SUFFIX)) return "PRODUCT_PAGE";
  // Addilex publishes its specification table ON the product page: the page IS the sheet.
  if (documentKey.startsWith("ADX-")) return "PRODUCT_PAGE";
  return "TECHNICAL_DATA_SHEET";
}

/**
 * The product-page document key for a workbook row, derived from the row's TDS key so that
 * nothing here does arithmetic on a row number. A row with no reviewed TDS entry has no
 * derived page: the page key exists to sit beside a TDS, not to stand in for one.
 */
export function productPageDocumentKeyFor(rowNumber: number): string | null {
  const entry = ENTRIES_BY_WORKBOOK_ROW.get(rowNumber);
  if (!entry || entry.family !== "king-power") return null;
  if (entry.documentKey.endsWith(PRODUCT_PAGE_SUFFIX)) return entry.documentKey;
  return `${entry.documentKey}${PRODUCT_PAGE_SUFFIX}`;
}

export interface WorkbookDocumentInput {
  readonly fileName: string;
  readonly sha256: string;
  readonly byteSize: number;
  /** When the workbook was read. A fixed constant, never `new Date()` — the plan is a hash. */
  readonly retrievedAt: string;
}

/** A locator the workbook states for a row, checked against the document that claims it. */
export interface LocatorMismatch {
  readonly rowNumber: number;
  readonly documentKey: string;
  readonly workbookLocator: string;
  readonly documentLocator: string;
}

export interface DocumentInventory {
  /**
   * Every document the workbook or a reviewed dataset ADDRESSES. A candidate, not a plan:
   * `partitionByEvidence` decides which of these become `source_documents` rows.
   */
  readonly candidates: readonly SourceDocumentDescriptor[];
  /** Product page key per King Power row, so the planner can cite the right one. */
  readonly productPageKeyByRow: ReadonlyMap<number, string>;
  /** The workbook row a derived product-page candidate came from. */
  readonly rowByProductPageKey: ReadonlyMap<string, number>;
  /** Documents whose locator disagrees with the workbook cell that cites them. */
  readonly locatorMismatches: readonly LocatorMismatch[];
  /** King Power rows with no reviewed TDS entry, and therefore no derived page document. */
  readonly kingPowerRowsWithoutPageDocument: readonly number[];
}

/**
 * Builds every document candidate, in a stable order: the workbook, then the reviewed
 * documents in their dataset order, then the derived product pages in workbook order.
 */
export function buildDocumentInventory(
  rows: readonly WorkbookProductRow[],
  workbook: WorkbookDocumentInput,
): DocumentInventory {
  const documents: SourceDocumentDescriptor[] = [
    {
      documentKey: WORKBOOK_DOCUMENT_KEY,
      locatorType: "UPLOADED_FILE",
      locatorValue: workbook.fileName,
      publisher: "SAM Group",
      title: "Authoritative catalog workbook",
      sha256: workbook.sha256,
      byteSize: workbook.byteSize,
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pageCount: null,
      revisionLabel: null,
      retrievedAt: workbook.retrievedAt,
      defaultResultBasis: ResultBasis.UNSPECIFIED,
    },
  ];

  const seenKeys = new Set<string>([WORKBOOK_DOCUMENT_KEY]);
  const productPageKeyByRow = new Map<number, string>();
  const rowByProductPageKey = new Map<string, number>();
  const locatorMismatches: LocatorMismatch[] = [];

  // The reviewed documents, in dataset order. A hand-authored product page (there is one, the
  // ATF-DCT page a claim was read from) already carries the derived key and is reused rather
  // than duplicated.
  for (const document of DOCUMENTS_BY_KEY.values()) {
    documents.push(document);
    seenKeys.add(document.documentKey);
  }

  for (const row of rows) {
    const entry = ENTRIES_BY_WORKBOOK_ROW.get(row.rowNumber);
    if (!entry) continue;

    // Every reviewed document that is itself the row's source must cite the same locator the
    // workbook does. A disagreement means the transcription and the workbook are looking at
    // two different pages, and no fact from it can be trusted to belong to this product.
    const own = DOCUMENTS_BY_KEY.get(entry.documentKey);
    if (own && own.locatorType === "URL" && own.locatorValue !== row.technicalReferenceEn) {
      // A King Power row's own document is the TDS PDF, which is legitimately a different
      // address from the page the workbook cites. Only same-role documents are compared.
      if (documentRoleOf(entry.documentKey) === "PRODUCT_PAGE") {
        locatorMismatches.push({
          rowNumber: row.rowNumber,
          documentKey: entry.documentKey,
          workbookLocator: row.technicalReferenceEn,
          documentLocator: own.locatorValue,
        });
      }
    }

    const pageKey = productPageDocumentKeyFor(row.rowNumber);
    if (pageKey === null) continue;
    productPageKeyByRow.set(row.rowNumber, pageKey);
    rowByProductPageKey.set(pageKey, row.rowNumber);

    const existing = DOCUMENTS_BY_KEY.get(pageKey);
    if (existing) {
      if (existing.locatorValue !== row.technicalReferenceEn) {
        locatorMismatches.push({
          rowNumber: row.rowNumber,
          documentKey: pageKey,
          workbookLocator: row.technicalReferenceEn,
          documentLocator: existing.locatorValue,
        });
      }
      continue;
    }
    if (seenKeys.has(pageKey)) continue;
    seenKeys.add(pageKey);
    documents.push({
      documentKey: pageKey,
      locatorType: "URL",
      locatorValue: row.technicalReferenceEn,
      publisher: "King Power Lubricants",
      title: `King Power product page — ${row.name}`,
      // Locator only: the page was addressed by the workbook, not captured by this gate.
      sha256: null,
      byteSize: null,
      mediaType: "text/html",
      pageCount: null,
      revisionLabel: null,
      // The date the CITING document — the workbook — was read. Nothing is fetched here.
      retrievedAt: workbook.retrievedAt,
      defaultResultBasis: ResultBasis.UNSPECIFIED,
    });
  }

  // `sourceFamilyOf` decides which rows are King Power. A row that cites King Power but has no
  // reviewed TDS entry gets NO page document: the page key is derived from the TDS key, and
  // inventing one from the row number would put position back into a document identifier. The
  // row is reported here and separately carries `SOURCE_NOT_TRANSCRIBED` in the plan.
  const kingPowerRowsWithoutPageDocument = rows
    .filter(
      (row) => sourceFamilyOf(row) === "king-power" && !productPageKeyByRow.has(row.rowNumber),
    )
    .map((row) => row.rowNumber);

  return {
    candidates: documents,
    productPageKeyByRow,
    rowByProductPageKey,
    locatorMismatches,
    kingPowerRowsWithoutPageDocument,
  };
}

// ── Evidence-bearing versus addressed ───────────────────────────────────────

export interface DocumentCitation {
  readonly documentKey: string;
  /** `technical` = a property reading; `claim` = a statement the source makes. */
  readonly citationKind: "technical" | "claim";
}

/** Why a candidate becomes a `source_documents` row. Never "because a URL exists". */
export type RetentionBasis =
  /** At least one planned SourceFact cites it. */
  | "CITED_BY_FACT"
  /** It is the file the ImportRun was made from, and `ImportRun.sourceDocumentId` names it. */
  | "IMPORT_RUN_SOURCE";

export interface PlannedDocument {
  readonly document: SourceDocumentDescriptor;
  readonly retentionBasis: RetentionBasis;
  readonly technicalFacts: number;
  readonly claims: number;
}

/**
 * A locator the sources ADDRESS and no evidence cites.
 *
 * Kept in the review manifest as provenance and NOT planned as a database row. A URL in a
 * spreadsheet cell says where somebody looked; it is not, on its own, a document this system
 * has any content for, and inserting 50 empty `source_documents` rows to make an inventory
 * total look complete would be inventing evidence out of an address.
 */
export interface ProvenanceLocator {
  /** The key it WOULD have had, so a later gate that transcribes it lands on the same row. */
  readonly documentKey: string;
  readonly rowNumber: number | null;
  readonly locatorType: "URL" | "UPLOADED_FILE";
  readonly locatorValue: string;
  readonly publisher: string;
  readonly title: string;
  readonly role: DocumentRole;
  readonly reason: string;
}

export interface DocumentPartition {
  readonly planned: readonly PlannedDocument[];
  readonly provenanceLocators: readonly ProvenanceLocator[];
}

/**
 * Splits the candidates into what would be written and what is only recorded.
 *
 * The rule is evidence, not addressability: a candidate is planned when a planned SourceFact
 * cites it, or when it is the workbook the run itself was made from — the one durable
 * relationship that is modelled without a fact, because `ImportRun.sourceDocumentId` points
 * at it and the run's own SHA-256 identifies it. Everything else is a provenance locator.
 */
export function partitionByEvidence(
  inventory: DocumentInventory,
  citations: readonly DocumentCitation[],
): DocumentPartition {
  const tallies = new Map<string, { technical: number; claims: number }>();
  for (const citation of citations) {
    const tally = tallies.get(citation.documentKey) ?? { technical: 0, claims: 0 };
    if (citation.citationKind === "technical") tally.technical++;
    else tally.claims++;
    tallies.set(citation.documentKey, tally);
  }

  const planned: PlannedDocument[] = [];
  const provenanceLocators: ProvenanceLocator[] = [];

  for (const document of inventory.candidates) {
    const tally = tallies.get(document.documentKey) ?? { technical: 0, claims: 0 };
    const cited = tally.technical + tally.claims > 0;
    if (cited) {
      planned.push({
        document,
        retentionBasis: "CITED_BY_FACT",
        technicalFacts: tally.technical,
        claims: tally.claims,
      });
      continue;
    }
    if (document.documentKey === WORKBOOK_DOCUMENT_KEY) {
      planned.push({
        document,
        retentionBasis: "IMPORT_RUN_SOURCE",
        technicalFacts: 0,
        claims: 0,
      });
      continue;
    }
    provenanceLocators.push({
      documentKey: document.documentKey,
      rowNumber: inventory.rowByProductPageKey.get(document.documentKey) ?? null,
      locatorType: document.locatorType,
      locatorValue: document.locatorValue,
      publisher: document.publisher,
      title: document.title,
      role: documentRoleOf(document.documentKey),
      reason:
        "Addressed by the workbook and cited by no planned SourceFact, claim or evidence " +
        "link. Recorded as provenance; not planned as a source_documents row.",
    });
  }

  return { planned, provenanceLocators };
}

export interface DocumentCountByRole {
  readonly publisher: string;
  readonly role: DocumentRole;
  readonly locatorType: "URL" | "UPLOADED_FILE";
  readonly count: number;
}

export interface DuplicateLocator {
  readonly locator: string;
  readonly documentKeys: readonly string[];
}

export interface MiscitedFact {
  readonly documentKey: string;
  readonly role: DocumentRole;
  readonly citationKind: "technical" | "claim";
  readonly count: number;
}

export interface DocumentIntegrityReport {
  /** `source_documents` rows an apply gate would insert. Evidence-bearing only. */
  readonly totalDocuments: number;
  /** Candidates the sources address. Larger than `totalDocuments` by the provenance set. */
  readonly candidateDocuments: number;
  /** Locators retained as provenance and deliberately NOT planned as database rows. */
  readonly provenanceLocators: number;
  /** How each planned document earned its row. Never "a URL exists". */
  readonly retentionByBasis: readonly { readonly basis: RetentionBasis; readonly count: number }[];
  readonly countsByRole: readonly DocumentCountByRole[];
  readonly uniqueLocators: number;
  readonly duplicateLocators: readonly DuplicateLocator[];
  /** Documents that would have a `SourceAsset`: captured and hashed. */
  readonly capturedDocuments: number;
  /** Documents cited by address only, with no stored bytes and therefore no asset. */
  readonly locatorOnlyDocuments: number;
  /** Distinct SHA-256 values — the `source_assets` row count an apply gate would insert. */
  readonly sourceAssets: number;
  readonly factsByDocument: readonly {
    readonly documentKey: string;
    readonly role: DocumentRole;
    readonly technical: number;
    readonly claims: number;
  }[];
  readonly documentsWithZeroEvidence: readonly string[];
  /** Facts whose `documentKey` names no planned document. Must always be empty. */
  readonly evidenceWithoutDocument: readonly string[];
  /** Statements cited to a TDS. King Power prints statements on its PAGE, not in the table. */
  readonly claimsCitingTechnicalDataSheet: readonly MiscitedFact[];
  /** Property readings cited to a product page while a TDS exists for the same product. */
  readonly technicalFactsCitingProductPage: readonly MiscitedFact[];
}

/**
 * Reconciles the planned citations against the PLANNED documents.
 *
 * Only the planned set is checked, because only the planned set would be written. A candidate
 * that no evidence cites is not a document with a problem — it is a locator, and it is
 * reported as one by `partitionByEvidence` instead of inflating this report.
 *
 * `productPagesWithSiblingTds` holds the PAGE document keys whose product ALSO has a technical
 * data sheet, so a property reading cited to a page can be judged: for Addilex the page IS the
 * sheet and citing it is correct, while for King Power it would mean a measured value
 * attributed to a marketing page.
 */
export function checkDocumentIntegrity(
  planned: readonly PlannedDocument[],
  citations: readonly DocumentCitation[],
  productPagesWithSiblingTds: ReadonlySet<string>,
  provenanceLocators: readonly ProvenanceLocator[] = [],
): DocumentIntegrityReport {
  const documents = planned.map((entry) => entry.document);
  const byKey = new Map(documents.map((document) => [document.documentKey, document]));

  const roleCounts = new Map<string, DocumentCountByRole>();
  const byLocator = new Map<string, string[]>();
  const hashes = new Set<string>();
  let captured = 0;

  for (const document of documents) {
    const role = documentRoleOf(document.documentKey);
    const groupKey = `${document.publisher}|${role}|${document.locatorType}`;
    const existing = roleCounts.get(groupKey);
    roleCounts.set(groupKey, {
      publisher: document.publisher,
      role,
      locatorType: document.locatorType,
      count: (existing?.count ?? 0) + 1,
    });

    const locatorKey = `${document.locatorType}|${document.locatorValue}`;
    const bucket = byLocator.get(locatorKey);
    if (bucket) bucket.push(document.documentKey);
    else byLocator.set(locatorKey, [document.documentKey]);

    if (document.sha256 !== null) {
      captured++;
      hashes.add(document.sha256);
    }
  }

  const tallies = new Map<string, { technical: number; claims: number }>();
  const evidenceWithoutDocument = new Set<string>();
  for (const citation of citations) {
    if (!byKey.has(citation.documentKey)) {
      evidenceWithoutDocument.add(citation.documentKey);
      continue;
    }
    const tally = tallies.get(citation.documentKey) ?? { technical: 0, claims: 0 };
    if (citation.citationKind === "technical") tally.technical++;
    else tally.claims++;
    tallies.set(citation.documentKey, tally);
  }

  const factsByDocument = documents.map((document) => {
    const tally = tallies.get(document.documentKey) ?? { technical: 0, claims: 0 };
    return {
      documentKey: document.documentKey,
      role: documentRoleOf(document.documentKey),
      technical: tally.technical,
      claims: tally.claims,
    };
  });

  const claimsCitingTechnicalDataSheet: MiscitedFact[] = [];
  const technicalFactsCitingProductPage: MiscitedFact[] = [];
  for (const entry of factsByDocument) {
    if (entry.role === "TECHNICAL_DATA_SHEET" && entry.claims > 0) {
      claimsCitingTechnicalDataSheet.push({
        documentKey: entry.documentKey,
        role: entry.role,
        citationKind: "claim",
        count: entry.claims,
      });
    }
    if (
      entry.role === "PRODUCT_PAGE" &&
      entry.technical > 0 &&
      productPagesWithSiblingTds.has(entry.documentKey)
    ) {
      technicalFactsCitingProductPage.push({
        documentKey: entry.documentKey,
        role: entry.role,
        citationKind: "technical",
        count: entry.technical,
      });
    }
  }

  const bases: RetentionBasis[] = ["CITED_BY_FACT", "IMPORT_RUN_SOURCE"];

  return {
    totalDocuments: documents.length,
    candidateDocuments: documents.length + provenanceLocators.length,
    provenanceLocators: provenanceLocators.length,
    retentionByBasis: bases.map((basis) => ({
      basis,
      count: planned.filter((entry) => entry.retentionBasis === basis).length,
    })),
    countsByRole: [...roleCounts.values()].sort(
      (a, b) =>
        a.publisher.localeCompare(b.publisher, "en") ||
        a.role.localeCompare(b.role, "en") ||
        a.locatorType.localeCompare(b.locatorType, "en"),
    ),
    uniqueLocators: byLocator.size,
    duplicateLocators: [...byLocator.entries()]
      .filter(([, keys]) => keys.length > 1)
      .map(([locator, documentKeys]) => ({ locator, documentKeys }))
      .sort((a, b) => a.locator.localeCompare(b.locator, "en")),
    capturedDocuments: captured,
    locatorOnlyDocuments: documents.length - captured,
    sourceAssets: hashes.size,
    factsByDocument,
    documentsWithZeroEvidence: factsByDocument
      .filter((entry) => entry.technical === 0 && entry.claims === 0)
      .map((entry) => entry.documentKey),
    evidenceWithoutDocument: [...evidenceWithoutDocument].sort(),
    claimsCitingTechnicalDataSheet,
    technicalFactsCitingProductPage,
  };
}
