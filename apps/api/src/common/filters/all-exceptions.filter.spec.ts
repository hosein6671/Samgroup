import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  ImATeapotException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

import { ApiException } from "../http/api.exception";
import { ErrorCode } from "../http/error-code";
import { AllExceptionsFilter } from "./all-exceptions.filter";

type Reply = { body: unknown; status: number };

function replyFor(exception: unknown): Reply {
  const reply = jest.fn();
  const adapterHost = {
    httpAdapter: {
      reply,
      getRequestMethod: () => "POST",
      getRequestUrl: () => "/api/v1/inquiries",
    },
  } as unknown as HttpAdapterHost;

  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter(adapterHost).catch(exception, host);

  const call = reply.mock.calls[0] as [unknown, unknown, number];

  return { body: call[1], status: call[2] };
}

describe("AllExceptionsFilter", () => {
  // The 5xx cases log a stack on purpose; silence it so a passing run stays readable.
  beforeAll(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("passes an ApiException's own code and details through", () => {
    const exception = new ApiException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ValidationError,
      "The request contains invalid or unexpected fields.",
      [{ field: "email", issue: "must be an email" }],
    );

    expect(replyFor(exception)).toEqual({
      status: 400,
      body: {
        error: {
          code: ErrorCode.ValidationError,
          message: "The request contains invalid or unexpected fields.",
          details: [{ field: "email", issue: "must be an email" }],
        },
      },
    });
  });

  it("maps a framework HttpException onto the catalog by status", () => {
    expect(replyFor(new NotFoundException("Cannot GET /api/v1/nope"))).toEqual({
      status: 404,
      body: { error: { code: ErrorCode.NotFound, message: "Cannot GET /api/v1/nope" } },
    });

    expect(replyFor(new ForbiddenException()).body).toEqual({
      error: { code: ErrorCode.Forbidden, message: "Forbidden" },
    });

    expect(replyFor(new ServiceUnavailableException()).body).toEqual({
      error: { code: ErrorCode.UpstreamUnavailable, message: "An unexpected error occurred." },
    });
  });

  it("omits details when the exception carries none", () => {
    const body = replyFor(new BadRequestException("Malformed body")).body as {
      error: Record<string, unknown>;
    };

    expect("details" in body.error).toBe(false);
  });

  it("keeps an uncatalogued status but does not invent a code for it", () => {
    expect(replyFor(new ImATeapotException())).toEqual({
      status: 418,
      body: { error: { code: ErrorCode.InternalError, message: "I'm a teapot" } },
    });
  });

  it("returns nothing from an unrecognized throw but its own generic message", () => {
    expect(replyFor(new Error("connect ECONNREFUSED 10.0.0.4:5432 — sam_platform"))).toEqual({
      status: 500,
      body: { error: { code: ErrorCode.InternalError, message: "An unexpected error occurred." } },
    });

    expect(replyFor("something threw a string").status).toBe(500);
  });
});
