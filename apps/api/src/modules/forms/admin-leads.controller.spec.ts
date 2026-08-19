import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";

import { ErrorCode } from "../../common/http/error-code";
import { UserRole } from "../../prisma/generated/client";
import { AUTHENTICATED_USER } from "../identity/authenticated-user";
import { ROLES_METADATA_KEY } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";

import { AdminCustomFormulationRequestsController } from "./admin-custom-formulation-requests.controller";
import { AdminInquiriesController } from "./admin-inquiries.controller";
import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { AdminCustomFormulationRequestListQuery } from "./dto/admin-custom-formulation-request-list.query";
import { AdminInquiryListQuery } from "./dto/admin-inquiry-list.query";
import { LeadIdParam } from "./dto/lead-id.param";
import { InquiriesService } from "./inquiries.service";

import type { ApiException } from "../../common/http/api.exception";
import type { AuthenticatedUser, RequestWithUser } from "../identity/authenticated-user";
import type { ExecutionContext } from "@nestjs/common";

/**
 * The Admin lead endpoints as a *surface*: who may reach them, what they forward to the service,
 * and what they promise about caching.
 *
 * ── RBAC is measured against the real guard and the real decorators ─────────
 *
 * `RolesGuard` is constructed with a real `Reflector` and pointed at the real controller classes,
 * so what these tests assert is what Nest resolves at runtime — not what a stubbed reflector was
 * told to return. `roles.guard.spec.ts` does the same for `/admin/users`; this is the same
 * technique applied to the endpoints SECURITY.md gives three roles rather than one.
 */

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const SALES_EXPERT_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";

const PAGE = { rows: [], total: 0, page: 1, limit: 25 };
const DETAIL = { id: LEAD_ID };

const guardsOn = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

const rolesOn = (target: object): unknown[] =>
  (Reflect.getMetadata(ROLES_METADATA_KEY, target) as unknown[] | undefined) ?? [];

const headersOn = (handler: object): { name: string; value: string }[] =>
  (Reflect.getMetadata(HEADERS_METADATA, handler) as { name: string; value: string }[]) ?? [];

function userWith(role: UserRole, id = ADMIN_ID): AuthenticatedUser {
  return { id, email: "person@example.test", role };
}

