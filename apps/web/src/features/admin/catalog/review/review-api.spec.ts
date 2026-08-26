import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decideReviewSubject,
  getProductClaimReview,
  getReviewQueue,
  getSpecificationReview,
} from "./review-api";
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

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
const { getAdminAccessToken } = vi.hoisted(() => ({ getAdminAccessToken: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiGet, apiPost }));
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

/* ========================================================================== */
/*  Detail                                                                     */
/* ========================================================================== */

/**
 * The two detail reads.
 *
 * The classification is again the whole point, and a detail adds the one collapse that would do the
 * most damage: **a missing subject rendered as an empty valid detail**. A page of blank panels says
 * "this subject has no value, no evidence and no history", which is a claim about the catalogue.
 * Nothing here may produce it.
 */

const DETAIL = {
  subjectType: "specification",
  id: "11111111-1111-4111-8111-111111111111",
  reviewStatus: "source_recorded",
  createdAt: "2026-08-24T09:00:00.000Z",
  deletedAt: null,
  product: {
    slug: "hsb-2000",
    name: "HSB 2000",
    family: "industrial-oils-lubricants",
    productType: null,
  },
  grade: null,
  specification: {
    propertyKey: "kinematic_viscosity_100c",
    displayValue: "11.5",
    valueType: "point",
    numericMin: "11.500000",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    unit: "mm2/s",
    method: "ASTM D445",
    qualifier: null,
    resultBasis: "typical",
  },
  claim: null,
  evidenceSetHash: "2222222222222222222222222222222222222222222222222222222222222222",
  evidence: [],
  mappings: [],
  approvalBlockers: [],
  eligibleForApproval: true,
  history: [],
};

const CLAIM_DETAIL = {
  ...DETAIL,
  subjectType: "product_claim",
  id: "22222222-2222-4222-8222-222222222222",
  specification: null,
  claim: { kind: "meets", standardBody: "API", standardCode: "CK-4", contextNote: null },
};

const SPEC_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";

describe("the Specification detail read", () => {
  it("asks the specifications endpoint for that id, with the token in the options", async () => {
    apiGet.mockResolvedValue(ok(DETAIL));

    await getSpecificationReview(SPEC_ID);

    expect(apiGet).toHaveBeenCalledWith(
      `/admin/catalog/review/specifications/${SPEC_ID}`,
      undefined,
      { accessToken: TOKEN },
    );
  });

  it("returns the curated detail unchanged on success", async () => {
    apiGet.mockResolvedValue(ok(DETAIL));

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({
      state: "ok",
      value: DETAIL,
    });
  });

  it("encodes an id that is not a plain identifier", async () => {
    apiGet.mockResolvedValue(ok(DETAIL));

    await getSpecificationReview("../users");

    expect(apiGet).toHaveBeenCalledWith(
      "/admin/catalog/review/specifications/..%2Fusers",
      undefined,
      { accessToken: TOKEN },
    );
  });
});

describe("the ProductClaim detail read", () => {
  it("asks the product-claims endpoint, never the specifications one", async () => {
    apiGet.mockResolvedValue(ok(CLAIM_DETAIL));

    const result = await getProductClaimReview(CLAIM_ID);

    expect(apiGet).toHaveBeenCalledWith(
      `/admin/catalog/review/product-claims/${CLAIM_ID}`,
      undefined,
      { accessToken: TOKEN },
    );
    expect(result).toEqual({ state: "ok", value: CLAIM_DETAIL });
  });
});

