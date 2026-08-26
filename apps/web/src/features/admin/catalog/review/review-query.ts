import {
  CATALOG_REVIEW_PATH,
  PRODUCT_CLAIM_REVIEW_PATH,
  SPECIFICATION_REVIEW_PATH,
} from "./review-routes";

import type {
  ReviewClaimKind,
  ReviewQueueSort,
  ReviewStatus,
  ReviewSubjectType,
} from "@sam-group/types";

/**
 * The review queue's URL contract.
 *
 * ## The whole filter state lives in the query string
 *
 * Same choice as the lead inbox, for the same reasons: a filtered queue is linkable, the back
 * button is correct, and the page stays a Server Component with no client state. It also means the
 * filters are **server-side** — every control is a link, not a script, and a filter can never
 * quietly narrow only the rows that happen to be on the current page.
 *
 * ## Validated against the API's own vocabulary, before the request exists
 *
 * `apps/api` runs `whitelist` + `forbidNonWhitelisted`, so an unknown key or an out-of-vocabulary
 * value is answered **400**. This module is the reason that can never happen from a link this app
 * rendered: every value is checked against the same closed set the DTO validates, and anything that
 * fails is **dropped from the request and reported**, never forwarded as an arbitrary string.
 *
 * Reporting rather than silently correcting is the difference the gate asks for. `lead-query.ts`
 * falls back quietly because a bad `page` there is almost always a stale bookmark. Here a bad value
 * is more likely a hand-edited URL or a link from somewhere that has drifted, and a queue that
 * silently shows 1,546 rows when the reader asked for a filtered subset has answered a question
 * nobody asked. So: apply what is valid, drop what is not, and say which.
 *
 * ## The length caps are the API's caps
 *
 * `documentLocator` 2000, everything else 200 — transcribed from
 * `dto/review-queue.query.ts`. A value over the cap is rejected here rather than sent to be
 * rejected there, so the reader gets a sentence instead of a 400.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/** The API's own default and ceiling (`DEFAULT_QUEUE_LIMIT`, `MAX_QUEUE_LIMIT`). */
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

/** The API's default ordering. */
export const DEFAULT_SORT: ReviewQueueSort = "-createdAt";

/**
 * A ceiling on `page`, matching `lead-query.ts`. The API accepts any positive integer and would
 * happily compute an offset of a billion; refusing here keeps a hand-typed page from becoming a
 * sequential scan.
 */
const MAX_PAGE = 10_000;

export const SUBJECT_TYPES: readonly ReviewSubjectType[] = ["specification", "product_claim"];

export const REVIEW_STATUSES: readonly ReviewStatus[] = [
  "source_recorded",
  "needs_review",
  "approved",
  "rejected",
  "superseded",
];

export const CLAIM_KINDS: readonly ReviewClaimKind[] = [
  "classification_stated",
  "meets",
  "suitable_for",
  "recommended_for",
  "formulated_for",
  "approved_by",
  "licensed_by",
  "reference_only",
];

export const SORTS: readonly ReviewQueueSort[] = [
  "-createdAt",
  "createdAt",
  "-updatedAt",
  "updatedAt",
];

/**
 * The free-text filters the API accepts, with its length caps.
 *
 * No control renders for these — there is no endpoint serving the `SpecProperty` dictionary or the
 * `ProductType` list, so a `<select>` would have to invent its options. They are honoured when they
 * arrive in the URL, shown in the active-filter summary, and clearable. Inventing a vocabulary the
 * platform does not publish would be worse than not offering the control.
 */
const TEXT_FILTERS = {
  productSlug: 200,
  family: 200,
  productType: 200,
  propertyKey: 200,
  documentLocator: 2000,
} as const;

/*
 * `sourceRef` is deliberately NOT in that table.
 *
 * The Review API does accept it as an exact server-side filter — `@MaxLength(64)`, bound as `$3`,
 * compared with `=` on both halves of the queue statement — and this module briefly parsed it. The
 * Architect's final ruling removed it: the column may be **displayed** inside the authenticated
 * Review UI, and it may not enter a route segment, a query string, a GET form field, browser
 * history, a reverse-proxy access log, or analytics. A URL is the one place a value is copied,
 * bookmarked, referred and logged by infrastructure nobody on this team controls, and an internal
 * import identity does not belong in any of them.
 *
 * That the API supports the filter does not authorize putting it in a browser URL. The capability
 * stays where it is, untouched, and reaching it needs a design that does not travel through the
 * address bar — deferred as an API/BFF question, not a missing line here.
 *
 * A client-only filter over the current page was considered and refused: it would narrow 25 rows
 * and look like it had narrowed 1,546.
 */

export type TextFilterKey = keyof typeof TEXT_FILTERS;

