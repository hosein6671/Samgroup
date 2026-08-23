/**
 * Reads the 100 authoritative Product rows out of the catalog workbook.
 *
 * ── The sheet's shape, and why the parser asserts it ────────────────────────
 *
 * The products sheet puts one product on every THIRD row starting at row 3, with
 * the two rows between them merged into the product's block. Column K is
 * `comments`, P and S are the English and Farsi technical references, V is
 * `نام محصول`, Y is `نوع محصول` and Z is `دسته بندی محصولات`.
 *
 * None of that is guessed: the parser reads the header row and refuses to
 * continue if a column is not where it expects. A workbook whose layout changed
 * must fail loudly, because silently reading the wrong column would produce a
 * plausible-looking import of the wrong data.
 *
 * ── Category inheritance ────────────────────────────────────────────────────
 *
 * Column Z carries a category once per block and leaves the following rows'
 * cells empty — the value is visually merged down the block. Carrying it forward
 * is reading the sheet as printed, not inference, and each row records whether
 * the value was its own cell or inherited so provenance stays honest.
 *
 * ── The optional identifier column ──────────────────────────────────────────
 *
 * The workbook has no identifier column today, and row position is not identity
 * (`identity-ledger.ts`). If one is ever added, this parser reads it: any column
 * whose header is one of `IDENTIFIER_HEADERS` is taken as the row's RATIFIED
 * `sourceRef`, and that is the only path by which a re-sorted workbook can be
 * re-identified without inference. Its absence is normal and is not an error —
 * the run then falls back to matching evidence, and says so.
 */

import { readWorkbook } from "./xlsx-reader";

import type { WorkbookProductRow } from "./catalog-import.types";
import type { XlsxSheet } from "./xlsx-reader";

/** The worksheet holding the products. The other sheet (`ایده ها`) is ideas, not catalogue. */
export const PRODUCTS_SHEET_NAME = "محصولات";

const HEADER_ROW = 1;
const FIRST_PRODUCT_ROW = 3;
const LAST_PRODUCT_ROW = 300;
const PRODUCT_ROW_STRIDE = 3;

/** Column number -> the header text that column must carry. */
const EXPECTED_HEADERS: ReadonlyMap<number, string> = new Map([
  [11, "comments"],
  [16, "مشخصات فنی-En"],
  [19, "مشخصات فنی-Fa"],
  [22, "نام محصول"],
  [25, "نوع محصول"],
  [26, "دسته بندی محصولات"],
]);

/**
 * Header texts that mark a column as carrying the row's ratified `sourceRef`. Matched
 * case-insensitively after whitespace collapsing. Deliberately a closed list: a column is an
 * identifier because it was named one, never because its contents look like references.
 */
export const IDENTIFIER_HEADERS: readonly string[] = [
  "sourceref",
  "source ref",
  "source_ref",
  "شناسه",
  "شناسه محصول",
];

/** The header row is scanned this far for an identifier column. Column 40 is well past Z. */
const LAST_SCANNED_COLUMN = 40;

const COLUMN_COMMENT = 11;
const COLUMN_REFERENCE_EN = 16;
const COLUMN_REFERENCE_FA = 19;
const COLUMN_NAME = 22;
const COLUMN_PRODUCT_TYPE = 25;
const COLUMN_CATEGORY = 26;

/**
 * Collapses runs of whitespace and trims. Applied to the PUBLIC name because the
 * workbook contains double spaces (`CK-4  10W-40`) that are typing artefacts rather
 * than part of the name; `rawName` keeps the cell exactly as written so the artefact
 * is never lost, only not published.
 */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cellText(sheet: XlsxSheet, row: number, column: number): string {
  return sheet.rows.get(row)?.get(column)?.value ?? "";
}

/** Prefers the hyperlink target over the cell text: the text may be a label, not a URL. */
function cellReference(sheet: XlsxSheet, row: number, column: number): string {
  const cell = sheet.rows.get(row)?.get(column);
  if (!cell) return "";
  return cell.hyperlink && cell.hyperlink.length > 0 ? cell.hyperlink : cell.value;
}

