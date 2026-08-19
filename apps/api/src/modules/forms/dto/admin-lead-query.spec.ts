import { ValidationPipe } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { validationExceptionFactory } from "../../../common/validation/validation-exception.factory";

import { AdminCustomFormulationRequestListQuery } from "./admin-custom-formulation-request-list.query";
import { AdminInquiryListQuery } from "./admin-inquiry-list.query";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT, resolveLeadPage } from "./admin-lead-list.query";
import { INQUIRY_TYPES } from "./create-inquiry.dto";
import { LeadIdParam } from "./lead-id.param";

import type { ArgumentMetadata } from "@nestjs/common";

/**
 * The query and parameter contract of the Admin lead endpoints, exercised through a ValidationPipe
 * configured **exactly** as `main.ts` configures the global one.
 *
 * Testing the decorators through `validate()` directly would miss the two properties this surface
 * actually rests on: `forbidNonWhitelisted` rejecting a parameter the endpoint does not declare —
 * which is what keeps a client-supplied `assignedToId` off an access-controlled query — and
 * `transform` converting a query string to a number before the numeric validators run.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const INQUIRY_QUERY: ArgumentMetadata = { type: "query", metatype: AdminInquiryListQuery };
const FORMULATION_QUERY: ArgumentMetadata = {
  type: "query",
  metatype: AdminCustomFormulationRequestListQuery,
};
const ID_PARAM: ArgumentMetadata = { type: "param", metatype: LeadIdParam };

async function fieldsRejected(value: unknown, meta: ArgumentMetadata): Promise<string[]> {
  try {
    await pipe.transform(value, meta);
  } catch (error) {
    const failure = error as ApiException;

    expect(failure.getStatus()).toBe(400);
    expect(failure.code).toBe(ErrorCode.ValidationError);

    return (failure.details ?? []).map((detail) => detail.field);
  }

  throw new Error("expected the value to be rejected");
}

describe("AdminInquiryListQuery", () => {
  it("accepts an empty query — an unfiltered first page is a valid request", async () => {
    await expect(pipe.transform({}, INQUIRY_QUERY)).resolves.toEqual({});
  });

  it("converts page and limit from their query-string form", async () => {
    const parsed = (await pipe.transform(
      { page: "2", limit: "10" },
      INQUIRY_QUERY,
    )) as AdminInquiryListQuery;

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });

  it.each([
    ["page", "0"],
    ["page", "-1"],
    ["page", "1.5"],
    ["page", "abc"],
    ["limit", "0"],
    ["limit", "abc"],
  ])("rejects %s=%s", async (field, value) => {
    await expect(fieldsRejected({ [field]: value }, INQUIRY_QUERY)).resolves.toContain(field);
  });

  /**
   * The ceiling is the whole reason `limit` is validated at all. Without it a single request could
   * pull the entire lead table — a denial-of-service lever and a bulk personal-data extraction one
   * on the same parameter. Bulk export is a separate, unbuilt capability.
   */
  it("rejects a limit above the ceiling and accepts the ceiling itself", async () => {
    await expect(
      fieldsRejected({ limit: String(MAX_LIMIT + 1) }, INQUIRY_QUERY),
    ).resolves.toContain("limit");
    await expect(pipe.transform({ limit: String(MAX_LIMIT) }, INQUIRY_QUERY)).resolves.toEqual({
      limit: MAX_LIMIT,
    });
  });

  it("accepts every value in the frozen inquiry-type vocabulary", async () => {
    for (const inquiryType of INQUIRY_TYPES) {
      await expect(pipe.transform({ inquiryType }, INQUIRY_QUERY)).resolves.toEqual({
        inquiryType,
      });
    }
  });

  it("rejects an inquiryType outside the vocabulary", async () => {
    await expect(fieldsRejected({ inquiryType: "quote" }, INQUIRY_QUERY)).resolves.toContain(
      "inquiryType",
    );
  });

  it("accepts only the two ordering values", async () => {
    await expect(pipe.transform({ sort: "-createdAt" }, INQUIRY_QUERY)).resolves.toEqual({
      sort: "-createdAt",
    });
    await expect(fieldsRejected({ sort: "email" }, INQUIRY_QUERY)).resolves.toContain("sort");
  });

  /**
   * The access-control assertion at the DTO layer. SECURITY.md §RBAC integration: "A
   * client-supplied `assignedToId` filter is an access-control decision made by the least
   * trustworthy participant." The parameter is not declared, so `forbidNonWhitelisted` answers 400
   * naming it — the request is refused rather than silently ignored.
   */
  it("rejects a client-supplied assignedToId rather than ignoring it", async () => {
    await expect(
      fieldsRejected({ assignedToId: "33333333-3333-4333-8333-333333333333" }, INQUIRY_QUERY),
    ).resolves.toContain("assignedToId");
  });

  it.each(["status", "q", "email", "country", "createdAfter", "userId"])(
    "rejects the undeclared parameter %s",
    async (property) => {
      await expect(fieldsRejected({ [property]: "x" }, INQUIRY_QUERY)).resolves.toContain(property);
    },
  );
});

describe("AdminCustomFormulationRequestListQuery", () => {
  it("accepts pagination and ordering", async () => {
    await expect(
      pipe.transform({ page: "2", limit: "5", sort: "createdAt" }, FORMULATION_QUERY),
    ).resolves.toEqual({ page: 2, limit: 5, sort: "createdAt" });
  });

  it("declares no filter, so inquiryType is rejected here too", async () => {
    await expect(
      fieldsRejected({ inquiryType: "general_inquiry" }, FORMULATION_QUERY),
    ).resolves.toContain("inquiryType");
  });

  it("bounds limit on the same ceiling", async () => {
    await expect(
      fieldsRejected({ limit: String(MAX_LIMIT + 1) }, FORMULATION_QUERY),
    ).resolves.toContain("limit");
  });
});

describe("LeadIdParam", () => {
  it("accepts a UUID", async () => {
    const id = "11111111-1111-4111-8111-111111111111";

    await expect(pipe.transform({ id }, ID_PARAM)).resolves.toEqual({ id });
  });

  /**
   * Without this the value would reach Prisma, which raises a driver-level error on an invalid
   * uuid input — surfacing a plainly malformed request as a 500.
   */
  it.each(["not-a-uuid", "1", "", "11111111-1111-4111-8111-11111111111"])(
    "rejects %p with a field-level 400",
    async (id) => {
      await expect(fieldsRejected({ id }, ID_PARAM)).resolves.toContain("id");
    },
  );
});

describe("resolveLeadPage", () => {
  it("applies the documented defaults", () => {
    expect(resolveLeadPage({})).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
      direction: "desc",
    });
  });

  it("derives the window from page and limit together", () => {
    expect(resolveLeadPage({ page: 4, limit: 25 })).toMatchObject({ skip: 75, limit: 25 });
  });

  it("reads the `-` prefix as descending", () => {
    expect(resolveLeadPage({ sort: "createdAt" }).direction).toBe("asc");
    expect(resolveLeadPage({ sort: "-createdAt" }).direction).toBe("desc");
  });
});
