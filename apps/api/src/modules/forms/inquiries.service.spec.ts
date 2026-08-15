import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../catalog/products.service";

import { InquiriesService } from "./inquiries.service";
import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { CreateInquiryDto } from "./dto/create-inquiry.dto";

const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const CREATED_AT = new Date("2026-08-15T09:30:00.000Z");
const ROW = { id: "11111111-1111-4111-8111-111111111111", createdAt: CREATED_AT };

/** The eight fields the table requires and the form marks with an asterisk — nothing more. */
const MINIMAL: CreateInquiryDto = {
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  industry: "Manufacturing",
  inquiryType: "general_inquiry",
  consentGiven: true,
};

type Harness = {
  service: InquiriesService;
  create: jest.Mock;
  existsById: jest.Mock;
};

async function createHarness(productExists = true): Promise<Harness> {
  const create = jest.fn().mockResolvedValue(ROW);
  const existsById = jest.fn().mockResolvedValue(productExists);

  const moduleRef = await Test.createTestingModule({
    providers: [
      InquiriesService,
      { provide: PrismaService, useValue: { inquiry: { create } } },
      { provide: ProductsService, useValue: { existsById } },
    ],
  }).compile();

  return { service: moduleRef.get(InquiriesService), create, existsById };
}

describe("InquiriesService.create", () => {
  it("writes the minimal submission and answers with the server-generated id and timestamp", async () => {
    const { service, create } = await createHarness();

    const result = await service.create({ ...MINIMAL });

    expect(result).toEqual({ id: ROW.id, createdAt: "2026-08-15T09:30:00.000Z" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("supplies status server-side and never reads one from the submission", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(create.mock.calls[0][0].data).toMatchObject({ status: INITIAL_SUBMISSION_STATUS });
  });

  it("never writes userId, assignedToId or attachmentMediaId", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    const { data } = create.mock.calls[0][0];

    expect(data).not.toHaveProperty("userId");
    expect(data).not.toHaveProperty("assignedToId");
    expect(data).not.toHaveProperty("attachmentMediaId");
  });

  it("selects only id and createdAt, so no lead field is echoed back", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(create.mock.calls[0][0].select).toEqual({ id: true, createdAt: true });
  });

  it("maps the wire inquiry type onto the Prisma enum member", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL, inquiryType: "sample_request" });

    expect(create.mock.calls[0][0].data.inquiryType).toBe("SAMPLE_REQUEST");
  });

  it("stores an absent multi-select as an empty array, not null", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(create.mock.calls[0][0].data.productsOfInterest).toEqual([]);
  });

  it("writes null rather than undefined for every omitted optional field", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    const { data } = create.mock.calls[0][0];

    expect(data.phone).toBeNull();
    expect(data.relatedProductId).toBeNull();
    expect(data.requiredQuantity).toBeNull();
    expect(data.destinationCountryPort).toBeNull();
    expect(data.preferredIncoterm).toBeNull();
    expect(data.message).toBeNull();
  });

  it("verifies a related product through the Catalog service before writing", async () => {
    const { service, create, existsById } = await createHarness();

    await service.create({
      ...MINIMAL,
      inquiryType: "sample_request",
      relatedProductId: PRODUCT_ID,
    });

    expect(existsById).toHaveBeenCalledWith(PRODUCT_ID);
    expect(create.mock.calls[0][0].data.relatedProductId).toBe(PRODUCT_ID);
  });

  it("does not consult the Catalog service when no product is referenced", async () => {
    const { service, existsById } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(existsById).not.toHaveBeenCalled();
  });

  it("rejects an unknown product as a field-level VALIDATION_ERROR and writes nothing", async () => {
    const { service, create } = await createHarness(false);

    const attempt = service.create({ ...MINIMAL, relatedProductId: PRODUCT_ID });

    await expect(attempt).rejects.toBeInstanceOf(ApiException);
    await expect(attempt).rejects.toMatchObject({
      code: ErrorCode.ValidationError,
      details: [{ field: "relatedProductId", issue: expect.any(String) }],
    });
    expect(create).not.toHaveBeenCalled();
  });
});
