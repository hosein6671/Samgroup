import { LeadWorkflowService } from "./lead-workflow.service";
import { UserRole } from "../../../prisma/generated/client";

import type { AssignableStaffDirectory } from "../../identity/assignable-staff.directory";
import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { ApiException } from "../../../common/http/api.exception";
import type { LeadKind } from "./lead-kind";

/**
 * The workflow service, for **both lead kinds**, against a faked Prisma.
 *
 * ## What the fake is, and what it is not
 *
 * It records the `where`/`data` of every call and returns what the test told it to. That is enough
 * to assert the three properties that matter and are invisible in review:
 *
 * 1. **The compare-and-set predicate is actually in the `WHERE`.** A test that only checked the
 *    response would pass against an unconditional update that silently loses writes.
 * 2. **History is written exactly once, and only on success.** Asserted by counting creates on
 *    every rejection path, not by reading the happy path.
 * 3. **Scope reaches both the read and the write.** A Sales Expert's constraint missing from the
 *    update would be a privilege escalation no response shape would reveal.
 *
 * It cannot prove the transaction is real, that the CHECK constraint holds, or that two concurrent
 * requests produce one winner. Those are database facts and are proven against PostgreSQL by
 * `scripts/verify-lead-workflow-constraints.sh` and by this gate's runtime verification.
 */

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const ADA = "22222222-2222-4222-8222-222222222222";
const GRACE = "33333333-3333-4333-8333-333333333333";

const ADMIN: AuthenticatedUser = {
  id: "aaaa1111-0000-4000-8000-000000000001",
  email: "admin@samgp.test",
  role: UserRole.ADMIN,
};

const SALES: AuthenticatedUser = { id: ADA, email: "ada@samgp.test", role: UserRole.SALES_EXPERT };

const KINDS: LeadKind[] = ["Inquiry", "CustomFormulationRequest"];

/** The Prisma delegate name each kind mutates — the fake keys its recording by this. */
const DELEGATE: Record<LeadKind, "inquiry" | "customFormulationRequest"> = {
  Inquiry: "inquiry",
  CustomFormulationRequest: "customFormulationRequest",
};

type Harness = {
  service: LeadWorkflowService;
  findFirst: jest.Mock;
  updateMany: jest.Mock;
  statusCreate: jest.Mock;
  assignmentCreate: jest.Mock;
  isAssignable: jest.Mock;
  resolveAuditEmails: jest.Mock;
};

function harness(
  kind: LeadKind,
  options: {
    lead?: { id: string; status: string; assignedToId: string | null } | null;
    updated?: number;
    assignable?: boolean;
    emails?: Map<string, string>;
  } = {},
): Harness {
  const {
    lead = { id: LEAD_ID, status: "new", assignedToId: null },
    updated = 1,
    assignable = true,
    emails = new Map([
      [ADA, "ada@samgp.test"],
      [GRACE, "grace@samgp.test"],
    ]),
  } = options;

  const findFirst = jest.fn().mockResolvedValue(lead);
  const updateMany = jest.fn().mockResolvedValue({ count: updated });
  const statusCreate = jest.fn().mockResolvedValue({});
  const assignmentCreate = jest.fn().mockResolvedValue({});

  const delegate = { findFirst, updateMany };
  const other = { findFirst: jest.fn(), updateMany: jest.fn() };

  const client = {
    [DELEGATE[kind]]: delegate,
    [DELEGATE[kind === "Inquiry" ? "CustomFormulationRequest" : "Inquiry"]]: other,
    statusHistory: { create: statusCreate, findMany: jest.fn().mockResolvedValue([]) },
    leadAssignmentHistory: { create: assignmentCreate, findMany: jest.fn().mockResolvedValue([]) },
  };

  const prisma = {
    ...client,
    // The interactive transaction runs its callback against the same fake, so anything the service
    // does inside it is recorded exactly as it would be outside.
    $transaction: (run: (tx: unknown) => unknown) => run(client),
  } as unknown as PrismaService;

  const isAssignable = jest.fn().mockResolvedValue(assignable);
  const resolveAuditEmails = jest.fn().mockResolvedValue(emails);
  const staff = { isAssignable, resolveAuditEmails } as unknown as AssignableStaffDirectory;

  return {
    service: new LeadWorkflowService(prisma, staff),
    findFirst,
    updateMany,
    statusCreate,
    assignmentCreate,
    isAssignable,
    resolveAuditEmails,
  };
}

