import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { login, logout, me, refresh } from "./auth-api";

import type { ApiNoContentResult, ApiResult } from "@/lib/api-client";

/**
 * The auth transport, and the distinction the whole gate turns on.
 *
 * The assertions that matter most here are the negative ones: a 500, a timeout and a refused
 * connection must **not** classify as `rejected`, because `rejected` is what causes a seven-day
 * credential to be deleted. Getting that wrong signs people out whenever the platform hiccups.
 */

const { apiGet, apiPost, apiPostNoContent } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPostNoContent: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ apiGet, apiPost, apiPostNoContent }));

function ok(data: unknown): ApiResult<unknown> {
  return { ok: true, data, meta: {} };
}

function http(status: number): ApiResult<never> & ApiNoContentResult {
  return { ok: false, reason: "http", status, code: null, message: null, details: null };
}

const UNREACHABLE = { ok: false, reason: "unreachable", detail: "ECONNREFUSED" } as const;
const MALFORMED = { ok: false, reason: "malformed", status: 200 } as const;

const TOKENS = { accessToken: "access-value", refreshToken: "refresh-value" };
const USER = { id: "u1", email: "admin@samgp.com", role: "admin" };

beforeEach(() => {
  // The classifier logs statuses and transport codes; silenced so a passing run is readable.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("login", () => {
  it("returns the token pair and the user on success", async () => {
    apiPost.mockResolvedValue(ok({ ...TOKENS, user: USER }));

    expect(await login("admin@samgp.com", "pw")).toEqual({
      outcome: "ok",
      value: { tokens: TOKENS, user: USER },
    });
  });

  it("sends exactly { email, password } and nothing else", async () => {
    apiPost.mockResolvedValue(ok({ ...TOKENS, user: USER }));

    await login("admin@samgp.com", "pw");

    expect(apiPost).toHaveBeenCalledWith("/auth/login", {
      email: "admin@samgp.com",
      password: "pw",
    });
  });

  it("classifies 401 as rejected — the generic invalid-credentials answer", async () => {
    apiPost.mockResolvedValue(http(401));

    expect(await login("a@b.test", "pw")).toEqual({ outcome: "rejected" });
  });

  it("classifies 429 as throttled, not as a wrong password", async () => {
    apiPost.mockResolvedValue(http(429));

    expect(await login("a@b.test", "pw")).toEqual({ outcome: "throttled" });
  });

  it("classifies an outage as unavailable, NEVER as rejected", async () => {
    for (const failure of [UNREACHABLE, MALFORMED, http(500), http(502), http(503)]) {
      apiPost.mockResolvedValue(failure);

      const attempt = await login("a@b.test", "pw");

      expect(attempt.outcome).toBe("unavailable");
      expect(attempt.outcome).not.toBe("rejected");
    }
  });

  it("classifies a 400 as unavailable — a DTO mismatch is our bug, not a wrong password", async () => {
    apiPost.mockResolvedValue(http(400));

    expect((await login("a@b.test", "pw")).outcome).toBe("unavailable");
  });

  it("treats a 200 with an unusable payload as unavailable rather than trusting it", async () => {
    for (const data of [{}, null, { accessToken: "a" }, { ...TOKENS, user: { id: "u1" } }]) {
      apiPost.mockResolvedValue(ok(data));

      expect((await login("a@b.test", "pw")).outcome).toBe("unavailable");
    }
  });

  it("never puts the password into a log line", async () => {
    apiPost.mockResolvedValue(http(500));

    await login("admin@samgp.com", "hunter2");

    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");

    expect(logged).not.toContain("hunter2");
  });
});

describe("refresh", () => {
  it("sends the token as a body value and no Authorization header", async () => {
    apiPost.mockResolvedValue(ok(TOKENS));

    await refresh("presented-token");

    expect(apiPost).toHaveBeenCalledWith("/auth/refresh", { refreshToken: "presented-token" });
    // Two arguments: no options object, therefore no Bearer. §2.2a contracts refresh as needing none.
    expect(apiPost.mock.calls[0]).toHaveLength(2);
  });

  it("returns the replacement pair", async () => {
    apiPost.mockResolvedValue(ok(TOKENS));

    expect(await refresh("old")).toEqual({ outcome: "ok", value: TOKENS });
  });

  it("classifies 401 as rejected — expired, revoked, rotated, deleted or disabled alike", async () => {
    apiPost.mockResolvedValue(http(401));

    expect(await refresh("old")).toEqual({ outcome: "rejected" });
  });

  it("classifies every infrastructure failure as unavailable", async () => {
    for (const failure of [UNREACHABLE, MALFORMED, http(500), http(503)]) {
      apiPost.mockResolvedValue(failure);

      expect((await refresh("old")).outcome).toBe("unavailable");
    }
  });

  it("refuses a 200 that does not carry two usable tokens", async () => {
    apiPost.mockResolvedValue(ok({ accessToken: "a", refreshToken: "" }));

    expect((await refresh("old")).outcome).toBe("unavailable");
  });
});

describe("me", () => {
  it("is the identity authority, and sends the access token as a Bearer credential", async () => {
    apiGet.mockResolvedValue(ok(USER));

    expect(await me("access-value")).toEqual({ outcome: "ok", value: USER });
    expect(apiGet).toHaveBeenCalledWith("/auth/me", undefined, { accessToken: "access-value" });
  });

  it("classifies 401 as rejected — a deleted, disabled or revoked account", async () => {
    apiPost.mockClear();
    apiGet.mockResolvedValue(http(401));

    expect(await me("stale")).toEqual({ outcome: "rejected" });
  });

  it("classifies 403 as rejected too", async () => {
    apiGet.mockResolvedValue(http(403));

    expect(await me("t")).toEqual({ outcome: "rejected" });
  });

  it("classifies an outage as unavailable", async () => {
    apiGet.mockResolvedValue(UNREACHABLE);

    expect((await me("t")).outcome).toBe("unavailable");
  });

  it("refuses an identity missing any of id, email or role", async () => {
    for (const data of [{ id: "u1", email: "a@b.test" }, { role: "admin" }, {}]) {
      apiGet.mockResolvedValue(ok(data));

      expect((await me("t")).outcome).toBe("unavailable");
    }
  });
});

describe("logout", () => {
  it("sends both factors — Bearer for who is asking, body for which session", async () => {
    apiPostNoContent.mockResolvedValue({ ok: true });

    expect(await logout("access-value", "refresh-value")).toEqual({ outcome: "ok", value: null });
    expect(apiPostNoContent).toHaveBeenCalledWith(
      "/auth/logout",
      { refreshToken: "refresh-value" },
      { accessToken: "access-value" },
    );
  });

  it("reports a failure rather than throwing — the caller clears cookies either way", async () => {
    for (const failure of [http(401), http(500), UNREACHABLE]) {
      apiPostNoContent.mockResolvedValue(failure);

      await expect(logout("a", "r")).resolves.toBeDefined();
    }
  });

  it("never logs a token value", async () => {
    apiPostNoContent.mockResolvedValue(http(500));

    await logout("ACCESS-SECRET", "REFRESH-SECRET");

    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");

    expect(logged).not.toContain("ACCESS-SECRET");
    expect(logged).not.toContain("REFRESH-SECRET");
  });
});
