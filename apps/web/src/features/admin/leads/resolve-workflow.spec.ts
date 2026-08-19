import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readAssigneeDirectory } = vi.hoisted(() => ({ readAssigneeDirectory: vi.fn() }));
const { getLeadHistory } = vi.hoisted(() => ({ getLeadHistory: vi.fn() }));

vi.mock("./assignee-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assignee-directory")>()),
  readAssigneeDirectory,
}));
vi.mock("./leads-api", () => ({ getLeadHistory }));

const { resolveWorkflowPanel } = await import("./resolve-workflow");

/**
 * Who may do what on the Workflow panel, and — just as important — what is *not requested* for a
 * role that would be refused.
 *
 * The second half is the one worth testing. Asking `/admin/users` as a Sales Expert, or asking for
 * history as a Content Manager, would be a round trip to be told 403, and the resulting failure
 * would surface as a degraded panel for a rule that is working correctly. None of it is the
 * security boundary — NestJS authorizes every call independently — but a page that asks only for
 * what it may have is a page whose error states mean something.
 */

const ADMIN = { id: "a1", email: "admin@samgp.test", role: "admin" };
const SALES = { id: "s1", email: "ada@samgp.test", role: "sales_expert" };
const CONTENT_MANAGER = { id: "c1", email: "editor@samgp.test", role: "content_manager" };

const DIRECTORY = {
  options: [{ id: "s1", email: "ada@samgp.test" }],
  byId: new Map([
    ["s1", { id: "s1", email: "ada@samgp.test", role: "sales_expert", status: "active" }],
    ["s2", { id: "s2", email: "gone@samgp.test", role: "sales_expert", status: "disabled" }],
  ]),
};

function resolve(
  user: { id: string; email: string; role: string },
  overrides: { status?: string; assigneeId?: string | null } = {},
): ReturnType<typeof resolveWorkflowPanel> {
  return resolveWorkflowPanel({
    section: "inquiries",
    id: "11111111-1111-4111-8111-111111111111",
    user,
    status: overrides.status ?? "new",
    assigneeId: overrides.assigneeId ?? null,
  });
}

beforeEach(() => {
  readAssigneeDirectory.mockResolvedValue(DIRECTORY);
  getLeadHistory.mockResolvedValue({ state: "ok", value: [] });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("capabilities per role", () => {
  it("gives an Admin assignment, status and history", async () => {
    const panel = await resolve(ADMIN);

    expect(panel).toMatchObject({ canAssign: true, canChangeStatus: true });
    expect(panel.history).toEqual([]);
    expect(panel.assigneeOptions).toEqual(DIRECTORY.options);
  });

  it("gives a Sales Expert status and history, but not assignment", async () => {
    const panel = await resolve(SALES);

    expect(panel).toMatchObject({ canAssign: false, canChangeStatus: true });
    expect(panel.history).toEqual([]);
  });

  it("gives a Content Manager neither control nor history", async () => {
    const panel = await resolve(CONTENT_MANAGER);

    expect(panel).toMatchObject({ canAssign: false, canChangeStatus: false });
    // `null` is "not permitted", which renders no History block at all.
    expect(panel.history).toBeNull();
  });

  it("treats an unknown role as no capability at all", async () => {
    const panel = await resolve({ id: "x", email: "x@samgp.test", role: "superadmin" });

    expect(panel).toMatchObject({ canAssign: false, canChangeStatus: false, history: null });
  });
});

describe("what is not requested", () => {
  it("does not read the staff list for a role that may not assign", async () => {
    await resolve(SALES);
    await resolve(CONTENT_MANAGER);

    expect(readAssigneeDirectory).not.toHaveBeenCalled();
  });

  it("does not ask for history a Content Manager may not have", async () => {
    await resolve(CONTENT_MANAGER);

    expect(getLeadHistory).not.toHaveBeenCalled();
  });

  it("asks for both when the caller is an Admin", async () => {
    await resolve(ADMIN);

    expect(readAssigneeDirectory).toHaveBeenCalledTimes(1);
    expect(getLeadHistory).toHaveBeenCalledWith(
      "inquiries",
      "11111111-1111-4111-8111-111111111111",
    );
  });
});

describe("naming the owner", () => {
  it("resolves the id through the directory for an Admin", async () => {
    expect((await resolve(ADMIN, { assigneeId: "s1" })).assigneeLabel).toBe("ada@samgp.test");
  });

  /**
   * A Sales Expert cannot read `/admin/users`, and every lead they can see is assigned to them —
   * so their own session email is the correct and only possible answer.
   */
  it("uses the session email for a Sales Expert's own lead", async () => {
    expect((await resolve(SALES, { assigneeId: "s1" })).assigneeLabel).toBe("ada@samgp.test");
  });

  it("falls back to null for an id the directory does not know", async () => {
    expect((await resolve(ADMIN, { assigneeId: "deleted" })).assigneeLabel).toBeNull();
  });

  it("reports null when the lead is unassigned", async () => {
    expect((await resolve(ADMIN)).assigneeLabel).toBeNull();
    expect((await resolve(ADMIN)).assigneeIsInactive).toBe(false);
  });

  it("marks an assignee whose account is disabled", async () => {
    expect((await resolve(ADMIN, { assigneeId: "s2" })).assigneeIsInactive).toBe(true);
  });
});

describe("degradation", () => {
  /**
   * The lead loaded; an operator must still be able to read it and change its status when the
   * audit trail is momentarily unreachable. An empty list is not "not permitted" — that is `null`.
   */
  it("flattens an unavailable history to an empty list rather than hiding the block", async () => {
    getLeadHistory.mockResolvedValue({ state: "unavailable" });

    expect((await resolve(ADMIN)).history).toEqual([]);
  });

  it("keeps the panel usable when the staff list cannot be read", async () => {
    readAssigneeDirectory.mockResolvedValue({ options: [], byId: new Map() });

    const panel = await resolve(ADMIN, { assigneeId: "s1" });

    expect(panel.canAssign).toBe(true);
    expect(panel.assigneeOptions).toEqual([]);
    expect(panel.assigneeLabel).toBeNull();
  });
});