const TEXT_FILTER_KEYS = Object.keys(TEXT_FILTERS) as readonly TextFilterKey[];

/* -------------------------------------------------------------------------- */
/*  The parsed query                                                           */
/* -------------------------------------------------------------------------- */

export type ReviewQueueQuery = {
  readonly page: number;
  readonly limit: number;
  readonly sort: ReviewQueueSort;
  readonly subjectType?: ReviewSubjectType;
  readonly reviewStatus?: ReviewStatus;
  readonly unresolvedFindings?: boolean;
  readonly claimKind?: ReviewClaimKind;
} & { readonly [K in TextFilterKey]?: string };

/** One parameter that was present, unusable, and therefore not applied. */
export type RejectedParam = {
  readonly param: string;
  readonly reason: string;
};

export type ReviewQueueQueryState = {
  readonly query: ReviewQueueQuery;
  readonly rejected: readonly RejectedParam[];
};

function single(value: string | string[] | undefined): string | undefined {
  // A repeated parameter (`?page=1&page=2`) arrives as an array. The first wins rather than the
  // whole thing being refused: the reader asked for a page, and answering "your URL is malformed"
  // to something every browser produces on a double-submit would be pedantry.
  return Array.isArray(value) ? value[0] : value;
}

function member<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T | undefined | "invalid" {
  if (raw === undefined || raw === "") return undefined;
  const found = allowed.find((candidate) => candidate === raw);
  return found ?? "invalid";
}

/**
 * The whole URL → a validated query plus the list of what was thrown away.
 *
 * Never throws. A page that cannot parse its own URL has no useful failure mode.
 */
export function readReviewQueueQuery(params: SearchParams): ReviewQueueQueryState {
  const rejected: RejectedParam[] = [];
  const query: Record<string, unknown> = {};

  /* -- closed vocabularies ------------------------------------------------ */

  const closed = [
    { key: "subjectType", allowed: SUBJECT_TYPES, noun: "subject type" },
    { key: "reviewStatus", allowed: REVIEW_STATUSES, noun: "review status" },
    { key: "claimKind", allowed: CLAIM_KINDS, noun: "claim kind" },
  ] as const;

  for (const { key, allowed, noun } of closed) {
    const result = member(single(params[key]), allowed);
    if (result === "invalid") {
      rejected.push({ param: key, reason: `is not a ${noun} the platform recognises` });
    } else if (result !== undefined) {
      query[key] = result;
    }
  }

  /* -- sort: falls back rather than being dropped ------------------------- */
  //
  // Every other filter is optional and its absence is meaningful. An ordering is not optional — a
  // list has one whether or not the URL names it — so an unusable value falls back to the API's
  // own default and is still reported.

  const sortResult = member(single(params.sort), SORTS);
  if (sortResult === "invalid") {
    rejected.push({ param: "sort", reason: "is not an ordering the queue offers" });
  }
  query.sort = sortResult === "invalid" || sortResult === undefined ? DEFAULT_SORT : sortResult;

  /* -- unresolvedFindings ------------------------------------------------- */
  //
  // Spelled exactly as the API's `booleanQuery()` transform accepts it. "1" and "yes" are refused
  // rather than guessed: guessing is how a filter comes to mean the opposite of what it says.

  const findings = single(params.unresolvedFindings);
  if (findings === "true") {
    query.unresolvedFindings = true;
  } else if (findings === "false") {
    query.unresolvedFindings = false;
  } else if (findings !== undefined && findings !== "") {
    rejected.push({ param: "unresolvedFindings", reason: "must be either true or false" });
  }

  /* -- free-text filters --------------------------------------------------- */

  for (const key of TEXT_FILTER_KEYS) {
    const raw = single(params[key])?.trim();
    if (raw === undefined || raw === "") continue;
    if (raw.length > TEXT_FILTERS[key]) {
      rejected.push({
        param: key,
        reason: `is longer than the ${String(TEXT_FILTERS[key])} characters the platform accepts`,
      });
      continue;
    }
    query[key] = raw;
  }

  /* -- page and limit ------------------------------------------------------ */

  query.page = readBounded(single(params.page), 1, MAX_PAGE, 1, "page", rejected);
  query.limit = readBounded(single(params.limit), 1, MAX_LIMIT, DEFAULT_LIMIT, "limit", rejected);

  return { query: query as ReviewQueueQuery, rejected };
}

function readBounded(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
  param: string,
  rejected: RejectedParam[],
): number {
  if (raw === undefined || raw === "") return fallback;
  // `Number` then `Number.isInteger`, matching `lead-query.ts`: "2abc", "2.5", " " and "" all fail
  // rather than becoming a NaN offset.
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    rejected.push({
      param,
      reason: `must be a whole number between ${String(min)} and ${String(max)}`,
    });
    return fallback;
  }
  return parsed;
}

