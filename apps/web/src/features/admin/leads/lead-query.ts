import type { AdminInquiryType } from "@sam-group/types";

/**
 * What an inbox URL is allowed to say, and how a URL is read back into a request.
 *
 * ── Read strictly, and never forwarded blind ────────────────────────────────
 *
 * `searchParams` is caller-controlled text. Nothing here passes a raw value through to the API:
 * `page` and `limit` are parsed to integers and clamped, `inquiryType` is matched against a closed
 * list, and anything unrecognised is **dropped**, not proxied. Forwarding an unknown parameter
 * would turn a mistyped URL into a 400 from NestJS rendered as an outage, and forwarding an
 * unbounded `limit` would let a link ask for the whole lead table.
 *
 * That is belt-and-braces rather than the enforcement — `apps/api` validates the same parameters
 * itself, rejects an out-of-range `limit`, and refuses any property it does not declare. This layer
 * exists so a bad URL renders page 1 instead of an error page, not so the API can trust it.
 *
 * ── `assignedToId` is not in this vocabulary, and cannot be ─────────────────
 *
 * SECURITY.md §RBAC integration: lead scoping is applied by the server, never requested by the
 * client. There is no URL spelling of it here, and the API declares no such parameter, so a hand-
 * crafted `?assignedToId=` is answered 400 rather than honoured.
 */

/** The page size the inbox asks for. Well inside the API's ceiling of 100. */
export const PAGE_SIZE = 25;

/** A ceiling on the parsed page too: a URL asking for page 10^9 should not become a real query. */
const MAX_PAGE = 10_000;

const INQUIRY_TYPES: readonly AdminInquiryType[] = [
  "product_inquiry",
  "request_a_quote",
  "customized_solution",
  "export_and_logistics",
  "distribution_partnership",
  "general_inquiry",
  "sample_request",
];

/** Next 15 hands a Server Component's `searchParams` in this shape. */
export type SearchParams = Record<string, string | string[] | undefined>;

export type InboxQuery = {
  readonly page: number;
  readonly limit: number;
  readonly inquiryType?: AdminInquiryType;
};

/** The first value of a repeated parameter, or `undefined`. `?page=1&page=2` is not two pages. */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPage(value: string | string[] | undefined): number {
  const raw = single(value);

  if (raw === undefined) return 1;

  // Base 10 explicitly, and `Number.isInteger` rather than a regex, so "2abc", "2.5", "" and " "
  // all fall back to page 1 instead of becoming a NaN skip.
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE ? parsed : 1;
}

function readInquiryType(value: string | string[] | undefined): AdminInquiryType | undefined {
  const raw = single(value);

  return INQUIRY_TYPES.find((type) => type === raw);
}

/** The inquiry inbox's query — a page and an optional type filter. */
export function readInquiryInboxQuery(params: SearchParams): InboxQuery {
  const inquiryType = readInquiryType(params.inquiryType);

  return inquiryType === undefined
    ? { page: readPage(params.page), limit: PAGE_SIZE }
    : { page: readPage(params.page), limit: PAGE_SIZE, inquiryType };
}

/** The formulation inbox's query — a page, and nothing else to carry. */
export function readFormulationInboxQuery(params: SearchParams): InboxQuery {
  return { page: readPage(params.page), limit: PAGE_SIZE };
}

/**
 * A link to another page of the same view, carrying **only** the parameters this vocabulary
 * recognises. A previous/next link built from the incoming URL string would preserve whatever
 * else was in it, which is how an unrecognised parameter survives a click.
 *
 * Page 1 omits `page` entirely, so the unfiltered first page has one URL rather than two.
 */
export function inboxPageHref(basePath: string, query: InboxQuery, page: number): string {
  const params = new URLSearchParams();

  if (query.inquiryType !== undefined) {
    params.set("inquiryType", query.inquiryType);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();

  return search === "" ? basePath : `${basePath}?${search}`;
}

/** The filter links above the inquiry list. Selecting a filter always returns to page 1. */
export function inboxFilterHref(
  basePath: string,
  inquiryType: AdminInquiryType | undefined,
): string {
  return inquiryType === undefined
    ? basePath
    : `${basePath}?${new URLSearchParams({ inquiryType }).toString()}`;
}

/** The last page number for a total, never below 1 — an empty inbox is still page 1 of 1. */
export function lastPage(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}
