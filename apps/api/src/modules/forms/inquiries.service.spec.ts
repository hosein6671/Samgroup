import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../catalog/products.service";

import { InquiriesService } from "./inquiries.service";
import { LeadNotificationService } from "./notification/lead-notification.service";
import * as revision from "./privacy-policy-revision";
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
  notifyInquiry: jest.Mock;
};

async function createHarness(productExists = true): Promise<Harness> {
  const create = jest.fn().mockResolvedValue(ROW);
  const existsById = jest.fn().mockResolvedValue(productExists);
  // Stands in for the real boundary, whose own contract — that it never throws — is asserted in
  // lead-notification.service.spec.ts. Here it resolves, so these tests measure what this service
  // does with a notification that behaves.
  const notifyInquiry = jest.fn().mockResolvedValue(undefined);

  const moduleRef = await Test.createTestingModule({
    providers: [
      InquiriesService,
      { provide: PrismaService, useValue: { inquiry: { create } } },
      { provide: ProductsService, useValue: { existsById } },
      { provide: LeadNotificationService, useValue: { notifyInquiry } },
    ],
  }).compile();

  return { service: moduleRef.get(InquiriesService), create, existsById, notifyInquiry };
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

/**
 * Consent evidence — SECURITY.md §Personal Data Retention, ratified 17 August 2026.
 *
 * `createdAt` already proved WHEN a consent was given. These assertions cover WHICH policy revision
 * it was given against: that the column is written on every inquiry regardless of type, that its
 * value comes from `ACTIVE_PRIVACY_POLICY_REVISION` rather than from the request, and that it is
 * the same value for every submission made by one build of the application.
 *
 * They deliberately assert **against the constant**, never against a literal. The constant is
 * `null` today because no approved Privacy Policy exists; when the gate that publishes one sets a
 * real revision these tests keep passing, and they would fail the moment a service stopped writing
 * the field or started deriving it from somewhere else.
 */
describe("InquiriesService.create — consent evidence", () => {
  it.each(["general_inquiry", "request_a_quote", "sample_request"] as const)(
    "stamps a %s submission with the server-owned policy revision",
    async (inquiryType) => {
      const { service, create } = await createHarness();

      await service.create({ ...MINIMAL, inquiryType });

      const { data } = create.mock.calls[0][0];

      expect(data).toHaveProperty("privacyPolicyVersion");
      expect(data.privacyPolicyVersion).toBe(revision.ACTIVE_PRIVACY_POLICY_REVISION);
    },
  );

  it("writes the same value for every submission, so the record is stable", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });
    await service.create({ ...MINIMAL, inquiryType: "sample_request" });
    await service.create({ ...MINIMAL, inquiryType: "request_a_quote" });

    const written = create.mock.calls.map((call) => call[0].data.privacyPolicyVersion);

    expect(written).toEqual([
      revision.ACTIVE_PRIVACY_POLICY_REVISION,
      revision.ACTIVE_PRIVACY_POLICY_REVISION,
      revision.ACTIVE_PRIVACY_POLICY_REVISION,
    ]);
  });

  /**
   * The DTO does not declare the field, so the global pipe rejects it with 400 long before the
   * service sees it — asserted in `create-inquiry.dto.spec.ts`. This covers the layer beneath that
   * one: even handed a body carrying a version, the service ignores it and writes the constant. The
   * cast is the point of the test, not a convenience.
   */
  it("ignores a client-supplied policy version and writes the server's own", async () => {
    const { service, create } = await createHarness();

    await service.create({
      ...MINIMAL,
      privacyPolicyVersion: "v99-forged-by-the-client",
    } as CreateInquiryDto);

    expect(create.mock.calls[0][0].data.privacyPolicyVersion).toBe(
      revision.ACTIVE_PRIVACY_POLICY_REVISION,
    );
  });

  it("does not put the policy version on the wire — the response is still id and createdAt", async () => {
    const { service, create } = await createHarness();

    const result = await service.create({ ...MINIMAL });

    expect(result).toEqual({ id: ROW.id, createdAt: "2026-08-15T09:30:00.000Z" });
    expect(create.mock.calls[0][0].select).toEqual({ id: true, createdAt: true });
  });
});

/**
 * The assertions above compare the written value to the constant, and the constant is `null` today
 * — so on their own they would still pass if the service wrote a hardcoded `null` and never read
 * the constant at all. This closes that hole: the exported revision is replaced with a stand-in and
 * the service must write **that** value.
 *
 * `jest.replaceProperty` rather than a module mock, because the service reads the binding at call
 * time, and the replacement is undone in `afterEach` so no other test can see it.
 */
describe("InquiriesService.create — the revision actually comes from the constant", () => {
  // The config sets no `restoreMocks`, so the replacement is undone explicitly rather than
  // left to leak into whatever runs next.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes the revision the constant names, whatever it is", async () => {
    const REVISION = "test-only-revision-not-a-policy";

    jest.replaceProperty(
      revision as { ACTIVE_PRIVACY_POLICY_REVISION: string | null },
      "ACTIVE_PRIVACY_POLICY_REVISION",
      REVISION,
    );

    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(create.mock.calls[0][0].data.privacyPolicyVersion).toBe(REVISION);
  });
});

