import { describe, expect, it } from "vitest";

import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE_SECONDS,
  AUTH_COOKIES,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  accessCookieOptions,
  clearedCookieOptions,
  isSecureCookieEnvironment,
  refreshCookieOptions,
} from "./cookie-contract";

/**
 * The frozen cookie contract, asserted attribute by attribute.
 *
 * These are the assertions that keep a credential out of reach of browser JavaScript, off
 * cross-site requests, and on a lifetime someone chose. They are written against the options
 * objects rather than through a framework harness because those objects are what every one of the
 * three issuing surfaces — middleware, Server Action, Route Handler — passes to its own cookie API.
 */

describe("cookie names", () => {
  it("are the two frozen names, and only those two", () => {
    expect(REFRESH_COOKIE).toBe("sam_admin_refresh");
    expect(ACCESS_COOKIE).toBe("sam_admin_access");
    expect(AUTH_COOKIES).toEqual(["sam_admin_access", "sam_admin_refresh"]);
  });
});

describe("refresh cookie", () => {
  it("is HttpOnly, SameSite=Strict and Path=/", () => {
    const options = refreshCookieOptions(true);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
  });

  it("is host-only — no Domain attribute is ever emitted", () => {
    // `in`, not a value comparison: an explicit `domain: undefined` is not the same thing to every
    // cookie serializer, and the decision is that the attribute is absent.
    expect("domain" in refreshCookieOptions(true)).toBe(false);
    expect("domain" in refreshCookieOptions(false)).toBe(false);
  });

  it("lives for seven days", () => {
    expect(REFRESH_MAX_AGE_SECONDS).toBe(604_800);
    expect(refreshCookieOptions(true).maxAge).toBe(604_800);
  });
});

describe("access cookie", () => {
  it("is HttpOnly, SameSite=Strict and Path=/", () => {
    const options = accessCookieOptions(true);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
  });

  it("is host-only — no Domain attribute is ever emitted", () => {
    expect("domain" in accessCookieOptions(true)).toBe(false);
    expect("domain" in accessCookieOptions(false)).toBe(false);
  });

  it("is aligned to the 15-minute access-token TTL", () => {
    expect(ACCESS_MAX_AGE_SECONDS).toBe(900);
    expect(accessCookieOptions(true).maxAge).toBe(900);
  });
});

describe("Secure", () => {
  it("is set in production", () => {
    expect(isSecureCookieEnvironment("production")).toBe(true);
    expect(refreshCookieOptions(isSecureCookieEnvironment("production")).secure).toBe(true);
    expect(accessCookieOptions(isSecureCookieEnvironment("production")).secure).toBe(true);
  });

  it("is dropped only for local development, never for any other environment", () => {
    expect(isSecureCookieEnvironment("development")).toBe(false);

    // `production` is the only value that opts in. Everything else — a typo, a missing variable, an
    // environment name nobody anticipated — falls to the non-Secure branch, which is safe here for
    // one reason worth stating: the platform is HTTPS-only behind nginx (ADR-005) and `NODE_ENV` is
    // `production` for both `next build` and `next start`, so no deployed build reaches this path.
    for (const env of ["test", "staging", "prod", "Production", "", undefined]) {
      expect(isSecureCookieEnvironment(env)).toBe(false);
    }
  });
});

describe("clearing", () => {
  it("differs from issuing in Max-Age alone", () => {
    const cleared = clearedCookieOptions(true);

    expect(cleared.maxAge).toBe(0);

    // Everything a browser keys a cookie on must match, or the clear writes a second cookie that
    // shadows the first instead of removing it.
    for (const issued of [refreshCookieOptions(true), accessCookieOptions(true)]) {
      expect(cleared.path).toBe(issued.path);
      expect(cleared.httpOnly).toBe(issued.httpOnly);
      expect(cleared.sameSite).toBe(issued.sameSite);
      expect(cleared.secure).toBe(issued.secure);
      expect("domain" in cleared).toBe("domain" in issued);
    }
  });

  it("tracks the Secure setting so the tombstone matches in development too", () => {
    expect(clearedCookieOptions(false).secure).toBe(false);
    expect(clearedCookieOptions(true).secure).toBe(true);
  });
});

describe("what the contract forbids", () => {
  it("never produces a JavaScript-readable or cross-site cookie", () => {
    const every = [
      refreshCookieOptions(true),
      refreshCookieOptions(false),
      accessCookieOptions(true),
      accessCookieOptions(false),
      clearedCookieOptions(true),
      clearedCookieOptions(false),
    ];

    for (const options of every) {
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("strict");
      expect(options.sameSite).not.toBe("none");
      expect(options.sameSite).not.toBe("lax");
    }
  });
});
