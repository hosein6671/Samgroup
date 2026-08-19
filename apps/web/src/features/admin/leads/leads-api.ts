import "server-only";

import { apiGet, apiPatch } from "@/lib/api-client";

import { getAdminAccessToken } from "../session/session";

import type { ApiResult } from "@/lib/api-client";
import type {
  AdminCustomFormulationRequestDetailResponse,
  AdminCustomFormulationRequestListItemResponse,
  AdminInquiryDetailResponse,
  AdminInquiryListItemResponse,
  AdminInquiryType,
  LeadHistoryEntry,
  LeadStatus,
  LeadWorkflowState,
} from "@sam-group/types";

/**
 * The Admin lead inbox's data access — `apps/web` → NestJS, server-side, with the session's access
 * token on the internal hop.
 *
 * ── The BFF path is the only path ──────────────────────────────────────────
 *
 * Browser → `apps/web` → NestJS. Nothing here is reachable from a browser: `import "server-only"`
 * fails `next build` if this module is pulled into a client bundle, `api-client.ts` carries the
 * same guard, and `apps/api` runs with `cors: false` so a browser-originated call could not
 * succeed even if one were written. The access token is read from an HttpOnly cookie by
 * `getAdminAccessToken()` and handed to `apiGet` as a named credential field — it is never
 * returned from any function here, never a prop, and never rendered.
 *
 * ── Five outcomes, and collapsing any two of them would be a bug ───────────
 *
 * `apps/web` must distinguish an authorization failure from an outage from a missing record; the
 * whole point of the taxonomy is that a page renders a different thing for each.
 *
 * - `ok` — the API answered with the envelope.
 * - `unauthenticated` (**401**) — NestJS refused the credential. Auth truth: the cookies are stale
 *   and the page sends the browser to the session-end handler that clears them.
 * - `forbidden` (**403**) — the credential is good and the role is not permitted. Nothing is
 *   cleared; signing in again would change nothing.
 * - `not-found` (**404**) — a definitive answer about one record, from an authenticated,
 *   authorized request. Only ever produced by a detail read.
 * - `unavailable` — anything else: 5xx, a transport failure, a timeout, a non-envelope body.
 *
 * **An outage is never rendered as a 404.** ADR-010 §7 fixes that for Product Detail and
 * FRONTEND_ARCHITECTURE §2a for the session layer; the same rule is applied here, and it is why
 * `unavailable` and `not-found` are separate members rather than one `null`. Telling an operator
 * that a lead does not exist because a container restarted is the specific failure this taxonomy
 * exists to prevent.
 *
 * ── Nothing is cached ──────────────────────────────────────────────────────
 *
 * `apiGet` sends `cache: "no-store"` on every request and the API answers `Cache-Control:
 * no-store`. Both halves are load-bearing rather than decorative: these responses carry named
 * people's contact details, and every page reading them is dynamic because reading `cookies()`
 * already forces it.
 *
 * ── Nothing is logged from a payload ───────────────────────────────────────
 *
 * The one diagnostic below reports an endpoint, a status class and nothing else. No name, no
 * email, no message, no company — a log line is a copy of the data in a place with different
 * retention, and SECURITY.md §Personal Data Retention treats these records as the most sensitive
 * the platform holds.
 */

export type LeadPage<T> = {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
};

export type LeadReadResult<T> =
  | { readonly state: "ok"; readonly value: T }
  | { readonly state: "unauthenticated" }
  | { readonly state: "forbidden" }
  | { readonly state: "not-found" }
  | { readonly state: "unavailable" };

/** The query an inbox page asks for. Both fields are already-validated numbers. */
export type LeadListRequest = {
  readonly page: number;
  readonly limit: number;
  readonly inquiryType?: AdminInquiryType;
};

const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;

