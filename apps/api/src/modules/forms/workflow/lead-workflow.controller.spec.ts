import { Reflector } from "@nestjs/core";

import { AUTHENTICATED_USER } from "../../identity/authenticated-user";
import { ROLES_METADATA_KEY } from "../../identity/decorators/roles.decorator";
import { RolesGuard } from "../../identity/guards/roles.guard";
import { UserRole } from "../../../prisma/generated/client";
import {
  AdminCustomFormulationWorkflowController,
  AdminInquiryWorkflowController,
} from "./lead-workflow.controller";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import { LeadWorkflowService as LeadWorkflowServiceClass } from "./lead-workflow.service";

import type { LeadWorkflowService } from "./lead-workflow.service";
import type { ExecutionContext } from "@nestjs/common";

/**
 * Who may reach each workflow route, decided by the **real** `RolesGuard` reading the **real**
 * `@Roles()` metadata off the shipped controllers.
 *
 * ## Why the metadata rather than a mocked guard
 *
 * A controller spec that overrides the guard proves the handler works and nothing about who can
 * call it — which is the only interesting question on a mutation surface. These tests resolve the
 * decorators exactly as Nest would at runtime, so an accidental widening (a missing handler-level
 * `@Roles`, a base class whose metadata is not inherited) fails here rather than in production.
 *
 * The controller-level list is `Admin, Sales Expert`; assignment narrows to `Admin` on the handler.
 * `getAllAndOverride` gives the handler precedence, which is what makes that narrowing real.
 */

const guard = new RolesGuard(new Reflector());

function user(role: UserRole): AuthenticatedUser {
  return { id: "aaaa1111-0000-4000-8000-000000000001", email: "person@samgp.test", role };
}

