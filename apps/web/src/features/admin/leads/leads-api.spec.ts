import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAdminCustomFormulationRequest,
  getAdminCustomFormulationRequests,
  getAdminInquiries,
  getAdminInquiry,
} from "./leads-api";

/**
 * The Admin lead data layer: what it sends, and how it classifies what comes back.
 *
 * ── The classification is the whole point ──────────────────────────────────
 *
 * 401, 403, 404 and "everything else" mean four different things to an operator, and every one of
 * these tests exists to stop two of them being collapsed. The one that matters most is the last:
 * **an outage must never be classified as a missing record.** ADR-010 §7 fixes that for public
 * content; a lead is a record that exists exactly once, so a false 404 is worse here, not better.
 */

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
const { getAdminAccessToken } = vi.hoisted(() => ({ getAdminAccessToken: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiGet }));
vi.mock("../session/session", () => ({ getAdminAccessToken }));

const TOKEN = "access-token-value";
const LIST_REQUEST = { page: 2, limit: 25 } as const;

type StubResult = Record<string, unknown>;

const okList = (data: unknown[], meta: Record<string, number> = {}): StubResult => ({
  ok: true,
  data,
  meta: { total: data.length, page: 1, limit: 25, ...meta },
});

const http = (status: number): StubResult => ({
  ok: false,
  reason: "http",
  status,
  code: null,
  message: null,
});

beforeEach(() => {
  getAdminAccessToken.mockResolvedValue(TOKEN);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("the request", () => {
  it("sends the session's access token as a credential, and asks the contracted path", async () => {
    apiGet.mockResolvedValue(okList([]));

    await getAdminInquiries(LIST_REQUEST);

    expect(apiGet).toHaveBeenCalledWith(
      "/admin/inquiries",
      { page: "2", limit: "25" },
      { accessToken: TOKEN },
    );
  });

  it("sends the inquiry filter only when one is set", async () => {
    apiGet.mockResolvedValue(okList([]));

    await getAdminInquiries({ ...LIST_REQUEST, inquiryType: "sample_request" });

    expect(apiGet).toHaveBeenCalledWith(
      "/admin/inquiries",
      { page: "2", limit: "25", inquiryType: "sample_request" },
      { accessToken: TOKEN },
    );
  });

  /**
   * The formulation endpoint declares no filter, so sending one would be answered 400 by
   * `forbidNonWhitelisted`. The client drops it rather than letting a stray parameter turn a valid
   * page into an error.
   */
  it("never sends a filter to the formulation endpoint", async () => {
    apiGet.mockResolvedValue(okList([]));

    await getAdminCustomFormulationRequests({ ...LIST_REQUEST, inquiryType: "sample_request" });

    expect(apiGet).toHaveBeenCalledWith(
      "/admin/custom-formulation-requests",
      { page: "2", limit: "25" },
      { accessToken: TOKEN },
    );
  });

  it("encodes the id into the detail path", async () => {
    apiGet.mockResolvedValue({ ok: true, data: { id: "x" }, meta: {} });

    await getAdminInquiry("a b/c");

    expect(apiGet).toHaveBeenCalledWith("/admin/inquiries/a%20b%2Fc", undefined, {
      accessToken: TOKEN,
    });
  });

  /**
   * No cookie means middleware could not produce one, so there is no credential to present.
   * Answering without a round trip is both faster and honest — the API would say the same thing.
   */
  it("is unauthenticated without a token, and issues no request", async () => {
    getAdminAccessToken.mockResolvedValue(null);

    await expect(getAdminInquiries(LIST_REQUEST)).resolves.toEqual({ state: "unauthenticated" });
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("the outcome taxonomy", () => {
  it("reads a page and its meta from a successful envelope", async () => {
    apiGet.mockResolvedValue(okList([{ id: "1" }, { id: "2" }], { total: 40, page: 2, limit: 25 }));

    await expect(getAdminInquiries(LIST_REQUEST)).resolves.toEqual({
      state: "ok",
      value: { items: [{ id: "1" }, { id: "2" }], total: 40, page: 2, limit: 25 },
    });
  });

  it("classifies 401 as unauthenticated — the credential is stale", async () => {
    apiGet.mockResolvedValue(http(401));

    await expect(getAdminInquiries(LIST_REQUEST)).resolves.toEqual({ state: "unauthenticated" });
  });

  it("classifies 403 as forbidden — the credential is good and the role is not", async () => {
    apiGet.mockResolvedValue(http(403));

    await expect(getAdminInquiries(LIST_REQUEST)).resolves.toEqual({ state: "forbidden" });
  });

  it("classifies a definitive 404 as not-found", async () => {
    apiGet.mockResolvedValue(http(404));

    await expect(getAdminInquiry("id")).resolves.toEqual({ state: "not-found" });
  });

  /**
   * The assertion this module exists for. Every one of these is `unavailable`, and not one of them
   * is `not-found`: telling an operator a lead does not exist because a container restarted is the
   * failure the taxonomy prevents.
   */
  it.each([
    ["500", http(500)],
    ["502", http(502)],
    ["503", http(503)],
    ["400", http(400)],
    ["a transport failure", { ok: false, reason: "unreachable", detail: "ECONNREFUSED" }],
    ["a timeout", { ok: false, reason: "unreachable", detail: "TimeoutError" }],
    ["a non-envelope body", { ok: false, reason: "malformed", status: 200 }],
  ])("classifies %s as unavailable, never as not-found", async (_label, result) => {
    apiGet.mockResolvedValue(result);

    await expect(getAdminInquiry("id")).resolves.toEqual({ state: "unavailable" });
    await expect(getAdminInquiries(LIST_REQUEST)).resolves.toEqual({ state: "unavailable" });
  });

  it("applies the same taxonomy to the formulation reads", async () => {
    apiGet.mockResolvedValue(http(404));
    await expect(getAdminCustomFormulationRequest("id")).resolves.toEqual({ state: "not-found" });

    apiGet.mockResolvedValue(http(503));
    await expect(getAdminCustomFormulationRequests(LIST_REQUEST)).resolves.toEqual({
      state: "unavailable",
    });
  });
});

describe("diagnostics", () => {
  /**
   * A log line is a copy of the data in a place with different retention. These records are the
   * most sensitive the platform holds (SECURITY.md §Personal Data Retention), so the failure log
   * carries an endpoint and a failure class and nothing that came out of a payload.
   */
  it("logs a failure without any part of a lead", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    apiGet.mockResolvedValue({
      ok: false,
      reason: "http",
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Ada Lovelace <ada@example.com> could not be read",
    });

    await getAdminInquiry("11111111-1111-4111-8111-111111111111");

    const logged = warn.mock.calls.map((call) => String(call[0])).join(" ");

    expect(logged).toContain("/admin/inquiries/");
    expect(logged).toContain("HTTP 500");
    expect(logged).not.toContain("ada@example.com");
    expect(logged).not.toContain("Ada");

    warn.mockRestore();
  });

  it("never logs the access token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    await getAdminInquiries(LIST_REQUEST);

    expect(warn.mock.calls.map((call) => String(call[0])).join(" ")).not.toContain(TOKEN);

    warn.mockRestore();
  });
});
