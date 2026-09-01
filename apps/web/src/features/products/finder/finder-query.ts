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
 * ── Three taxonomy axes and a search term ───────────────────────────────────
 *
 * `category`, `segment`, `productType`, and `q`.
 *
 * The third axis was absent by decision, on the grounds that "no ProductType name or slug is
 * approved, `product_types` holds zero rows, and every non-blank `?productType=` answers 400 — so a
 * control for it would be a UI for a vocabulary that does not exist". **Every clause of that is now
 * out of date**: ADR-020 §1 approved the eight slugs and display names on 31 August 2026 and ADR-020
 * §2 approved showing them on this Finder, the table holds those eight rows, all 100 products carry
 * one, and the endpoint filters on it. See `features/products/product-types-data.ts`.
 *
 * It matters more than a third chip row usually would, because it is the only axis with full
 * coverage: Segment reaches 41 of the 100 products and this reaches all of them.
 *
 * **`q` is a search term and not a fourth axis**, and the distinction is why it is last in every
 * list here. The three taxonomy parameters are slugs the API resolves against a vocabulary and
 * rejects with a 400 naming the field; `q` is free text that matches or does not. They compose —
 * the API ANDs the search against the taxonomy-filtered set — but only the three can be wrong.
 *
 * ── `page`, and still no `limit` or `sort` ──────────────────────────────────
 *
 * `page` is the fifth member and the only one that is not a filter: it selects a window over the
 * result of the other four rather than changing what they select. It exists because it had to — the
 * endpoint's default page is twenty and `?productType=engine-oils` selects thirty-three, so without
 * it thirteen published products were unreachable from this surface.
 *
 * **`limit` and `sort` stay unsent**, by owner decision. `GET /products` accepts both, and the
 * finder takes the endpoint's `limit=20` and `sort=name` as given rather than offering controls for
 * them — an alphabetical page of twenty is a browsing surface's answer, and a page number is only
 * coherent against a page size the visitor cannot change underneath it.
 *
 * **`page` is not a filter, and the difference is load-bearing.** It is reset by every control that
 * changes what is being selected (see `filterHref`), it is absent from `hasFilters`, and page 1 is
 * written as no parameter at all rather than as `?page=1`. A `page` that survived a filter change
 * would put a visitor on page 3 of a two-page result and call it empty.
 *
 * ── Unknown parameters are ignored, not rejected ────────────────────────────
 *
 * Anything else in the query string is read by nothing and emitted by nothing. A finder URL
 * carrying a stray `?utm_source=` still renders, and the links this module builds carry the four
 * axes, the page, and nothing more — so a shared link is the filter state and not the campaign that
 * produced it.
 */

import { ROUTES } from "@/features/site/site-routes";

/**
 * The four parameters as the page holds them. `null` is "not filtered on this axis" and is a
 * first-class value, never a missing one — the unfiltered view is `NO_FILTERS` below, where every
 * member is explicitly `null` rather than absent.
 */
export type FinderQuery = {
  /** A Product Family's canonical default-locale `Category.slug` (ADR-009 §1), or `null`. */
  readonly category: string | null;
  /** An approved `Segment.slug` (ADR-008 §4), or `null`. */
  readonly segment: string | null;
  /** An approved `ProductType.slug` (ADR-020 §1), or `null`. */
  readonly productType: string | null;
  /** Free-text search across published product names, slugs and public specification values. */
  readonly q: string | null;
  /**
   * The 1-based page of the filtered set. **Never `null`** — unlike the four above, an absent page
   * has a meaning rather than an absence: it is page 1. Typing it as a plain number is what stops
   * every reader of this shape from having to decide whether `null` means "the first page" or "no
   * page", and they are the same page.
   *
   * Always a safe positive integer: `readFinderPage` admits nothing else.
   */
  readonly page: number;
};

/**
 * The page an unpaginated request is on, and the page every malformed one falls back to.
 *
 * Named rather than written as `1` in eight places, because the three rules that make pagination
 * coherent are all statements about this one value: it is the default, it is what a bad `?page=`
 * normalizes to, and it is the page that is omitted from a URL rather than written into it.
 */
