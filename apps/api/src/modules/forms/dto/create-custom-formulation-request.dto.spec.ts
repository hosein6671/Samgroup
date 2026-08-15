import { ValidationPipe } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { validationExceptionFactory } from "../../../common/validation/validation-exception.factory";

import { CreateCustomFormulationRequestDto } from "./create-custom-formulation-request.dto";

import type { ArgumentMetadata } from "@nestjs/common";

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const META: ArgumentMetadata = { type: "body", metatype: CreateCustomFormulationRequestDto };

/** The seven NOT NULL columns a public submitter supplies. See the DTO's note on §5's asterisks. */
const VALID = {
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "Gear oil for high-load reducers",
  requiredSpecifications: "ISO VG 320, operating range -10 to 90 C, extended drain.",
  consentGiven: true,
};

async function run(body: unknown): Promise<CreateCustomFormulationRequestDto> {
  return (await pipe.transform(body, META)) as CreateCustomFormulationRequestDto;
}

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

describe("CreateCustomFormulationRequestDto", () => {
  it("accepts the seven required fields alone", async () => {
    await expect(run({ ...VALID })).resolves.toMatchObject({ email: "ada@example.com" });
  });

  it("accepts the four Incoterms this form offers", async () => {
    for (const preferredIncoterm of ["EXW", "FOB", "CFR", "CIF"]) {
      await expect(run({ ...VALID, preferredIncoterm })).resolves.toMatchObject({
        preferredIncoterm,
      });
    }
  });

  /** The documented distinction in DATA_MODEL_GAP_REVIEW §2, asserted rather than commented. */
  it("rejects the Inquiry form's fifth Incoterm option", async () => {
    expect(await fieldsRejected({ ...VALID, preferredIncoterm: "Not sure" })).toContain(
      "preferredIncoterm",
    );
  });

  it("rejects a submission missing the specification the form exists to collect", async () => {
    const { requiredSpecifications: _spec, ...withoutSpec } = VALID;

    expect(await fieldsRejected(withoutSpec)).toContain("requiredSpecifications");
  });

  it("rejects a submission without consent", async () => {
    expect(await fieldsRejected({ ...VALID, consentGiven: false })).toContain("consentGiven");
  });

  it("rejects a malformed email address", async () => {
    expect(await fieldsRejected({ ...VALID, email: "not-an-address" })).toContain("email");
  });

  it("rejects an unknown property", async () => {
    expect(await fieldsRejected({ ...VALID, budget: "50000" })).toContain("budget");
  });

  it.each(["status", "userId", "assignedToId", "attachmentMediaId"])(
    "rejects the internal field %s",
    async (field) => {
      expect(await fieldsRejected({ ...VALID, [field]: "anything" })).toContain(field);
    },
  );

  /** No product relation exists on this entity, so the Inquiry field must not be accepted here. */
  it("rejects relatedProductId, which this entity has no column for", async () => {
    expect(
      await fieldsRejected({
        ...VALID,
        relatedProductId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toContain("relatedProductId");
  });
});
