import { Reflector } from "@nestjs/core";

import { ErrorCode } from "../../../common/http/error-code";
import { AdminUsersController } from "../admin-users.controller";
import { AUTHENTICATED_USER } from "../authenticated-user";
import { ROLES_METADATA_KEY } from "../decorators/roles.decorator";
import { Roles } from "../decorators/roles.decorator";
import { UserRole } from "../../../prisma/generated/client";

import { RolesGuard } from "./roles.guard";

import type { ApiException } from "../../../common/http/api.exception";
import type { AuthenticatedUser, RequestWithUser } from "../authenticated-user";
import type { ExecutionContext } from "@nestjs/common";

/**
 * RBAC, against the **real** `Reflector` reading real `@Roles()` metadata.
 *
 * The metadata is read from actual decorated classes rather than from a stubbed reflector, so what
 * these tests assert is what Nest would resolve at runtime.
 */

const guard = new RolesGuard(new Reflector());

function userWith(role: UserRole): AuthenticatedUser {
  return { id: "6a1f6a0e-0f5f-4a1a-9f8a-3f4d5b6c7d8e", email: "person@example.test", role };
}

/**
 * A context whose handler and class are the ones Nest would pass. `request` is spread in so a test
 * can add client-controlled fields — a body, a query — and prove they are not consulted.
 */
function makeContext(
  user: AuthenticatedUser | undefined,
  target: { handler: object; controller: new (...args: never[]) => object },
  extraRequestFields: Record<string, unknown> = {},
): ExecutionContext {
  const request: RequestWithUser & Record<string, unknown> = { ...extraRequestFields };

  if (user !== undefined) {
    request[AUTHENTICATED_USER] = user;
  }

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => target.handler,
    getClass: () => target.controller,
  } as unknown as ExecutionContext;
}

/** The real Admin-only controller from this module — not a fixture that imitates one. */
const adminTarget = {
  handler: AdminUsersController.prototype.list,
  controller: AdminUsersController,
};

class ContentManagerOnlyController {
  @Roles(UserRole.CONTENT_MANAGER)
  handle(): void {}
}

class UndecoratedController {
  handle(): void {}
}

function expectDenied(context: ExecutionContext): ApiException {
  try {
    guard.canActivate(context);
  } catch (error) {
    return error as ApiException;
  }

  throw new Error("expected the guard to deny");
}

describe("RolesGuard", () => {
  it("allows the permitted role", () => {
    expect(guard.canActivate(makeContext(userWith(UserRole.ADMIN), adminTarget))).toBe(true);
  });

  it("denies every other role with 403 FORBIDDEN", () => {
    for (const role of [UserRole.CONTENT_MANAGER, UserRole.SALES_EXPERT, UserRole.CUSTOMER]) {
      const failure = expectDenied(makeContext(userWith(role), adminTarget));

      expect(failure.getStatus()).toBe(403);
      expect(failure.code).toBe(ErrorCode.Forbidden);
    }
  });

  it("names neither the caller's role nor the required one in the 403", () => {
    const failure = expectDenied(makeContext(userWith(UserRole.SALES_EXPERT), adminTarget));

    expect(failure.message).not.toMatch(/admin|sales|content|customer|role/i);
  });

  /**
   * The rule from SECURITY.md: routes opt INTO higher requirements, never out of a base one. A
   * handler whose `@Roles()` someone forgot must be closed, not open to every authenticated user —
   * including `Customer`, which has no admin access whatsoever.
   */
  it("denies a handler carrying no @Roles() metadata at all", () => {
    const target = {
      handler: UndecoratedController.prototype.handle,
      controller: UndecoratedController,
    };

    for (const role of Object.values(UserRole)) {
      expect(expectDenied(makeContext(userWith(role), target)).code).toBe(ErrorCode.Forbidden);
    }
  });

  it("answers 401 rather than 403 when no user is attached at all", () => {
    const failure = expectDenied(makeContext(undefined, adminTarget));

    expect(failure.getStatus()).toBe(401);
    expect(failure.code).toBe(ErrorCode.Unauthenticated);
  });

  /**
   * The privilege-escalation test. The guard must read the role from the object `JwtAuthGuard`
   * wrote after a database read, and from nowhere a client can reach.
   */
  it("ignores a role supplied in the request body, query, headers or `user`", () => {
    const context = makeContext(userWith(UserRole.SALES_EXPERT), adminTarget, {
      body: { role: "admin", user: { role: "admin" } },
      query: { role: "admin" },
      headers: { "x-role": "admin", "x-user-role": "admin" },
      // The conventional property name, which this application deliberately does not use.
      user: { id: "attacker", email: "attacker@example.test", role: UserRole.ADMIN },
      params: { role: "admin" },
    });

    expect(expectDenied(context).code).toBe(ErrorCode.Forbidden);
  });

  it("cannot be satisfied by overwriting the authenticated user with a plain string", () => {
    const context = makeContext(undefined, adminTarget, {
      [AUTHENTICATED_USER as unknown as string]: "admin",
    });

    // A symbol key cannot be reached through JSON or a query string, so this can only happen from
    // inside the process — and it still fails closed.
    expect(expectDenied(context).getStatus()).toBeGreaterThanOrEqual(401);
  });

  it("resolves a handler's own @Roles() rather than the wrong controller's", () => {
    const target = {
      handler: ContentManagerOnlyController.prototype.handle,
      controller: ContentManagerOnlyController,
    };

    expect(guard.canActivate(makeContext(userWith(UserRole.CONTENT_MANAGER), target))).toBe(true);
    expect(expectDenied(makeContext(userWith(UserRole.ADMIN), target)).code).toBe(
      ErrorCode.Forbidden,
    );
  });

  it("reads the metadata key the decorator writes", () => {
    const roles: unknown = Reflect.getMetadata(ROLES_METADATA_KEY, AdminUsersController);

    expect(roles).toEqual([UserRole.ADMIN]);
  });
});
