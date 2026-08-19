import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../catalog/products.service";

import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "./dto/admin-lead-list.query";
import { InquiriesService } from "./inquiries.service";
import { LeadNotificationService } from "./notification/lead-notification.service";

import type { AdminCustomFormulationRequestListQuery } from "./dto/admin-custom-formulation-request-list.query";
import type { AdminInquiryListQuery } from "./dto/admin-inquiry-list.query";
import type { LeadScope } from "./lead-scope";

/**
 * The Admin read half of both Forms services — what it asks the database for, and what it hands
 * back.
 *
 * ── Prisma is stubbed, and the assertions are on the query object ───────────
 *
 * The same arrangement the write specs in this directory use. What matters here is not that
 * Postgres can execute a `findMany` — it can — but that the `where`, the `orderBy`, the `select`
 * and the window are exactly what the contract says. Those are values this code constructs, so
 * they can be read directly instead of inferred from rows. Behaviour against the real database is
 * covered by the runtime verification this gate ran, not by mocking one.
 */

const CREATED_AT = new Date("2026-08-19T09:30:00.000Z");
const SALES_EXPERT_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "11111111-1111-4111-8111-111111111111";

const INQUIRY_ROW = {
  id: LEAD_ID,
  createdAt: CREATED_AT,
  inquiryType: "SAMPLE_REQUEST",
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  relatedProductId: null,
  status: "new",
};

const INQUIRY_DETAIL_ROW = {
  ...INQUIRY_ROW,
  phone: "+44 20 7946 0000",
  industry: "Manufacturing",
  productsOfInterest: ["Base oils"],
  requiredQuantity: "20 t",
  destinationCountryPort: "Felixstowe",
  preferredIncoterm: "FOB",
  message: "Please send a sample.",
  consentGiven: true,
  privacyPolicyVersion: null,
};

const FORMULATION_ROW = {
  id: LEAD_ID,
  createdAt: CREATED_AT,
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "High-temperature chain oil",
  status: "new",
};

const FORMULATION_DETAIL_ROW = {
  ...FORMULATION_ROW,
  phone: null,
  requiredSpecifications: "ISO VG 220, drop point above 250 C",
  estimatedQuantity: null,
  packagingRequirements: null,
  additionalInformation: null,
  destinationCountry: null,
  preferredIncoterm: null,
  consentGiven: true,
  privacyPolicyVersion: null,
};

type InquiryHarness = {
  service: InquiriesService;
  count: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  transaction: jest.Mock;
};

async function inquiryHarness(rows: unknown[] = [INQUIRY_ROW], total = 1): Promise<InquiryHarness> {
  const count = jest.fn().mockResolvedValue(total);
  const findMany = jest.fn().mockResolvedValue(rows);
  const findFirst = jest.fn().mockResolvedValue(INQUIRY_DETAIL_ROW);
  // Mirrors Prisma's array form: the operations are awaited together, so the count and the page
  // come from one snapshot. The stub resolves them the same way.
  const transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));

  const moduleRef = await Test.createTestingModule({
    providers: [
      InquiriesService,
      {
        provide: PrismaService,
        useValue: {
          inquiry: { count, findMany, findFirst, create: jest.fn() },
          $transaction: transaction,
        },
      },
      { provide: ProductsService, useValue: { existsById: jest.fn() } },
      { provide: LeadNotificationService, useValue: { notifyInquiry: jest.fn() } },
    ],
  }).compile();

  return { service: moduleRef.get(InquiriesService), count, findMany, findFirst, transaction };
}

type FormulationHarness = {
  service: CustomFormulationRequestsService;
  count: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
};

