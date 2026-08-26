import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getReviewQueue } from "./review-api";
import { DEFAULT_LIMIT, DEFAULT_SORT } from "./review-query";

import type { ReviewQueueQuery } from "./review-query";

/**
 * The review queue's data layer: what it sends, and how it classifies what comes back.
 *
 * ## The classification is the whole point
 *
 * Six outcomes, and every test here exists to stop two of them being collapsed. Three of the
 * collapses would be actively misleading:
 *
 * - **a refusal rendered as an empty queue** would tell a reader there is no work, when in fact
 *   there are 1,546 subjects they are not allowed to see;
 * - **an outage rendered as zero results** would say the catalogue is clear when nothing answered;
 * - **a refused filter rendered as an outage** would send someone to check a service that is fine.
 *
 * ## And what never crosses the boundary
 *
 * No token, no URL, no upstream message, no error code. The one thing carried out of a 400 is the
 * API's own `details[].field` — a DTO property name it authored.
 */

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
const { getAdminAccessToken } = vi.hoisted(() => ({ getAdminAccessToken: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiGet }));
vi.mock("../../session/session", () => ({ getAdminAccessToken }));

const TOKEN = "access-token-value";
const QUERY: ReviewQueueQuery = { page: 1, limit: DEFAULT_LIMIT, sort: DEFAULT_SORT };

const ROW = {
  subjectType: "specification",
  id: "11111111-1111-4111-8111-111111111111",
  reviewStatus: "source_recorded",
  createdAt: "2026-08-24T09:00:00.000Z",
  product: {
    slug: "hsb-2000",
    name: "HSB 2000",
    family: "industrial-oils-lubricants",
    productType: null,
  },
  grade: null,
  propertyKey: "kinematic_viscosity_100c",
  claimKind: null,
  summary: "kinematic_viscosity_100c 11.5 mm2/s",
  evidenceCount: 1,
  hasUnresolvedFindings: false,
  reviewCount: 0,
};

type StubResult = Record<string, unknown>;

const ok = (data: unknown, meta: Record<string, number> = {}): StubResult => ({
  ok: true,
  data,
  meta: { total: 1546, page: 1, limit: 25, ...meta },
});

const http = (status: number, details?: { field: string; issue: string }[]): StubResult => ({
  ok: false,
  reason: "http",
  status,
  code: null,
  message: null,
  details: details ?? null,
});

beforeEach(() => {
  getAdminAccessToken.mockResolvedValue(TOKEN);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("the request", () => {
  it("asks the contracted path with the session's token as a credential", async () => {
    apiGet.mockResolvedValue(ok([]));

    await getReviewQueue(QUERY);

    expect(apiGet).toHaveBeenCalledWith(
      "/admin/catalog/review/queue",
      { page: "1", limit: "25", sort: "-createdAt" },
      { accessToken: TOKEN },
    );
  });

  it("never sends a filter the caller did not supply", async () => {
    apiGet.mockResolvedValue(ok([]));

    await getReviewQueue(QUERY);

    const [, query] = apiGet.mock.calls[0] as [string, Record<string, string>];
    expect(query).not.toHaveProperty("reviewStatus");
    expect(query).not.toHaveProperty("subjectType");
  });

  it("does not reach the API at all when there is no session cookie", async () => {
    getAdminAccessToken.mockResolvedValue(null);

    await expect(getReviewQueue(QUERY)).resolves.toEqual({ state: "unauthenticated" });
    expect(apiGet).not.toHaveBeenCalled();
  });

  /** Reads only. A `POST` from this layer would be a decision, and Phase A ships none. */
  it("exposes exactly one function, and it is a read", async () => {
    apiGet.mockResolvedValue(ok([]));

    await getReviewQueue(QUERY);

    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});

describe("success", () => {
  it("returns the curated rows with the envelope's own window", async () => {
    apiGet.mockResolvedValue(ok([ROW], { total: 1546, page: 1, limit: 25 }));

    const result = await getReviewQueue(QUERY);

    expect(result).toEqual({
      state: "ok",
      value: { items: [ROW], total: 1546, page: 1, limit: 25 },
    });
  });

  it("carries the live catalogue's total of 1,546 through unchanged", async () => {
    apiGet.mockResolvedValue(ok([ROW], { total: 1546 }));

    const result = await getReviewQueue(QUERY);

    expect(result.state === "ok" && result.value.total).toBe(1546);
  });

  it("reports a 200 whose data is not the contracted array as a failure, not an empty queue", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue(ok({ items: [] }));

    await expect(getReviewQueue(QUERY)).resolves.toEqual({ state: "failed" });
  });
});

describe("the six outcomes stay distinct", () => {
  it("classifies 401 as unauthenticated", async () => {
    apiGet.mockResolvedValue(http(401));

    await expect(getReviewQueue(QUERY)).resolves.toEqual({ state: "unauthenticated" });
  });

  it("classifies 403 as forbidden, never as an empty queue", async () => {
    apiGet.mockResolvedValue(http(403));

    const result = await getReviewQueue(QUERY);

    expect(result).toEqual({ state: "forbidden" });
    expect(result).not.toHaveProperty("value");
  });

  it("classifies 400 as a refused query and names the field the API named", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue(
      http(400, [{ field: "limit", issue: "must not be greater than 100" }]),
    );

    await expect(getReviewQueue(QUERY)).resolves.toEqual({
      state: "invalid-query",
      field: "limit",
    });
  });

  it("carries no backend sentence out of a 400 — only the field name", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue(
      http(400, [{ field: "subjectType", issue: "must be one of the following values: …" }]),
    );

    const result = await getReviewQueue(QUERY);

    expect(JSON.stringify(result)).not.toContain("must be one of");
  });

  it("classifies an unreachable API as unavailable, never as zero results", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    const result = await getReviewQueue(QUERY);

    expect(result).toEqual({ state: "unavailable" });
    expect(result).not.toHaveProperty("value");
  });

  it("classifies a non-envelope body as failed, which is not an outage", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue({ ok: false, reason: "malformed", status: 200 });

    await expect(getReviewQueue(QUERY)).resolves.toEqual({ state: "failed" });
  });

  it("classifies any other status as a safe generic failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue(http(503));

    await expect(getReviewQueue(QUERY)).resolves.toEqual({ state: "failed" });
  });
});

describe("what reaches the log", () => {
  it("logs a path and a description, never the token, the query or a body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    await getReviewQueue({ ...QUERY, productSlug: "hsb-2000" });

    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("/admin/catalog/review/queue");
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("hsb-2000");
  });

  it("says nothing at all on a successful read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    apiGet.mockResolvedValue(ok([ROW]));

    await getReviewQueue(QUERY);

    expect(warn).not.toHaveBeenCalled();
  });
});
