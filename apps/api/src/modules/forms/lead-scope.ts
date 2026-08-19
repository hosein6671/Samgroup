import { UserRole } from "../../prisma/generated/client";

import type { AuthenticatedUser } from "../identity/authenticated-user";

/**
 * Which lead rows an authenticated caller may see — SECURITY.md's RBAC matrix, "Forms & Leads"
 * column, applied to a `where` clause.
 *
 * ## The matrix, unmodified
 *
 * | Role            | Forms & Leads      | What this returns                     |
 * | --------------- | ------------------ | ------------------------------------- |
 * | Admin           | full               | `null` — no constraint                |
 * | Content Manager | read               | `null` — no constraint                |
 * | Sales Expert    | full (own leads)   | `{ assignedToId: <their own id> }`    |
 * | Customer        | create (own)       | unreachable — the role is not in `@Roles()` |
 *
 * `Customer` never reaches this function: the controllers list three roles and `RolesGuard`
 * answers 403 before a handler runs. It is in the table because a reader checking this against
 * SECURITY.md should be able to see all four rows accounted for.
 *
 * ## Why the constraint is derived, never accepted
 *
 * SECURITY.md §RBAC integration, rule 2: "Scoping is applied by the server, never requested by the
 * client. A Sales Expert listing leads receives only their assigned records because NestJS
 * constrains the query — not because the client sent a filter. A client-supplied `assignedToId`
 * filter is an access-control decision made by the least trustworthy participant."
 *
 * The only input here is `AuthenticatedUser`, which `JwtAuthGuard` re-read out of `sam_platform`
 * on this request. No query parameter, header or body reaches this function, and neither list DTO
 * declares an `assignedToId` — sending one is answered 400 by `forbidNonWhitelisted`. So the
 * constraint is structurally underivable from anything the caller controls.
 *
 * ## A Sales Expert sees nothing today, and that is the correct answer
 *
 * No assignment endpoint exists — `/admin/inquiries` is contracted for "list, read, **assign,
 * status**" and this gate implements the first two only — so `assigned_to_id` is NULL on every
 * row and a Sales Expert's list is empty. That is not a bug to work around: they have been
 * assigned no leads, and an empty queue is the truthful rendering of that. The alternative,
 * showing them every lead until assignment is built, would be widening the matrix by accident and
 * would have to be taken back later.
 *
 * ## Deliberately not a `where` fragment for `assignedToId: null`
 *
 * Returning `{ assignedToId: null }` for anyone would mean "unassigned leads", which is a queue
 * concept this platform has not defined. The two states here are "constrained to me" and
 * "unconstrained", nothing else.
 */
export type LeadScope = { readonly assignedToId: string } | null;

export function resolveLeadScope(user: AuthenticatedUser): LeadScope {
  return user.role === UserRole.SALES_EXPERT ? { assignedToId: user.id } : null;
}