async function failure(run: () => Promise<unknown>): Promise<ApiException> {
  try {
    await run();
  } catch (error) {
    return error as ApiException;
  }

  throw new Error("expected a failure");
}

describe.each(KINDS)("%s — status transitions", (kind) => {
  it.each([
    ["new", "in_progress"],
    ["new", "closed"],
    ["in_progress", "closed"],
    ["closed", "in_progress"],
  ] as const)("allows %s -> %s", async (from, to) => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: from, assignedToId: null } });

    await expect(h.service.changeStatus(kind, LEAD_ID, { from, to }, ADMIN)).resolves.toEqual({
      status: to,
      assigneeId: null,
    });

    expect(h.statusCreate).toHaveBeenCalledTimes(1);
  });

  /**
   * Every edge the graph does not contain. `closed -> new` and `in_progress -> new` are the two
   * that matter: `new` means nobody has looked at the lead, and once somebody has, moving back to
   * it would make the record assert something false.
   */
  it.each([
    ["in_progress", "new"],
    ["closed", "new"],
  ] as const)("refuses %s -> %s with 400 and writes no history", async (from, to) => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: from, assignedToId: null } });

    const error = await failure(() => h.service.changeStatus(kind, LEAD_ID, { from, to }, ADMIN));

    expect(error.getStatus()).toBe(400);
    expect(h.statusCreate).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it.each(["new", "in_progress", "closed"] as const)(
    "refuses the no-op %s -> %s",
    async (status) => {
      const h = harness(kind, { lead: { id: LEAD_ID, status, assignedToId: null } });

      const error = await failure(() =>
        h.service.changeStatus(kind, LEAD_ID, { from: status, to: status }, ADMIN),
      );

      expect(error.getStatus()).toBe(400);
      expect(h.statusCreate).not.toHaveBeenCalled();
    },
  );

  it("puts the caller's `from` in the WHERE — the compare-and-set predicate", async () => {
    const h = harness(kind);

    await h.service.changeStatus(kind, LEAD_ID, { from: "new", to: "in_progress" }, ADMIN);

    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: LEAD_ID, status: "new" },
      data: { status: "in_progress" },
    });
  });

  it("answers 409 when the row moved, and writes no history", async () => {
    const h = harness(kind, { updated: 0 });

    const error = await failure(() =>
      h.service.changeStatus(kind, LEAD_ID, { from: "new", to: "in_progress" }, ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(h.statusCreate).not.toHaveBeenCalled();
  });

  it("answers 404 for a lead that is not readable, before any write", async () => {
    const h = harness(kind, { lead: null });

    const error = await failure(() =>
      h.service.changeStatus(kind, LEAD_ID, { from: "new", to: "in_progress" }, ADMIN),
    );

    expect(error.getStatus()).toBe(404);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.statusCreate).not.toHaveBeenCalled();
  });

  /**
   * The escalation this catches: a Sales Expert's constraint present on the read but missing from
   * the update would let them transition any lead by id while still seeing only their own.
   */
  it("carries the Sales Expert scope into BOTH the read and the write", async () => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: "new", assignedToId: ADA } });

    await h.service.changeStatus(kind, LEAD_ID, { from: "new", to: "in_progress" }, SALES);

    expect(h.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LEAD_ID, assignedToId: ADA } }),
    );
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: LEAD_ID, status: "new", assignedToId: ADA },
      data: { status: "in_progress" },
    });
  });

  it("applies no scope for an Admin", async () => {
    const h = harness(kind);

    await h.service.changeStatus(kind, LEAD_ID, { from: "new", to: "closed" }, ADMIN);

    expect(h.updateMany.mock.calls[0][0].where).not.toHaveProperty("assignedToId");
  });

  it("writes the actor id and the email snapshot from the authenticated caller", async () => {
    const h = harness(kind);

    await h.service.changeStatus(
      kind,
      LEAD_ID,
      { from: "new", to: "in_progress", note: "Called back" },
      SALES,
    );

    expect(h.statusCreate).toHaveBeenCalledWith({
      data: {
        entityType: kind,
        entityId: LEAD_ID,
        fromStatus: "new",
        toStatus: "in_progress",
        changedById: SALES.id,
        changedByEmailSnapshot: "ada@samgp.test",
        note: "Called back",
      },
    });
  });

  it("records a null note when none was given", async () => {
    const h = harness(kind);

    await h.service.changeStatus(kind, LEAD_ID, { from: "new", to: "closed" }, ADMIN);

    expect(h.statusCreate.mock.calls[0][0].data.note).toBeNull();
  });
});