export interface ParsedWorkbook {
  readonly sheetName: string;
  readonly rows: readonly WorkbookProductRow[];
  /** The column carrying ratified references, or null when the sheet has none. */
  readonly identifierColumn: number | null;
  /**
   * The identifier column's header EXACTLY as the sheet writes it, whitespace collapsed.
   *
   * The column is matched case-insensitively against `IDENTIFIER_HEADERS`, so the match
   * alone does not say what the cell actually reads. Custody verification pins the exact
   * wording, and cannot check it against a value nothing reported.
   *
   * Optional so that a `ParsedWorkbook` assembled by hand — the frozen fixture — stays valid
   * without restating a field it has no identifier column for.
   */
  readonly identifierHeader?: string | null;
  /** `rowNumber -> declared sourceRef`, empty when there is no identifier column. */
  readonly declaredSourceRefs: ReadonlyMap<number, string>;
}

/** Finds the identifier column, if the sheet has one. Absence is normal, not an error. */
function findIdentifierColumn(sheet: XlsxSheet): { column: number; header: string } | null {
  for (let column = 1; column <= LAST_SCANNED_COLUMN; column++) {
    const text = collapseWhitespace(cellText(sheet, HEADER_ROW, column));
    if (text.length > 0 && IDENTIFIER_HEADERS.includes(text.toLowerCase())) {
      return { column, header: text };
    }
  }
  return null;
}

/**
 * Parses the authoritative workbook. Throws rather than degrading: every caller of this
 * treats its output as the definition of which products exist.
 */
export function parseCatalogWorkbook(buffer: Buffer): ParsedWorkbook {
  const workbook = readWorkbook(buffer);
  const sheet = workbook.sheets.find((s) => s.name === PRODUCTS_SHEET_NAME);
  if (!sheet) {
    const found = workbook.sheets.map((s) => s.name).join(", ");
    throw new Error(
      `Workbook has no "${PRODUCTS_SHEET_NAME}" worksheet. Sheets present: ${found || "(none)"}.`,
    );
  }

  for (const [column, expected] of EXPECTED_HEADERS) {
    const actual = collapseWhitespace(cellText(sheet, HEADER_ROW, column));
    if (actual !== expected) {
      throw new Error(
        `Workbook layout changed: expected header "${expected}" in column ${column}, ` +
          `found "${actual}". Refusing to parse rather than read the wrong column.`,
      );
    }
  }

  const identifier = findIdentifierColumn(sheet);
  const identifierColumn = identifier === null ? null : identifier.column;
  const declaredSourceRefs = new Map<number, string>();

  const rows: WorkbookProductRow[] = [];
  let categoryBlock = "";

  for (let row = FIRST_PRODUCT_ROW; row <= LAST_PRODUCT_ROW; row += PRODUCT_ROW_STRIDE) {
    const ownCategory = collapseWhitespace(cellText(sheet, row, COLUMN_CATEGORY));
    if (ownCategory) categoryBlock = ownCategory;

    const rawName = cellText(sheet, row, COLUMN_NAME);
    const name = collapseWhitespace(rawName);
    if (!name) {
      throw new Error(
        `Workbook row ${row} has no product name. The 100 product rows are a fixed ` +
          `structure; a blank one means the sheet changed shape.`,
      );
    }

    if (identifierColumn !== null) {
      const declared = collapseWhitespace(cellText(sheet, row, identifierColumn));
      if (declared.length > 0) declaredSourceRefs.set(row, declared);
    }

    rows.push({
      sheetName: sheet.name,
      rowNumber: row,
      name,
      rawName,
      productTypeLabel: collapseWhitespace(cellText(sheet, row, COLUMN_PRODUCT_TYPE)),
      categoryLabel: categoryBlock,
      categoryIsOwnCell: ownCategory.length > 0,
      comment: collapseWhitespace(cellText(sheet, row, COLUMN_COMMENT)),
      technicalReferenceEn: cellReference(sheet, row, COLUMN_REFERENCE_EN),
      technicalReferenceFa: cellReference(sheet, row, COLUMN_REFERENCE_FA),
    });
  }

  return {
    sheetName: sheet.name,
    rows,
    identifierColumn,
    identifierHeader: identifier === null ? null : identifier.header,
    declaredSourceRefs,
  };
}

/**
 * Which external publisher a row's technical reference points at. `null` where the
 * reference is neither a recognised publisher nor a URL — the workbook writes the literal
 * text `کاتالوگ HSB` for the printed catalogue, which is a locator, not an address.
 */
export function sourceFamilyOf(row: WorkbookProductRow): "king-power" | "hsb" | "addilex" | null {
  const reference = row.technicalReferenceEn;
  if (reference.includes("kingpowerlub.com")) return "king-power";
  if (reference.includes("addilex.com")) return "addilex";
  if (reference.includes("HSB")) return "hsb";
  return null;
}
