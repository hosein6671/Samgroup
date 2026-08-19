import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { changeLeadStatus, changeLeadAssignment } = vi.hoisted(() => ({
  changeLeadStatus: vi.fn(),
  changeLeadAssignment: vi.fn(),
}));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("./leads-api", () => ({ changeLeadStatus, changeLeadAssignment }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { submitAssignmentChange, submitStatusChange } = await import("./workflow-actions");
const { WORKFLOW_IDLE, WORKFLOW_MESSAGE } = await import("./workflow-state");

/**
 * The two Server Actions: what they send, what they report, and what they refuse to send.
 *
 * The interesting assertions are the negative ones. An action that forwarded whatever arrived in
 * the form would let a hand-crafted POST set an arbitrary status string or an arbitrary assignee
 * sentinel; an action that reported every failure identically would tell an operator to "try
 * again" when the correct advice is to reload. Both are checked here rather than assumed.
 */

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const ADA = "22222222-2222-4222-8222-222222222222";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) data.append(key, value);

  return data;
}

function statusForm(overrides: Record<string, string> = {}): FormData {
  return form({ section: "inquiries", id: LEAD_ID, from: "new", to: "in_progress", ...overrides });
}

function assignmentForm(overrides: Record<string, string> = {}): FormData {
  return form({
    section: "inquiries",
    id: LEAD_ID,
    fromAssigneeId: "unassigned",
    assigneeId: ADA,
    ...overrides,
  });
}

beforeEach(() => {
  changeLeadStatus.mockResolvedValue({
    state: "ok",
    value: { status: "in_progress", assigneeId: null },
  });
  changeLeadAssignment.mockResolvedValue({
    state: "ok",
    value: { status: "new", assigneeId: ADA },
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("the status action", () => {
  it("sends the transition with the compare-and-set predicate", async () => {
    await submitStatusChange(WORKFLOW_IDLE, statusForm());

    expect(changeLeadStatus).toHaveBeenCalledWith("inquiries", LEAD_ID, {
      from: "new",
      to: "in_progress",
    });
  });

  it("reports success and revalidates the detail route", async () => {
    const state = await submitStatusChange(WORKFLOW_IDLE, statusForm());

    expect(state).toEqual({ status: "saved", message: WORKFLOW_MESSAGE.statusSaved });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/leads/inquiries/${LEAD_ID}`);
  });

  /** A hand-crafted POST must not be able to put an arbitrary string into the API's `to`. */
  it.each(["qualified", "won", "", "NEW"])("refuses the unknown status %p locally", async (to) => {
    const state = await submitStatusChange(WORKFLOW_IDLE, statusForm({ to }));

    expect(state.status).toBe("invalid");
    expect(changeLeadStatus).not.toHaveBeenCalled();
  });

  it("refuses an unknown section rather than building a path from it", async () => {
    const state = await submitStatusChange(WORKFLOW_IDLE, statusForm({ section: "../users" }));

    expect(state.status).toBe("invalid");
    expect(changeLeadStatus).not.toHaveBeenCalled();
  });

  it("refuses a form missing its target", async () => {
    const state = await submitStatusChange(WORKFLOW_IDLE, form({ from: "new", to: "closed" }));

    expect(state.status).toBe("invalid");
    expect(changeLeadStatus).not.toHaveBeenCalled();
  });

  /**
   * The transition graph is not re-implemented here. A local copy would be a second rule able to
   * disagree with the server's; the action forwards a well-formed request and reports the refusal.
   */
  it("forwards a graph-invalid transition and reports what the API said", async () => {
    changeLeadStatus.mockResolvedValue({ state: "invalid", issue: "is not an allowed transition" });

    const state = await submitStatusChange(
      WORKFLOW_IDLE,
      statusForm({ from: "closed", to: "new" }),
    );

    expect(changeLeadStatus).toHaveBeenCalled();
    expect(state.status).toBe("invalid");
    expect(state.message).toContain("is not an allowed transition");
  });
});

describe("the assignment action", () => {
  it("sends the owner change with its compare-and-set predicate", async () => {
    await submitAssignmentChange(WORKFLOW_IDLE, assignmentForm());

    expect(changeLeadAssignment).toHaveBeenCalledWith("inquiries", LEAD_ID, {
      fromAssigneeId: null,
      assigneeId: ADA,
    });
  });

  /** The sentinel exists because an HTML option value cannot be null; it stops at this edge. */
  it("translates the unassigned sentinel to null in both directions", async () => {
    await submitAssignmentChange(
      WORKFLOW_IDLE,
      assignmentForm({ fromAssigneeId: ADA, assigneeId: "unassigned" }),
    );

    expect(changeLeadAssignment).toHaveBeenCalledWith("inquiries", LEAD_ID, {
      fromAssigneeId: ADA,
      assigneeId: null,
    });
  });

  it("refuses an empty assignee rather than sending it", async () => {
    const state = await submitAssignmentChange(WORKFLOW_IDLE, assignmentForm({ assigneeId: "" }));

    expect(state.status).toBe("invalid");
    expect(changeLeadAssignment).not.toHaveBeenCalled();
  });

  it("reports success and revalidates", async () => {
    const state = await submitAssignmentChange(WORKFLOW_IDLE, assignmentForm());

    expect(state).toEqual({ status: "saved", message: WORKFLOW_MESSAGE.assignmentSaved });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/leads/inquiries/${LEAD_ID}`);
  });

  it("works for the other lead kind too", async () => {
    await submitAssignmentChange(
      WORKFLOW_IDLE,
      assignmentForm({ section: "custom-formulation-requests" }),
    );

    expect(changeLeadAssignment.mock.calls[0]?.[0]).toBe("custom-formulation-requests");
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/leads/custom-formulation-requests/${LEAD_ID}`,
    );
  });
});

describe("every failure gets its own words", () => {
  it.each([
    ["conflict", WORKFLOW_MESSAGE.conflict],
    ["forbidden", WORKFLOW_MESSAGE.forbidden],
    ["not-found", WORKFLOW_MESSAGE.notFound],
    ["unavailable", WORKFLOW_MESSAGE.unavailable],
  ] as const)("maps %s to its own message", async (state, message) => {
    changeLeadStatus.mockResolvedValue({ state });

    const result = await submitStatusChange(WORKFLOW_IDLE, statusForm());

    expect(result).toEqual({ status: state, message });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  /**
   * A stale write and an outage must never read alike: one means "reload and look", the other
   * means "nothing happened, try later".
   */
  it("keeps conflict and unavailable distinct", async () => {
    expect(WORKFLOW_MESSAGE.conflict).not.toBe(WORKFLOW_MESSAGE.unavailable);
    expect(WORKFLOW_MESSAGE.conflict).toContain("Reload");
  });

  /**
   * A 401 mid-interaction is reported neutrally rather than redirected: a Server Action cannot send
   * the form to the session-end handler without discarding the operator's input, and the next
   * navigation goes through middleware, which resolves the session properly.
   */
  it("reports a dead credential as unavailable rather than claiming success", async () => {
    changeLeadStatus.mockResolvedValue({ state: "unauthenticated" });

    const result = await submitStatusChange(WORKFLOW_IDLE, statusForm());

    expect(result.status).toBe("unavailable");
    expect(result.message).toBe(WORKFLOW_MESSAGE.unavailable);
  });

  it("never revalidates on a failure — the page must not re-render as if it worked", async () => {
    for (const state of ["conflict", "forbidden", "not-found", "unavailable"] as const) {
      changeLeadAssignment.mockResolvedValue({ state });
      await submitAssignmentChange(WORKFLOW_IDLE, assignmentForm());
    }

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