describe.each(KINDS)("%s — assignment", (kind) => {
  it("assigns an unassigned lead and writes one history row", async () => {
    const h = harness(kind);

    await expect(
      h.service.changeAssignment(kind, LEAD_ID, { fromAssigneeId: null, assigneeId: ADA }, ADMIN),
    ).resolves.toEqual({ status: "new", assigneeId: ADA });

    expect(h.assignmentCreate).toHaveBeenCalledTimes(1);
    expect(h.assignmentCreate.mock.calls[0][0].data).toMatchObject({
      entityType: kind,
      entityId: LEAD_ID,
      fromAssigneeId: null,
      fromAssigneeEmailSnapshot: null,
      toAssigneeId: ADA,
      toAssigneeEmailSnapshot: "ada@samgp.test",
      changedById: ADMIN.id,
      changedByEmailSnapshot: "admin@samgp.test",
    });
  });

  /** A → B must keep both ends: the record has to survive either account being deleted. */
  it("reassigns A -> B and snapshots both ends", async () => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: "new", assignedToId: ADA } });

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: ADA, assigneeId: GRACE },
      ADMIN,
    );

    expect(h.assignmentCreate.mock.calls[0][0].data).toMatchObject({
      fromAssigneeId: ADA,
      fromAssigneeEmailSnapshot: "ada@samgp.test",
      toAssigneeId: GRACE,
      toAssigneeEmailSnapshot: "grace@samgp.test",
    });
  });

  it("clears an assignment, recording the absence rather than a sentinel", async () => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: "new", assignedToId: ADA } });

    await expect(
      h.service.changeAssignment(kind, LEAD_ID, { fromAssigneeId: ADA, assigneeId: null }, ADMIN),
    ).resolves.toEqual({ status: "new", assigneeId: null });

    expect(h.assignmentCreate.mock.calls[0][0].data).toMatchObject({
      toAssigneeId: null,
      toAssigneeEmailSnapshot: null,
    });
    // Clearing asks Identity nothing — there is no eligibility question about nobody.
    expect(h.isAssignable).not.toHaveBeenCalled();
  });

  it("puts the caller's fromAssigneeId in the WHERE, including the null case", async () => {
    const h = harness(kind);

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: null, assigneeId: ADA },
      ADMIN,
    );

    // `assignedToId: null` compiles to IS NULL, which is the predicate two Admins racing for the
    // same unassigned lead need.
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: LEAD_ID, assignedToId: null },
      data: { assignedToId: ADA },
    });
  });

  it("rejects an ineligible assignee with 400 and never touches the lead", async () => {
    const h = harness(kind, { assignable: false });

    const error = await failure(() =>
      h.service.changeAssignment(kind, LEAD_ID, { fromAssigneeId: null, assigneeId: GRACE }, ADMIN),
    );

    expect(error.getStatus()).toBe(400);
    expect(h.isAssignable).toHaveBeenCalledWith(GRACE);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.assignmentCreate).not.toHaveBeenCalled();
  });

  it("refuses a no-op assignment", async () => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: "new", assignedToId: ADA } });

    const error = await failure(() =>
      h.service.changeAssignment(kind, LEAD_ID, { fromAssigneeId: ADA, assigneeId: ADA }, ADMIN),
    );

    expect(error.getStatus()).toBe(400);
    expect(h.assignmentCreate).not.toHaveBeenCalled();
  });

  it("answers 409 when the owner changed under the caller", async () => {
    const h = harness(kind, { updated: 0 });

    const error = await failure(() =>
      h.service.changeAssignment(kind, LEAD_ID, { fromAssigneeId: null, assigneeId: ADA }, ADMIN),
    );

    expect(error.getStatus()).toBe(409);
    expect(h.assignmentCreate).not.toHaveBeenCalled();
  });

  it("answers 404 for a lead that does not exist", async () => {
    const h = harness(kind, { lead: null });

    const error = await failure(() =>
      h.service.changeAssignment(kind, LEAD_ID, { fromAssigneeId: null, assigneeId: ADA }, ADMIN),
    );

    expect(error.getStatus()).toBe(404);
    expect(h.assignmentCreate).not.toHaveBeenCalled();
  });

  /**
   * A previous owner who has since been disabled or had their role changed still has to be named
   * in the handover record — which is why the snapshot lookup is not the eligibility check.
   */
  it("snapshots a previous owner who would no longer be eligible", async () => {
    const h = harness(kind, {
      lead: { id: LEAD_ID, status: "new", assignedToId: ADA },
      emails: new Map([
        [ADA, "retired@samgp.test"],
        [GRACE, "grace@samgp.test"],
      ]),
    });

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: ADA, assigneeId: GRACE },
      ADMIN,
    );

    expect(h.resolveAuditEmails).toHaveBeenCalledWith([ADA, GRACE]);
    expect(h.assignmentCreate.mock.calls[0][0].data.fromAssigneeEmailSnapshot).toBe(
      "retired@samgp.test",
    );
  });

  /** A deleted user has no email left to snapshot; `null` is the truthful record, not a crash. */
  it("records null when an id resolves to nobody", async () => {
    const h = harness(kind, { emails: new Map() });

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: null, assigneeId: ADA },
      ADMIN,
    );

    expect(h.assignmentCreate.mock.calls[0][0].data.toAssigneeEmailSnapshot).toBeNull();
  });
});