/**
 * The notification hand-off.
 *
 * What is asserted here is the **division of responsibility**, not delivery: that the row is
 * written first, that the boundary receives exactly the values just persisted, and that nothing it
 * does reaches the response. Delivery itself — timeouts, refused relays, unconfigured mail — is
 * `lead-notification.service.spec.ts` and `smtp.mailer.spec.ts`.
 */
describe("InquiriesService.create — internal notification", () => {
  it("notifies once for a successful submission", async () => {
    const { service, notifyInquiry } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(notifyInquiry).toHaveBeenCalledTimes(1);
  });

  it("hands over the persisted id and timestamp, not values of its own", async () => {
    const { service, notifyInquiry } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(notifyInquiry.mock.calls[0][0]).toMatchObject({
      id: ROW.id,
      createdAt: "2026-08-15T09:30:00.000Z",
    });
  });

  it("hands over every submitted field the approved mapping names", async () => {
    const { service, notifyInquiry } = await createHarness();

    await service.create({
      ...MINIMAL,
      inquiryType: "request_a_quote",
      phone: "+44 20 7946 0000",
      relatedProductId: PRODUCT_ID,
      productsOfInterest: ["Base oils"],
      requiredQuantity: "20 MT",
      destinationCountryPort: "Jebel Ali",
      preferredIncoterm: "FOB",
      message: "Please quote for quarterly shipments.",
    });

    expect(notifyInquiry.mock.calls[0][0]).toEqual({
      id: ROW.id,
      createdAt: "2026-08-15T09:30:00.000Z",
      privacyPolicyVersion: revision.ACTIVE_PRIVACY_POLICY_REVISION,
      inquiryType: "request_a_quote",
      firstName: MINIMAL.firstName,
      lastName: MINIMAL.lastName,
      companyName: MINIMAL.companyName,
      country: MINIMAL.country,
      email: MINIMAL.email,
      industry: MINIMAL.industry,
      phone: "+44 20 7946 0000",
      relatedProductId: PRODUCT_ID,
      productsOfInterest: ["Base oils"],
      requiredQuantity: "20 MT",
      destinationCountryPort: "Jebel Ali",
      preferredIncoterm: "FOB",
      message: "Please quote for quarterly shipments.",
    });
  });

  it("hands over the same policy revision the row was stamped with", async () => {
    const { service, create, notifyInquiry } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(notifyInquiry.mock.calls[0][0].privacyPolicyVersion).toBe(
      create.mock.calls[0][0].data.privacyPolicyVersion,
    );
  });

  /**
   * The ordering the whole gate depends on. A notification attempted before the write could fire
   * for a lead that was never stored.
   */
  it("notifies only after the row is written", async () => {
    const order: string[] = [];
    const { service, create, notifyInquiry } = await createHarness();

    create.mockImplementation(async () => {
      order.push("persist");

      return ROW;
    });
    notifyInquiry.mockImplementation(async () => {
      order.push("notify");
    });

    await service.create({ ...MINIMAL });

    expect(order).toEqual(["persist", "notify"]);
  });

  it("attempts no notification when the write fails", async () => {
    const { service, create, notifyInquiry } = await createHarness();
    create.mockRejectedValue(new Error("write failed"));

    await expect(service.create({ ...MINIMAL })).rejects.toThrow("write failed");

    expect(notifyInquiry).not.toHaveBeenCalled();
  });

  it("attempts no notification when the product reference is rejected", async () => {
    const { service, notifyInquiry } = await createHarness(false);

    await expect(
      service.create({ ...MINIMAL, relatedProductId: PRODUCT_ID }),
    ).rejects.toBeInstanceOf(ApiException);

    expect(notifyInquiry).not.toHaveBeenCalled();
  });

  /**
   * **Documents where the safety actually lives, and it is not here.**
   *
   * This service awaits the boundary and adds no second catch of its own, so a boundary that broke
   * its never-throws contract would surface as a failed submission — which is precisely why that
   * contract is asserted exhaustively in `lead-notification.service.spec.ts` against every SMTP
   * failure mode, rather than assumed. Wrapping this call in another try/catch would hide a real
   * defect in the boundary behind a silent success, and the row would still be written either way.
   *
   * The test is kept as the record of that choice: if it ever starts failing, the boundary is
   * broken and the fix belongs there.
   */
  it("relies on the boundary never rejecting, rather than catching a second time", async () => {
    const { service, notifyInquiry } = await createHarness();
    notifyInquiry.mockRejectedValue(new Error("boundary contract broken"));

    await expect(service.create({ ...MINIMAL })).rejects.toThrow("boundary contract broken");
  });

  it("returns id and createdAt and nothing else, whatever the notification did", async () => {
    const { service, notifyInquiry } = await createHarness();

    const result = await service.create({ ...MINIMAL });

    expect(Object.keys(result).sort()).toEqual(["createdAt", "id"]);
    expect(notifyInquiry).toHaveBeenCalledTimes(1);
  });
});