/* -------------------------------------------------------------------------- */
/*  Outbound — what actually reaches the API                                   */
/* -------------------------------------------------------------------------- */

/**
 * The query as the API's `ReviewQueueQuery` DTO expects it.
 *
 * Only keys the DTO declares, only values already checked against its vocabulary. `page`, `limit`
 * and `sort` are always sent, even at their defaults: stating the window makes the request
 * self-describing in a log, and costs nothing.
 */
export function toQueueRequest(query: ReviewQueueQuery): Record<string, string> {
  const request: Record<string, string> = {
    page: String(query.page),
    limit: String(query.limit),
    sort: query.sort,
  };

  if (query.subjectType !== undefined) request.subjectType = query.subjectType;
  if (query.reviewStatus !== undefined) request.reviewStatus = query.reviewStatus;
  if (query.claimKind !== undefined) request.claimKind = query.claimKind;
  if (query.unresolvedFindings !== undefined) {
    request.unresolvedFindings = String(query.unresolvedFindings);
  }
  for (const key of TEXT_FILTER_KEYS) {
    const value = query[key];
    if (value !== undefined) request[key] = value;
  }

  return request;
}

/* -------------------------------------------------------------------------- */
/*  Outbound — hrefs                                                           */
/* -------------------------------------------------------------------------- */

/** The filter keys, in the order they are serialized. Fixed so a URL is stable and comparable. */
const HREF_ORDER = [
  "subjectType",
  "reviewStatus",
  "claimKind",
  "unresolvedFindings",
  ...TEXT_FILTER_KEYS,
  "sort",
  "limit",
  "page",
] as const;

export type QueryPatch = Partial<{
  readonly [K in keyof ReviewQueueQuery]: ReviewQueueQuery[K] | undefined;
}>;

/**
 * A link to the queue with some part of the state changed.
 *
 * **Changing a filter resets `page` to 1.** A reader on page 43 who narrows to "unresolved
 * findings" wants the first page of the narrower list, not page 43 of it — which, at 133 matching
 * rows, does not exist and would render as an empty queue that looks like a filter returning
 * nothing. Paging is the one patch that keeps its page, and it says so by naming `page`.
 *
 * Defaults are omitted from the URL, so the unfiltered queue is `/admin/catalog/review` with no
 * query string at all.
 */
export function reviewQueueHref(query: ReviewQueueQuery, patch: QueryPatch = {}): string {
  const merged: Record<string, unknown> = { ...query, ...patch };
  if (!("page" in patch)) merged.page = 1;

  const serialized = serializeQuery(merged);
  return serialized === "" ? CATALOG_REVIEW_PATH : `${CATALOG_REVIEW_PATH}?${serialized}`;
}

/**
 * The query state as a query string, with every default omitted.
 *
 * Extracted so the detail href and the queue href serialize identically. Two spellings of the same
 * state would produce two URLs for one screen, and the Back link would stop matching the URL the
 * reader arrived from.
 */
function serializeQuery(merged: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const key of HREF_ORDER) {
    const value = merged[key];
    if (value === undefined) continue;
    if (key === "sort" && value === DEFAULT_SORT) continue;
    if (key === "limit" && value === DEFAULT_LIMIT) continue;
    if (key === "page" && value === 1) continue;
    search.set(key, String(value));
  }

  return search.toString();
}

/** A link to another page of the same filtered, sorted queue. */
export function reviewPageHref(query: ReviewQueueQuery, page: number): string {
  return reviewQueueHref(query, { page });
}

/**
 * Toggle semantics for a chip: choosing the value already chosen clears it.
 *
 * So every filter has a way out that is the control itself, rather than a separate "clear" the
 * reader has to find.
 */
export function toggleHref<K extends keyof ReviewQueueQuery>(
  query: ReviewQueueQuery,
  key: K,
  value: ReviewQueueQuery[K],
): string {
  return reviewQueueHref(query, {
    [key]: query[key] === value ? undefined : value,
  } as QueryPatch);
}

/* -------------------------------------------------------------------------- */
/*  Outbound — the two detail routes                                           */
/* -------------------------------------------------------------------------- */

