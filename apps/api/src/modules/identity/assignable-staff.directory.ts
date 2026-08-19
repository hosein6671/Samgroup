import { Injectable } from "@nestjs/common";

import { UserRole, UserStatus } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * The Identity module's **assignment boundary** — the two questions the Forms module must ask
 * about a member of staff in order to route a lead, and nothing else.
 *
 * ## Two methods, and each is deliberately the narrowest thing that works
 *
 * 1. `isAssignable(userId)` → **a boolean.** May this person be given a lead right now?
 * 2. `resolveAuditEmails(userIds)` → **id → email, and only email.** Who were these people, as text,
 *    at the moment an assignment changed?
 *
 * Neither returns a `User`, a Prisma object, a role, a status, an organization, a password hash, a
 * session or any other profile field. There is no list method, no search, no pagination and no
 * lookup by email — **this is not a user directory, and it must not become one.** The Admin UI's
 * assignee dropdown is built from `GET /admin/users`, which is Admin-only, already shipped, and
 * lives in this module with the rest of the `users` surface.
 *
 * ## Why Forms cannot do either of these itself
 *
 * `User` is Identity's entity (ARCHITECTURE.md §Modules), and the modular-monolith rule is that a
 * module never reaches another module's repository or model. `identity.module.spec.ts` fails the
 * build if any file outside this directory so much as names `UsersService` or `prisma.user.`.
 *
 * ## Why the second method exists at all
 *
 * The gate that specified this contract asked for "boolean only", and the same gate requires that
 * assignment history stay human-readable after a `User` is physically deleted — recording the
 * previous owner, the new owner and the actor as immutable text. Those two requirements cannot both
 * hold with a boolean-only contract: Forms would have no way to learn any email, and the only
 * alternative is querying `users`, which is forbidden.
 *
 * `resolveAuditEmails` is the smallest thing that resolves it, and its scope is stated as a rule
 * rather than left to judgement: **it exists solely to snapshot actor and assignee identity during a
 * workflow mutation.** It is called from exactly one place — `LeadWorkflowService.changeAssignment`
 * — and `assignable-staff.directory.spec.ts` asserts both the email-only shape and that single call
 * site, so a future consumer reaching for it as a convenience lookup fails a test rather than
 * quietly widening the boundary.
 */
@Injectable()
export class AssignableStaffDirectory {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Whether `userId` may be given ownership of a lead **right now**.
   *
   * Three conditions, all in the query rather than in a branch afterwards — which is what keeps a
   * staff record out of this service entirely, since Prisma returns every scalar when no `select`
   * is given:
   *
   * 1. **The row exists.** The foreign key would catch a missing user, but as a constraint
   *    violation the caller would then have to translate back into a field-level message.
   * 2. **`status = active`.** A disabled account cannot authenticate (ADR-012), so assigning to one
   *    parks the lead where nobody can reach it. **Existing** assignments to a user who is later
   *    disabled are deliberately left alone — disabling is an auth action and must not silently
   *    redistribute sales ownership — but a *new* one is refused.
   * 3. **`role = sales_expert`.** DATA_MODEL.md §Notes states `assignedToId` "references a `USER`
   *    with the Sales Expert role". Nothing in the database enforces it — measured: PostgreSQL
   *    accepts an assignment to a `customer` — so this is where that intent becomes real. **Admin
   *    is not eligible either:** under the single-role model an Admin who also sells cannot own a
   *    lead, and widening that is a role-model decision.
   *
   * One indexed lookup and one boolean, so the caller cannot learn *which* condition failed.
   */
  async isAssignable(userId: string): Promise<boolean> {
    const match = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE, role: UserRole.SALES_EXPERT },
      select: { id: true },
    });

    return match !== null;
  }

  /**
   * Email addresses for the people an assignment audit row is about — **snapshot capture only**.
   *
   * ## What it may be used for, stated as a rule
   *
   * Writing `from_assignee_email_snapshot` and `to_assignee_email_snapshot` on a
   * `LeadAssignmentHistory` row, during the mutation that creates it. That is the whole permitted
   * scope. It is **not** a directory read, not a display lookup, not a search, and not a way to
   * turn an id into a person anywhere else on the platform.
   *
   * The actor's own email is **not** obtained here: `AuthenticatedUser` already carries it
   * authoritatively, re-read from `sam_platform` by the guard on this very request, so asking again
   * would be a second round trip for a value already in hand.
   *
   * ## It answers for any user, and that is the point
   *
   * The **previous** owner may since have been disabled, or had their role changed;
   * `isAssignable` would say false for them and their name would vanish from the handover record.
   * Eligibility is a question about the future of an assignment; this is a question about the past
   * of one, and conflating them would lose exactly the identity the snapshot exists to preserve.
   *
   * ## Shape
   *
   * `select: { id, email }` — no role, no status, no organization, no hash, no timestamps. Ids that
   * name nobody are simply absent from the map: a deleted user has no email left to snapshot, and
   * the caller records `null` rather than inventing one. Batched because one handover needs two
   * lookups and three round trips inside a transaction to build one audit row is waste.
   */
  async resolveAuditEmails(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const wanted = [...new Set(userIds)];

    if (wanted.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.user.findMany({
      where: { id: { in: wanted } },
      select: { id: true, email: true },
    });

    return new Map(rows.map((row) => [row.id, row.email]));
  }
}
