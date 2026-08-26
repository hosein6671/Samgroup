import "server-only";

import { apiGet } from "@/lib/api-client";

import { getAdminAccessToken } from "../../session/session";
import { toQueueRequest } from "./review-query";

import type { ReviewQueueQuery } from "./review-query";
import type { ApiResult } from "@/lib/api-client";
import type { ReviewQueueItemResponse } from "@sam-group/types";

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
 * One function, one `apiGet`. There is no `apiPost`, no `apiPatch`, no Server Action and no import
 * of one anywhere in this feature — Phase A ships nothing that can change review state, and
 * `phase-boundary.spec.ts` fails the build if that stops being true.
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
