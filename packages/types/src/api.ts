/**
 * The platform's HTTP envelope, as it appears on the wire.
 *
 * ── Why this is a second file rather than part of `catalog.ts` ───────────────
 *
 * Nothing below is catalog-specific. `{ data, meta }` / `{ error }` is the shape
 * API_CONTRACT_FINAL.md §8 contracts for **every** endpoint, so the blog client, the content
 * client and the submissions clients all consume these same declarations. Declaring them inside
 * `catalog.ts` would mean the next resource importing its envelope from a module named after a
 * different resource — a naming error every later consumer would inherit.
 *
 * ── Types only, and the same constraint as `seo.ts` ─────────────────────────
 *
 * This package publishes raw `.ts` source and `apps/api` compiles with `rootDir: "src"`, so a
 * runtime value exported from here would enter that program's output and be rejected as a file
 * outside `rootDir`. Everything here is erased before emit.
 *
 * ── What this is NOT, in this gate ──────────────────────────────────────────
 *
 * It is **not** compile-time enforcement against the backend. `apps/api` declares its own
 * `common/http/api-response.types.ts` and `common/http/error-code.ts` and is deliberately
 * untouched here; these declarations are transcribed from that source and from
 * API_CONTRACT_FINAL.md §8, and are consumed by the frontend API client only. Making the two
 * sides share one declaration is a later, separate gate — until it happens, the agreement is
 * maintained by reading, not by `tsc`.
 */

/**
 * `meta` is present on every success response, `{}` when there is nothing to report.
 *
 * The fields are closed, matching the backend's own closed `ResponseMeta`: `total`/`page`/`limit`
 * are the pagination contract (API_DESIGN.md §Pagination) and `localeFallback` the localization
 * one (API_CONTRACT_FINAL.md §3).
 */
export type ApiMeta = {
  total?: number;
  page?: number;
  limit?: number;
  localeFallback?: boolean;
};

export type ApiSuccessResponse<T> = {
  data: T;
  meta: ApiMeta;
};

/**
 * The error catalog of API_CONTRACT_FINAL.md §8, complete and closed — the same set the backend
 * enumerates. A closed union rather than `string` because the contract is frozen: a code outside
 * this set is a contract violation the client should notice, not a value it should quietly accept.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_LOCALE"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "UPSTREAM_UNAVAILABLE";

/** One field-level failure. `field` is the DTO path, so a form can map it back to an input. */
export type ApiErrorDetail = {
  field: string;
  issue: string;
};

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Omitted entirely when there is nothing field-level to report — never `[]`, never `null`. */
    details?: ApiErrorDetail[];
  };
};
