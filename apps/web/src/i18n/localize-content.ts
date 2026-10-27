import "server-only";

import { uiCatalog } from "./catalogs";
import { contentCatalog } from "./content-catalogs";

/**
 * Property names whose string values are machine vocabulary — identifiers, paths, URLs, slugs,
 * enum values — and must never be translated even when their text happens to match an entry.
 * Specification values need no entry here: they are never catalog keys, so they pass through.
 */
const MACHINE_KEYS = new Set([
  "id",
  "key",
  "slug",
  "href",
  "src",
  "url",
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
  "categoryKey",
  "segment",
  "productType",
  "variant",
  "tone",
  "mode",
  "type",
  "unit",
  "method",
  "standard",
  "access",
  "layout",
  "form",
  "twitterCardType",
  "subRangeIds",
]);

/**
 * The built-in copy of a layout, in `locale`.
 *
 * Walks the value and replaces every string that has an entry in the locale's content catalog,
 * looking each one up whole — never a substring — so a grade, a test method or a number cannot be
 * rewritten by accident: those are never catalog entries, so they pass through unchanged even
 * under a `value` key, while a display value ("Engine room and deck") is translated.
 */
export function localizeContent<T>(locale: string, value: T): T {
  const catalog = contentCatalog(locale);
  const ui = uiCatalog(locale);
  if (Object.keys(catalog).length === 0 && Object.keys(ui).length === 0) return value;
  const exact = (text: string): string | undefined =>
    Object.hasOwn(catalog, text) ? catalog[text] : Object.hasOwn(ui, text) ? ui[text] : undefined;
  const lookup = (text: string): string => {
    const whole = exact(text) ?? exact(text.trim());
    if (whole !== undefined) return whole;
    // Rich text from the CMS: translate each element's own text and keep the markup as it is.
    if (/^\s*</.test(text)) {
      return text.replace(/>([^<>]*[A-Za-z][^<>]*)</g, (match, inner: string) => {
        const translated = exact(inner.trim());
        return translated === undefined ? match : `>${translated}<`;
      });
    }
    // Several lines in one field — paragraphs, or Markdown with headings and list items: translate
    // each line's text and keep its Markdown marker, so the structure renders exactly as before.
    if (text.includes("\n")) {
      return text
        .split("\n")
        .map((line) => {
          const [, marker = "", body = ""] =
            /^(\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+)?)(.*)$/.exec(line) ?? [];
          const translated = body.trim() === "" ? undefined : exact(body.trim());
          return translated === undefined ? line : `${marker}${translated}`;
        })
        .join("\n");
    }
    return text;
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return lookup(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object" && Object.getPrototypeOf(node) === Object.prototype) {
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [
          key,
          MACHINE_KEYS.has(key) && typeof child === "string" ? child : walk(child),
        ]),
      );
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * One piece of built-in copy in `locale` — for metadata titles and descriptions and other single
 * strings a server component owns. Looks in the content catalog first, then the UI catalog, and
 * returns the English source when neither has it.
 */
export function contentText(locale: string, source: string): string {
  const content = contentCatalog(locale);
  if (Object.hasOwn(content, source)) return content[source] ?? source;
  const ui = uiCatalog(locale);
  return Object.hasOwn(ui, source) ? (ui[source] ?? source) : source;
}
