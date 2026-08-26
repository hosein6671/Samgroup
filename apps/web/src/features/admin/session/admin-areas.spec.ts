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

  /**
   * The technical-review queue mirrors `@Roles(UserRole.ADMIN)` on all three NestJS review
   * controllers. Nothing on it is meant for another role: approving a Specification publishes it to
   * the public site.
   */
  it("keeps the technical-review queue Admin-only", () => {
    expect(AREA_ROLES.review).toEqual(["admin"]);
  });

  /**
   * `shell` and `review` hold the same one role today, and that is a coincidence rather than a
   * rule. They are separate entries so that the day the dashboard admits another role, that role
   * does not silently gain the screen where technical data is approved. This asserts they are
   * distinct objects, not equal contents — equality is exactly what is expected right now.
   */
  it("keeps the shell and the review queue as separate entries, not one list shared", () => {
    expect(AREA_ROLES.review).not.toBe(AREA_ROLES.shell);
  });

  it("admits no role outside the four the platform defines", () => {
    for (const area of ["shell", "leads", "review"] as const) {
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
    ["admin", "review", true],
    ["content_manager", "shell", false],
    ["content_manager", "leads", true],
    ["content_manager", "review", false],
    ["sales_expert", "shell", false],
    ["sales_expert", "leads", true],
    ["sales_expert", "review", false],
    ["customer", "shell", false],
    ["customer", "leads", false],
    ["customer", "review", false],
  ] as const)("%s may enter %s: %s", (role, area, expected) => {
    expect(roleMayEnter(role, area)).toBe(expected);
  });

  /** An allow-list, so a role this build has never heard of is refused rather than waved through. */
  it("refuses an unknown role everywhere", () => {
    expect(roleMayEnter("superadmin", "shell")).toBe(false);
    expect(roleMayEnter("superadmin", "leads")).toBe(false);
    expect(roleMayEnter("superadmin", "review")).toBe(false);
    expect(roleMayEnter("", "leads")).toBe(false);
    expect(roleMayEnter("", "review")).toBe(false);
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
