import { describe, expect, it } from "vitest";

import { AREA_ROLES, roleMayEnter } from "./admin-areas";
import { resolveAdminAccess } from "./session";

import type { AdminSession } from "./session";

/**
 * The route-aware entry rules, against SECURITY.md's RBAC matrix.
 *
 * ## What is being pinned
 *
 * `/admin` and `/admin/leads/**` have **separate** role lists. The lead inbox had to admit Content
 * Manager and Sales Expert — the "Forms & Leads" row grants them read — and the shell did not, so
 * widening one to fix the other would have granted two roles a page built for a third. These tests
 * fail if the two lists are ever merged.
 *
 * ## What is NOT being pinned here
 *
 * Which *records* a role sees. That is NestJS's, derived from the authenticated caller, and there
 * is nothing in `apps/web` for a test to assert about it — which is the point. A Sales Expert with
 * no assigned leads is `authorized` here and gets an empty inbox, not a refusal; the inbox spec
 * asserts the wording.
 */

function authenticated(role: string): AdminSession {
  return { state: "authenticated", user: { id: "u1", email: "person@samgp.test", role } };
}

const ROLES = ["admin", "content_manager", "sales_expert", "customer"] as const;

describe("the area role lists follow the RBAC matrix", () => {
  it("keeps /admin Admin-only", () => {
    expect(AREA_ROLES.shell).toEqual(["admin"]);
  });

  it("gives the lead inbox the Forms & Leads row", () => {
    expect([...AREA_ROLES.leads].sort()).toEqual(["admin", "content_manager", "sales_expert"]);
  });

  it("keeps the two lists distinct — one is not the other", () => {
    expect(AREA_ROLES.shell).not.toEqual(AREA_ROLES.leads);
  });

  it("admits no role outside the four the platform defines", () => {
    for (const area of ["shell", "leads"] as const) {
      for (const role of AREA_ROLES[area]) {
        expect(ROLES).toContain(role);
      }
    }
  });
});

describe("roleMayEnter", () => {
  it.each([
    ["admin", "shell", true],
    ["admin", "leads", true],
    ["content_manager", "shell", false],
    ["content_manager", "leads", true],
    ["sales_expert", "shell", false],
    ["sales_expert", "leads", true],
    ["customer", "shell", false],
    ["customer", "leads", false],
  ] as const)("%s may enter %s: %s", (role, area, expected) => {
    expect(roleMayEnter(role, area)).toBe(expected);
  });

  /** An allow-list, so a role this build has never heard of is refused rather than waved through. */
  it("refuses an unknown role everywhere", () => {
    expect(roleMayEnter("superadmin", "shell")).toBe(false);
    expect(roleMayEnter("superadmin", "leads")).toBe(false);
    expect(roleMayEnter("", "leads")).toBe(false);
  });
});

describe("resolveAdminAccess applies the area", () => {
  it("defaults to the shell, so an unqualified call cannot accidentally widen a page", () => {
    expect(resolveAdminAccess(authenticated("content_manager")).state).toBe("forbidden");
    expect(resolveAdminAccess(authenticated("admin")).state).toBe("authorized");
  });

  it.each(["admin", "content_manager", "sales_expert"])(
    "authorizes %s for the leads area",
    (role) => {
      const access = resolveAdminAccess(authenticated(role), "leads");

      expect(access.state).toBe("authorized");
    },
  );

  it("refuses a Customer in both areas", () => {
    expect(resolveAdminAccess(authenticated("customer"), "shell").state).toBe("forbidden");
    expect(resolveAdminAccess(authenticated("customer"), "leads").state).toBe("forbidden");
  });

  it("refuses a Content Manager and a Sales Expert at the shell", () => {
    expect(resolveAdminAccess(authenticated("content_manager"), "shell").state).toBe("forbidden");
    expect(resolveAdminAccess(authenticated("sales_expert"), "shell").state).toBe("forbidden");
  });

  /**
   * An outage is not an authorization answer. It must not be turned into "forbidden" by any area,
   * because that would tell an operator their account lacks access when nothing about their account
   * is known.
   */
  it("reports an unresolved session as unavailable in every area", () => {
    for (const area of ["shell", "leads"] as const) {
      expect(resolveAdminAccess({ state: "unavailable" }, area)).toEqual({ state: "unavailable" });
    }
  });

  it("refuses to answer for a session that has not been resolved", () => {
    expect(() => resolveAdminAccess({ state: "anonymous" }, "leads")).toThrow();
    expect(() => resolveAdminAccess({ state: "expired" }, "leads")).toThrow();
  });

  it("carries the caller's own identity into the answer, never a remembered one", () => {
    const access = resolveAdminAccess(authenticated("sales_expert"), "leads");

    expect(access).toEqual({
      state: "authorized",
      user: { id: "u1", email: "person@samgp.test", role: "sales_expert" },
    });
  });
});
