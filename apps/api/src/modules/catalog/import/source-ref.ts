/**
 * Minting a PROPOSED source reference, and the name normalization used as matching evidence.
 *
 * ── What a proposed reference is, and is not ────────────────────────────────
 *
 * The workbook has no identifier column of its own, so the first authoritative generation has
 * nothing but structure to derive a reference from: `SAMCAT-<lineage>-R<row>`, deterministic
 * and independent of everything editorial about the row.
 *
 * That is a PROPOSAL and nothing more. Row position is mutable — one insertion above the
 * block moves every row below it — so a reference minted from position is only meaningful
 * until the owner ratifies it. AFTER RATIFICATION THE STRING IS OPAQUE: `R123` no longer
 * means "row 123", nothing re-derives it, and `identity-ledger.ts` is the only thing that
 * decides which row carries it.
 *
 * ── The lineage token, and why it is not the file hash ──────────────────────
 *
 * `W1` names the authoritative workbook's LINEAGE, not a particular file. Re-saving the
 * workbook changes its bytes and therefore its SHA-256, but not which workbook it is; a hash
 * in the identity would re-mint all 100 proposals on every save. The hash is still captured —
 * as `SourceAsset.sha256`, where a changed file correctly means a new revision of the
 * evidence rather than a new set of products.
 *
 * A second, genuinely different authoritative workbook would get `W2` and a decision recorded
 * alongside it. There is no automatic path to one.
 */

/** Lineage token of the authoritative catalog workbook (`دسته بندی محصولات.xlsx`). */
export const WORKBOOK_LINEAGE = "W1";

/**
 * The two proposal shapes. `-NEW<n>` is minted only when a new row's position-derived
 * proposal is already spoken for by a row that MOVED — see `identity-ledger.ts`. A ratified
 * reference is whatever the ledger holds and is not required to match this at all.
 */
const SOURCE_REF_PATTERN = /^SAMCAT-W\d+-R\d{3,}(?:-NEW\d+)?$/;

/**
 * Mints the PROPOSED source reference for a row. Deterministic and pure: the same row number
 * always yields the same reference, and nothing about the row's content is read.
 */
export function proposeSourceRef(rowNumber: number, lineage: string = WORKBOOK_LINEAGE): string {
  if (!Number.isInteger(rowNumber) || rowNumber < 1) {
    throw new Error(`Row number must be a positive integer, received ${String(rowNumber)}.`);
  }
  return `SAMCAT-${lineage}-R${String(rowNumber).padStart(3, "0")}`;
}

export function isSourceRef(value: string): boolean {
  return SOURCE_REF_PATTERN.test(value);
}

/**
 * The comparison form of a product name. MATCHING EVIDENCE ONLY: used to re-find a row whose
 * position moved, never as identity, never published, and never written to a Product.
 *
 * Normalizing to NFKC folds the compatibility characters the sources use — a full-width
 * comma, an ellipsis — so a name that is typographically different but textually the same
 * still matches itself across a re-export.
 */
export function normalizeNameForMatching(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