function contextFor(
  user: AuthenticatedUser | undefined,
  controller: new (...args: never[]) => object,
  handler: object,
): ExecutionContext {
  const request: RequestWithUser = {};

  if (user !== undefined) {
    request[AUTHENTICATED_USER] = user;
  }

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

const rolesGuard = new RolesGuard(new Reflector());

type InquiryHarness = {
  controller: AdminInquiriesController;
  findAllForAdmin: jest.Mock;
  findByIdForAdmin: jest.Mock;
};

async function inquiryHarness(): Promise<InquiryHarness> {
  const findAllForAdmin = jest.fn().mockResolvedValue(PAGE);
  const findByIdForAdmin = jest.fn().mockResolvedValue(DETAIL);

  const moduleRef = await Test.createTestingModule({
    controllers: [AdminInquiriesController],
    providers: [{ provide: InquiriesService, useValue: { findAllForAdmin, findByIdForAdmin } }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return {
    controller: moduleRef.get(AdminInquiriesController),
    findAllForAdmin,
    findByIdForAdmin,
  };
}

async function formulationHarness(): Promise<{
  controller: AdminCustomFormulationRequestsController;
  findAllForAdmin: jest.Mock;
  findByIdForAdmin: jest.Mock;
}> {
  const findAllForAdmin = jest.fn().mockResolvedValue(PAGE);
  const findByIdForAdmin = jest.fn().mockResolvedValue(DETAIL);

  const moduleRef = await Test.createTestingModule({
    controllers: [AdminCustomFormulationRequestsController],
    providers: [
      {
        provide: CustomFormulationRequestsService,
        useValue: { findAllForAdmin, findByIdForAdmin },
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return {
    controller: moduleRef.get(AdminCustomFormulationRequestsController),
    findAllForAdmin,
    findByIdForAdmin,
  };
}

const CONTROLLERS: [string, new (...args: never[]) => object, object, object][] = [
  [
    "AdminInquiriesController",
    AdminInquiriesController,
    AdminInquiriesController.prototype.list,
    AdminInquiriesController.prototype.detail,
  ],
  [
    "AdminCustomFormulationRequestsController",
    AdminCustomFormulationRequestsController,
    AdminCustomFormulationRequestsController.prototype.list,
    AdminCustomFormulationRequestsController.prototype.detail,
  ],
];

describe("Admin lead endpoints are protected by declaration", () => {
  it.each(CONTROLLERS)("%s authenticates before it authorizes", (_name, controller) => {
    // Order matters: RolesGuard reads what JwtAuthGuard wrote, so a reversed list would answer 401
    // for a permitted caller holding a perfectly valid token.
    expect(guardsOn(controller)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  /**
   * SECURITY.md's RBAC matrix, "Forms & Leads": Admin full, Content Manager read, Sales Expert full
   * (own leads). API_CONTRACT_FINAL.md §2.10 says the same. Exactly those three, and never
   * `Customer`, whose cell in that column is the public submission endpoint.
   */
  it.each(CONTROLLERS)(
    "%s lists exactly the three roles the matrix grants",
    (_name, controller) => {
      expect(rolesOn(controller)).toEqual([
        UserRole.ADMIN,
        UserRole.CONTENT_MANAGER,
        UserRole.SALES_EXPERT,
      ]);
    },
  );

  /**
   * **Read-only, asserted rather than intended.** §2.10 contracts the Leads group as "list, read,
   * assign, status"; this gate implements the first two. A `PATCH` added here later would be a
   * status lifecycle nobody approved — `submission-status.ts` records that `new` has no authorized
   * transition and no second value — so the absence of every write verb is checked directly.
   */
  it.each(CONTROLLERS)("%s exposes GET handlers and nothing else", (_name, controller) => {
    const prototype: object = controller.prototype;
    const routeMethods = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== "constructor")
      .map((name) => (prototype as Record<string, unknown>)[name])
      .filter((value): value is object => typeof value === "function")
      .map((handler) => Reflect.getMetadata(METHOD_METADATA, handler) as unknown);

    expect(routeMethods.length).toBeGreaterThan(0);
    // RequestMethod.GET is 0; any write verb is a non-zero member of the same enum.
    expect(routeMethods.every((method) => method === RequestMethod.GET)).toBe(true);
  });

  it.each(CONTROLLERS)("%s is not throttled", (_name, controller) => {
    // The 5/hour budget belongs to the public submission endpoints. An operator paging an inbox
    // must not spend it — see throttle.config.ts.
    expect(guardsOn(controller)).not.toContain(ThrottlerGuard);
  });

  it.each(CONTROLLERS)(
    "%s sets Cache-Control: no-store on both handlers",
    (_name, _controller, list, detail) => {
      // §2.10's first rule, and @Header does not inherit from the controller — so both are checked.
      for (const handler of [list, detail]) {
        expect(headersOn(handler)).toEqual([{ name: "Cache-Control", value: "no-store" }]);
      }
    },
  );
});

describe("RBAC, against the real guard and the real metadata", () => {
  it.each(CONTROLLERS)(
    "%s admits Admin, Content Manager and Sales Expert",
    (_name, controller, list) => {
      for (const role of [UserRole.ADMIN, UserRole.CONTENT_MANAGER, UserRole.SALES_EXPERT]) {
        expect(rolesGuard.canActivate(contextFor(userWith(role), controller, list))).toBe(true);
      }
    },
  );

  it.each(CONTROLLERS)("%s refuses a Customer with 403", (_name, controller, list) => {
    const thrown = ((): ApiException => {
      try {
        rolesGuard.canActivate(contextFor(userWith(UserRole.CUSTOMER), controller, list));
      } catch (error) {
        return error as ApiException;
      }

      throw new Error("expected a Customer to be refused");
    })();

    expect(thrown.getStatus()).toBe(403);
    expect(thrown.code).toBe(ErrorCode.Forbidden);
    // The message names neither the caller's role nor the permitted ones.
    expect(thrown.message).not.toMatch(/admin|sales|content|customer/i);
  });

  it.each(CONTROLLERS)(
    "%s refuses an unauthenticated request with 401",
    (_name, controller, list) => {
      const thrown = ((): ApiException => {
        try {
          rolesGuard.canActivate(contextFor(undefined, controller, list));
        } catch (error) {
          return error as ApiException;
        }

        throw new Error("expected an unauthenticated request to be refused");
      })();

      expect(thrown.getStatus()).toBe(401);
      expect(thrown.code).toBe(ErrorCode.Unauthenticated);
    },
  );

  it.each(CONTROLLERS)(
    "%s applies the same rules to the detail handler",
    (_name, controller, _list, detail) => {
      expect(rolesGuard.canActivate(contextFor(userWith(UserRole.ADMIN), controller, detail))).toBe(
        true,
      );
      expect(() =>
        rolesGuard.canActivate(contextFor(userWith(UserRole.CUSTOMER), controller, detail)),
      ).toThrow();
    },
  );
});

describe("AdminInquiriesController", () => {
  it("wraps the page in the envelope's pagination meta", async () => {
    const { controller } = await inquiryHarness();

    const response = await controller.list({}, userWith(UserRole.ADMIN));

    expect(response).toMatchObject({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });

  it("forwards the query unchanged to the service", async () => {
    const { controller, findAllForAdmin } = await inquiryHarness();
    const query: AdminInquiryListQuery = { page: 2, limit: 10, inquiryType: "sample_request" };

    await controller.list(query, userWith(UserRole.ADMIN));

    expect(findAllForAdmin).toHaveBeenCalledWith(query, null);
  });

  /**
   * The scoping decision, taken from the authenticated caller and nothing else — SECURITY.md
   * §RBAC integration rule 2.
   */
  it("derives no constraint for an Admin or a Content Manager", async () => {
    const { controller, findAllForAdmin } = await inquiryHarness();

    await controller.list({}, userWith(UserRole.ADMIN));
    await controller.list({}, userWith(UserRole.CONTENT_MANAGER));

    expect(findAllForAdmin.mock.calls[0][1]).toBeNull();
    expect(findAllForAdmin.mock.calls[1][1]).toBeNull();
  });

  it("constrains a Sales Expert to their own id, taken from the session", async () => {
    const { controller, findAllForAdmin, findByIdForAdmin } = await inquiryHarness();
    const salesExpert = userWith(UserRole.SALES_EXPERT, SALES_EXPERT_ID);

    await controller.list({}, salesExpert);
    await controller.detail({ id: LEAD_ID }, salesExpert);

    expect(findAllForAdmin).toHaveBeenCalledWith({}, { assignedToId: SALES_EXPERT_ID });
    expect(findByIdForAdmin).toHaveBeenCalledWith(LEAD_ID, { assignedToId: SALES_EXPERT_ID });
  });

  it("returns the detail payload unwrapped — there is no meta to report", async () => {
    const { controller } = await inquiryHarness();

    await expect(controller.detail({ id: LEAD_ID }, userWith(UserRole.ADMIN))).resolves.toBe(
      DETAIL,
    );
  });
});

describe("AdminCustomFormulationRequestsController", () => {
  it("wraps the page in the envelope's pagination meta", async () => {
    const { controller } = await formulationHarness();

    await expect(controller.list({}, userWith(UserRole.ADMIN))).resolves.toMatchObject({
      data: [],
      meta: { total: 0, page: 1, limit: 25 },
    });
  });

  it("constrains a Sales Expert to their own id", async () => {
    const { controller, findAllForAdmin } = await formulationHarness();

    await controller.list({}, userWith(UserRole.SALES_EXPERT, SALES_EXPERT_ID));

    expect(findAllForAdmin).toHaveBeenCalledWith({}, { assignedToId: SALES_EXPERT_ID });
  });

  it("passes the validated id through to the service", async () => {
    const { controller, findByIdForAdmin } = await formulationHarness();

    await controller.detail({ id: LEAD_ID }, userWith(UserRole.ADMIN));

    expect(findByIdForAdmin).toHaveBeenCalledWith(LEAD_ID, null);
  });
});

/**
 * The regression `forms.controllers.spec.ts` documents from measurement, applied to the parameter
 * classes this gate adds.
 *
 * The global ValidationPipe finds a DTO through the `design:paramtypes` metadata TypeScript emits
 * for a handler's parameter annotation. Import the class with `import type` and it is erased: the
 * emitted metatype becomes `Function`, which is not in Nest's skip list, so the pipe validates
 * against a class carrying no `class-validator` metadata and answers 400 with every legitimate
 * parameter reported as "should not exist". `tsc` accepts the type-only import and the DTO's own
 * tests still pass, so only an assertion on the emitted metadata catches it.
 */
describe("parameter classes survive compilation as values", () => {
  const paramTypes = (controller: object, method: string): unknown[] =>
    (Reflect.getMetadata("design:paramtypes", controller, method) as unknown[] | undefined) ?? [];

  it("gives the inquiries list its query class", () => {
    expect(paramTypes(AdminInquiriesController.prototype, "list")[0]).toBe(AdminInquiryListQuery);
  });

  it("gives the formulation list its query class", () => {
    expect(paramTypes(AdminCustomFormulationRequestsController.prototype, "list")[0]).toBe(
      AdminCustomFormulationRequestListQuery,
    );
  });

  it.each([
    ["AdminInquiriesController", AdminInquiriesController.prototype],
    [
      "AdminCustomFormulationRequestsController",
      AdminCustomFormulationRequestsController.prototype,
    ],
  ])("gives %s's detail handler the id parameter class", (_name, prototype) => {
    expect(paramTypes(prototype, "detail")[0]).toBe(LeadIdParam);
  });
});
