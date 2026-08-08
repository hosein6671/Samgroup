/**
 * The error catalog from API_CONTRACT_FINAL.md §8, complete and closed.
 *
 * Codes with no thrower yet (INVALID_LOCALE, UNAUTHENTICATED, FORBIDDEN, ...) are listed
 * deliberately: they are the contract the later modules must map onto, not a new string
 * literal each of them gets to invent.
 */
export enum ErrorCode {
  ValidationError = "VALIDATION_ERROR",
  InvalidLocale = "INVALID_LOCALE",
  Unauthenticated = "UNAUTHENTICATED",
  Forbidden = "FORBIDDEN",
  NotFound = "NOT_FOUND",
  Conflict = "CONFLICT",
  PayloadTooLarge = "PAYLOAD_TOO_LARGE",
  RateLimited = "RATE_LIMITED",
  InternalError = "INTERNAL_ERROR",
  UpstreamUnavailable = "UPSTREAM_UNAVAILABLE",
}

/**
 * Fallback mapping for exceptions thrown without an explicit code — Nest's own
 * NotFoundException, a framework-raised 413, and so on. An ApiException carries its own
 * code and never consults this table.
 */
const ERROR_CODE_BY_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: ErrorCode.ValidationError,
  401: ErrorCode.Unauthenticated,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  413: ErrorCode.PayloadTooLarge,
  429: ErrorCode.RateLimited,
  500: ErrorCode.InternalError,
  503: ErrorCode.UpstreamUnavailable,
};

/**
 * An unlisted status (418, 422, 502, ...) reports INTERNAL_ERROR while the response keeps
 * its real HTTP status. Guessing a catalog code from an arbitrary status would put a code
 * on the wire that the contract never defined.
 */
export function errorCodeForStatus(status: number): ErrorCode {
  return ERROR_CODE_BY_STATUS[status] ?? ErrorCode.InternalError;
}
