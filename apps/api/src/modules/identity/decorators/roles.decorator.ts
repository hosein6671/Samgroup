import { SetMetadata } from "@nestjs/common";

import type { UserRole } from "../../../prisma/generated/client";

export const ROLES_METADATA_KEY = "sam-group:roles";

/**
 * The roles permitted to reach a handler — SECURITY.md's RBAC matrix, expressed declaratively.
 *
 * ── Roles only. There is no permission model to express ─────────────────────
 *
 * SECURITY.md defines authorization as a role × resource matrix and nothing finer: there is no
 * `Permission` entity in `schema.prisma`, none in DATA_MODEL.md, and no document names a permission
 * string. So this decorator takes roles, and a dynamic permission database is not built — the
 * project's rule against speculative infrastructure applies exactly here. If per-permission
 * granularity is ever needed, it is a data-model decision first.
 *
 * ── Deny by default ─────────────────────────────────────────────────────────
 *
 * `RolesGuard` denies a handler that carries no `@Roles()` at all rather than allowing it, which
 * is SECURITY.md §Admin Dashboard Access's rule that routes "opt into higher role requirements,
 * never opt out of the base requirement" made mechanical: forgetting the decorator produces a
 * closed door, not an open one.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
