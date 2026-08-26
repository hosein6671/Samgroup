import "server-only";

import { apiGet, apiPost } from "@/lib/api-client";

import { getAdminAccessToken } from "../../session/session";
import { toQueueRequest } from "./review-query";

import type { ReviewQueueQuery } from "./review-query";
import type { ApiResult } from "@/lib/api-client";
import type {
  ReviewDetailResponse,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
  ReviewQueueItemResponse,
  ReviewSubjectType,
} from "@sam-group/types";

/**
 * The Admin review queue's read path — `GET /api/v1/admin/catalog/review/queue`.
 *
 * ## Server-only, and there is no second way in
 *
 * `import "server-only"` at the top, exactly as `leads-api.ts` and `api-client.ts` do. The access
 * token is read from the HttpOnly cookie inside a Server Component and put in an `Authorization`
 * header by `apiGet`; it is never a prop, never serialized into the RSC payload, and never
 * reachable from a browser. `apps/web` has no route handler proxying `/admin/*`, and this gate adds
 * none — a generic proxy would turn a server-side-only API into a browser-reachable one, which is
 * the thing the architecture (API_CONTRACT_FINAL.md §1, CORS off in `main.ts`) says does not exist.
 *
 * ## Reads only
 *
 * Three functions, three `apiGet` calls — the queue below, and the two subject details further
 * down. There is no `apiPost`, no `apiPatch`, no Server Action and no import of one anywhere in this
 * feature, and the decision sub-collection is not named in this module at all. Phases A and B ship
 * nothing that can change review state, and `phase-boundary.spec.ts` fails the build if that stops
 * being true.
 *
 * ## Six outcomes, because six things can happen
 *
 * The lead inbox collapses "unreachable" and "answered something unusable" into one `unavailable`.
 * That is right for a lead: either way the operator retries. It is wrong here, because the queue
 * has a failure mode leads do not — a filter the API refuses. A 400 rendered as "the platform is
 * not responding" would send someone to check a service that is fine, so:
 *
 * | outcome          | cause                                                    | what the page says          |
 * | ---------------- | -------------------------------------------------------- | --------------------------- |
 * | `ok`             | 200 with an envelope                                      | the queue                   |
 * | `unauthenticated`| 401 — token absent, expired, or its user is gone          | hand back to the session    |
 * | `forbidden`      | 403 — authenticated, wrong role                           | a refusal, never an empty list |
 * | `invalid-query`  | 400 — a filter the DTO refused                            | which filter, and why       |
 * | `unavailable`    | the API could not be reached at all                       | outage, you are not signed out |
 * | `failed`         | any other status, or a 2xx that was not the envelope      | a safe generic failure      |
 *
 * `unavailable` and `failed` are separate on purpose: one means nothing answered, the other means
 * something answered wrongly. Neither is ever rendered as zero results.
 *
 * ## What crosses this boundary
 *
 * The curated queue DTO and nothing else. No transport detail, no `ApiErrorCode`, no upstream
 * message, no URL, no base address. `invalid-query` carries only the API's own `details[].field` —
 * a DTO property name it authored, never a value and never a backend sentence. Failures are logged
 * with a path and a status; a response body is never logged, because a review row is unapproved
 * technical data and a log is not an Admin surface.
 */

const QUEUE_PATH = "/admin/catalog/review/queue";

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;

