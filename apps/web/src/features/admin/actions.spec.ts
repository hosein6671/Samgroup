import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signIn, signOut } from "./actions";
import { LOGIN_IDLE } from "./login-state";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./session/cookie-contract";

/**
 * The two Admin mutations.
 *
 * The assertions worth naming: a login failure never leaves a token anywhere the browser can read,
 * a login *outage* is never reported as a wrong password, and a logout clears the browser's
 * credentials **whatever** the API does — including when it is unreachable.
 */

const { login, logout } = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn() }));
const { jar } = vi.hoisted(() => ({ jar: new Map<string, { value: string; options: unknown }>() }));

vi.mock("./session/auth-api", () => ({ login, logout }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)?.value } : undefined),
    set: (name: string, value: string, options: unknown) => jar.set(name, { value, options }),
  }),
}));

/** `redirect()` signals by throwing. Reproduced so a destination can be asserted. */
class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`NEXT_REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();

  for (const [name, value] of Object.entries(fields)) data.append(name, value);

  return data;
}

const CREDENTIALS = { email: "admin@samgp.com", password: "correct horse" };
const TOKENS = { accessToken: "ACCESS-SECRET", refreshToken: "REFRESH-SECRET" };
const USER = { id: "u1", email: "admin@samgp.com", role: "admin" };

beforeEach(() => {
  jar.clear();
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("signIn — success", () => {
  beforeEach(() => {
    login.mockResolvedValue({ outcome: "ok", value: { tokens: TOKENS, user: USER } });
  });

  it("sets both cookies and redirects to /admin", async () => {
    await expect(signIn(LOGIN_IDLE, form(CREDENTIALS))).rejects.toThrow(RedirectSignal);

    expect(jar.get(ACCESS_COOKIE)?.value).toBe("ACCESS-SECRET");
    expect(jar.get(REFRESH_COOKIE)?.value).toBe("REFRESH-SECRET");
  });

  it("redirects to the frozen constant, never to anything from the form", async () => {
    const rejection = await signIn(LOGIN_IDLE, form({ ...CREDENTIALS, next: "https://evil.test" }))
      .then(() => null)
      .catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(RedirectSignal);
    expect((rejection as RedirectSignal).to).toBe("/admin");
  });

  it("issues both cookies with the frozen attributes", async () => {
    await signIn(LOGIN_IDLE, form(CREDENTIALS)).catch(() => undefined);

    expect(jar.get(ACCESS_COOKIE)?.options).toEqual({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: true,
      maxAge: 900,
    });
    expect(jar.get(REFRESH_COOKIE)?.options).toEqual({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: true,
      maxAge: 604_800,
    });
  });

  it("trims the submitted fields and sends nothing else", async () => {
    await signIn(LOGIN_IDLE, form({ email: "  admin@samgp.com  ", password: "pw" })).catch(
      () => undefined,
    );

    expect(login).toHaveBeenCalledWith("admin@samgp.com", "pw");
  });
});

describe("signIn — failure", () => {
  it("reports invalid credentials generically", async () => {
    login.mockResolvedValue({ outcome: "rejected" });

    expect(await signIn(LOGIN_IDLE, form(CREDENTIALS))).toEqual({ status: "invalid" });
  });

  it("reports a rate limit as its own state, not as a wrong password", async () => {
    login.mockResolvedValue({ outcome: "throttled" });

    expect(await signIn(LOGIN_IDLE, form(CREDENTIALS))).toEqual({ status: "throttled" });
  });

  it("reports a backend outage as unavailable — NEVER as invalid credentials", async () => {
    login.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    const state = await signIn(LOGIN_IDLE, form(CREDENTIALS));

    expect(state).toEqual({ status: "unavailable" });
    expect(state.status).not.toBe("invalid");
  });

  it("refuses empty input without spending a rate-limit attempt", async () => {
    const empties: Record<string, string>[] = [
      { email: "", password: "pw" },
      { email: "a@b.test", password: "  " },
      {},
    ];

    for (const fields of empties) {
      expect(await signIn(LOGIN_IDLE, form(fields))).toEqual({ status: "invalid" });
    }

    expect(login).not.toHaveBeenCalled();
  });

  it("sets no cookie on any failure", async () => {
    for (const outcome of ["rejected", "throttled", "unavailable"]) {
      login.mockResolvedValue({ outcome, detail: "x" });

      await signIn(LOGIN_IDLE, form(CREDENTIALS));

      expect(jar.size).toBe(0);
    }
  });

  it("returns a state that structurally cannot carry a token", async () => {
    login.mockResolvedValue({ outcome: "rejected" });

    const state = await signIn(LOGIN_IDLE, form(CREDENTIALS));

    // The whole client-visible surface of a login attempt: one status string.
    expect(Object.keys(state)).toEqual(["status"]);
    expect(JSON.stringify(state)).not.toContain("SECRET");
    expect(JSON.stringify(state)).not.toContain(CREDENTIALS.password);
  });
});

describe("signOut", () => {
  beforeEach(() => {
    jar.set(ACCESS_COOKIE, { value: "ACCESS-SECRET", options: null });
    jar.set(REFRESH_COOKIE, { value: "REFRESH-SECRET", options: null });
  });

  it("calls the API with both factors, then clears both cookies and redirects", async () => {
    logout.mockResolvedValue({ outcome: "ok", value: null });

    const rejection = await signOut()
      .then(() => null)
      .catch((error: unknown) => error);

    expect(logout).toHaveBeenCalledWith("ACCESS-SECRET", "REFRESH-SECRET");
    expect(jar.get(ACCESS_COOKIE)?.value).toBe("");
    expect(jar.get(REFRESH_COOKIE)?.value).toBe("");
    expect((rejection as RedirectSignal).to).toBe("/login");
  });

  it("clears with the same attributes the cookies were issued under", async () => {
    logout.mockResolvedValue({ outcome: "ok", value: null });

    await signOut().catch(() => undefined);

    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      expect(jar.get(name)?.options).toEqual({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: true,
        maxAge: 0,
      });
    }
  });

  it("clears the browser cookies even when the API refuses the logout", async () => {
    logout.mockResolvedValue({ outcome: "rejected" });

    await signOut().catch(() => undefined);

    expect(jar.get(ACCESS_COOKIE)?.value).toBe("");
    expect(jar.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("clears the browser cookies even when the API is unreachable", async () => {
    logout.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    await signOut().catch(() => undefined);

    // An explicit sign-out is a statement about this browser. Honouring it must not depend on a
    // network hop succeeding.
    expect(jar.get(ACCESS_COOKIE)?.value).toBe("");
    expect(jar.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("does not retry a failed logout", async () => {
    logout.mockResolvedValue({ outcome: "unavailable", detail: "ECONNREFUSED" });

    await signOut().catch(() => undefined);

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("is safe to repeat — a second sign-out clears again and calls nothing", async () => {
    logout.mockResolvedValue({ outcome: "ok", value: null });
    await signOut().catch(() => undefined);
    logout.mockClear();

    const rejection = await signOut()
      .then(() => null)
      .catch((error: unknown) => error);

    // Both cookies are now empty strings, so neither factor is present and no call is made.
    expect(logout).not.toHaveBeenCalled();
    expect(jar.get(REFRESH_COOKIE)?.value).toBe("");
    expect((rejection as RedirectSignal).to).toBe("/login");
  });

  it("skips the API call entirely when a factor is missing", async () => {
    jar.delete(ACCESS_COOKIE);

    await signOut().catch(() => undefined);

    expect(logout).not.toHaveBeenCalled();
    expect(jar.get(REFRESH_COOKIE)?.value).toBe("");
  });
});