async function formulationHarness(
  rows: unknown[] = [FORMULATION_ROW],
  total = 1,
): Promise<FormulationHarness> {
  const count = jest.fn().mockResolvedValue(total);
  const findMany = jest.fn().mockResolvedValue(rows);
  const findFirst = jest.fn().mockResolvedValue(FORMULATION_DETAIL_ROW);

  const moduleRef = await Test.createTestingModule({
    providers: [
      CustomFormulationRequestsService,
      {
        provide: PrismaService,
        useValue: {
          customFormulationRequest: { count, findMany, findFirst, create: jest.fn() },
          $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
        },
      },
      { provide: LeadNotificationService, useValue: { notifyCustomFormulationRequest: jest.fn() } },
    ],
  }).compile();

  return { service: moduleRef.get(CustomFormulationRequestsService), count, findMany, findFirst };
}

const NO_SCOPE: LeadScope = null;

/** The exception a rejected read threw. Fails the test if the call unexpectedly resolved. */
async function rejection(read: Promise<unknown>): Promise<ApiException> {
  try {
    await read;
  } catch (error) {
    return error as ApiException;
  }

  throw new Error("expected the read to be rejected");
}

describe("InquiriesService.findAllForAdmin", () => {
  it("defaults to page 1, the default limit, and newest first", async () => {
    const { service, findMany } = await inquiryHarness();

    const result = await service.findAllForAdmin({}, NO_SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: DEFAULT_LIMIT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.limit).toBe(DEFAULT_LIMIT);
    expect(result.total).toBe(1);
  });

  /**
   * `created_at` is not unique, so it cannot order a page on its own: two rows written in the same
   * microsecond would be returned in whatever order the planner produced, and a row could appear on
   * two pages or on none. The secondary key must travel in the same direction as the primary one.
   */
  it("carries the id tie-breaker in whichever direction was asked for", async () => {
    const { service, findMany } = await inquiryHarness();

    await service.findAllForAdmin({ sort: "createdAt" }, NO_SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("translates page and limit into a skip/take window", async () => {
    const { service, findMany } = await inquiryHarness();

    await service.findAllForAdmin({ page: 3, limit: 10 }, NO_SCOPE);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
  });

  it("counts and reads inside one transaction, against the same where clause", async () => {
    const { service, count, findMany, transaction } = await inquiryHarness();

    await service.findAllForAdmin({ inquiryType: "sample_request" }, NO_SCOPE);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0][0].where).toEqual(findMany.mock.calls[0][0].where);
  });

  it("filters on the Prisma enum member, not on the wire value", async () => {
    const { service, findMany } = await inquiryHarness();

    await service.findAllForAdmin({ inquiryType: "request_a_quote" }, NO_SCOPE);

    expect(findMany.mock.calls[0][0].where).toEqual({ inquiryType: "REQUEST_A_QUOTE" });
  });

  it("applies no where clause at all for an unscoped, unfiltered request", async () => {
    const { service, findMany } = await inquiryHarness();

    await service.findAllForAdmin({}, NO_SCOPE);

    expect(findMany.mock.calls[0][0].where).toEqual({});
  });

  /**
   * The access-control assertion. SECURITY.md §RBAC integration: a Sales Expert sees only assigned
   * records because the server constrains the query. The constraint has to reach `where` on both
   * the count and the page — a scoped page with an unscoped total would report rows the caller
   * cannot see.
   */
  it("constrains both queries to the scope it was given", async () => {
    const { service, count, findMany } = await inquiryHarness();

    await service.findAllForAdmin({}, { assignedToId: SALES_EXPERT_ID });

    expect(findMany.mock.calls[0][0].where).toEqual({ assignedToId: SALES_EXPERT_ID });
    expect(count.mock.calls[0][0].where).toEqual({ assignedToId: SALES_EXPERT_ID });
  });

  it("combines the scope with the filter rather than letting either replace the other", async () => {
    const { service, findMany } = await inquiryHarness();

    await service.findAllForAdmin(
      { inquiryType: "general_inquiry" },
      {
        assignedToId: SALES_EXPERT_ID,
      },
    );

    expect(findMany.mock.calls[0][0].where).toEqual({
      assignedToId: SALES_EXPERT_ID,
      inquiryType: "GENERAL_INQUIRY",
    });
  });

  /**
   * The list is a triage surface. `message` in particular is the submitter's verbatim text, and a
   * page of 25 would put 25 people's messages on the wire to render none of them.
   */
  it("selects the list projection only — no message, phone, or consent evidence", async () => {
    const { service, findMany } = await inquiryHarness();

    await service.findAllForAdmin({}, NO_SCOPE);

    const select = findMany.mock.calls[0][0].select;

    expect(Object.keys(select).sort()).toEqual(
      [
        "companyName",
        "country",
        "createdAt",
        "email",
        "firstName",
        "id",
        "inquiryType",
        "lastName",
        "relatedProductId",
        "status",
        "assignedToId",
      ].sort(),
    );
  });

  /**
   * `assignedToId` left this list when the workflow gate published it as `assigneeId`: the detail
   * view renders the owner and the assignment control sends the value back as its compare-and-set
   * predicate, so withholding it would make a safe write impossible (ADR-013). The other two stay
   * out — `userId` is structurally NULL on every row, and `attachmentMediaId` is a handle to an
   * object store with no read route behind it.
   */
  it("never selects userId or attachmentMediaId", async () => {
    const { service, findMany, findFirst } = await inquiryHarness();

    await service.findAllForAdmin({}, NO_SCOPE);
    await service.findByIdForAdmin(LEAD_ID, NO_SCOPE);

    for (const call of [findMany.mock.calls[0][0], findFirst.mock.calls[0][0]]) {
      expect(call.select).not.toHaveProperty("userId");
      expect(call.select).not.toHaveProperty("attachmentMediaId");
    }
  });

  it("publishes the owner as assigneeId, an id rather than a name", async () => {
    const { service, findMany } = await inquiryHarness();

    const { rows } = await service.findAllForAdmin({}, NO_SCOPE);

    expect(findMany.mock.calls[0][0].select).toHaveProperty("assignedToId", true);
    expect(rows[0]).toHaveProperty("assigneeId");
    // An id, never resolved to an email or a name — Forms cannot read `users`.
    expect(rows[0]).not.toHaveProperty("assigneeEmail");
  });

  it("renders createdAt as ISO 8601 and inquiryType as its wire value", async () => {
    const { service } = await inquiryHarness();

    const { rows } = await service.findAllForAdmin({}, NO_SCOPE);
    const [row] = rows;

    expect(row).toBeDefined();
    expect(row?.createdAt).toBe("2026-08-19T09:30:00.000Z");
    expect(row?.inquiryType).toBe("sample_request");
  });

  /** A page past the end is an empty page, not an error: rows can be read away between requests. */
  it("answers an empty page beyond the end with the real total", async () => {
    const { service } = await inquiryHarness([], 3);

    const result = await service.findAllForAdmin({ page: 9 }, NO_SCOPE);

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(3);
  });

  it("passes no client-supplied key into where beyond the one filter it declares", async () => {
    const { service, findMany } = await inquiryHarness();

    // The DTO cannot carry this — `forbidNonWhitelisted` rejects it at the pipe — but the service
    // must not read it even if a future caller hands one over.
    await service.findAllForAdmin(
      { assignedToId: "someone-else" } as unknown as AdminInquiryListQuery,
      NO_SCOPE,
    );

    expect(findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("InquiriesService.findByIdForAdmin", () => {
  it("returns the full submission for an id in scope", async () => {
    const { service } = await inquiryHarness();

    const detail = await service.findByIdForAdmin(LEAD_ID, NO_SCOPE);

    expect(detail).toEqual({
      id: LEAD_ID,
      createdAt: "2026-08-19T09:30:00.000Z",
      inquiryType: "sample_request",
      firstName: "Ada",
      lastName: "Lovelace",
      companyName: "Analytical Engines Ltd",
      country: "United Kingdom",
      email: "ada@example.com",
      relatedProductId: null,
      status: "new",
      phone: "+44 20 7946 0000",
      industry: "Manufacturing",
      productsOfInterest: ["Base oils"],
      requiredQuantity: "20 t",
      destinationCountryPort: "Felixstowe",
      preferredIncoterm: "FOB",
      message: "Please send a sample.",
      consentGiven: true,
      privacyPolicyVersion: null,
    });
  });

  it("puts the scope in the same where clause as the id", async () => {
    const { service, findFirst } = await inquiryHarness();

    await service.findByIdForAdmin(LEAD_ID, { assignedToId: SALES_EXPERT_ID });

    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: LEAD_ID,
      assignedToId: SALES_EXPERT_ID,
    });
  });

  /**
   * 404 rather than 403, even when the row exists but belongs to someone else. A 403 would confirm
   * the id names a real record, turning the endpoint into an existence oracle for harvested ids.
   */
  it("answers NOT_FOUND when nothing in scope matches", async () => {
    const { service, findFirst } = await inquiryHarness();

    findFirst.mockResolvedValue(null);

    const error = await rejection(
      service.findByIdForAdmin(LEAD_ID, { assignedToId: SALES_EXPERT_ID }),
    );

    expect(error).toBeInstanceOf(ApiException);
    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe(ErrorCode.NotFound);
  });
});

describe("CustomFormulationRequestsService.findAllForAdmin", () => {
  it("orders newest first with the id tie-breaker and the default window", async () => {
    const { service, findMany } = await formulationHarness();

    await service.findAllForAdmin({}, NO_SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: DEFAULT_LIMIT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("constrains both queries to the scope it was given", async () => {
    const { service, count, findMany } = await formulationHarness();

    await service.findAllForAdmin({}, { assignedToId: SALES_EXPERT_ID });

    expect(findMany.mock.calls[0][0].where).toEqual({ assignedToId: SALES_EXPERT_ID });
    expect(count.mock.calls[0][0].where).toEqual({ assignedToId: SALES_EXPERT_ID });
  });

  it("keeps requiredSpecifications out of the list projection", async () => {
    const { service, findMany } = await formulationHarness();

    await service.findAllForAdmin({}, NO_SCOPE);

    const select = findMany.mock.calls[0][0].select;

    expect(select).not.toHaveProperty("requiredSpecifications");
    expect(Object.keys(select).sort()).toEqual(
      [
        "companyName",
        "country",
        "createdAt",
        "email",
        "id",
        "industry",
        "productOrApplication",
        "status",
        "assignedToId",
      ].sort(),
    );
  });

  it("has no filter term to apply", async () => {
    const { service, findMany } = await formulationHarness();

    await service.findAllForAdmin(
      { industry: "Manufacturing" } as unknown as AdminCustomFormulationRequestListQuery,
      NO_SCOPE,
    );

    expect(findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("CustomFormulationRequestsService.findByIdForAdmin", () => {
  it("returns the full request for an id in scope", async () => {
    const { service } = await formulationHarness();

    const detail = await service.findByIdForAdmin(LEAD_ID, NO_SCOPE);

    expect(detail).toEqual({
      id: LEAD_ID,
      createdAt: "2026-08-19T09:30:00.000Z",
      companyName: "Analytical Engines Ltd",
      country: "United Kingdom",
      industry: "Manufacturing",
      email: "ada@example.com",
      productOrApplication: "High-temperature chain oil",
      status: "new",
      phone: null,
      requiredSpecifications: "ISO VG 220, drop point above 250 C",
      estimatedQuantity: null,
      packagingRequirements: null,
      additionalInformation: null,
      destinationCountry: null,
      preferredIncoterm: null,
      consentGiven: true,
      privacyPolicyVersion: null,
    });
  });

  it("answers NOT_FOUND when nothing in scope matches", async () => {
    const { service, findFirst } = await formulationHarness();

    findFirst.mockResolvedValue(null);

    const error = await rejection(service.findByIdForAdmin(LEAD_ID, NO_SCOPE));

    expect(error).toBeInstanceOf(ApiException);
    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe(ErrorCode.NotFound);
  });
});