/**
 * A link from a queue row to that subject's detail page.
 *
 * ## The path carries the subject id, and only the subject id
 *
 * `encodeURIComponent` on the id, always, even though the API validates it as a UUID and every id
 * this app puts here came from a response rather than from a reader. Encoding an interpolated
 * segment is not a judgement about the current data; it is what stops the next value that is not a
 * UUID from changing the shape of the path.
 *
 * **Nothing else identifies the subject in the URL.** Not the property key, not the claim kind, not
 * the product slug, and — categorically — not the source reference. That column is displayed inside
 * the Review UI and enters no route segment, no query string, no browser history and no
 * reverse-proxy log; this module does not know the field exists, and `phase-boundary.spec.ts`
 * asserts that it does not.
 *
 * ## The queue context rides along, and it is the SAME state the queue validated
 *
 * A reader on page 43 of "unresolved findings, product claims" who opens a subject must come back
 * to page 43 of that list. The alternatives were both worse:
 *
 * - a `returnTo` parameter carrying an arbitrary URL — an open-redirect surface on an
 *   authenticated screen, and one that would have to be validated against a prefix on every read;
 * - `history.back()` — a script dependency on a Server-Component page, wrong after a reload, wrong
 *   when the detail URL was opened directly, and silent when it fails.
 *
 * What is carried instead is the **already-parsed, already-validated query object**, re-serialized
 * by the same function the queue's own links use. The detail page re-parses it with
 * `readReviewQueueQuery`, so every value is checked against the closed vocabulary a second time,
 * and the Back href is then rebuilt from `CATALOG_REVIEW_PATH`. A hand-edited parameter cannot make
 * the Back link point anywhere but at the queue: the destination is a constant, and the only thing
 * the URL can influence is which filters survive validation.
 *
 * `query` is optional. A detail page reached without it — a bookmark, a pasted link — still renders
 * and still offers a Back link, to the unfiltered queue.
 */
export function reviewSubjectHref(
  subjectType: ReviewSubjectType,
  id: string,
  query?: ReviewQueueQuery,
): string {
  const base =
    subjectType === "specification" ? SPECIFICATION_REVIEW_PATH : PRODUCT_CLAIM_REVIEW_PATH;
  const path = `${base}/${encodeURIComponent(id)}`;

  if (query === undefined) return path;

  // The reader's actual page, not page 1: this is a link out of a list, not a change to the list.
  const serialized = serializeQuery({ ...query });

  return serialized === "" ? path : `${path}?${serialized}`;
}

/**
 * The Back link's destination — the queue, in the state the reader left it.
 *
 * Built from `CATALOG_REVIEW_PATH` and the validated query, never from anything the URL supplied
 * verbatim. There is no parameter that can redirect it, and no branch in which it points off-site.
 */
export function backToQueueHref(query: ReviewQueueQuery): string {
  return reviewQueueHref(query, { page: query.page });
}

/* -------------------------------------------------------------------------- */
/*  Active filters, as text                                                    */
/* -------------------------------------------------------------------------- */

export type ActiveFilter = {
  readonly param: string;
  readonly label: string;
  readonly value: string;
  readonly clearHref: string;
};

/**
 * Every filter currently narrowing the queue, as label/value pairs with a way to remove each.
 *
 * Rendered as text, not as a colour or a highlighted control: WCAG 2.2 §1.4.1, and more plainly,
 * "why am I seeing 66 rows" is the first question a filtered queue has to answer. The empty state
 * uses the same list, which is why it is built here rather than inside a view.
 *
 * `sort` is not a filter and is deliberately absent — it changes order, never membership.
 */
export function activeFilters(
  query: ReviewQueueQuery,
  describe: {
    readonly subjectType: (value: ReviewSubjectType) => string;
    readonly reviewStatus: (value: ReviewStatus) => string;
    readonly claimKind: (value: ReviewClaimKind) => string;
    readonly unresolvedFindings: (value: boolean) => string;
  },
): readonly ActiveFilter[] {
  const filters: ActiveFilter[] = [];

  const push = (param: keyof ReviewQueueQuery, label: string, value: string): void => {
    filters.push({
      param,
      label,
      value,
      clearHref: reviewQueueHref(query, { [param]: undefined } as QueryPatch),
    });
  };

  if (query.subjectType !== undefined) {
    push("subjectType", "Subject type", describe.subjectType(query.subjectType));
  }
  if (query.reviewStatus !== undefined) {
    push("reviewStatus", "Review status", describe.reviewStatus(query.reviewStatus));
  }
  if (query.claimKind !== undefined) {
    push("claimKind", "Claim kind", describe.claimKind(query.claimKind));
  }
  if (query.unresolvedFindings !== undefined) {
    push("unresolvedFindings", "Findings", describe.unresolvedFindings(query.unresolvedFindings));
  }

  const textLabel: Readonly<Record<TextFilterKey, string>> = {
    productSlug: "Product",
    family: "Product family",
    productType: "Product type",
    propertyKey: "Property key",
    documentLocator: "Evidence document",
  };
  for (const key of TEXT_FILTER_KEYS) {
    const value = query[key];
    if (value !== undefined) push(key, textLabel[key], value);
  }

  return filters;
}

/** The last page a result set of this size has. Never below 1, so an empty queue still has one. */
export function lastPage(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}
