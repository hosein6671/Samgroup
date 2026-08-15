import { ValidationPipe } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { validationExceptionFactory } from "../../../common/validation/validation-exception.factory";
import { FIELD_MAX } from "./field-limits";

import { CreateInquiryDto } from "./create-inquiry.dto";

import type { ArgumentMetadata } from "@nestjs/common";

/**
 * The DTO is exercised through a ValidationPipe configured **exactly** as `main.ts` configures the
 * global one. Testing the decorators through `validate()` directly would prove the constraints
 * hold and prove nothing about the two properties this endpoint's safety actually rests on —
 * `forbidNonWhitelisted` rejecting internal fields, and `transform` running the trim before the
 * validators see the value.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const META: ArgumentMetadata = { type: "body", metatype: CreateInquiryDto };

const VALID = {
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  industry: "Manufacturing",
  inquiryType: "general_inquiry",
  consentGiven: true,
};

async function run(body: unknown): Promise<CreateInquiryDto> {
  return (await pipe.transform(body, META)) as CreateInquiryDto;
}

/** The `details[].field` values a rejection reported, which is what the frontend maps to inputs. */
async function fieldsRejected(body: unknown): Promise<string[]> {
  try {
    await run(body);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(ErrorCode.ValidationError);

    return ((error as ApiException).details ?? []).map((detail) => detail.field);
  }

  throw new Error("expected the body to be rejected");
}

describe("CreateInquiryDto — accepted submissions", () => {
  it("accepts the eight required fields alone", async () => {
    await expect(run({ ...VALID })).resolves.toMatchObject({ inquiryType: "general_inquiry" });
  });

  it("accepts every inquiry type the enum defines", async () => {
    for (const inquiryType of [
      "product_inquiry",
      "request_a_quote",
      "customized_solution",
      "export_and_logistics",
      "distribution_partnership",
      "general_inquiry",
      "sample_request",
    ]) {
      await expect(run({ ...VALID, inquiryType })).resolves.toMatchObject({ inquiryType });
    }
  });

  it("trims surrounding whitespace before storing", async () => {
    const dto = await run({ ...VALID, firstName: "  Ada  ", companyName: " Engines Ltd " });

    expect(dto.firstName).toBe("Ada");
    expect(dto.companyName).toBe("Engines Ltd");
  });

  it("treats an untouched optional input as absent rather than as an empty string", async () => {
    const dto = await run({ ...VALID, phone: "   ", message: "", requiredQuantity: "" });

    expect(dto.phone).toBeUndefined();
    expect(dto.message).toBeUndefined();
    expect(dto.requiredQuantity).toBeUndefined();
  });

  it("accepts the fifth Incoterm option this form has and the formulation form does not", async () => {
    await expect(run({ ...VALID, preferredIncoterm: "Not sure" })).resolves.toMatchObject({
      preferredIncoterm: "Not sure",
    });
  });
});

describe("CreateInquiryDto — rejected submissions", () => {
  it("rejects a missing required field, naming it", async () => {
    const { email: _email, ...withoutEmail } = VALID;

    expect(await fieldsRejected(withoutEmail)).toContain("email");
  });

  it("rejects a malformed email address", async () => {
    expect(await fieldsRejected({ ...VALID, email: "ada@" })).toContain("email");
  });

  it("rejects a whitespace-only required field, because the trim runs first", async () => {
    expect(await fieldsRejected({ ...VALID, firstName: "   " })).toContain("firstName");
  });

  it("rejects an inquiry type outside the enum", async () => {
    expect(await fieldsRejected({ ...VALID, inquiryType: "sample" })).toContain("inquiryType");
  });

  it("rejects a submission without consent", async () => {
    expect(await fieldsRejected({ ...VALID, consentGiven: false })).toContain("consentGiven");
  });

  it("rejects a related product id that is not a UUID", async () => {
    expect(await fieldsRejected({ ...VALID, relatedProductId: "base-oils" })).toContain(
      "relatedProductId",
    );
  });

  it("rejects free text beyond the field's limit", async () => {
    const tooLong = "x".repeat(FIELD_MAX.LONG_TEXT + 1);

    expect(await fieldsRejected({ ...VALID, message: tooLong })).toContain("message");
  });

  it("rejects an unknown property rather than silently dropping it", async () => {
    expect(await fieldsRejected({ ...VALID, nickname: "Ada" })).toContain("nickname");
  });

  it.each(["status", "userId", "assignedToId", "attachmentMediaId", "id", "createdAt"])(
    "rejects the internal field %s",
    async (field) => {
      expect(await fieldsRejected({ ...VALID, [field]: "anything" })).toContain(field);
    },
  );
});
