/**
 * A minimal, dependency-free reader for the one workbook this project treats as
 * authoritative.
 *
 * ── Why not a library ───────────────────────────────────────────────────────
 *
 * Adding a dependency needs approval, and this reader needs to do exactly four
 * things: inflate a ZIP, resolve shared strings, read cell values, and follow
 * hyperlink relationships. Node's `zlib` covers the first; the rest is XML this
 * file reads with explicit regular expressions. It is not a general XLSX
 * implementation and must not be used as one — it ignores styles, formulas,
 * dates, and every part of the format the authoritative workbook does not use.
 *
 * ── Why hyperlinks are read at all ──────────────────────────────────────────
 *
 * `مشخصات فنی-En` carries the reference URL as a hyperlink relationship, not as
 * cell text. Reading only the text would lose the locator that identifies which
 * external document a row's technical data comes from, which is the one thing
 * the workbook says about provenance.
 */

import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
/** The ZIP end-of-central-directory record is at most 22 bytes plus a 64 KiB comment. */
const MAX_EOCD_SEARCH = 22 + 0xffff;
const METHOD_STORED = 0;

/** One cell: its A1 reference, its resolved text, and the URL any hyperlink gives it. */
export interface XlsxCell {
  readonly ref: string;
  readonly value: string;
  readonly hyperlink: string | null;
}

export interface XlsxSheet {
  readonly name: string;
  /** Keyed by 1-based row number, then by 1-based column number. */
  readonly rows: ReadonlyMap<number, ReadonlyMap<number, XlsxCell>>;
}

export interface XlsxWorkbook {
  readonly sheets: readonly XlsxSheet[];
}

/** Reads a ZIP container into `entry name -> bytes`. Stored and deflated members only. */
export function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  let eocd = -1;
  const floor = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let i = buffer.length - 22; i >= floor; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP container: end-of-central-directory record not found.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();

  for (let n = 0; n < entryCount; n++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_HEADER_SIGNATURE) {
      throw new Error(`Malformed ZIP: bad central directory header at offset ${offset}.`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and extra fields at its own lengths, which are
    // allowed to differ from the central directory's. Read the local ones.
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === METHOD_STORED ? Buffer.from(raw) : inflateRawSync(raw));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Decodes XML entities. `&amp;` is decoded LAST on purpose: decoding it first would turn
 * the literal text `&amp;lt;` into `<`, inventing markup the cell never contained.
 */
function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");
}

/** `A1` -> 1, `Z1` -> 26, `AA1` -> 27. */
export function columnNumber(ref: string): number {
  const match = /^([A-Z]+)/.exec(ref);
  if (!match?.[1]) throw new Error(`Not a cell reference: ${ref}`);
  let n = 0;
  for (const ch of match[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 1 -> `A`, 27 -> `AA`. */
export function columnName(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function expandRange(ref: string): string[] {
  if (!ref.includes(":")) return [ref];
  const [from, to] = ref.split(":");
  if (!from || !to) return [ref];
  const c1 = columnNumber(from);
  const c2 = columnNumber(to);
  const r1 = Number(/\d+/.exec(from)?.[0] ?? 0);
  const r2 = Number(/\d+/.exec(to)?.[0] ?? 0);
  const out: string[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) out.push(`${columnName(c)}${r}`);
  }
  return out;
}

function readRelationships(entries: Map<string, Buffer>, path: string): Map<string, string> {
  const rels = new Map<string, string>();
  const bytes = entries.get(path);
  if (!bytes) return rels;
  const xml = bytes.toString("utf8");
  for (const m of xml.matchAll(
    /<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*?\/>/g,
  )) {
    if (m[1] && m[2]) rels.set(m[1], decodeXmlText(m[2]));
  }
  return rels;
}

function readSharedStrings(entries: Map<string, Buffer>): string[] {
  const bytes = entries.get("xl/sharedStrings.xml");
  if (!bytes) return [];
  const xml = bytes.toString("utf8");
  const out: string[] = [];
  for (const item of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = "";
    // A shared string is split across <t> runs when parts of it are styled differently.
    // Concatenating the runs is what reassembles the cell's actual text.
    for (const run of (item[1] ?? "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
      text += decodeXmlText(run[1] ?? "");
    }
    out.push(text);
  }
  return out;
}

function readSheet(
  entries: Map<string, Buffer>,
  sheetPath: string,
  name: string,
  shared: readonly string[],
): XlsxSheet {
  const bytes = entries.get(sheetPath);
  if (!bytes) throw new Error(`Workbook is missing worksheet part: ${sheetPath}`);
  const xml = bytes.toString("utf8");

  const relsPath = sheetPath.replace(/\/([^/]+)$/, "/_rels/$1.rels");
  const rels = readRelationships(entries, relsPath);

  const hyperlinks = new Map<string, string>();
  for (const m of xml.matchAll(/<hyperlink\b[^>]*?\/>/g)) {
    const tag = m[0];
    const ref = /ref="([^"]+)"/.exec(tag)?.[1];
    if (!ref) continue;
    const relId = /r:id="([^"]+)"/.exec(tag)?.[1];
    const location = /location="([^"]+)"/.exec(tag)?.[1];
    const display = /display="([^"]+)"/.exec(tag)?.[1];
    const url = relId
      ? (rels.get(relId) ?? "")
      : location
        ? `#${decodeXmlText(location)}`
        : display
          ? decodeXmlText(display)
          : "";
    for (const cellRef of expandRange(ref)) hyperlinks.set(cellRef, url);
  }

  const rows = new Map<number, Map<number, XlsxCell>>();
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(/\br="(\d+)"/.exec(rowMatch[1] ?? "")?.[1] ?? 0);
    if (!rowNumber) continue;
    const cells = new Map<number, XlsxCell>();
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      if (!ref) continue;
      const cellType = /\bt="([^"]+)"/.exec(attributes)?.[1];
      let value = "";
      if (cellType === "inlineStr") {
        for (const run of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
          value += decodeXmlText(run[1] ?? "");
        }
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw !== undefined) {
          value = cellType === "s" ? (shared[Number(raw)] ?? "") : decodeXmlText(raw);
        }
      }
      cells.set(columnNumber(ref), { ref, value, hyperlink: hyperlinks.get(ref) ?? null });
    }
    rows.set(rowNumber, cells);
  }
  return { name, rows };
}

/** Reads the whole workbook. Sheets come back in the order the workbook declares them. */
export function readWorkbook(buffer: Buffer): XlsxWorkbook {
  const entries = readZipEntries(buffer);
  const workbookXml = entries.get("xl/workbook.xml");
  if (!workbookXml) throw new Error("Not an XLSX workbook: xl/workbook.xml is missing.");
  const shared = readSharedStrings(entries);
  const workbookRels = readRelationships(entries, "xl/_rels/workbook.xml.rels");

  const sheets: XlsxSheet[] = [];
  for (const m of workbookXml.toString("utf8").matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attributes = m[1] ?? "";
    const name = decodeXmlText(/name="([^"]*)"/.exec(attributes)?.[1] ?? "");
    const relId = /r:id="([^"]+)"/.exec(attributes)?.[1];
    const target = relId ? rels(workbookRels, relId) : null;
    if (!target) continue;
    sheets.push(readSheet(entries, target, name, shared));
  }
  return { sheets };
}

/** Resolves a workbook-relative relationship target to its part name inside the container. */
function rels(workbookRels: Map<string, string>, relId: string): string | null {
  const target = workbookRels.get(relId);
  if (!target) return null;
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}
