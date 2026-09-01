import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProducts } from "./products";

/**
 * What the Product Finder actually puts on the wire, and what it makes of the answer.
 *
 * ── Why this is asserted at the client rather than at the page ──────────────
 *
 * `finder-query.spec.ts` proves the URL is read and rebuilt correctly, and `finder-filters.spec.tsx`
 * proves the controls emit the right URLs. Neither of them proves the step between: that a
 * `productType` the route read off the address reaches `GET /products` as a query parameter. That
 * step is one spread in `getProducts`, it has no visible failure — an omitted filter returns a
 * larger list, not an error — and it is the whole of what "the filter works" means.
 *
 * The API's filter SEMANTICS are not asserted here and must not be: which products a type selects,
 * and whether a slug resolves at all, are `apps/api`'s (ADR-008), and a second opinion in `apps/web`
 * could only ever agree with the first by coincidence. What is asserted is the request and the
 * mapping of the response — the two halves this module actually owns.
 */

const ORIGIN = "http://api.test";

function stubFetch(responder: (url: string) => Response): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (input: unknown) => responder(String(input)));

  vi.stubGlobal("fetch", spy);

  return spy;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ROW = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "SAM Demo Grade",
  slug: "sam-demo-grade",
  description: null,
  categoryId: "00000000-0000-4000-8000-000000000002",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/** The query string of the single request the call under test issued. */
function requestedQuery(spy: ReturnType<typeof vi.fn>): URLSearchParams {
  expect(spy).toHaveBeenCalledTimes(1);

  return new URL(String(spy.mock.calls[0]?.[0])).searchParams;
}

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", ORIGIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the request the finder issues", () => {
  it("sends all three taxonomy axes and the search term together", async () => {
    const spy = stubFetch(() => json({ data: [ROW], meta: { total: 1, page: 1, limit: 20 } }));

    await getProducts("en", {
      category: "base-oils",
      segment: "marine",
      productType: "gear-oils",
      q: "15w-40",
    });

    const query = requestedQuery(spy);

    expect(query.get("locale")).toBe("en");
    expect(query.get("category")).toBe("base-oils");
    expect(query.get("segment")).toBe("marine");
    expect(query.get("productType")).toBe("gear-oils");
    expect(query.get("q")).toBe("15w-40");
  });

  /**
   * Spelled `productType`, never `type`. ADR-008 rejects the short form, and `apps/api`'s
   * `ValidationPipe` runs with `forbidNonWhitelisted` — so a misspelled parameter is a 400 on every
   * request the finder makes, not a filter that is quietly ignored.
   */
  it("spells the parameter productType", async () => {
    const spy = stubFetch(() => json({ data: [], meta: { total: 0 } }));

    await getProducts("en", { productType: "greases" });

    const query = requestedQuery(spy);

    expect(query.has("productType")).toBe(true);
    expect(query.has("type")).toBe(false);
  });

  /** An absent axis is omitted rather than sent blank: `?productType=` is not a filter. */
  it("omits every axis it was not given", async () => {
    const spy = stubFetch(() => json({ data: [], meta: { total: 0 } }));

    await getProducts("fa", { productType: "greases" });

    const query = requestedQuery(spy);

    expect([...query.keys()].sort()).toEqual(["locale", "productType"]);
  });

  /**
   * `limit` and `sort` stay unsent by owner decision: the endpoint's `limit=20` and `sort=name`
   * stand, and no control on the Finder varies either. A page number only means something against
   * a page size the caller is not also changing.
   */
  it("never sends a limit or a sort, on any page", async () => {
    for (const page of [undefined, 1, 2, 40]) {
      const spy = stubFetch(() => json({ data: [], meta: { total: 0 } }));

      await getProducts("en", { productType: "greases", page });

      const query = requestedQuery(spy);

      expect(query.has("limit")).toBe(false);
      expect(query.has("sort")).toBe(false);

      vi.unstubAllGlobals();
    }
  });

  /** Page 1 is the endpoint's own default, so asking for it says nothing the bare request did not. */
  it.each([undefined, 1])("omits the page when it is %s", async (page) => {
    const spy = stubFetch(() => json({ data: [], meta: { total: 0 } }));

    await getProducts("en", { productType: "greases", page });

    expect(requestedQuery(spy).has("page")).toBe(false);
  });

  it("sends every page after the first", async () => {
    const spy = stubFetch(() => json({ data: [], meta: { total: 33, page: 2, limit: 20 } }));

    await getProducts("en", { productType: "engine-oils", page: 2 });

    const query = requestedQuery(spy);

    expect(query.get("page")).toBe("2");
    expect(query.get("productType")).toBe("engine-oils");
  });
});

describe("what it makes of the answer", () => {
  /**
   * `meta.total` is the size of the filtered set and `products.length` is how much of it this page
   * holds. The finder states the difference rather than rounding it away, which it can only do if
   * this module keeps the two apart.
   */
  it("keeps meta.total apart from the number of rows returned", async () => {
    stubFetch(() => json({ data: [ROW], meta: { total: 33, page: 1, limit: 20 } }));

    const result = await getProducts("en", { productType: "engine-oils" });

    expect(result).toMatchObject({ ok: true, total: 33, page: 1, limit: 20 });
    expect(result.ok && result.products).toHaveLength(1);
  });

  /**
   * A page past the end is a 200 with zero rows and an intact `meta` — the shape the results block
   * classifies as out-of-range. It must arrive as a successful, empty listing rather than as any
   * kind of failure, or the page that does not exist would be reported as a service that did not
   * answer.
   */
  it("returns an out-of-range page as an ok result carrying the real total", async () => {
    stubFetch(() => json({ data: [], meta: { total: 33, page: 5, limit: 20 } }));

    expect(await getProducts("en", { productType: "engine-oils", page: 5 })).toEqual({
      ok: true,
      products: [],
      total: 33,
      page: 5,
      limit: 20,
    });
  });

  /**
   * A rejected `productType` has to arrive as `unknown-filter` naming that field. It is the only
   * failure the visitor caused and the only one they can undo, and the results block routes on the
   * field name to say which chip to clear.
   */
  it("reports a rejected productType as an unknown filter naming that field", async () => {
    stubFetch(() =>
      json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: [{ field: "productType", issue: "must be the slug of an existing type" }],
          },
        },
        400,
      ),
    );

    expect(await getProducts("en", { productType: "not-a-type" })).toEqual({
      ok: false,
      reason: "unknown-filter",
      field: "productType",
    });
  });

  /** A 400 naming no field is not a filter the visitor can clear, and must not be reported as one. */
  it("reports a 400 with no named field as an API error", async () => {
    stubFetch(() => json({ error: { code: "VALIDATION_ERROR", message: "Bad" } }, 400));

    expect(await getProducts("en", { productType: "greases" })).toEqual({
      ok: false,
      reason: "api-error",
      status: 400,
    });
  });
});
