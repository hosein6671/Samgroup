import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { AUTHENTICATED_USER } from "../authenticated-user";
import { ROLES_METADATA_KEY } from "../decorators/roles.decorator";

import type { RequestWithUser } from "../authenticated-user";
import type { UserRole } from "../../../prisma/generated/client";

const FORBIDDEN_STATUS = 403;
const UNAUTHORIZED_STATUS = 401;

/**
 * The message a 403 carries. It names no role, neither the caller's nor the ones that would have
 * been accepted: telling a Sales Expert that a route wants Admin maps the platform's privilege
 * structure for anyone who probes it.
 */
const FORBIDDEN_MESSAGE = "You do not have access to this resource.";

/**
 * Enforces SECURITY.md's RBAC matrix — API_CONTRACT_FINAL.md §7, "enforced in NestJS guards".
 *
 * Runs after `JwtAuthGuard` (guards execute in the order they are listed in `@UseGuards`) and
 * reads the same request property that guard wrote. It never parses a token, never reads a header,
 * and never looks at the request body or query — the role it compares comes from the `users` row,
 * so "role cannot be supplied by the client" is a structural property rather than a check.
 *
 * ── Deny by default ─────────────────────────────────────────────────────────
 *
 * A handler with no `@Roles()` metadata is **denied**, not allowed. Nest's usual convention is the
 * reverse, and the reverse is wrong here: SECURITY.md requires that admin routes opt into higher
 * requirements rather than out of a base one, and a decorator that someone forgets to write must
 * not silently open a route to every authenticated user — including `Customer`, the role with no
 * admin access whatsoever.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request[AUTHENTICATED_USER];

    if (user === undefined) {
      // Reached only if this guard is used without JwtAuthGuard in front of it. Answering 401
      // rather than 403 is the accurate description: nobody has been authenticated at all.
      throw new ApiException(
        UNAUTHORIZED_STATUS,
        ErrorCode.Unauthenticated,
        "Authentication is required.",
      );
    }

    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // `getAllAndOverride` lets a handler's own `@Roles()` narrow or widen its controller's, which
    // is what §2.10's per-group role lists need — one admin controller is not one role.
    if (allowed === undefined || allowed.length === 0 || !allowed.includes(user.role)) {
      throw new ApiException(FORBIDDEN_STATUS, ErrorCode.Forbidden, FORBIDDEN_MESSAGE);
    }

    return true;
  }
}