export const FIRST_PAGE = 1;

/** The unfiltered view — every published product, which is what the bare route serves. */
export const NO_FILTERS: FinderQuery = {
  category: null,
  segment: null,
  productType: null,
  q: null,
  page: FIRST_PAGE,
};

/**
 * One `searchParams` value, normalized to what may be sent to the API.
 *
 * Three shapes arrive and each has one honest reading:
 *
 * - **absent, or blank** → no filter. A trimmed-empty value is the same request as no value, which
 *   is also how the API's own `normalizeFilter` reads it.
 * - **one value** → the filter, passed through unchanged. It is **not** checked against any of the
 *   three frontend registries: whether a slug resolves is the API's answer (400 VALIDATION_ERROR
 *   naming the field, surfaced as its own result state), and a second authority in front of that
 *   contract would turn one clear rejection into two disagreeing ones.
 * - **repeated** (`?segment=a&segment=b`) → no filter. ADR-008 explicitly defers multi-value
 *   taxonomy filtering, so there is no defined meaning to honour; picking one of the two would be
 *   inventing that meaning, and it stays visible because no chip renders as active.
 *
 * The Product Family route holds its own copy of this rule for its own `?segment=`. The two are
 * kept separate on purpose: that route reads one axis as a narrowing of a page that exists without
 * it, this one reads three axes and a search term that are the page's entire subject, and merging
 * them would put a finder concern inside the shared `[slug]` discriminator.
 */
export function readFinderParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * One `?page=` value, normalized to a page this surface can actually ask for.
 *
 * ── Everything that is not a page is page 1 ─────────────────────────────────
 *
 * A page number reaches this function as caller-supplied text from a URL bar, a stale bookmark, a
 * truncated link or a crawler, and there is exactly one safe reading for anything that is not a
 * plain positive integer: **the first page**. Every rejected shape below is rejected for its own
 * reason, and none of them is an error the visitor is shown — a URL that says something impossible
 * is answered with the page they were most likely looking for.
 *
 * | Input                     | Reads as | Why                                                    |
 * | ------------------------- | -------- | ------------------------------------------------------ |
 * | absent                    | 1        | the default, and the whole point of omitting `?page=1` |
 * | `""`, `"   "`             | 1        | a blank parameter is an absent one, as for the filters |
 * | `["2", "3"]`              | 1        | repeated: no defined meaning, and picking is inventing |
 * | `"0"`, `"-1"`             | 1        | there is no page zero and no page before the first     |
 * | `"+2"`                    | 1        | a sign is not part of a page number's vocabulary       |
 * | `"2.0"`, `"2e1"`, `"0x2"` | 1        | `Number()` would accept all three; a page is digits    |
 * | `"abc"`, `"2abc"`         | 1        | not a number at all                                    |
 * | `"9007199254740993"`      | 1        | past `Number.MAX_SAFE_INTEGER`: arithmetic silently lies |
 *
 * `^\d+$` is doing the work that `Number()` and `parseInt` both get wrong here. `Number(" 2 ")` is
 * 2, `Number("2e1")` is 20, `Number("0x2")` is 2, and `parseInt("2abc")` is 2 — each of them turns
 * a string that is not a page number into a page number that was never requested. Digits only, then
 * one conversion, then a range check.
 *
 * Leading zeros are admitted (`"007"` → page 7): it is a positive base-10 integer written
 * redundantly, and every URL this module emits afterwards writes it back canonically as `7`.
 *
 * **Out-of-range is not this function's job.** A page past the end of the result set is a well-formed
 * request whose answer depends on data this module has never seen — `results.tsx` decides that from
 * the response's own `meta`, and it is a distinct visible state rather than a silent clamp.
 */
export function readFinderPage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return FIRST_PAGE;

  const trimmed = raw.trim();

  if (!/^\d+$/u.test(trimmed)) return FIRST_PAGE;

  const page = Number(trimmed);

  return Number.isSafeInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE;
}

