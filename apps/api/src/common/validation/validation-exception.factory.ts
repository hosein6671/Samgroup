import { HttpStatus } from "@nestjs/common";
import type { ValidationError } from "class-validator";

import type { ApiErrorDetail } from "../http/api-response.types";
import { ApiException } from "../http/api.exception";
import { ErrorCode } from "../http/error-code";

const VALIDATION_MESSAGE = "The request contains invalid or unexpected fields.";

/**
 * class-validator nests errors by object graph; the contract wants one flat list keyed by a
 * path the frontend can map to a form input, so `address.city` and `items.0.sku` are built
 * on the way down.
 */
function flattenValidationErrors(errors: ValidationError[], parentPath: string): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath === "" ? error.property : `${parentPath}.${error.property}`;

    for (const issue of Object.values(error.constraints ?? {})) {
      details.push({ field, issue });
    }

    if (error.children !== undefined && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}

/**
 * Replaces Nest's default ValidationPipe factory, which produces a flat `string[]` of
 * sentences with the field name readable only inside the prose. API_CONTRACT_FINAL.md §8
 * requires `details: [{field, issue}]`.
 */
export function validationExceptionFactory(errors: ValidationError[]): ApiException {
  const details = flattenValidationErrors(errors, "");

  return new ApiException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.ValidationError,
    VALIDATION_MESSAGE,
    details.length > 0 ? details : undefined,
  );
}