describe("a detail request that does not produce a subject", () => {
  it("answers unauthenticated with no request when there is no cookie", async () => {
    getAdminAccessToken.mockResolvedValue(null);

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({ state: "unauthenticated" });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [400, "invalid-id"],
    [418, "failed"],
    [500, "failed"],
  ])("maps HTTP %s to %s", async (status, state) => {
    apiGet.mockResolvedValue(http(status));

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({ state });
  });

  it("keeps an outage distinct from a missing subject", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({ state: "unavailable" });

    apiGet.mockResolvedValue(http(404));

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({ state: "not-found" });
  });

  it("treats a non-envelope body as a failure, not as a subject", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "malformed", status: 200 });

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({ state: "failed" });
  });

  /**
   * The collapse that matters most. A 200 that is not a subject must never become one — not an
   * empty object, not an array, not null, and not the *other* subject type.
   */
  it.each([
    ["null", null],
    ["an empty object", {}],
    ["an array", []],
    ["a string", "nothing"],
    ["the other subject type", CLAIM_DETAIL],
    ["a subject with no id", { subjectType: "specification" }],
  ])("refuses to render %s as an empty valid detail", async (_name, body) => {
    apiGet.mockResolvedValue(ok(body));

    await expect(getSpecificationReview(SPEC_ID)).resolves.toEqual({ state: "failed" });
  });
});

describe("what a detail failure is allowed to say", () => {
  /** A route template, a failure class, and nothing else. Never the id, never the body. */
  it("logs no subject id, token, body or upstream message", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    apiGet.mockResolvedValue({
      ok: false,
      reason: "http",
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Prisma raised P2025 on specifications",
      details: null,
    });

    await getSpecificationReview(SPEC_ID);

    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n");

    expect(logged).toContain("/admin/catalog/review/specifications/:id");
    expect(logged).not.toContain(SPEC_ID);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("Prisma");
    expect(logged).not.toContain("INTERNAL_ERROR");

    warn.mockRestore();
  });

  /** No transport detail crosses the boundary in the returned value either. */
  it("returns a bare discriminant with no status, code or message attached", async () => {
    apiGet.mockResolvedValue(http(403));

    const result = await getSpecificationReview(SPEC_ID);

    expect(Object.keys(result)).toEqual(["state"]);
  });
});

describe("the Phase C decision write", () => {
  const body = {
    decision: "approve" as const,
    expectedReviewStatus: "source_recorded" as const,
    expectedEvidenceSetHash: "2".repeat(64),
  };

  it("posts one subject decision with the server-held token", async () => {
    const response = {
      subjectType: "specification",
      id: SPEC_ID,
      reviewStatus: "approved",
      decision: "approved",
      reviewId: "33333333-3333-4333-8333-333333333333",
      reviewedAt: "2026-08-26T20:00:00.000Z",
      evidenceSetHash: body.expectedEvidenceSetHash,
      reviewerEmail: "admin@samgp.com",
    };
    apiPost.mockResolvedValue(ok(response));

    await expect(decideReviewSubject("specification", SPEC_ID, body)).resolves.toEqual({
      state: "ok",
      value: response,
    });
    expect(apiPost).toHaveBeenCalledWith(
      `/admin/catalog/review/specifications/${SPEC_ID}/decisions`,
      body,
      { accessToken: TOKEN },
    );
  });

  it("carries approval blocker issues out of a 409 without its upstream message", async () => {
    apiPost.mockResolvedValue({
      ok: false,
      reason: "http",
      status: 409,
      code: "CONFLICT",
      message: "This subject is not eligible for approval.",
      details: [
        { field: "decision", issue: "A cited source has no captured asset." },
        { field: "decision", issue: "A required test method is absent." },
      ],
    });

    await expect(decideReviewSubject("specification", SPEC_ID, body)).resolves.toEqual({
      state: "conflict",
      blockers: ["A cited source has no captured asset.", "A required test method is absent."],
    });
  });

  it.each([
    [400, "invalid"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [500, "failed"],
  ])("maps decision HTTP %s to %s", async (status, state) => {
    apiPost.mockResolvedValue(http(status));
    const result = await decideReviewSubject("specification", SPEC_ID, body);
    expect(result.state).toBe(state);
  });

  it("does not post when the access cookie is absent", async () => {
    getAdminAccessToken.mockResolvedValue(null);
    await expect(decideReviewSubject("specification", SPEC_ID, body)).resolves.toEqual({
      state: "unauthenticated",
    });
    expect(apiPost).not.toHaveBeenCalled();
  });
});
