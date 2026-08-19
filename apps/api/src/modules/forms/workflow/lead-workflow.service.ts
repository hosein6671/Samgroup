import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { AssignableStaffDirectory } from "../../identity/assignable-staff.directory";
import { PrismaService } from "../../../prisma/prisma.service";
import { resolveLeadScope } from "../lead-scope";

import { isAllowedTransition } from "./lead-status";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { LeadScope } from "../lead-scope";
import type { ChangeLeadAssignmentDto } from "./dto/change-lead-assignment.dto";
import type { ChangeLeadStatusDto } from "./dto/change-lead-status.dto";
import type { LeadKind } from "./lead-kind";
import type { LeadStatus } from "./lead-status";
import type { Prisma } from "../../../prisma/generated/client";

const NOT_FOUND_MESSAGE = "Lead not found.";
const STALE_MESSAGE = "This lead was changed by someone else. Reload and try again.";
const SAME_STATUS_ISSUE = "must differ from the current status";
const BAD_TRANSITION_ISSUE = "is not an allowed transition from the current status";
const SAME_ASSIGNEE_ISSUE = "must differ from the current assignee";
const INELIGIBLE_ASSIGNEE_ISSUE = "must be an active Sales Expert";

/** The lead columns every workflow operation reads. Identical on both lead tables. */
type LeadWorkflowState = {
  readonly id: string;
  readonly status: string;
  readonly assignedToId: string | null;
};

/** What a successful mutation answers with — the authoritative post-state, and nothing else. */
export type LeadWorkflowStateResponse = {
  status: string;
  assigneeId: string | null;
};

/** One entry of a lead's combined history, newest first. */
export type LeadHistoryEntryResponse =
  | {
      kind: "status";
      at: string;
      actorEmail: string | null;
      fromStatus: string | null;
      toStatus: string;
      note: string | null;
    }
  | {
      kind: "assignment";
      at: string;
      actorEmail: string | null;
      fromAssigneeEmail: string | null;
      toAssigneeEmail: string | null;
      note: string | null;
    };

/**
 * Everything that changes a lead's workflow state, for both lead kinds.
 *
 * ## Why one service across two tables
 *
 * `Inquiry` and `CustomFormulationRequest` have identical workflow columns — `status text NOT NULL`
 * and `assigned_to_id uuid NULL` — and there is no business reason for their workflows to diverge.
 * Two copies of this logic would be two places for the transition graph, the compare-and-set and
 * the history write to drift apart, and the audit trail is exactly the thing that must not drift.
 * The kind is a parameter; everything else is shared.
 *
 * ## Every mutation is one transaction, and history is inside it
 *
 * `API_CONTRACT_FINAL.md` §2.10 requires that every mutation writes a history row. That is only
 * true if the row cannot be lost, so the update and the insert share one interactive transaction:
 * **no mutation without history, and no history without mutation.** A rejected request — 400, 403,
 * 404, 409 or a no-op — writes nothing at all.
 *
 * ## Compare-and-set, not locking
 *
 * Each mutation's `WHERE` carries the caller's belief about the current value, so a concurrent edit
 * loses the race rather than being overwritten by it. `updateMany` is used instead of `update`
 * precisely because it reports a **count**: one means this caller won, zero means the row moved
 * under them. There is no version column, no `updatedAt`, no row lock and no application mutex —
 * the predicate the caller already holds does the whole job.
 *
 * Distinguishing zero-because-stale from zero-because-invisible is done by re-reading **within the
 * caller's scope**, which is why a Sales Expert can never learn that a lead they cannot see exists:
 * both answers are 404 for them.
 */