describe.each(KINDS)("%s — history", (kind) => {
  it("answers 404 before reading history the caller may not see", async () => {
    const h = harness(kind, { lead: null });

    const error = await failure(() => h.service.readHistory(kind, LEAD_ID, SALES));

    expect(error.getStatus()).toBe(404);
  });

  it("merges both trails newest first and publishes snapshots, never user ids", async () => {
    const h = harness(kind);
    // The service holds the same fake the harness built, so its history delegates can be told what
    // to return from here.
    const { prisma } = h.service as unknown as {
      prisma: {
        statusHistory: { findMany: jest.Mock };
        leadAssignmentHistory: { findMany: jest.Mock };
      };
    };

    prisma.statusHistory.findMany.mockResolvedValue([
      {
        changedAt: new Date("2026-08-20T10:00:00Z"),
        changedByEmailSnapshot: "ada@samgp.test",
        fromStatus: "new",
        toStatus: "in_progress",
        note: null,
      },
    ]);
    prisma.leadAssignmentHistory.findMany.mockResolvedValue([
      {
        changedAt: new Date("2026-08-20T09:00:00Z"),
        changedByEmailSnapshot: "admin@samgp.test",
        fromAssigneeEmailSnapshot: null,
        toAssigneeEmailSnapshot: "ada@samgp.test",
        note: null,
      },
    ]);

    const entries = await h.service.readHistory(kind, LEAD_ID, ADMIN);

    expect(entries.map((entry) => entry.kind)).toEqual(["status", "assignment"]);
    expect(entries[0]).toMatchObject({
      at: "2026-08-20T10:00:00.000Z",
      actorEmail: "ada@samgp.test",
    });

    for (const entry of entries) {
      expect(entry).not.toHaveProperty("changedById");
      expect(entry).not.toHaveProperty("toAssigneeId");
      expect(entry).not.toHaveProperty("entityId");
    }
  });
});