/** All five parameters, read off one `searchParams` object. */
export function readFinderQuery(
  params: Record<string, string | string[] | undefined>,
): FinderQuery {
  return {
    category: readFinderParam(params.category),
    segment: readFinderParam(params.segment),
    productType: readFinderParam(params.productType),
    q: readFinderParam(params.q),
    page: readFinderPage(params.page),
  };
}

/**
 * Whether anything is being filtered on — what decides if a reset control is offered at all.
 *
 * **`page` is deliberately not counted.** It selects a window over a result rather than selecting
 * the result, so a visitor on page 2 of the unfiltered catalog has nothing to clear, and a "Clear
 * search and filters" control offered to them would name two things that are not in force. The
 * distinction also keeps the empty states honest: with no filters and no products, the catalog is
 * empty regardless of which page was asked for.
 */
export function hasFilters(query: FinderQuery): boolean {
  return (
    query.category !== null ||
    query.segment !== null ||
    query.productType !== null ||
    query.q !== null
  );
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
 * Emitted in a fixed order — `category`, `segment`, `productType`, `q` — so two routes to the same
 * view produce the same URL. That matters for something plainer than tidiness: a chip's
 * `data-active` is decided by comparing values, but a shared or bookmarked URL is compared by a
 * human, and a filter set whose parameter order depended on which control was clicked last would
 * look like two different pages.
 *
 * The order is the one the chips are drawn in and the one `selectionSentence` names them in. `page`
 * is written last because it is not one of them — it qualifies the whole of what precedes it.
 *
 * A `null` axis is omitted entirely rather than written blank. `?category=` and no `category` at all
 * mean the same thing to the API, and the shorter one is the one that reads as unfiltered.
 *
 * **Page 1 is omitted for the same reason**, and it is the stronger case: `?page=1` and no `page` are
 * the same request, and a canonical URL that carried it would put a parameter into every shared
 * link, every "clear all" and every chip on the first page of every result — where it would read as
 * a position the visitor had chosen rather than the one they started at.
 */
export function finderHref(locale: string, query: FinderQuery): string {
  const params = new URLSearchParams();

  if (query.category !== null) params.set("category", query.category);
  if (query.segment !== null) params.set("segment", query.segment);
  if (query.productType !== null) params.set("productType", query.productType);
  if (query.q !== null) params.set("q", query.q);
  if (query.page !== FIRST_PAGE) params.set("page", String(query.page));

  const search = params.toString();

  return search === "" ? finderPath(locale) : `${finderPath(locale)}?${search}`;
}

/**
 * A link that changes what is being selected — a chip, an "All", the clear-all — and therefore
 * **always returns to page 1**.
 *
 * This is the function every filter control uses, and its whole reason to exist is the `page` it
 * drops. A chip built with a plain `{ ...query, segment: slug }` spread keeps the page number, so a
 * visitor on page 2 of thirty-three engine oils who narrows to a Segment lands on page 2 of a
 * result that may have one page — and is told, accurately and uselessly, that the page they are on
 * is out of range. Resetting is not a convenience; it is the only reading of "show me this instead"
 * that can be answered.
 *
 * `page` in `patch` is overridden rather than honoured. A caller that wants to move the page is
 * asking for something else and has `pageHref` for it.
 */
export function filterHref(
  locale: string,
  query: FinderQuery,
  patch: Partial<FinderQuery>,
): string {
  return finderHref(locale, { ...query, ...patch, page: FIRST_PAGE });
}

/**
 * A link that moves the page and changes nothing else — Previous, Next, and the way back from an
 * out-of-range page.
 *
 * The mirror image of `filterHref`: every filter and the search term are carried through untouched,
 * because paging is the one action on this surface that must NOT alter what is being looked at.
 */
export function pageHref(locale: string, query: FinderQuery, page: number): string {
  return finderHref(locale, { ...query, page });
}