function contextFor(
  controller: new (...args: never[]) => object,
  handler: object,
  role: UserRole | null,
): ExecutionContext {
  const request: Record<PropertyKey, unknown> = {};

  if (role !== null) request[AUTHENTICATED_USER] = user(role);

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function allows(
  controller: new (...args: never[]) => object,
  handler: object,
  role: UserRole,
): boolean {
  try {
    return guard.canActivate(contextFor(controller, handler, role));
  } catch {
    return false;
  }
}

const CONTROLLERS = [
  ["inquiries", AdminInquiryWorkflowController],
  ["custom formulation requests", AdminCustomFormulationWorkflowController],
] as const;

describe.each(CONTROLLERS)("%s workflow routes — who gets in", (_name, Controller) => {
  const routes = {
    assignment: Controller.prototype.changeAssignment,
    status: Controller.prototype.changeStatus,
    history: Controller.prototype.readHistory,
  };

  /** Assignment is ownership. A Sales Expert works their leads; they do not redistribute them. */
  it("admits only Admin to assignment", () => {
    expect(allows(Controller, routes.assignment, UserRole.ADMIN)).toBe(true);
    expect(allows(Controller, routes.assignment, UserRole.SALES_EXPERT)).toBe(false);
    expect(allows(Controller, routes.assignment, UserRole.CONTENT_MANAGER)).toBe(false);
    expect(allows(Controller, routes.assignment, UserRole.CUSTOMER)).toBe(false);
  });

  it("admits Admin and Sales Expert to status", () => {
    expect(allows(Controller, routes.status, UserRole.ADMIN)).toBe(true);
    expect(allows(Controller, routes.status, UserRole.SALES_EXPERT)).toBe(true);
    expect(allows(Controller, routes.status, UserRole.CONTENT_MANAGER)).toBe(false);
    expect(allows(Controller, routes.status, UserRole.CUSTOMER)).toBe(false);
  });

  /**
   * Content Manager may read leads and may **not** read history. History records which member of
   * staff did what and when — employee activity data rather than lead data — and the RBAC matrix
   * gives them no operational reason to see it.
   */
  it("admits Admin and Sales Expert to history, and excludes Content Manager", () => {
    expect(allows(Controller, routes.history, UserRole.ADMIN)).toBe(true);
    expect(allows(Controller, routes.history, UserRole.SALES_EXPERT)).toBe(true);
    expect(allows(Controller, routes.history, UserRole.CONTENT_MANAGER)).toBe(false);
    expect(allows(Controller, routes.history, UserRole.CUSTOMER)).toBe(false);
  });

  it("refuses an unauthenticated request on every route", () => {
    for (const handler of Object.values(routes)) {
      expect(() => guard.canActivate(contextFor(Controller, handler, null))).toThrow();
    }
  });

  /** Deny-by-default only holds if the metadata is really there — a silent absence would open it. */
  it("declares roles on the class and narrows assignment on the handler", () => {
    const reflector = new Reflector();

    expect(reflector.get(ROLES_METADATA_KEY, Controller)).toEqual([
      UserRole.ADMIN,
      UserRole.SALES_EXPERT,
    ]);
    expect(reflector.get(ROLES_METADATA_KEY, routes.assignment)).toEqual([UserRole.ADMIN]);
  });
});

describe.each(CONTROLLERS)("%s workflow routes — what they pass on", (_name, Controller) => {
  const kind =
    Controller === AdminInquiryWorkflowController ? "Inquiry" : "CustomFormulationRequest";

  function build(): {
    controller: InstanceType<typeof Controller>;
    changeStatus: jest.Mock;
    changeAssignment: jest.Mock;
    readHistory: jest.Mock;
  } {
    const changeStatus = jest.fn().mockResolvedValue({ status: "closed", assigneeId: null });
    const changeAssignment = jest.fn().mockResolvedValue({ status: "new", assigneeId: null });
    const readHistory = jest.fn().mockResolvedValue([]);
    const workflow = {
      changeStatus,
      changeAssignment,
      readHistory,
    } as unknown as LeadWorkflowService;

    return {
      controller: new Controller(workflow),
      changeStatus,
      changeAssignment,
      readHistory,
    };
  }

  const actor = user(UserRole.ADMIN);

  it("tags every call with its own lead kind", async () => {
    const { controller, changeStatus, changeAssignment, readHistory } = build();
    const id = "11111111-1111-4111-8111-111111111111";

    await controller.changeStatus({ id }, { from: "new", to: "closed" }, actor);
    await controller.changeAssignment({ id }, { fromAssigneeId: null, assigneeId: null }, actor);
    await controller.readHistory({ id }, actor);

    expect(changeStatus.mock.calls[0][0]).toBe(kind);
    expect(changeAssignment.mock.calls[0][0]).toBe(kind);
    expect(readHistory.mock.calls[0][0]).toBe(kind);
  });

  /** The actor is the guard's, off the request. Nothing the client sent can become an actor. */
  it("passes the authenticated caller through as the actor", async () => {
    const { controller, changeStatus } = build();

    await controller.changeStatus(
      { id: "11111111-1111-4111-8111-111111111111" },
      { from: "new", to: "closed" },
      actor,
    );

    expect(changeStatus.mock.calls[0][3]).toBe(actor);
  });

  it("wraps the mutation result in the envelope with an empty meta", async () => {
    const { controller } = build();

    const response = await controller.changeStatus(
      { id: "11111111-1111-4111-8111-111111111111" },
      { from: "new", to: "closed" },
      actor,
    );

    expect(response.data).toEqual({ status: "closed", assigneeId: null });
    expect(response.meta).toEqual({});
  });

  it("reports the history count in meta.total", async () => {
    const { controller, readHistory } = build();

    readHistory.mockResolvedValue([
      {
        kind: "status",
        at: "2026-08-20T10:00:00.000Z",
        actorEmail: null,
        fromStatus: null,
        toStatus: "new",
        note: null,
      },
    ]);

    const response = await controller.readHistory(
      { id: "11111111-1111-4111-8111-111111111111" },
      actor,
    );

    expect(response.meta).toEqual({ total: 1 });
  });
});

/**
 * The dependency Nest will actually inject.
 *
 * This is not a style check. A derived controller that declares no constructor of its own emits an
 * **empty** `design:paramtypes`, so Nest constructs it with no arguments, `this.workflow` is
 * `undefined`, and every request answers 500. It type-checks, and every test above still passes
 * because they construct the controller by hand — the failure appears only against a live server.
 * It did, once. This assertion is what stops it appearing twice.
 */
describe("what Nest will inject", () => {
  it.each(CONTROLLERS)("%s declares its own constructor dependency", (_name, Controller) => {
    const paramtypes: unknown = Reflect.getMetadata("design:paramtypes", Controller);

    expect(paramtypes).toEqual([LeadWorkflowServiceClass]);
  });
});
