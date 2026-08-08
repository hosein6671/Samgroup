import type { ResponseMeta } from "./api-response.types";

/**
 * A symbol rather than a `{data, meta}` shape check: a handler returning a domain object
 * that happens to have `data` and `meta` properties would otherwise be silently unwrapped
 * and served as the envelope itself.
 */
const RESPONSE_WITH_META = Symbol("sam-group:response-with-meta");

export type ResponseWithMeta<T> = {
  readonly [RESPONSE_WITH_META]: true;
  readonly data: T;
  readonly meta: ResponseMeta;
};

/**
 * Opt-in for handlers that have something to put in `meta` — pagination totals, a locale
 * fallback flag. Handlers with nothing to add return their payload directly and the
 * interceptor supplies `meta: {}`.
 */
export function withMeta<T>(data: T, meta: ResponseMeta): ResponseWithMeta<T> {
  return { [RESPONSE_WITH_META]: true, data, meta };
}

export function isResponseWithMeta(value: unknown): value is ResponseWithMeta<unknown> {
  return typeof value === "object" && value !== null && RESPONSE_WITH_META in value;
}
