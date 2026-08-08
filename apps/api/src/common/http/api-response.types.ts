import type { ErrorCode } from "./error-code";

/**
 * The wire contract every endpoint answers with — API_DESIGN.md §Request/Response Envelope
 * and API_CONTRACT_FINAL.md §8. These types describe what leaves the process; they are not
 * DTOs and carry no validation decorators.
 */

/**
 * Every success response carries `meta`, `{}` when there is nothing to report.
 *
 * The fields are closed on purpose. `total`/`page`/`limit` are the pagination contract
 * (API_DESIGN.md §Pagination) and `localeFallback` the localization one
 * (API_CONTRACT_FINAL.md §3); neither has a producer yet, and a module that needs a new
 * meta key changes this type rather than attaching an ad-hoc one.
 */
export type ResponseMeta = {
  total?: number;
  page?: number;
  limit?: number;
  localeFallback?: boolean;
};

export type ApiSuccessResponse<T> = {
  data: T;
  meta: ResponseMeta;
};

/** One field-level failure. `field` is the DTO path, so the frontend can map it to an input. */
export type ApiErrorDetail = {
  field: string;
  issue: string;
};

export type ApiErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    /** Omitted entirely when there is nothing field-level to report — never `[]`, never `null`. */
    details?: ApiErrorDetail[];
  };
};