/**
 * One authenticated GET, mapped onto the outcome taxonomy.
 *
 * The absent-token branch answers `unauthenticated` without a request: middleware has already had
 * its chance to refresh, so a page reaching here with no cookie has no credential to present, and
 * sending an anonymous request to an admin endpoint to be told so is a round trip for an answer
 * already known.
 */
async function readAdmin<T>(
  path: string,
  query?: Readonly<Record<string, string>>,
): Promise<LeadReadResult<{ data: T; total: number; page: number; limit: number }>> {
  const accessToken = await getAdminAccessToken();

  if (accessToken === null) {
    return { state: "unauthenticated" };
  }

  const result: ApiResult<T> = await apiGet<T>(path, query, { accessToken });

  if (result.ok) {
    return {
      state: "ok",
      value: {
        data: result.data,
        total: typeof result.meta.total === "number" ? result.meta.total : 0,
        page: typeof result.meta.page === "number" ? result.meta.page : 1,
        limit: typeof result.meta.limit === "number" ? result.meta.limit : 0,
      },
    };
  }

  if (result.reason === "http") {
    if (result.status === UNAUTHORIZED) return { state: "unauthenticated" };
    if (result.status === FORBIDDEN) return { state: "forbidden" };
    if (result.status === NOT_FOUND) return { state: "not-found" };
  }

  reportFailure(path, result);

  return { state: "unavailable" };
}

/**
 * One line, server-side, carrying the endpoint and the failure class — never a response body, and
 * never a query value. `path` is a route template argument built in this module, not caller text.
 */
function reportFailure(path: string, result: Extract<ApiResult<unknown>, { ok: false }>): void {
  const description =
    result.reason === "http"
      ? `HTTP ${String(result.status)}`
      : result.reason === "unreachable"
        ? `unreachable (${result.detail})`
        : `malformed envelope (HTTP ${String(result.status)})`;

  console.warn(`[admin/leads] ${path} — ${description}`);
}

/** The query string for a list request, with the optional filter omitted rather than sent empty. */
function listQuery(request: LeadListRequest): Record<string, string> {
  const query: Record<string, string> = {
    page: String(request.page),
    limit: String(request.limit),
  };

  if (request.inquiryType !== undefined) {
    query.inquiryType = request.inquiryType;
  }

  return query;
}

/** `meta` is the authority on which page came back — a clamped page is the API's answer, not ours. */
function toPage<T>(value: {
  data: readonly T[];
  total: number;
  page: number;
  limit: number;
}): LeadPage<T> {
  return { items: value.data, total: value.total, page: value.page, limit: value.limit };
}

export async function getAdminInquiries(
  request: LeadListRequest,
): Promise<LeadReadResult<LeadPage<AdminInquiryListItemResponse>>> {
  const result = await readAdmin<AdminInquiryListItemResponse[]>(
    "/admin/inquiries",
    listQuery(request),
  );

  return result.state === "ok" ? { state: "ok", value: toPage(result.value) } : result;
}

export async function getAdminInquiry(
  id: string,
): Promise<LeadReadResult<AdminInquiryDetailResponse>> {
  const result = await readAdmin<AdminInquiryDetailResponse>(
    `/admin/inquiries/${encodeURIComponent(id)}`,
  );

  return result.state === "ok" ? { state: "ok", value: result.value.data } : result;
}

export async function getAdminCustomFormulationRequests(
  request: LeadListRequest,
): Promise<LeadReadResult<LeadPage<AdminCustomFormulationRequestListItemResponse>>> {
  const result = await readAdmin<AdminCustomFormulationRequestListItemResponse[]>(
    "/admin/custom-formulation-requests",
    // The endpoint declares no filter, so only the page window is sent. Passing `inquiryType`
    // here would be answered 400 by `forbidNonWhitelisted` — correctly.
    listQuery({ page: request.page, limit: request.limit }),
  );

  return result.state === "ok" ? { state: "ok", value: toPage(result.value) } : result;
}

