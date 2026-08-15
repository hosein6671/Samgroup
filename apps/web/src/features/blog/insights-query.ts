/**
 * The Insights index's URL state — how it is read off the request, and how it is written back.
 *
 * ── The URL is the whole state machine ──────────────────────────────────────
 *
 * The index has no client-side state and no `"use client"` anywhere in its tree. Paging is an `<a>`
 * to this same route carrying a different query string, the server re-issues `GET /blog/posts`, and
 * the browser's own history is what makes Back, Forward, refresh, bookmarking and link-sharing work.
 * That keeps the paging and filtering semantics in exactly one place — the API.
 *
 * ── One axis, and deliberately not more ─────────────────────────────────────
 *
 * `category`, plus `page`. **No `tag`**: `blog_post_tags` exists but no tag vocabulary is approved,
 * the endpoint declines the parameter, and a control for it would be a UI for a taxonomy that does
 * not exist. **No `q`**: the blog endpoint carries no free-text search, and API_CONTRACT_FINAL.md
 * §2.7 records that Phase 1 has no cross-content search by decision.
 *
 * ── No category rail is rendered from this ──────────────────────────────────
 *
 * `?category=` is honoured when a visitor arrives with one — a link out of an article's category
 * label produces exactly that — but the index draws no list of categories to pick from. SITE_STRUCTURE
 * §8 names five candidate categories; none is approved as reference data, and rendering a rail from
 * whatever rows happen to exist would publish the demo category as if it were the site's taxonomy.
 *
 * Unknown parameters are read by nothing and emitted by nothing, so a shared link is the view state
 * and not the campaign that produced it.
 */

import { ROUTES } from "@/features/site/site-routes";

/** The index's view state. `null` is "not filtered", a first-class value rather than a missing one. */
export type InsightsQuery = {
  /** A `BlogCategory` slug, or `null` for the whole published index. */
  readonly category: string | null;
  /** 1-based, and never below 1. Page 1 is what the bare route serves. */
  readonly page: number;
};

export const FIRST_PAGE = 1;

/**
 * One `searchParams` value, normalized to what may be sent to the API.
 *
 * Absent or blank is no filter — a trimmed-empty value is the same request as no value, which is
 * also how the API's own `normalizeFilter` reads it. A repeated parameter is no filter either: there
 * is no defined meaning for two categories at once, and picking one would be inventing it.
 *
 * A single value is passed through unchanged and is **not** checked against any local registry:
 * whether a slug resolves is the API's answer (400 VALIDATION_ERROR naming the field, surfaced as
 * its own result state), and a second authority in front of that contract would turn one clear
 * rejection into two disagreeing ones.
 */
function readCategoryParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * `?page=`, normalized to a positive integer.
 *
 * Anything that is not one — blank, `0`, `-3`, `2.5`, `abc`, a repeated parameter — reads as page 1
 * rather than as an error. A page number is navigation, not a filter: the honest response to a
 * mistyped one is the first page of the same list, and sending it to the API instead would answer
 * 400 for a URL a visitor could easily produce by editing the address bar.
 *
 * There is no upper bound here. Which pages exist depends on `meta.total`, which is not known until
 * the request has been made; a page past the end returns an empty list and is reported as such.
 */
function readPageParam(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return FIRST_PAGE;

  const parsed = Number(raw.trim());

  return Number.isInteger(parsed) && parsed >= FIRST_PAGE ? parsed : FIRST_PAGE;
}

export function readInsightsQuery(
  params: Record<string, string | string[] | undefined>,
): InsightsQuery {
  return { category: readCategoryParam(params.category), page: readPageParam(params.page) };
}

/**
 * The index's canonical path in one locale.
 *
 * Composed from `ROUTES.insights` rather than typed out, so the route this page lives at and the
 * route everything links to are one string. The `[locale]` prefix is added here and never baked into
 * the constant: structural page URLs stay fixed English across locales (PROJECT_HANDOFF §6.12) and
 * only the prefix varies.
 */
export function insightsPath(locale: string): string {
  return `/${locale}${ROUTES.insights}`;
}

/**
 * A link to the index in one locale carrying one view state.
 *
 * Emitted in a fixed order — `category` then `page` — so two routes to the same view produce the
 * same URL. Page 1 is omitted rather than written out, because `?page=1` and no page at all are the
 * same request and the shorter one is the one that reads as the start of the list.
 */
export function insightsHref(locale: string, query: InsightsQuery): string {
  const params = new URLSearchParams();

  if (query.category !== null) params.set("category", query.category);
  if (query.page > FIRST_PAGE) params.set("page", String(query.page));

  const search = params.toString();

  return search === "" ? insightsPath(locale) : `${insightsPath(locale)}?${search}`;
}