@Injectable()
export class LeadWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignableStaff: AssignableStaffDirectory,
  ) {}

  /**
   * `PATCH /admin/{leads}/:id/status`.
   *
   * Order of checks, and it is deliberate:
   *
   * 1. **Read within scope** → absent means **404**, for a nonexistent lead and for one outside a
   *    Sales Expert's assignment alike. A 403 here would confirm the record exists.
   * 2. **`from === to`** → **400**. A no-op is not a change and must not write an audit row saying
   *    nothing happened.
   * 3. **Graph check on the caller's own `from → to`** → **400**. The request is malformed on its
   *    own terms, independently of what the server currently holds, so it is answered before any
   *    staleness question — which keeps the response deterministic when a request is both.
   * 4. **Compare-and-set** → zero rows means the status moved after step 1, so **409**.
   */
  async changeStatus(
    kind: LeadKind,
    id: string,
    dto: ChangeLeadStatusDto,
    actor: AuthenticatedUser,
  ): Promise<LeadWorkflowStateResponse> {
    const scope = resolveLeadScope(actor);

    return this.prisma.$transaction(async (tx) => {
      const lead = await this.readLead(tx, kind, id, scope);

      if (dto.from === dto.to) {
        throw validationError(SAME_STATUS_ISSUE, "to");
      }

      if (!isAllowedTransition(dto.from, dto.to)) {
        throw validationError(BAD_TRANSITION_ISSUE, "to");
      }

      const changed = await updateLeadStatus(tx, kind, id, scope, dto.from, dto.to);

      if (changed === 0) {
        // The lead was readable a moment ago, so this is staleness rather than absence.
        throw new ApiException(HttpStatus.CONFLICT, ErrorCode.Conflict, STALE_MESSAGE);
      }

      await tx.statusHistory.create({
        data: {
          entityType: kind,
          entityId: id,
          fromStatus: dto.from,
          toStatus: dto.to,
          changedById: actor.id,
          // The actor's own email, off the authenticated request — never client-supplied, and
          // captured now so the row still names them after the account is deleted.
          changedByEmailSnapshot: actor.email,
          note: dto.note ?? null,
        },
      });

      return { status: dto.to, assigneeId: lead.assignedToId };
    });
  }

  /**
   * `PATCH /admin/{leads}/:id/assignment` — Admin only, enforced by the controller's `@Roles`.
   *
   * The scope is unconstrained in practice because only Admin reaches here, but it is still
   * derived rather than assumed: if the role list ever widened, the read would narrow with it
   * instead of silently exposing every lead.
   *
   * **Eligibility is asked of Identity, never of `users`.** `AssignableStaffDirectory.isAssignable`
   * answers exists-AND-active-AND-Sales-Expert as one boolean; Forms has no access to the table
   * and no way to distinguish which condition failed, which is also why the caller gets one
   * message rather than a probe into the staff list.
   */
  async changeAssignment(
    kind: LeadKind,
    id: string,
    dto: ChangeLeadAssignmentDto,
    actor: AuthenticatedUser,
  ): Promise<LeadWorkflowStateResponse> {
    const scope = resolveLeadScope(actor);

    if (dto.assigneeId !== null && !(await this.assignableStaff.isAssignable(dto.assigneeId))) {
      throw validationError(INELIGIBLE_ASSIGNEE_ISSUE, "assigneeId");
    }

    return this.prisma.$transaction(async (tx) => {
      const lead = await this.readLead(tx, kind, id, scope);

      if (dto.assigneeId === lead.assignedToId) {
        throw validationError(SAME_ASSIGNEE_ISSUE, "assigneeId");
      }

      const changed = await updateLeadAssignment(
        tx,
        kind,
        id,
        scope,
        dto.fromAssigneeId,
        dto.assigneeId,
      );

      if (changed === 0) {
        throw new ApiException(HttpStatus.CONFLICT, ErrorCode.Conflict, STALE_MESSAGE);
      }

      /*
       * ── The snapshot identities, and where each one is authoritative ───────
       *
       * The **from** id is `lead.assignedToId` — what the database actually held, read inside this
       * transaction — not `dto.fromAssigneeId`, which is only the client's assertion about it. The
       * compare-and-set above means the two agree whenever this line is reached, so the values are
       * identical in practice; taking the database's is what makes that a property of the code
       * rather than a consequence of a check somebody could later move.
       *
       * The **to** id is `dto.assigneeId`, already validated against `isAssignable`. The **actor**
       * is not looked up at all: `AuthenticatedUser.email` was re-read from `sam_platform` by the
       * guard on this request, so it is authoritative and in hand.
       *
       * **No client-supplied email reaches any of the three columns** — the DTO declares no email
       * field, and every value written below comes from the database or from the authenticated
       * session.
       */
      const emails = await this.assignableStaff.resolveAuditEmails(
        [lead.assignedToId, dto.assigneeId].filter((value): value is string => value !== null),
      );

      await tx.leadAssignmentHistory.create({
        data: {
          entityType: kind,
          entityId: id,
          fromAssigneeId: lead.assignedToId,
          fromAssigneeEmailSnapshot:
            lead.assignedToId === null ? null : (emails.get(lead.assignedToId) ?? null),
          toAssigneeId: dto.assigneeId,
          toAssigneeEmailSnapshot:
            dto.assigneeId === null ? null : (emails.get(dto.assigneeId) ?? null),
          changedById: actor.id,
          changedByEmailSnapshot: actor.email,
        },
      });

      return { status: lead.status, assigneeId: dto.assigneeId };
    });
  }

  /**
   * `GET /admin/{leads}/:id/history` — both trails, merged, newest first.
   *
   * ## One projection, because the UI renders one list
   *
   * A lead's story is "assigned to Ada, then moved to in_progress, then closed". Serving two
   * separately would make the frontend merge and re-sort them, which is work the server can do
   * once and correctly.
   *
   * ## Identity is served as the snapshot, never as an id
   *
   * The response carries `actorEmail` and the assignee emails, not `changedById` or
   * `toAssigneeId`. Internal user ids are of no use to the UI — it renders a name — and publishing
   * them would put staff identifiers on an admin surface for nothing. The snapshot is also the
   * only field that still answers after a `User` is deleted, which is what it exists for.
   *
   * ## Authorization mirrors the lead itself
   *
   * The lead is re-read within the caller's scope first, so a Sales Expert asking for the history
   * of a lead that is not theirs gets **404** — the same answer as asking for the lead. There is no
   * global history endpoint, and this one cannot be reached without a lead id.
   */
  async readHistory(
    kind: LeadKind,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<LeadHistoryEntryResponse[]> {
    const scope = resolveLeadScope(actor);

    await this.readLead(this.prisma, kind, id, scope);

    const [statuses, assignments] = await Promise.all([
      this.prisma.statusHistory.findMany({
        where: { entityType: kind, entityId: id },
        select: {
          changedAt: true,
          changedByEmailSnapshot: true,
          fromStatus: true,
          toStatus: true,
          note: true,
        },
      }),
      this.prisma.leadAssignmentHistory.findMany({
        where: { entityType: kind, entityId: id },
        select: {
          changedAt: true,
          changedByEmailSnapshot: true,
          fromAssigneeEmailSnapshot: true,
          toAssigneeEmailSnapshot: true,
          note: true,
        },
      }),
    ]);

    const entries: LeadHistoryEntryResponse[] = [
      ...statuses.map((row): LeadHistoryEntryResponse => ({
        kind: "status",
        at: row.changedAt.toISOString(),
        actorEmail: row.changedByEmailSnapshot,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        note: row.note,
      })),
      ...assignments.map((row): LeadHistoryEntryResponse => ({
        kind: "assignment",
        at: row.changedAt.toISOString(),
        actorEmail: row.changedByEmailSnapshot,
        fromAssigneeEmail: row.fromAssigneeEmailSnapshot,
        toAssigneeEmail: row.toAssigneeEmailSnapshot,
        note: row.note,
      })),
    ];

    // Newest first. Sorted here rather than in SQL because the two trails are separate tables and
    // a UNION would buy nothing at these row counts.
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  /**
   * The lead, within the caller's scope, or **404**.
   *
   * Takes the transaction client so the read and the write see one snapshot; the history read
   * passes the plain client because it has no write to be consistent with.
   */
  private async readLead(
    client: Prisma.TransactionClient | PrismaService,
    kind: LeadKind,
    id: string,
    scope: LeadScope,
  ): Promise<LeadWorkflowState> {
    const where = { id, ...(scope ?? {}) };
    const select = { id: true, status: true, assignedToId: true } as const;

    const lead =
      kind === "Inquiry"
        ? await client.inquiry.findFirst({ where, select })
        : await client.customFormulationRequest.findFirst({ where, select });

    if (lead === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    return lead;
  }
}

function validationError(issue: string, field: string): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.ValidationError,
    "The request could not be applied.",
    [{ field, issue }],
  );
}