/**
 * The three shapes an ownership change can take, and the snapshot each must preserve.
 *
 * `LeadAssignmentHistory` exists for exactly this: a handover has two ends, and both have to stay
 * readable after either account is gone. A test that only covered `NULL → A` would pass against an
 * implementation that dropped the previous owner entirely.
 */
describe.each(KINDS)("%s — the three assignment forms", (kind) => {
  const CASES = [
    {
      name: "NULL -> A",
      lead: null as string | null,
      to: ADA as string | null,
      fromEmail: null as string | null,
      toEmail: "ada@samgp.test" as string | null,
    },
    {
      name: "A -> B",
      lead: ADA,
      to: GRACE,
      fromEmail: "ada@samgp.test",
      toEmail: "grace@samgp.test",
    },
    { name: "B -> NULL", lead: GRACE, to: null, fromEmail: "grace@samgp.test", toEmail: null },
  ];

  it.each(CASES)("$name records both ends", async ({ lead, to, fromEmail, toEmail }) => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: "new", assignedToId: lead } });

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: lead, assigneeId: to },
      ADMIN,
    );

    expect(h.assignmentCreate).toHaveBeenCalledTimes(1);
    expect(h.assignmentCreate.mock.calls[0][0].data).toMatchObject({
      fromAssigneeId: lead,
      fromAssigneeEmailSnapshot: fromEmail,
      toAssigneeId: to,
      toAssigneeEmailSnapshot: toEmail,
      changedByEmailSnapshot: "admin@samgp.test",
    });
  });

  /**
   * The snapshot is written from the **database's** current assignment, not from the client's
   * assertion about it. They agree whenever the compare-and-set succeeded — this proves the code
   * reads the authoritative one rather than relying on that agreement.
   */
  it("takes the from-snapshot from the stored assignment, not from the request body", async () => {
    const h = harness(kind, { lead: { id: LEAD_ID, status: "new", assignedToId: ADA } });

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: ADA, assigneeId: GRACE },
      ADMIN,
    );

    expect(h.resolveAuditEmails).toHaveBeenCalledWith([ADA, GRACE]);
    expect(h.assignmentCreate.mock.calls[0][0].data.fromAssigneeId).toBe(ADA);
  });

  /** The actor's email is the session's — already re-read by the guard, never looked up again. */
  it("takes the actor snapshot from the authenticated caller", async () => {
    const h = harness(kind);

    await h.service.changeAssignment(
      kind,
      LEAD_ID,
      { fromAssigneeId: null, assigneeId: ADA },
      ADMIN,
    );

    // Only the assignee ids are resolved; the actor is not among them.
    expect(h.resolveAuditEmails).toHaveBeenCalledWith([ADA]);
    expect(h.assignmentCreate.mock.calls[0][0].data.changedByEmailSnapshot).toBe(ADMIN.email);
  });
});

/**
 * What the history endpoint puts on the wire for each kind.
 *
 * The assignment branch is the one this exists for: it must carry the two **email snapshots** and
 * must not carry a user id. Publishing `toAssigneeId` would leak an internal identifier for a value
 * the UI renders as a person, and — more importantly — it is the field that goes NULL when the
 * account is deleted, which is precisely when the row still needs to name someone.
 */
