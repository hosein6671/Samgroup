import { HttpException } from "@nestjs/common";

import type { ApiErrorDetail } from "./api-response.types";
import type { ErrorCode } from "./error-code";

/**
 * An exception that names its own catalog code instead of leaving the filter to infer one
 * from the HTTP status. Needed wherever one status carries several codes — 400 is both
 * VALIDATION_ERROR and INVALID_LOCALE — and it is the only way `details` reaches the client.
 */
export class ApiException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}
