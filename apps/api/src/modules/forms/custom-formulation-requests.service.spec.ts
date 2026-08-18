import { Test } from "@nestjs/testing";

import { PrismaService } from "../../prisma/prisma.service";

import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { LeadNotificationService } from "./notification/lead-notification.service";
import * as revision from "./privacy-policy-revision";
import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { CreateCustomFormulationRequestDto } from "./dto/create-custom-formulation-request.dto";

const CREATED_AT = new Date("2026-08-15T09:30:00.000Z");
const ROW = { id: "33333333-3333-4333-8333-333333333333", createdAt: CREATED_AT };

/** The seven columns `custom_formulation_requests` declares NOT NULL — nothing more. */
const MINIMAL: CreateCustomFormulationRequestDto = {
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "Hydraulic fluid for a high-pressure test rig",
  requiredSpecifications: "ISO VG 46, low pour point, zinc-free",
  consentGiven: true,
};

type Harness = {
  service: CustomFormulationRequestsService;
  create: jest.Mock;
  notifyCustomFormulationRequest: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const create = jest.fn().mockResolvedValue(ROW);
  // See the note on the same mock in inquiries.service.spec.ts.
  const notifyCustomFormulationRequest = jest.fn().mockResolvedValue(undefined);

  const moduleRef = await Test.createTestingModule({
    providers: [
      CustomFormulationRequestsService,
      { provide: PrismaService, useValue: { customFormulationRequest: { create } } },
      { provide: LeadNotificationService, useValue: { notifyCustomFormulationRequest } },
    ],
  }).compile();

  return {
    service: moduleRef.get(CustomFormulationRequestsService),
    create,
    notifyCustomFormulationRequest,
  };
}

/**
 * The write path for the Custom Product Request form.
 *
 * Until this gate the service had no spec of its own — it was covered only through its controller
 * and its DTO. Consent evidence is a property of the **write**, so it needs assertions at the layer
 * that performs one; the neighbouring server-owned invariants are asserted alongside it rather than
 * left to the Inquiry spec, which exercises a different entity.
 */
describe("CustomFormulationRequestsService.create", () => {
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

  it("selects only id and createdAt, so no submitted field is echoed back", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(create.mock.calls[0][0].select).toEqual({ id: true, createdAt: true });
  });

  it("writes null rather than undefined for every omitted optional field", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    const { data } = create.mock.calls[0][0];

    expect(data.phone).toBeNull();
    expect(data.estimatedQuantity).toBeNull();
    expect(data.packagingRequirements).toBeNull();
    expect(data.additionalInformation).toBeNull();
    expect(data.destinationCountry).toBeNull();
    expect(data.preferredIncoterm).toBeNull();
  });
});

/** The same consent-evidence contract the Inquiry spec asserts, on the second entity that carries it. */
describe("CustomFormulationRequestsService.create — consent evidence", () => {
  it("stamps the submission with the server-owned policy revision", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });

    const { data } = create.mock.calls[0][0];

    expect(data).toHaveProperty("privacyPolicyVersion");
    expect(data.privacyPolicyVersion).toBe(revision.ACTIVE_PRIVACY_POLICY_REVISION);
  });

  it("writes the same value for every submission, so the record is stable", async () => {
    const { service, create } = await createHarness();

    await service.create({ ...MINIMAL });
    await service.create({ ...MINIMAL, estimatedQuantity: "20 drums" });

    const written = create.mock.calls.map((call) => call[0].data.privacyPolicyVersion);

    expect(written).toEqual([
      revision.ACTIVE_PRIVACY_POLICY_REVISION,
      revision.ACTIVE_PRIVACY_POLICY_REVISION,
    ]);
  });

  it("ignores a client-supplied policy version and writes the server's own", async () => {
    const { service, create } = await createHarness();

    await service.create({
      ...MINIMAL,
      privacyPolicyVersion: "v99-forged-by-the-client",
    } as CreateCustomFormulationRequestDto);

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

/** The same proof the Inquiry spec carries: the value is read from the constant, not hardcoded. */
describe("CustomFormulationRequestsService.create — the revision comes from the constant", () => {
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

/** The same hand-off as the Inquiry path, over a different entity. */
describe("CustomFormulationRequestsService.create — internal notification", () => {
  it("notifies once for a successful submission", async () => {
    const { service, notifyCustomFormulationRequest } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(notifyCustomFormulationRequest).toHaveBeenCalledTimes(1);
  });

  it("hands over every submitted field the approved mapping names", async () => {
    const { service, notifyCustomFormulationRequest } = await createHarness();

    await service.create({
      ...MINIMAL,
      phone: "+44 20 7946 0000",
      estimatedQuantity: "5 MT / month",
      packagingRequirements: "IBC tanks",
      destinationCountry: "United Arab Emirates",
      preferredIncoterm: "CIF",
      additionalInformation: "Existing supplier is discontinuing the grade.",
    });

    expect(notifyCustomFormulationRequest.mock.calls[0][0]).toEqual({
      id: ROW.id,
      createdAt: "2026-08-15T09:30:00.000Z",
      privacyPolicyVersion: revision.ACTIVE_PRIVACY_POLICY_REVISION,
      companyName: MINIMAL.companyName,
      country: MINIMAL.country,
      industry: MINIMAL.industry,
      email: MINIMAL.email,
      phone: "+44 20 7946 0000",
      productOrApplication: MINIMAL.productOrApplication,
      requiredSpecifications: MINIMAL.requiredSpecifications,
      estimatedQuantity: "5 MT / month",
      packagingRequirements: "IBC tanks",
      destinationCountry: "United Arab Emirates",
      preferredIncoterm: "CIF",
      additionalInformation: "Existing supplier is discontinuing the grade.",
    });
  });

  it("hands over no product reference, because the entity has no column for one", async () => {
    const { service, notifyCustomFormulationRequest } = await createHarness();

    await service.create({ ...MINIMAL });

    expect(notifyCustomFormulationRequest.mock.calls[0][0]).not.toHaveProperty("relatedProductId");
  });

  it("notifies only after the row is written", async () => {
    const order: string[] = [];
    const { service, create, notifyCustomFormulationRequest } = await createHarness();

    create.mockImplementation(async () => {
      order.push("persist");

      return ROW;
    });
    notifyCustomFormulationRequest.mockImplementation(async () => {
      order.push("notify");
    });

    await service.create({ ...MINIMAL });

    expect(order).toEqual(["persist", "notify"]);
  });

  it("attempts no notification when the write fails", async () => {
    const { service, create, notifyCustomFormulationRequest } = await createHarness();
    create.mockRejectedValue(new Error("write failed"));

    await expect(service.create({ ...MINIMAL })).rejects.toThrow("write failed");

    expect(notifyCustomFormulationRequest).not.toHaveBeenCalled();
  });

  it("returns id and createdAt and nothing else", async () => {
    const { service } = await createHarness();

    const result = await service.create({ ...MINIMAL });

    expect(Object.keys(result).sort()).toEqual(["createdAt", "id"]);
  });
});
