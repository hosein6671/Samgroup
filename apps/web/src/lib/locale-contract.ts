/**
 * The locale contract — validation and negotiation, with no transport and no runtime assumptions.
 *
 * ── Why this is separate from `locales.ts` ──────────────────────────────────
 *
 * Two consumers need these rules and they run in different places. `locales.ts` is server-only and
 * memoized, and serves `generateStaticParams` and the `[locale]` root layout at build time.
 * `middleware.ts` runs per request, in the Edge runtime, and may not import a `server-only` module.
 *
 * Splitting the *rules* out of the *fetching* is what keeps that from becoming duplication. There
 * is exactly one definition of "is this a valid active locale set" and exactly one definition of
 * "which locale does this request want", and both live here. Neither consumer reimplements either.
 *
 * Nothing in this file touches `process`, `fs`, `crypto` or any other Node-only API, so it is safe
 * in the Edge runtime. It is deliberately free of `import "server-only"` for the same reason — see
 * the note in `middleware.ts` about why that matters.
 *
 * ── Malformed data is rejected, never normalized ────────────────────────────
 *
 * Every validation below throws instead of coercing, dropping a bad row, or picking a winner. The
 * locale table is the routing source: a set this module cannot vouch for would become a route tree,
 * an `<html lang>` and a redirect target. Silently repairing it would ship an invented locale
 * configuration, which is precisely the failure the approved policy exists to prevent.
 */

import type { LocaleDirection, LocaleResponse } from "@sam-group/types";

/** The API path, without the `/api/v1` prefix the client composes. */
export const LOCALES_PATH = "/locales";

/**
 * The cookie a returning visitor's explicit language choice is remembered in.
 *
 * `NEXT_LOCALE` is named by INTERNATIONALIZATION_STRATEGY.md §2's detection order. **The writer is
 * the language switcher**, and only on an explicit choice — see `rememberLocale` in
 * `features/site/nav-behaviour.ts` for the attributes and for why ordinary navigation never writes
 * it. Reading it stays confined to `middleware.ts`, and only for a locale-less structural path: a
 * `/{locale}/…` URL states its own language and this cookie never overrides one.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Why a locale set was refused. Every value names a distinct, actionable fault. */
export type LocaleContractViolation =
  | "not-an-array"
  | "empty"
  | "malformed-row"
  | "duplicate-code"
  | "no-default"
  | "multiple-defaults";

/**
 * A locale set that cannot be trusted as a routing source.
 *
 * Its own class rather than a plain `Error` so a caller can tell a contract violation from a
 * transport failure without matching on message text — the two mean different things and, at build
 * time, point at different people.
 */
export class LocaleContractError extends Error {
  readonly violation: LocaleContractViolation;

  constructor(violation: LocaleContractViolation, detail: string) {
    super(`GET ${LOCALES_PATH} returned an unusable locale set (${violation}): ${detail}`);
    this.name = "LocaleContractError";
    this.violation = violation;
  }
}

