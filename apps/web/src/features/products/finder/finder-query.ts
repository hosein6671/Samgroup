/**
 * The Product Finder's URL state — how it is read off the request, and how it is written back.
 *
 * ── The URL is the whole state machine ──────────────────────────────────────
 *
 * The finder has no client-side state, no store, no handler and no `"use client"` anywhere in its
 * tree. Every control it draws is an `<a>` to this same route carrying a different query string,
 * the server re-issues `GET /products` with those filters, and the browser's own history is what
 * makes Back, Forward, refresh, bookmarking and link-sharing work. That is not a simplification of
 * a richer design — it is what keeps the FILTER SEMANTICS in exactly one place, the API, which
 * ADR-008 fixed and which a second client-side implementation could only ever agree with by
 * coincidence.
 *
 * ── Two axes, and deliberately not a third ──────────────────────────────────
 *
 * `category` and `segment`. **No `productType`**, and its absence is a decision rather than an
 * omission: no ProductType name or slug is approved (ADR-008), `product_types` holds zero rows, and
 * every non-blank `?productType=` answers 400 — so a control for it would be a UI for a vocabulary
 * that does not exist, and a query parameter for it would be a link that cannot succeed.
 *
 * **No `q`.** The list endpoint supports free-text search and this gate does not surface it; the
 * finder's approved scope here is the two taxonomy axes. Nothing below forbids it later — it would
 * be a third member of `FinderQuery` and a third parameter on the same links.
 *
 * ── Unknown parameters are ignored, not rejected ────────────────────────────
 *
 * Anything else in the query string is read by nothing and emitted by nothing. A finder URL
 * carrying a stray `?utm_source=` still renders, and the links this module builds carry the two
 * axes and nothing more — so a shared link is the filter state and not the campaign that produced
 * it.
 */

import { ROUTES } from "@/features/site/site-routes";

/**
 * The two axes as the page holds them. `null` is "not filtered on this axis" and is a first-class
 * value, never a missing one — the unfiltered view is `{ category: null, segment: null }`.
 */
export type FinderQuery = {
  /** A Product Family's canonical default-locale `Category.slug` (ADR-009 §1), or `null`. */
  readonly category: string | null;
  /** An approved `Segment.slug` (ADR-008 §4), or `null`. */
  readonly segment: string | null;
  /** Free-text search across published product names, slugs and public specification values. */
  readonly q: string | null;
};

/** The unfiltered view — every published product, which is what the bare route serves. */
export const NO_FILTERS: FinderQuery = { category: null, segment: null, q: null };

/**
 * One `searchParams` value, normalized to what may be sent to the API.
 *
 * Three shapes arrive and each has one honest reading:
 *
 * - **absent, or blank** → no filter. A trimmed-empty value is the same request as no value, which
 *   is also how the API's own `normalizeFilter` reads it.
 * - **one value** → the filter, passed through unchanged. It is **not** checked against the
 *   frontend's Family or Segment registry: whether a slug resolves is the API's answer (400
 *   VALIDATION_ERROR naming the field, surfaced as its own result state), and a second authority in
 *   front of that contract would turn one clear rejection into two disagreeing ones.
 * - **repeated** (`?segment=a&segment=b`) → no filter. ADR-008 explicitly defers multi-value
 *   taxonomy filtering, so there is no defined meaning to honour; picking one of the two would be
 *   inventing that meaning, and it stays visible because no chip renders as active.
 *
 * The Product Family route holds its own copy of this rule for its own `?segment=`. The two are
 * kept separate on purpose: that route reads one axis as a narrowing of a page that exists without
 * it, this one reads two axes that are the page's entire subject, and merging them would put a
 * finder concern inside the shared `[slug]` discriminator.
 */
export function readFinderParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();

  return trimmed === "" ? null : trimmed;
}

/** Both axes, read off one `searchParams` object. */
export function readFinderQuery(
  params: Record<string, string | string[] | undefined>,
): FinderQuery {
  return {
    category: readFinderParam(params.category),
    segment: readFinderParam(params.segment),
    q: readFinderParam(params.q),
  };
}

/** Whether anything is being filtered on — what decides if a reset control is offered at all. */
export function hasFilters(query: FinderQuery): boolean {
  return query.category !== null || query.segment !== null || query.q !== null;
}

/**
 * The finder's canonical path in one locale.
 *
 * Composed from `ROUTES.productFinder` rather than typed out, so the route this page lives at and
 * the route everything links to are one string. The `[locale]` prefix is added here and never baked
 * into the constant: structural page URLs stay fixed English across locales (PROJECT_HANDOFF §6.12)
 * and only the prefix varies.
 */
export function finderPath(locale: string): string {
  return `/${locale}${ROUTES.productFinder}`;
}

/**
 * A link to the finder in one locale carrying one filter state.
 *
 * Emitted in a fixed order — `category` then `segment` — so two routes to the same view produce the
 * same URL. That matters for something plainer than tidiness: a chip's `data-active` is decided by
 * comparing values, but a shared or bookmarked URL is compared by a human, and a filter set whose
 * parameter order depended on which control was clicked last would look like two different pages.
 *
 * A `null` axis is omitted entirely rather than written blank. `?category=` and no `category` at all
 * mean the same thing to the API, and the shorter one is the one that reads as unfiltered.
 */
export function finderHref(locale: string, query: FinderQuery): string {
  const params = new URLSearchParams();

  if (query.category !== null) params.set("category", query.category);
  if (query.segment !== null) params.set("segment", query.segment);
  if (query.q !== null) params.set("q", query.q);

  const search = params.toString();

  return search === "" ? finderPath(locale) : `${finderPath(locale)}?${search}`;
}
