/**
 * The reviewed source datasets, assembled into the two lookups the planner needs.
 *
 * ── The workbook is a source document too ───────────────────────────────────
 *
 * `WORKBOOK_DOCUMENT_KEY` cites the authoritative workbook itself. Every fact the workbook
 * states — the exact name, the category, the `نوع محصول` — traces to a spreadsheet cell in
 * it, and a bare performance designation read out of a product NAME is evidenced by that
 * cell and nothing else. The workbook has no URL and never will, which is exactly why
 * `SourceDocument` addresses a locator rather than requiring one.
 *
 * Its SHA-256 is filled in at run time from the file actually read, not hard-coded: the
 * hash identifies the revision in front of the importer, and pinning it here would let the
 * two drift apart silently.
 *
 * ── One row, one enrichment source ──────────────────────────────────────────
 *
 * `entriesByWorkbookRow` is keyed on the row, and a duplicate key is a build-time error.
 * Two datasets claiming the same row would mean one product silently receiving another's
 * technical data.
 */

import { ADDILEX_DOCUMENTS, ADDILEX_ENTRIES } from "./addilex.data";
import { HSB_DOCUMENT_CLAIMS, HSB_DOCUMENTS, HSB_ENTRIES } from "./hsb.data";
import { KING_POWER_DOCUMENTS, KING_POWER_ENTRIES } from "./king-power.data";

import type { ReviewedSourceEntry, SourceDocumentDescriptor } from "../catalog-import.types";
import type { DocumentLevelClaim } from "./hsb.data";

export { HSB_DOCUMENT_CLAIMS };
export type { DocumentLevelClaim };

/** The documentKey of the authoritative catalog workbook. */
export const WORKBOOK_DOCUMENT_KEY = "SAM-CATALOG-WORKBOOK";

export const REVIEWED_ENTRIES: readonly ReviewedSourceEntry[] = [
  ...KING_POWER_ENTRIES,
  ...HSB_ENTRIES,
  ...ADDILEX_ENTRIES,
];

export const REVIEWED_DOCUMENTS: readonly SourceDocumentDescriptor[] = [
  ...KING_POWER_DOCUMENTS,
  ...HSB_DOCUMENTS,
  ...ADDILEX_DOCUMENTS,
];

function buildEntryIndex(): ReadonlyMap<number, ReviewedSourceEntry> {
  const index = new Map<number, ReviewedSourceEntry>();
  for (const entry of REVIEWED_ENTRIES) {
    const existing = index.get(entry.workbookRow);
    if (existing) {
      throw new Error(
        `Two reviewed source entries claim workbook row ${entry.workbookRow}: ` +
          `"${existing.documentKey}" and "${entry.documentKey}". One row has one enrichment ` +
          `source; a second would silently give a product another product's technical data.`,
      );
    }
    index.set(entry.workbookRow, entry);
  }
  return index;
}

export const ENTRIES_BY_WORKBOOK_ROW = buildEntryIndex();

function buildDocumentIndex(): ReadonlyMap<string, SourceDocumentDescriptor> {
  const index = new Map<string, SourceDocumentDescriptor>();
  for (const document of REVIEWED_DOCUMENTS) {
    if (index.has(document.documentKey)) {
      throw new Error(`Duplicate source documentKey: "${document.documentKey}".`);
    }
    index.set(document.documentKey, document);
  }
  return index;
}

export const DOCUMENTS_BY_KEY = buildDocumentIndex();
