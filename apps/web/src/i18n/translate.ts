/**
 * Translation — the message catalogs INTERNATIONALIZATION_STRATEGY.md §2 and §5 call for.
 *
 * ── What belongs here and what does not ─────────────────────────────────────
 *
 * The CMS stays the source of business content. What these catalogs translate is only text that
 * already lives in this application's code: UI chrome (`t`, here) and the built-in copy each layout
 * ships with for when the CMS has nothing published (`localizeContent`, in `localize-content.ts`). An editor translating
 * a page in the admin overrides the built-in copy exactly as the English editor overrides the
 * English built-in copy today.
 *
 * ── Why no `next-intl` ───────────────────────────────────────────────────────
 *
 * Locale routing already exists — hand-written middleware plus `[locale]` — and the only missing
 * piece was a catalog lookup. Adding the package would also bring its middleware and request
 * config, which overlap what is already built and tested. The `{name}` placeholder syntax is
 * `next-intl`'s, so adopting it later remains a mechanical change.
 *
 * ── Missing translations ─────────────────────────────────────────────────────
 *
 * Text with no entry renders its English source. Nothing throws, nothing renders empty.
 */

import { uiCatalog, type Catalog } from "./catalogs";

/** Placeholder values, written into the message as `{name}`. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** Translate one piece of English source text. */
export type Translate = (source: string, values?: MessageValues) => string;

function interpolate(message: string, values?: MessageValues): string {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

/** A translator over one catalog — what the client provider holds. */
export function translatorFrom(catalog: Catalog): Translate {
  return (source, values) =>
    interpolate(Object.hasOwn(catalog, source) ? (catalog[source] ?? source) : source, values);
}

/** The UI chrome translator for one locale. */
export function translator(locale: string): Translate {
  return translatorFrom(uiCatalog(locale));
}

/**
 * A number in the locale's own digits — `۲۰۲۶` in Persian — for counts, years and page numbers in
 * running text. Never for specification values: a grade, a viscosity or a test result is shown
 * exactly as published, in the digits the standard writes it in.
 */
export function formatCount(locale: string, value: number, grouping = false): string {
  try {
    return new Intl.NumberFormat(locale, { useGrouping: grouping }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * A two-digit ordinal in the locale's own digits — `01` in English, `۰۱` in Persian. The site's
 * numbered rows and counters use it in place of `String(n).padStart(2, "0")`.
 */
export function ordinal(locale: string, value: number): string {
  return formatCount(locale, value).padStart(2, formatCount(locale, 0));
}

/**
 * A number written as text — `"01"`, `"6"` — in the locale's own digits. Anything that is not
 * purely digits (a grade such as `SN 150`) is returned untouched.
 */
export function localDigits(locale: string, text: string): string {
  if (!/^\d+$/.test(text)) return text;
  const zero = formatCount(locale, 0);
  return zero === "0" ? text : text.replace(/\d/g, (d) => formatCount(locale, Number(d)));
}