/**
 * The status compare-and-set. `status: from` in the `WHERE` is the whole concurrency mechanism:
 * the row is updated only while it still holds what the caller saw.
 */
async function updateLeadStatus(
  client: Prisma.TransactionClient,
  kind: LeadKind,
  id: string,
  scope: LeadScope,
  from: LeadStatus,
  to: LeadStatus,
): Promise<number> {
  const where = { id, status: from, ...(scope ?? {}) };
  const data = { status: to };

  const result =
    kind === "Inquiry"
      ? await client.inquiry.updateMany({ where, data })
      : await client.customFormulationRequest.updateMany({ where, data });

  return result.count;
}

/**
 * The assignment compare-and-set.
 *
 * `assignedToId: null` in a Prisma `where` compiles to `IS NULL`, and a non-null value to `=`,
 * which together are exactly the `IS NOT DISTINCT FROM` semantics this needs — including the case
 * that matters most, two Admins both claiming an unassigned lead.
 */
async function updateLeadAssignment(
  client: Prisma.TransactionClient,
  kind: LeadKind,
  id: string,
  scope: LeadScope,
  fromAssigneeId: string | null,
  toAssigneeId: string | null,
): Promise<number> {
  const where = { id, assignedToId: fromAssigneeId, ...(scope ?? {}) };
  const data = { assignedToId: toAssigneeId };

  const result =
    kind === "Inquiry"
      ? await client.inquiry.updateMany({ where, data })
      : await client.customFormulationRequest.updateMany({ where, data });

  return result.count;
}
