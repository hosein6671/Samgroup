import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/features/admin/session/cookie-contract";
import {
  SESSION_SIGNAL_HEADER,
  SESSION_SIGNAL_UNAVAILABLE,
} from "@/features/admin/session/session-signal";

import { middleware } from "./middleware";

/**
 * The middleware, which now carries two concerns: the Admin session check and locale routing.
 *
 * Two groups of assertions matter here.
 *
 * **The session lifecycle** — that a refused refresh clears cookies and a *failed* refresh does
 * not. Those two branches look adjacent in the code and mean opposite things to a signed-in
 * operator, and only one of them may ever destroy a seven-day credential.
 *
 * **The regression group** — that none of this leaked onto the public site. The session check is a
 * scoped short-circuit, not a global guard: every `[locale]` route, the proof tree and every
 * locale-less structural path must behave exactly as they did before this gate.
 */

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/features/admin/session/auth-api", () => ({ refresh }));
vi.mock("@/lib/api-client", () => ({ apiGet }));

const ORIGIN = "https://samgp.com";

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const headers = new Headers({
    accept: "text/html",
    "user-agent": "vitest",
    "accept-language": "en-GB,en;q=0.9",
  });

  const jar = Object.entries(cookies);

  if (jar.length > 0) {
    headers.set("cookie", jar.map(([name, value]) => `${name}=${value}`).join("; "));
  }

  return new NextRequest(new Request(`${ORIGIN}${path}`, { headers }));
}

/** The request headers middleware forwarded to the render, decoded from the override protocol. */
function forwardedHeader(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

function forwardedNames(response: Response): string[] {
  return (response.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key !== "");
}

const TOKENS = { accessToken: "fresh-access", refreshToken: "rotated-refresh" };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("/login", () => {
  it("is reachable without any session, and triggers no refresh", async () => {
    const response = await middleware(request("/login"));

    expect(response.headers.get("location")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("is not locale-redirected", async () => {
    const response = await middleware(request("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("strips an inbound session signal so only middleware can author one", async () => {
    const req = request("/login");

    req.headers.set(SESSION_SIGNAL_HEADER, SESSION_SIGNAL_UNAVAILABLE);

    const response = await middleware(req);

    expect(forwardedHeader(response, SESSION_SIGNAL_HEADER)).toBeNull();
    expect(forwardedNames(response)).not.toContain(SESSION_SIGNAL_HEADER);
  });
});

describe("/admin with a usable access credential", () => {
  it("continues without refreshing", async () => {
    const response = await middleware(request("/admin", { [ACCESS_COOKIE]: "still-valid" }));

    expect(refresh).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not refresh on every navigation while the access cookie lives", async () => {
    for (const path of ["/admin", "/admin", "/admin/session/end"]) {
      await middleware(request(path, { [ACCESS_COOKIE]: "still-valid" }));
    }

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("/admin with no credential at all", () => {
  it("redirects to /login", async () => {
    const response = await middleware(request("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login`);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sends a nested admin path to /login too", async () => {
    const response = await middleware(request("/admin/leads"));

    expect(response.headers.get("location")).toBe(`${ORIGIN}/login`);
  });
});

describe("/admin refresh — success", () => {
  it("refreshes exactly once, using the cookie's token", async () => {
    refresh.mockResolvedValue({ outcome: "ok", value: TOKENS });

    await middleware(request("/admin", { [REFRESH_COOKIE]: "presented-token" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith("presented-token");
  });

  it("rotates BOTH cookies on the response", async () => {
    refresh.mockResolvedValue({ outcome: "ok", value: TOKENS });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "presented-token" }));

    const access = response.cookies.get(ACCESS_COOKIE);
    const refreshed = response.cookies.get(REFRESH_COOKIE);

    expect(access?.value).toBe("fresh-access");
    expect(refreshed?.value).toBe("rotated-refresh");

    // The rotated refresh token MUST be stored: the presented one is already revoked server-side.
    expect(refreshed?.value).not.toBe("presented-token");
  });

  it("issues both cookies with the frozen attributes", async () => {
    refresh.mockResolvedValue({ outcome: "ok", value: TOKENS });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "presented-token" }));

    for (const [name, maxAge] of [
      [ACCESS_COOKIE, 900],
      [REFRESH_COOKIE, 604_800],
    ] as const) {
      const cookie = response.cookies.get(name);

      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("strict");
      expect(cookie?.path).toBe("/");
      expect(cookie?.secure).toBe(true);
      expect(cookie?.maxAge).toBe(maxAge);
      expect(cookie?.domain).toBeUndefined();
    }
  });

  it("propagates the fresh access token to THIS request's render", async () => {
    refresh.mockResolvedValue({ outcome: "ok", value: TOKENS });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "presented-token" }));

    // Without this the render that triggered the refresh would still see no access cookie and
    // conclude nobody was signed in — the browser copy only helps the next request.
    expect(forwardedHeader(response, "cookie")).toContain(`${ACCESS_COOKIE}=fresh-access`);
  });

  it("replaces rather than duplicates an existing access cookie in the forwarded header", async () => {
    refresh.mockResolvedValue({ outcome: "ok", value: TOKENS });

    const req = request("/admin", { [REFRESH_COOKIE]: "presented-token" });
    const response = await middleware(req);
    const forwarded = forwardedHeader(response, "cookie") ?? "";

    expect(forwarded.match(new RegExp(`${ACCESS_COOKIE}=`, "g"))).toHaveLength(1);
  });

  it("forwards the complete header set, not just the cookie", async () => {
    refresh.mockResolvedValue({ outcome: "ok", value: TOKENS });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "presented-token" }));

    // Next deletes every request header absent from the override list, so a partial clone would
    // strip accept, user-agent and accept-language from the render.
    for (const name of ["accept", "user-agent", "accept-language", "cookie"]) {
      expect(forwardedNames(response)).toContain(name);
    }
  });
});

describe("/admin refresh — rejected by the API", () => {
  it("clears both cookies and redirects to /login", async () => {
    refresh.mockResolvedValue({ outcome: "rejected" });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "revoked" }));

    expect(response.headers.get("location")).toBe(`${ORIGIN}/login`);
    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("clears with the same Path and host-only semantics it issued with", async () => {
    refresh.mockResolvedValue({ outcome: "rejected" });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "revoked" }));

    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      const cookie = response.cookies.get(name);

      // A mismatched Path would write a second, narrower cookie shadowing the one at "/" instead
      // of removing it — a credential left behind by an operation that looked successful.
      expect(cookie?.path).toBe("/");
      expect(cookie?.maxAge).toBe(0);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("strict");
      expect(cookie?.domain).toBeUndefined();
    }
  });
});