export type ReviewQueuePage = {
  readonly items: readonly ReviewQueueItemResponse[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
};

export type ReviewQueueResult =
  | { readonly state: "ok"; readonly value: ReviewQueuePage }
  | { readonly state: "unauthenticated" }
  | { readonly state: "forbidden" }
  | { readonly state: "invalid-query"; readonly field: string | null }
  | { readonly state: "unavailable" }
  | { readonly state: "failed" };

/**
 * Fetch one page of the queue.
 *
 * `cache: "no-store"` is not set here because it is not optional here: `apiGet` states it on every
 * request, the API answers `Cache-Control: no-store` on every review route, and the page is
 * `force-dynamic` with `revalidate = 0`. Three independent layers, and this function relies on all
 * three rather than adding a fourth spelling of the same thing.
 */
export async function getReviewQueue(query: ReviewQueueQuery): Promise<ReviewQueueResult> {
  const accessToken = await getAdminAccessToken();
  if (accessToken === null) {
    // No cookie at all. The middleware normally redirects before a page renders, so reaching here
    // means the cookie expired between that check and this request — the session boundary decides
    // what happens next, not this function.
    return { state: "unauthenticated" };
  }

  const result: ApiResult<ReviewQueueItemResponse[]> = await apiGet<ReviewQueueItemResponse[]>(
    QUEUE_PATH,
    toQueueRequest(query),
    { accessToken },
  );

  if (result.ok) {
    if (!Array.isArray(result.data)) {
      // A 200 carrying an envelope whose `data` is not the contracted array. Reported as a failure
      // rather than rendered as an empty queue, which is what `items: []` would have looked like.
      report("answered 200 with a non-array data field");
      return { state: "failed" };
    }
    return {
      state: "ok",
      value: {
        items: result.data,
        // `meta` is contracted as always present on success (API_CONTRACT_FINAL.md §8). The
        // fallbacks describe what to render if it is not, and are not an expectation.
        total: typeof result.meta.total === "number" ? result.meta.total : result.data.length,
        page: typeof result.meta.page === "number" ? result.meta.page : query.page,
        limit: typeof result.meta.limit === "number" ? result.meta.limit : query.limit,
      },
    };
  }

  if (result.reason === "unreachable") {
    report(`could not be reached (${result.detail})`);
    return { state: "unavailable" };
  }

  if (result.reason === "malformed") {
    report(`answered ${String(result.status)} with a non-envelope body`);
    return { state: "failed" };
  }

  if (result.status === UNAUTHORIZED) return { state: "unauthenticated" };
  if (result.status === FORBIDDEN) return { state: "forbidden" };

  if (result.status === BAD_REQUEST) {
    // `field` is a DTO property name the API authored — `subjectType`, `limit`, and so on. The
    // accompanying `issue` sentence is deliberately not carried: it is API-authored too, but it is
    // written for a developer reading a 400, and this page can say something better because it
    // knows which control produced the value.
    const field = result.details?.[0]?.field ?? null;
    report(`refused the query (field: ${field ?? "unnamed"})`);
    return { state: "invalid-query", field };
  }

  report(`answered ${String(result.status)}`);
  return { state: "failed" };
}

/** A path and a description. Never a body, never a token, never a query value. */
function report(description: string): void {
  console.warn(`[admin/catalog/review] GET ${QUEUE_PATH} — ${description}`);
}

/* -------------------------------------------------------------------------- */
/*  Detail — one subject                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The two detail reads — `GET /api/v1/admin/catalog/review/{subject}/:id`.
 *
 * ## Everything the queue read establishes still holds
 *
 * Same `server-only` module, same HttpOnly cookie read inside a Server Component, same
 * `Authorization` header applied by `apiGet`, same `no-store`. The token is never a prop, never in
 * the RSC payload, never in browser JavaScript and never in storage. No route handler proxies any
 * of this, so there is still no browser-to-NestJS path.
 *
 * ## Seven outcomes, because a detail can fail in one way a list cannot
 *
 * The queue has six. A detail adds `not-found`, and that addition is the whole reason this is not
 * the queue's mapper with a different path:
 *
 * | outcome           | cause                                                   | what the page says            |
 * | ----------------- | ------------------------------------------------------- | ----------------------------- |
 * | `ok`              | 200 with an envelope carrying the detail object          | the subject                   |
 * | `unauthenticated` | 401, or no cookie at all                                 | hand back to the session      |
 * | `forbidden`       | 403 — authenticated, wrong role                          | a refusal                     |
 * | `invalid-id`      | 400 — the API refused the id in the path                 | the address is not a subject  |
 * | `not-found`       | 404 — authenticated, authorized, no such subject         | this subject does not exist   |
 * | `unavailable`     | nothing answered at all                                  | outage, you are not signed out |
 * | `failed`          | any other status, or a 2xx that was not the envelope     | a safe generic failure        |
 *
 * **`not-found` and `unavailable` are never collapsed.** A reviewer told a subject does not exist
 * stops looking for it, and a container restart must not be able to say that — the same rule
 * ADR-010 §7 fixes for Product Detail and the lead detail already follows.
 *
 * **A missing subject can never look like an empty valid detail.** There is no branch that
 * synthesizes a `ReviewDetailResponse`, no default object, and no `?? {}`. A 200 whose `data` is not
 * an object with the two discriminating fields is reported as `failed` rather than rendered, so a
 * body that arrived without a subject in it produces a failure state and not a page of empty panels.
 *
 * ## What crosses this boundary
 *
 * The curated detail DTO, and nothing else. No status code, no upstream message, no URL, no base
 * address, no token. Diagnostics carry a route **template** — `specifications/:id`, never the id —
 * and a failure class. A subject id is not secret, but it is not useful in a log either, and the
 * response body carries unapproved technical data that a log's retention rules were never written
 * for.
 */

export type ReviewDetailResult =
  | { readonly state: "ok"; readonly value: ReviewDetailResponse }
  | { readonly state: "unauthenticated" }
  | { readonly state: "forbidden" }
  | { readonly state: "invalid-id" }
  | { readonly state: "not-found" }
  | { readonly state: "unavailable" }
  | { readonly state: "failed" };

const NOT_FOUND = 404;

const SPECIFICATION_PATH = "/admin/catalog/review/specifications";
const PRODUCT_CLAIM_PATH = "/admin/catalog/review/product-claims";

/** One Specification's full review context. */
export async function getSpecificationReview(id: string): Promise<ReviewDetailResult> {
  return getSubjectReview("specification", id);
}

/** One ProductClaim's full review context. */
export async function getProductClaimReview(id: string): Promise<ReviewDetailResult> {
  return getSubjectReview("product_claim", id);
}

/**
 * The shared read.
 *
 * The subject type picks the base path rather than being interpolated into one: the two endpoints
 * are two controllers on the API side, and a caller here supplies a union member, never a segment.
 *
 * `encodeURIComponent` on the id for the same reason `reviewSubjectHref` applies it — an
 * interpolated segment is encoded because of what a future value might be, not because of what this
 * one is.
 */
async function getSubjectReview(
  subjectType: ReviewSubjectType,
  id: string,
): Promise<ReviewDetailResult> {
  const base = subjectType === "specification" ? SPECIFICATION_PATH : PRODUCT_CLAIM_PATH;

  const accessToken = await getAdminAccessToken();
  if (accessToken === null) {
    // No cookie. Middleware has already had its chance to refresh, so there is no credential to
    // present and no reason to spend a round trip being told so.
    return { state: "unauthenticated" };
  }

  const result: ApiResult<ReviewDetailResponse> = await apiGet<ReviewDetailResponse>(
    `${base}/${encodeURIComponent(id)}`,
    undefined,
    { accessToken },
  );

  if (result.ok) {
    if (!isDetail(result.data, subjectType)) {
      reportDetail(base, "answered 200 with a body that is not a review subject");
      return { state: "failed" };
    }
    return { state: "ok", value: result.data };
  }

  if (result.reason === "unreachable") {
    reportDetail(base, `could not be reached (${result.detail})`);
    return { state: "unavailable" };
  }

  if (result.reason === "malformed") {
    reportDetail(base, `answered ${String(result.status)} with a non-envelope body`);
    return { state: "failed" };
  }

  if (result.status === UNAUTHORIZED) return { state: "unauthenticated" };
  if (result.status === FORBIDDEN) return { state: "forbidden" };
  if (result.status === NOT_FOUND) return { state: "not-found" };

  if (result.status === BAD_REQUEST) {
    // The API validates `:id` as a UUID and answers 400 for anything else. That is a statement
    // about the address, not about the platform, and it is not a 404 either: "this is not a subject
    // address" and "no such subject" are different sentences and lead a reviewer to different next
    // steps.
    reportDetail(base, "refused the subject id");
    return { state: "invalid-id" };
  }

  reportDetail(base, `answered ${String(result.status)}`);
  return { state: "failed" };
}

/**
 * Whether a 200 body is actually a review subject.
 *
 * Deliberately narrow: the discriminant, the id, and that the subject type is the one that was
 * asked for. It is not a schema validation — the API is the contract and this app does not
 * re-litigate it — it is the check that stops an unexpected body from being rendered as a subject
 * with every panel empty. The one thing this must never do is let "nothing came back" look like
 * "a subject with nothing in it".
 */
function isDetail(data: unknown, subjectType: ReviewSubjectType): data is ReviewDetailResponse {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;

  const candidate = data as { subjectType?: unknown; id?: unknown };

  return candidate.subjectType === subjectType && typeof candidate.id === "string";
}

/** A route template and a description. Never an id, never a body, never a token. */
function reportDetail(base: string, description: string): void {
  console.warn(`[admin/catalog/review] GET ${base}/:id — ${description}`);
}

/* -------------------------------------------------------------------------- */
/*  Phase C — one immutable decision                                           */
/* -------------------------------------------------------------------------- */

export type ReviewDecisionResult =
  | { readonly state: "ok"; readonly value: ReviewDecisionResponse }
  | { readonly state: "unauthenticated" }
  | { readonly state: "forbidden" }
  | { readonly state: "invalid"; readonly field: string | null; readonly issue: string | null }
  | { readonly state: "not-found" }
  | {
      readonly state: "conflict";
      readonly blockers: readonly string[];
    }
  | { readonly state: "unavailable" }
  | { readonly state: "failed" };

/**
 * POST one decision from a Server Action. The caller's status and hash are comparison values only;
 * NestJS recomputes the hash under the subject lock and persists that value, never this request's.
 */
export async function decideReviewSubject(
  subjectType: ReviewSubjectType,
  id: string,
  body: ReviewDecisionRequest,
): Promise<ReviewDecisionResult> {
  const base = subjectType === "specification" ? SPECIFICATION_PATH : PRODUCT_CLAIM_PATH;
  const accessToken = await getAdminAccessToken();
  if (accessToken === null) return { state: "unauthenticated" };

  const result = await apiPost<ReviewDecisionResponse>(
    `${base}/${encodeURIComponent(id)}/decisions`,
    body,
    { accessToken },
  );

  if (result.ok) return { state: "ok", value: result.data };

  if (result.reason === "unreachable") {
    reportDecision(base, `could not be reached (${result.detail})`);
    return { state: "unavailable" };
  }

  if (result.reason === "malformed") {
    reportDecision(base, `answered ${String(result.status)} with a non-envelope body`);
    return { state: "failed" };
  }

  if (result.status === UNAUTHORIZED) return { state: "unauthenticated" };
  if (result.status === FORBIDDEN) return { state: "forbidden" };
  if (result.status === NOT_FOUND) return { state: "not-found" };

  if (result.status === BAD_REQUEST) {
    return {
      state: "invalid",
      field: result.details?.[0]?.field ?? null,
      issue: result.details?.[0]?.issue ?? null,
    };
  }

  if (result.status === 409) {
    return {
      state: "conflict",
      blockers: result.details?.map((detail) => detail.issue) ?? [],
    };
  }

  reportDecision(base, `answered ${String(result.status)}`);
  return { state: "failed" };
}

/** A route template and a failure class. Never an id, request body, hash, token or response body. */
function reportDecision(base: string, description: string): void {
  console.warn(`[admin/catalog/review] POST ${base}/:id/decisions — ${description}`);
}
