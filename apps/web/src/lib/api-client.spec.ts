import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost, apiPostNoContent } from "./api-client";

/**
 * The API client, including the two capabilities this gate added.
 *
 * The regression half matters as much as the new half: `lib/api-client.ts` is imported by every
 * public page on the platform, so the existing envelope handling and the four-outcome failure
 * taxonomy are asserted here to prove the Bearer and 204 work changed neither.
 */

const ORIGIN = "http://api.test";

/** One `fetch` stand-in. Returns whatever the test queues, and records how it was called. */
function stubFetch(
  responder: (url: string, init: RequestInit) => Response | Promise<Response>,
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (input: unknown, init: unknown) =>
    responder(String(input), (init ?? {}) as RequestInit),
  );

  vi.stubGlobal("fetch", spy);

  return spy;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Read one header off a recorded call, however the client expressed it. */
function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", ORIGIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("envelope success — unchanged", () => {
  it("returns data and meta from a well-formed 200", async () => {
    stubFetch(() => json({ data: { id: "p1" }, meta: { total: 1 } }));

    const result = await apiGet<{ id: string }>("/products");

    expect(result).toEqual({ ok: true, data: { id: "p1" }, meta: { total: 1 } });
  });

  it("composes the origin, the frozen /api/v1 prefix, the path and the query", async () => {
    const spy = stubFetch(() => json({ data: [], meta: {} }));

    await apiGet("/products", { segment: "marine" });

    expect(spy.mock.calls[0]?.[0]).toBe(`${ORIGIN}/api/v1/products?segment=marine`);
  });

  it("still sends no-store on every request", async () => {
    const spy = stubFetch(() => json({ data: null, meta: {} }));

    await apiGet("/locales");
    await apiPost("/inquiries", { email: "a@b.test" });

    for (const call of spy.mock.calls) {
      expect((call[1] as RequestInit).cache).toBe("no-store");
    }
  });

  it("reports a 2xx without a data key as malformed", async () => {
    stubFetch(() => json({ unexpected: true }));

    expect(await apiGet("/products")).toEqual({ ok: false, reason: "malformed", status: 200 });
  });
});

describe("failure taxonomy — unchanged", () => {
  it("carries status, code, message and details off an http failure", async () => {
    stubFetch(() =>
      json(
        { error: { code: "VALIDATION_ERROR", message: "bad", details: [{ field: "email" }] } },
        400,
      ),
    );

    const result = await apiPost("/inquiries", {});

    expect(result).toEqual({
      ok: false,
      reason: "http",
      status: 400,
      code: "VALIDATION_ERROR",
      message: "bad",
      details: [{ field: "email" }],
    });
  });

  it("reports a transport failure as unreachable, with a code and no URL", async () => {
    stubFetch(() => {
      throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    });

    const result = await apiGet("/products");

    expect(result).toEqual({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });
    expect(JSON.stringify(result)).not.toContain(ORIGIN);
  });

  it("reports an unset origin as unreachable rather than throwing", async () => {
    vi.stubEnv("API_INTERNAL_URL", "");

    expect(await apiGet("/products")).toEqual({
      ok: false,
      reason: "unreachable",
      detail: "API_INTERNAL_URL is unset or invalid",
    });
  });

  it("rethrows Next's control-flow signals instead of swallowing them", async () => {
    stubFetch(() => {
      throw Object.assign(new Error("dynamic"), { digest: "DYNAMIC_SERVER_USAGE" });
    });

    await expect(apiGet("/products")).rejects.toMatchObject({ digest: "DYNAMIC_SERVER_USAGE" });
  });
});

describe("204 No Content", () => {
  it("is a success, not a malformed envelope", async () => {
    stubFetch(() => new Response(null, { status: 204 }));

    expect(await apiPostNoContent("/auth/logout", { refreshToken: "r" })).toEqual({ ok: true });
  });

  it("would have been misreported by the envelope reader — the reason this exists", async () => {
    stubFetch(() => new Response(null, { status: 204 }));

    expect(await apiPost("/auth/logout", { refreshToken: "r" })).toEqual({
      ok: false,
      reason: "malformed",
      status: 204,
    });
  });

  it("keeps the same failure taxonomy as every other call", async () => {
    stubFetch(() => json({ error: { code: "UNAUTHENTICATED", message: "no" } }, 401));

    expect(await apiPostNoContent("/auth/logout", {})).toMatchObject({
      ok: false,
      reason: "http",
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("accepts a 2xx that carries a body anyway, and ignores it", async () => {
    stubFetch(() => json({ anything: true }, 200));

    expect(await apiPostNoContent("/auth/logout", {})).toEqual({ ok: true });
  });
});

describe("authenticated server requests", () => {
  it("sends Authorization: Bearer when a token is supplied", async () => {
    const spy = stubFetch(() => json({ data: { id: "u1" }, meta: {} }));

    await apiGet("/auth/me", undefined, { accessToken: "TOKEN-VALUE" });

    expect(headerOf(spy.mock.calls[0]?.[1] as RequestInit, "authorization")).toBe(
      "Bearer TOKEN-VALUE",
    );
  });

  it("sends no Authorization header when no token is supplied", async () => {
    const spy = stubFetch(() => json({ data: null, meta: {} }));

    await apiGet("/products");
    await apiPost("/inquiries", {});

    for (const call of spy.mock.calls) {
      expect(headerOf(call[1] as RequestInit, "authorization")).toBeNull();
    }
  });

  it("ignores an empty token rather than sending a headerless Bearer", async () => {
    const spy = stubFetch(() => json({ data: null, meta: {} }));

    await apiGet("/auth/me", undefined, { accessToken: "" });

    expect(headerOf(spy.mock.calls[0]?.[1] as RequestInit, "authorization")).toBeNull();
  });

  it("hard-codes the Bearer scheme rather than taking one from a response", async () => {
    const spy = stubFetch(() => json({ data: null, meta: {} }));

    await apiPostNoContent("/auth/logout", { refreshToken: "r" }, { accessToken: "T" });

    expect(headerOf(spy.mock.calls[0]?.[1] as RequestInit, "authorization")).toMatch(/^Bearer /);
  });

  it("keeps an authenticated request uncached", async () => {
    const spy = stubFetch(() => json({ data: null, meta: {} }));

    await apiGet("/auth/me", undefined, { accessToken: "T" });

    expect((spy.mock.calls[0]?.[1] as RequestInit).cache).toBe("no-store");
  });
});
