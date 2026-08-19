import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_COOKIE } from "./cookie-contract";
import { SESSION_SIGNAL_HEADER, SESSION_SIGNAL_UNAVAILABLE } from "./session-signal";
import { getAdminAccessToken, readAdminSession, resolveAdminAccess } from "./session";

/**
 * The server-only session boundary: what the four states mean, and where the role comes from.
 *
 * The two assertions to read first are that a backend **401** produces `expired` (the only state
 * that condemns the cookies) and that a backend **outage** produces `unavailable` (which touches
 * nothing). Everything else on the Admin surface branches off that pair.
 */

const { me } = vi.hoisted(() => ({ me: vi.fn() }));
const { cookieJar, headerBag } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  headerBag: new Map<string, string>(),
}));

vi.mock("./auth-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth-api")>()),
  me,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
  headers: async () => new Headers([...headerBag]),
}));

const ADMIN = { id: "u1", email: "admin@samgp.com", role: "admin" };

beforeEach(() => {
  cookieJar.clear();
  headerBag.clear();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("getAdminAccessToken", () => {
  it("returns the access cookie value for server-side callers", async () => {
    cookieJar.set(ACCESS_COOKIE, "access-value");

    expect(await getAdminAccessToken()).toBe("access-value");
  });

  it("returns null when there is no access cookie", async () => {
    expect(await getAdminAccessToken()).toBeNull();
  });
});

describe("session resolution", () => {
  it("is anonymous when no access cookie survived middleware", async () => {
    expect(await readAdminSession()).toEqual({ state: "anonymous" });
    expect(me).not.toHaveBeenCalled();
  });

  it("is authenticated when the API confirms the token, and carries the API's own user", async () => {
    cookieJar.set(ACCESS_COOKIE, "access-value");
    me.mockResolvedValue({ outcome: "ok", value: ADMIN });

    expect(await readAdminSession()).toEqual({ state: "authenticated", user: ADMIN });
    expect(me).toHaveBeenCalledWith("access-value");
  });

  it("is expired when the API refuses the token — deleted, disabled or revoked", async () => {
    cookieJar.set(ACCESS_COOKIE, "stale");
    me.mockResolvedValue({ outcome: "rejected" });

    expect(await readAdminSession()).toEqual({ state: "expired" });
  });

  it("is unavailable when the API could not answer, and never expired", async () => {
    cookieJar.set(ACCESS_COOKIE, "access-value");
    me.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    const session = await readAdminSession();

    expect(session).toEqual({ state: "unavailable" });
    expect(session.state).not.toBe("expired");
  });

  it("is unavailable — not anonymous — when middleware flagged an unreachable refresh", async () => {
    headerBag.set(SESSION_SIGNAL_HEADER, SESSION_SIGNAL_UNAVAILABLE);

    // No access cookie: without the signal this is indistinguishable from "never signed in", which
    // is exactly how a backend outage becomes a false login redirect.
    expect(await readAdminSession()).toEqual({ state: "unavailable" });
  });

  it("ignores the signal when a credential is present — it can only ever downgrade", async () => {
    cookieJar.set(ACCESS_COOKIE, "access-value");
    headerBag.set(SESSION_SIGNAL_HEADER, SESSION_SIGNAL_UNAVAILABLE);
    me.mockResolvedValue({ outcome: "ok", value: ADMIN });

    expect(await readAdminSession()).toEqual({ state: "authenticated", user: ADMIN });
  });
});

describe("role", () => {
  it("admits the admin role", () => {
    expect(resolveAdminAccess({ state: "authenticated", user: ADMIN })).toEqual({
      state: "authorized",
      user: ADMIN,
    });
  });

  it("refuses every other role on the platform", () => {
    for (const role of ["content_manager", "sales_expert", "customer"]) {
      const user = { ...ADMIN, role };

      expect(resolveAdminAccess({ state: "authenticated", user })).toEqual({
        state: "forbidden",
        user,
      });
    }
  });

  it("refuses an unrecognised role rather than defaulting it open", () => {
    const user = { ...ADMIN, role: "superadmin" };

    expect(resolveAdminAccess({ state: "authenticated", user }).state).toBe("forbidden");
  });

  it("decides from the server-supplied role, not from anything the browser sent", async () => {
    cookieJar.set(ACCESS_COOKIE, "access-value");
    me.mockResolvedValue({ outcome: "ok", value: { ...ADMIN, role: "sales_expert" } });

    const session = await readAdminSession();

    // The authority is `GET /auth/me`, re-read from sam_platform on this request. No claim is
    // decoded from the token anywhere — it carries sub/iat/exp and no role.
    expect(session.state === "authenticated" && session.user.role).toBe("sales_expert");
    expect(resolveAdminAccess(session).state).toBe("forbidden");
  });

  it("passes an outage through as unavailable rather than as a role refusal", () => {
    expect(resolveAdminAccess({ state: "unavailable" })).toEqual({ state: "unavailable" });
  });
});
