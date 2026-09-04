import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocaleResponse } from "@sam-group/types";

/**
 * The locale bootstrap memo.
 *
 * This module decides which routes exist at all, so it is the one read on the platform that is
 * allowed to fail a build rather than degrade. What it may **not** do is turn a transient upstream
 * blip into a permanent outage — and it used to, by memoizing the rejected promise for the lifetime
 * of the process. These tests hold both halves of the corrected behaviour: a success is cached
 * forever, a failure is not cached at all, and concurrent callers still share one attempt.
 */

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("./api-client", () => ({ apiGet }));

const LOCALES: LocaleResponse[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "Farsi", direction: "rtl", isDefault: false },
];

/** The envelope `apiGet` hands back on success. */
const OK = { ok: true, data: LOCALES, meta: {} };

/**
 * A fresh module per test.
 *
 * The memo is module scope, which is exactly the thing under test — importing once and sharing it
 * between cases would make each test depend on the order of the ones before it.
 */
async function freshModule(): Promise<typeof import("./locales")> {
  vi.resetModules();

  return import("./locales");
}

beforeEach(() => {
  apiGet.mockReset();
});

describe("a successful read is memoized", () => {
  it("issues one request however many consumers ask", async () => {
    apiGet.mockResolvedValue(OK);

    const { getActiveLocales } = await freshModule();

    await getActiveLocales();
    await getActiveLocales();
    await getActiveLocales();

    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("serves the same list to every caller", async () => {
    apiGet.mockResolvedValue(OK);

    const { getActiveLocales } = await freshModule();

    expect(await getActiveLocales()).toBe(await getActiveLocales());
  });
});

/**
 * The regression this file exists for.
 *
 * Measured before the fix: with `next start` brought up while the API was briefly unavailable, the
 * first render cached a rejected promise and every page answered 500 until the process was
 * restarted by hand — long after the API had recovered.
 */
describe("a failed read is not memoized", () => {
  it("retries on the next call instead of replaying a stale failure", async () => {
    apiGet.mockResolvedValueOnce({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    const { getActiveLocales } = await freshModule();

    await expect(getActiveLocales()).rejects.toThrow(/ECONNREFUSED/u);

    // The API comes back. The very next caller must see the recovery.
    apiGet.mockResolvedValue(OK);

    await expect(getActiveLocales()).resolves.toEqual(LOCALES);
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it("recovers from a contract failure too, not only a transport one", async () => {
    // A 2xx carrying a set that cannot be a routing source — two rows claiming `isDefault`.
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: [{ ...LOCALES[0] }, { ...LOCALES[1], isDefault: true }],
      meta: {},
    });

    const { getActiveLocales } = await freshModule();

    await expect(getActiveLocales()).rejects.toThrow();

    apiGet.mockResolvedValue(OK);

    await expect(getActiveLocales()).resolves.toEqual(LOCALES);
  });

  it("keeps failing while the source is still down, one attempt per call", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    const { getActiveLocales } = await freshModule();

    await expect(getActiveLocales()).rejects.toThrow();
    await expect(getActiveLocales()).rejects.toThrow();

    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  /**
   * The property the original design was protecting, and which the fix had to preserve: a build's
   * four consumers must see ONE failure from ONE request, not four independent ones that could
   * disagree.
   */
  it("gives concurrent callers one shared attempt and one shared error", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    const { getActiveLocales } = await freshModule();

    const results = await Promise.allSettled([
      getActiveLocales(),
      getActiveLocales(),
      getActiveLocales(),
      getActiveLocales(),
    ]);

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.status === "rejected")).toBe(true);

    const reasons = results.map((result) =>
      result.status === "rejected" ? result.reason : undefined,
    );

    // The identical error object, not four equal-looking ones.
    expect(new Set(reasons).size).toBe(1);
  });
});

describe("getLocaleByCode", () => {
  it("reads through the same memo rather than issuing its own request", async () => {
    apiGet.mockResolvedValue(OK);

    const { getActiveLocales, getLocaleByCode } = await freshModule();

    await getActiveLocales();

    expect(await getLocaleByCode("fa")).toMatchObject({ code: "fa" });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("answers undefined for a code the table does not have", async () => {
    apiGet.mockResolvedValue(OK);

    const { getLocaleByCode } = await freshModule();

    expect(await getLocaleByCode("de")).toBeUndefined();
  });
});