export async function getAdminCustomFormulationRequest(
  id: string,
): Promise<LeadReadResult<AdminCustomFormulationRequestDetailResponse>> {
  const result = await readAdmin<AdminCustomFormulationRequestDetailResponse>(
    `/admin/custom-formulation-requests/${encodeURIComponent(id)}`,
  );

  return result.state === "ok" ? { state: "ok", value: result.value.data } : result;
}

/* -------------------------------------------------------------------------- */
/*  Workflow — history reads, and the two mutations                           */
/* -------------------------------------------------------------------------- */

const CONFLICT = 409;
const BAD_REQUEST = 400;

/**
 * What a workflow mutation produced.
 *
 * `conflict` is the branch this whole gate turns on: it means the API refused the write because
 * the lead moved under the operator, and it is neither an error in what they asked for nor a
 * problem with their session. Folding it into `unavailable` would tell them to try again later
 * when the correct advice is to reload and look at the new state; folding it into `invalid` would
 * blame their input for someone else's edit.
 */
export type LeadMutationResult =
  | { readonly state: "ok"; readonly value: LeadWorkflowState }
  | { readonly state: "unauthenticated" }
  | { readonly state: "forbidden" }
  | { readonly state: "not-found" }
  | { readonly state: "conflict" }
  | { readonly state: "invalid"; readonly issue: string | null }
  | { readonly state: "unavailable" };

/**
 * One authenticated PATCH, mapped onto the mutation taxonomy.
 *
 * **Not retried, ever.** A workflow mutation is compare-and-set: a retry after a timeout would
 * carry a `from` that may already have been consumed by the first attempt, and the second attempt
 * would report a conflict for a change that actually succeeded. The operator reloads and decides.
 */
async function mutateAdmin(path: string, body: unknown): Promise<LeadMutationResult> {
  const accessToken = await getAdminAccessToken();

  if (accessToken === null) {
    return { state: "unauthenticated" };
  }

  const result = await apiPatch<LeadWorkflowState>(path, body, { accessToken });

  if (result.ok) {
    return { state: "ok", value: result.data };
  }

  if (result.reason === "http") {
    if (result.status === UNAUTHORIZED) return { state: "unauthenticated" };
    if (result.status === FORBIDDEN) return { state: "forbidden" };
    if (result.status === NOT_FOUND) return { state: "not-found" };
    if (result.status === CONFLICT) return { state: "conflict" };

    if (result.status === BAD_REQUEST) {
      // The API's field-level issue, when it gave one. It is API-authored text about the request
      // shape — never a lead value and never a staff identity — so it is safe to surface.
      return { state: "invalid", issue: result.details?.[0]?.issue ?? null };
    }
  }

  reportFailure(path, result);

  return { state: "unavailable" };
}

export async function getLeadHistory(
  kind: "inquiries" | "custom-formulation-requests",
  id: string,
): Promise<LeadReadResult<readonly LeadHistoryEntry[]>> {
  const result = await readAdmin<LeadHistoryEntry[]>(
    `/admin/${kind}/${encodeURIComponent(id)}/history`,
  );

  return result.state === "ok" ? { state: "ok", value: result.value.data } : result;
}

/** `PATCH /admin/{kind}/:id/status` — `from` is the compare-and-set predicate, not decoration. */
export async function changeLeadStatus(
  kind: "inquiries" | "custom-formulation-requests",
  id: string,
  body: { from: LeadStatus; to: LeadStatus; note?: string },
): Promise<LeadMutationResult> {
  return mutateAdmin(`/admin/${kind}/${encodeURIComponent(id)}/status`, body);
}

/** `PATCH /admin/{kind}/:id/assignment` — Admin only; NestJS refuses anyone else. */
export async function changeLeadAssignment(
  kind: "inquiries" | "custom-formulation-requests",
  id: string,
  body: { fromAssigneeId: string | null; assigneeId: string | null },
): Promise<LeadMutationResult> {
  return mutateAdmin(`/admin/${kind}/${encodeURIComponent(id)}/assignment`, body);
}
