import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

import type { ApiErrorResponse } from "../http/api-response.types";
import { ApiException } from "../http/api.exception";
import { ErrorCode, errorCodeForStatus } from "../http/error-code";

const INTERNAL_STATUS = 500;

/**
 * The single message any 5xx ever returns. API_CONTRACT_FINAL.md §8: stack traces, ORM
 * errors and upstream messages never reach the client.
 */
const INTERNAL_MESSAGE = "An unexpected error occurred.";

/**
 * A 4xx message describes what the caller did wrong and is safe to return, but it can
 * arrive as a string, an object, or class-validator's string[] depending on who threw.
 */
function clientMessage(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === "string") {
    return response;
  }

  if (typeof response === "object" && response !== null && "message" in response) {
    const { message } = response as { message: unknown };

    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message)) {
      return message.filter((entry): entry is string => typeof entry === "string").join("; ");
    }
  }

  return exception.message;
}

function describe(exception: unknown): { status: number; error: ApiErrorResponse["error"] } {
  if (exception instanceof ApiException) {
    return {
      status: exception.getStatus(),
      error: {
        code: exception.code,
        message: exception.message,
        ...(exception.details !== undefined ? { details: exception.details } : {}),
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();

    return {
      status,
      error: {
        code: errorCodeForStatus(status),
        message: status >= INTERNAL_STATUS ? INTERNAL_MESSAGE : clientMessage(exception),
      },
    };
  }

  // A raw Error, a rejected promise, a thrown string — nothing about it is contracted, so
  // none of it is described to the client.
  return {
    status: INTERNAL_STATUS,
    error: { code: ErrorCode.InternalError, message: INTERNAL_MESSAGE },
  };
}

/**
 * Turns every thrown value into the `{error: {code, message, details?}}` contract
 * (API_CONTRACT_FINAL.md §8). Catches unfiltered — an uncaught non-HttpException would
 * otherwise be served by Nest's default handler in a shape the contract does not describe.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // Replies through the adapter rather than an Express Response so the filter stays
  // platform-agnostic, and so the request is readable for the 5xx log line.
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const { status, error } = describe(exception);

    if (status >= INTERNAL_STATUS) {
      const request: unknown = context.getRequest();
      const method: unknown = httpAdapter.getRequestMethod(request);
      const url: unknown = httpAdapter.getRequestUrl(request);

      // Method and path only: SECURITY.md keeps personal data out of logs, and request
      // bodies here are form submissions.
      this.logger.error(
        `${String(method)} ${String(url)} failed with ${String(status)}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = { error };

    httpAdapter.reply(context.getResponse(), body, status);
  }
}
