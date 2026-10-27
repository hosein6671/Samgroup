import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { STRUCTURAL_LISTS } from "@sam-group/types/structural-lists";

import * as contact from "@/features/contact/contact-data";
import { FAQ_PAGE_DEFAULTS } from "@/features/faq/page-content";
import * as home from "@/features/home/home-data";
import { getCategoryContent } from "@/features/products/category/data";
import { getProductDetailEditorial } from "@/features/products/detail/product-detail-content";
import * as products from "@/features/products/products-data";

import { contentCatalog } from "./content-catalogs";
import { uiCatalog } from "./catalogs";
import { localizeContent } from "./localize-content";

/**
 * The Persian catalogs stay complete as the site changes.
 *
 * A new `t("…")` call, or a new sentence in a layout's built-in copy, fails here until it has a
 * Persian entry — otherwise it would silently render in English on `/fa`.
 */

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.spec\./.test(name) ? [path] : [];
  });
}

/** Strings that are Latin on purpose in every language: codes, grades, units and identifiers. */
const LATIN_BY_DESIGN = new Set([
  "BS 150",
  "CFR",
  "CIF",
  "EXW",
  "FOB",
  "IBC",
  "PAG",
  "PAO",
  "PDF",
  "SAM GROUP",
  "SN 150",
  "SN 350",
  "SN 500",
  "SN 650",
  "TAN",
  "TBN",
  "TDS · SDS · COA",
  "TPEO",
]);

/** Keys whose values are identifiers, not text (mirrors `MACHINE_KEYS`, plus form vocabulary). */
const NOT_TEXT = new Set([
  "id",
  "key",
  "slug",
  "href",
  "src",
  "icon",
  "code",
  "kind",
  "route",
  "slot",
  "photo",
  "focus",
  "drift",
  "image",
  "anchor",
  "familyId",
  "type",
  "name",
  "autoComplete",
  "source",
  "access",
  "layout",
  "axisKey",
  "unit",
  "method",
  "mode",
  "form",
  "twitterCardType",
  "subRangeIds",
]);

function untranslated(value: unknown, key = "", out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (!NOT_TEXT.has(key) && /[A-Za-z]{2}/.test(value) && !/[؀-ۿ]/.test(value))
      if (!LATIN_BY_DESIGN.has(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) untranslated(item, key, out);
  } else if (value && typeof value === "object") {
    for (const [name, child] of Object.entries(value)) untranslated(child, name, out);
  }
  return out;
}

describe("the Persian UI catalog", () => {
  it("has an entry for every literal passed to a translator", () => {
    const missing = new Set<string>();
    const call = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;
    for (const file of sourceFiles(SRC)) {
      for (const match of readFileSync(file, "utf8").matchAll(call)) {
        const source = JSON.parse(`"${match[1] ?? ""}"`) as string;
        if (!Object.hasOwn(uiCatalog("fa"), source)) missing.add(source);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("keeps every {placeholder} of the English source in the translation", () => {
    for (const catalog of [uiCatalog("fa"), contentCatalog("fa")]) {
      for (const [source, translation] of Object.entries(catalog)) {
        const names = (text: string): string[] =>
          [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
        expect(names(translation), source).toEqual(names(source));
      }
    }
  });
});

describe("the Persian built-in copy", () => {
  it("leaves no English sentence in any layout's built-in copy", () => {
    const families = products.FAMILIES.map((family) => family.id);
    const all = [
      STRUCTURAL_DEFAULTS,
      STRUCTURAL_LISTS,
      { ...home },
      { ...products },
      { ...contact },
      FAQ_PAGE_DEFAULTS,
      ...families.map((id) => getCategoryContent(id)),
      ...families.map((id) => getProductDetailEditorial(id)),
    ];
    const left = new Set<string>();
    for (const value of all) untranslated(localizeContent("fa", value), "", left);
    expect([...left]).toEqual([]);
  });
});