const DIRECTIONS: readonly LocaleDirection[] = ["ltr", "rtl"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty string. A blank `code` would produce the route `//`, so blank is not a value. */
function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isLocaleResponse(value: unknown): value is LocaleResponse {
  if (!isRecord(value)) return false;

  return (
    isFilledString(value.code) &&
    isFilledString(value.name) &&
    isFilledString(value.nativeName) &&
    DIRECTIONS.some((direction) => direction === value.direction) &&
    typeof value.isDefault === "boolean"
  );
}

/**
 * An unknown payload, checked against every property the routing layer depends on.
 *
 * Six conditions, each of which would otherwise surface much later and much less legibly:
 *
 * - **not an array / empty** — an empty set generates a site with zero pages. A build that
 *   succeeds and emits nothing is the worst available outcome.
 * - **malformed row** — a missing `direction` becomes `<html dir="undefined">`; a blank `code`
 *   becomes the route `//`.
 * - **duplicate code** — two rows claiming `fa` make `generateStaticParams` emit a duplicate route
 *   and make "which record is `fa`" answerable two ways.
 * - **no default** — nothing to redirect `/` to.
 * - **multiple defaults** — the database's partial unique index should make this impossible; it is
 *   checked anyway, because "should be impossible" is how a silent wrong default gets shipped.
 *
 * @throws LocaleContractError on any of the above. Never returns a repaired set.
 */
export function validateActiveLocales(payload: unknown): readonly LocaleResponse[] {
  if (!Array.isArray(payload)) {
    throw new LocaleContractError("not-an-array", `expected an array, received ${typeof payload}`);
  }

  if (payload.length === 0) {
    throw new LocaleContractError(
      "empty",
      "the active locale set is empty — seed the `locales` table before building",
    );
  }

  const locales: LocaleResponse[] = [];
  const seen = new Set<string>();

  for (const [index, row] of payload.entries()) {
    if (!isLocaleResponse(row)) {
      // The row itself is not echoed: it is a payload this application did not author, and the
      // index is what identifies it for anyone reading the API's own response.
      throw new LocaleContractError(
        "malformed-row",
        `row ${String(index)} is not { code, name, nativeName, direction, isDefault }`,
      );
    }

    if (seen.has(row.code)) {
      throw new LocaleContractError("duplicate-code", `the code "${row.code}" appears twice`);
    }

    seen.add(row.code);
    locales.push(row);
  }

  const defaults = locales.filter((locale) => locale.isDefault);

  if (defaults.length === 0) {
    throw new LocaleContractError("no-default", "no active locale carries isDefault");
  }

  if (defaults.length > 1) {
    throw new LocaleContractError(
      "multiple-defaults",
      `${String(defaults.length)} active locales carry isDefault`,
    );
  }

  // Frozen so no consumer can re-sort it: the endpoint's order is the editorial display order.
  return Object.freeze(locales);
}

/**
 * The platform default. Safe to call only on a set that came out of `validateActiveLocales`,
 * which is what guarantees exactly one exists.
 */
export function defaultLocale(locales: readonly LocaleResponse[]): LocaleResponse {
  const match = locales.find((locale) => locale.isDefault);

  if (!match) {
    // Unreachable through the validated path. Thrown rather than asserted so a future caller that
    // skips validation fails here instead of silently redirecting to `undefined`.
    throw new LocaleContractError("no-default", "defaultLocale called on an unvalidated set");
  }

  return match;
}

/** Exact match on the route segment. Case-sensitive, because `code` is the route segment verbatim. */
export function findLocale(
  locales: readonly LocaleResponse[],
  code: string | undefined,
): LocaleResponse | undefined {
  if (code === undefined) return undefined;

  return locales.find((locale) => locale.code === code);
}

/**
 * One `Accept-Language` entry, after parsing.
 *
 * Kept as a tuple of tag and quality rather than a class: the header is parsed once per redirect
 * candidate and nothing downstream needs behavior on it.
 */
type LanguageRange = { tag: string; quality: number };

/**
 * `Accept-Language` as an ordered preference list, best first.
 *
 * Deliberately small. It splits on commas, reads an optional `;q=`, drops anything with `q=0`
 * (RFC 9110: zero means "not acceptable"), and sorts descending. It does not implement the full
 * matching algorithm of RFC 4647 — no wildcard expansion, no range filtering — because the
 * candidate set here is three rows from our own database, not the open set of language tags.
 *
 * A malformed header degrades to "no preference" rather than throwing: unlike the locale table,
 * this is untrusted input from an arbitrary client, and the correct answer to a broken one is the
 * default locale, not a failed request.
 */
function parseAcceptLanguage(header: string | null): LanguageRange[] {
  if (header === null || header.trim() === "") return [];

  const ranges: LanguageRange[] = [];

  for (const part of header.split(",")) {
    const [rawTag, ...parameters] = part.split(";");
    const tag = rawTag?.trim().toLowerCase();

    if (tag === undefined || tag === "" || tag === "*") continue;

    const qualityParameter = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("q="));

    const quality = qualityParameter === undefined ? 1 : Number(qualityParameter.slice(2));

    // NaN from a malformed `q=` is treated as "unstated", i.e. the default weight of 1, rather
    // than dropping an entry the client did express a preference for.
    const weight = Number.isNaN(quality) ? 1 : quality;

    if (weight <= 0) continue;

    ranges.push({ tag, quality: weight });
  }

  return ranges.sort((a, b) => b.quality - a.quality);
}

/**
 * Which active locale a request wants — INTERNATIONALIZATION_STRATEGY.md §2's order, minus the
 * step this function is not responsible for.
 *
 * §2 lists four steps: an explicit locale already in the URL, the `NEXT_LOCALE` cookie,
 * `Accept-Language`, then the default. **Step 1 is not here**, and that is structural rather than
 * an omission: this function is only ever called for a path that carries no locale segment, so
 * "already in the URL" has been answered `no` before it runs.
 *
 * Matching against `Accept-Language` tries the whole tag first (`fa` against `fa`), then the
 * primary subtag (`fa-ir` against `fa`). That second step is ordinary language negotiation — a
 * browser configured for Persian as spoken in Iran wants the Persian page — and it is the only
 * inference in this file. It resolves *content preference*, never route structure: a locale that
 * is not in the active set can never be produced, whatever the header says.
 *
 * @returns always an active locale. Never null, never invented — the default is the floor.
 */
export function negotiateLocale(
  locales: readonly LocaleResponse[],
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): LocaleResponse {
  const fromCookie = findLocale(locales, cookieValue);
  if (fromCookie) return fromCookie;

  for (const range of parseAcceptLanguage(acceptLanguage)) {
    const exact = locales.find((locale) => locale.code.toLowerCase() === range.tag);
    if (exact) return exact;

    const primary = range.tag.split("-")[0];
    const byPrimary = locales.find((locale) => locale.code.toLowerCase() === primary);
    if (byPrimary) return byPrimary;
  }

  return defaultLocale(locales);
}
