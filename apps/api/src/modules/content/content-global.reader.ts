import { PayloadClient } from "./payload.client";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { ContentGlobalResponse } from "@sam-group/types";

/**
 * Reading one Payload Global — the whole behaviour, in one place, for every Global there will ever
 * be.
 *
 * ── Why this is shared rather than repeated per Global ─────────────────────
 *
 * Because what it encodes is not "how to fetch About Us": it is the platform's answer to three
 * questions that every company page must answer identically —
 *
 * 1. **Never ask for a draft.** No caller passes `draft`, so the published-only contract cannot be
 *    weakened by a second service written on a busier afternoon.
 * 2. **Unpublished is a state, not a failure.** Payload answers `200 {}` for a Global that was
 *    never published and for one the service identity's `_status` constraint excludes; both mean
 *    "no published page", and both become `{ available: false, content: null }`. Payload's raw `{}`
 *    never reaches a consumer.
 * 3. **A fallback is measured, and only when something was served.**
 *
 * A copy of this per Global would drift, and the first thing to drift would be the part that
 * matters most.
 *
 * ── Two reads, and why not one ─────────────────────────────────────────────
 *
 * `ContentPagesService` reads strictly first and falls back only if the strict read came back
 * untranslated. That works for a two-field document and is wrong for a thirty-field one: a page
 * translated in its hero but not its later sections would pass the strict test and then be served
 * with every untranslated field **empty**.
 *
 * So the content read always has Payload's fallback on, and a second, cheap `depth=0` read with
 * `fallback-locale=none` answers the only question fallback state is needed for: did the requested
 * locale supply its own heading? The default locale costs one read, never two.
 */

/** What every Global read answers with: the envelope, plus whether a fallback produced it. */
export type ContentGlobalResult<T> = {
  readonly response: ContentGlobalResponse<T>;
  readonly localeFallback: boolean;
};

/**
 * Turns a Payload document into the wire shape, or `null` when it is not a page.
 *
 * `null` is the projection's way of saying **unconfigured** — an empty document, a document the
 * published-only constraint excluded, or one an editor saved with no heading. All three are the
 * same fact for a consumer.
 */
export type ContentGlobalProjection<T> = (doc: Record<string, unknown>, locale: string) => T | null;

/**
 * `depth: 1` expands upload relationships — a section photograph, the SEO group's images — into
 * media records, which the projection then reduces to a URL, alt text and dimensions. A Global with
 * no uploads is unaffected by it.
 */
const CONTENT_QUERY = { depth: "1" } as const;

/** The marker every Global uses to decide whether the requested locale is translated: its heading. */
function heroTitleOf(doc: Record<string, unknown>): string {
  const hero: unknown = doc.hero;
  const title: unknown =
    typeof hero === "object" && hero !== null ? (hero as Record<string, unknown>).title : null;

  return typeof title === "string" ? title.trim() : "";
}

export async function readContentGlobal<T>(
  payload: PayloadClient,
  slug: string,
  locale: ResolvedLocale,
  project: ContentGlobalProjection<T>,
): Promise<ContentGlobalResult<T>> {
  const doc = await payload.findGlobal(slug, { locale: locale.code, ...CONTENT_QUERY });
  const content = project(doc, locale.code);

  if (content === null) {
    /*
     * No second read: `meta.localeFallback` describes content that was served, and nothing was.
     * Reporting a fallback for an unpublished page would describe a translation state that does not
     * exist.
     */
    return { response: { available: false, content: null }, localeFallback: false };
  }

  return {
    response: { available: true, content },
    localeFallback: await isFallback(payload, slug, locale),
  };
}

/**
 * Whether the served heading came from the default locale rather than the requested one.
 *
 * Skipped entirely for the default locale, where the question cannot arise and the read would be a
 * second request for a known answer.
 */
async function isFallback(
  payload: PayloadClient,
  slug: string,
  locale: ResolvedLocale,
): Promise<boolean> {
  if (locale.isDefault) {
    return false;
  }

  const strict = await payload.findGlobal(slug, {
    locale: locale.code,
    depth: "0",
    "fallback-locale": "none",
  });

  return heroTitleOf(strict) === "";
}