describe.each(KINDS)("%s — the history projection", (kind) => {
  function withRows(status: unknown[], assignment: unknown[]): ReturnType<typeof harness> {
    const h = harness(kind);
    const { prisma } = h.service as unknown as {
      prisma: {
        statusHistory: { findMany: jest.Mock };
        leadAssignmentHistory: { findMany: jest.Mock };
      };
    };

    prisma.statusHistory.findMany.mockResolvedValue(status);
    prisma.leadAssignmentHistory.findMany.mockResolvedValue(assignment);

    return h;
  }

  const ASSIGNMENT_ROW = {
    changedAt: new Date("2026-08-20T10:00:00Z"),
    changedByEmailSnapshot: "admin@samgp.test",
    fromAssigneeEmailSnapshot: "ada@samgp.test",
    toAssigneeEmailSnapshot: "grace@samgp.test",
    note: null,
  };

  it("publishes an assignment event with both email snapshots and no ids", async () => {
    const h = withRows([], [ASSIGNMENT_ROW]);

    const [entry] = await h.service.readHistory(kind, LEAD_ID, ADMIN);

    expect(entry).toEqual({
      kind: "assignment",
      at: "2026-08-20T10:00:00.000Z",
      actorEmail: "admin@samgp.test",
      fromAssigneeEmail: "ada@samgp.test",
      toAssigneeEmail: "grace@samgp.test",
      note: null,
    });
  });

  it("never publishes a user id on either branch", async () => {
    const h = withRows(
      [
        {
          changedAt: new Date("2026-08-20T11:00:00Z"),
          changedByEmailSnapshot: "ada@samgp.test",
          fromStatus: "new",
          toStatus: "in_progress",
          note: null,
        },
      ],
      [ASSIGNMENT_ROW],
    );

    for (const entry of await h.service.readHistory(kind, LEAD_ID, ADMIN)) {
      for (const forbidden of [
        "changedById",
        "fromAssigneeId",
        "toAssigneeId",
        "entityId",
        "entityType",
        "id",
      ]) {
        expect(entry).not.toHaveProperty(forbidden);
      }
    }
  });

  /**
   * The state after a physical `User` deletion: every FK is NULL and every snapshot survives. The
   * database proof is `scripts/verify-lead-workflow-constraints.sh`; this proves the projection
   * still carries the names once that has happened.
   */
  it("still names both ends when the referenced accounts have been deleted", async () => {
    const h = withRows(
      [],
      [
        {
          ...ASSIGNMENT_ROW,
          // The FK columns are gone; the snapshots are not. The service never reads the ids.
          fromAssigneeId: null,
          toAssigneeId: null,
          changedById: null,
        },
      ],
    );

    const [entry] = await h.service.readHistory(kind, LEAD_ID, ADMIN);

    expect(entry).toMatchObject({
      actorEmail: "admin@samgp.test",
      fromAssigneeEmail: "ada@samgp.test",
      toAssigneeEmail: "grace@samgp.test",
    });
  });

  it("reports a first assignment and a cleared one as nulls, not as sentinels", async () => {
    const h = withRows(
      [],
      [
        { ...ASSIGNMENT_ROW, fromAssigneeEmailSnapshot: null },
        {
          ...ASSIGNMENT_ROW,
          changedAt: new Date("2026-08-20T09:00:00Z"),
          toAssigneeEmailSnapshot: null,
        },
      ],
    );

    const entries = await h.service.readHistory(kind, LEAD_ID, ADMIN);

    expect(entries[0]).toMatchObject({
      fromAssigneeEmail: null,
      toAssigneeEmail: "grace@samgp.test",
    });
    expect(entries[1]).toMatchObject({
      fromAssigneeEmail: "ada@samgp.test",
      toAssigneeEmail: null,
    });
  });
});