describe("/admin refresh — backend unavailable", () => {
  it("does NOT clear the refresh cookie", async () => {
    refresh.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "perfectly-good" }));

    // The single most important assertion in this file: an outage says nothing about a credential,
    // and deleting one on the strength of a transient network error ends a valid seven-day session.
    expect(response.cookies.get(REFRESH_COOKIE)).toBeUndefined();
    expect(response.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does NOT redirect to /login", async () => {
    refresh.mockResolvedValue({ outcome: "unavailable", detail: "TimeoutError" });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "perfectly-good" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("flags the request so the render can tell an outage from being signed out", async () => {
    refresh.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    const response = await middleware(request("/admin", { [REFRESH_COOKIE]: "perfectly-good" }));

    expect(forwardedHeader(response, SESSION_SIGNAL_HEADER)).toBe(SESSION_SIGNAL_UNAVAILABLE);
  });

  it("retries nothing — one refresh attempt per browser request", async () => {
    refresh.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    await middleware(request("/admin", { [REFRESH_COOKIE]: "perfectly-good" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("the credential-clearing handler", () => {
  it("is reachable with a broken session and triggers no refresh", async () => {
    const response = await middleware(request("/admin/session/end", { [REFRESH_COOKIE]: "x" }));

    expect(refresh).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("regression — the public site is untouched", () => {
  it("still negotiates a locale for a locale-less structural path", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: [
        { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
      ],
      meta: {},
    });

    const response = await middleware(request("/products"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/en/products`);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("still redirects the site root", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: [
        { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
      ],
      meta: {},
    });

    expect((await middleware(request("/"))).headers.get("location")).toBe(`${ORIGIN}/en`);
  });

  it("still passes an already-localized path through without an API call", async () => {
    const response = await middleware(request("/en/products/base-oils"));

    expect(response.headers.get("location")).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("still bypasses the proof tree entirely", async () => {
    const response = await middleware(request("/design-proof/products"));

    expect(response.headers.get("location")).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("still passes the request through when the locale source is unreachable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    expect((await middleware(request("/products"))).headers.get("location")).toBeNull();
  });

  it("never auth-protects a public route — no public path can produce a login redirect", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (const path of [
      "/en",
      "/en/products",
      "/en/insights/a-post",
      "/en/contact-us/request-a-quote",
      "/fa/privacy-policy",
      "/design-proof",
    ]) {
      const response = await middleware(request(path));

      expect(response.headers.get("location")).not.toBe(`${ORIGIN}/login`);
    }

    expect(refresh).not.toHaveBeenCalled();
  });
});
