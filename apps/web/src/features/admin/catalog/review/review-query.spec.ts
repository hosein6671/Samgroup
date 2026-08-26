import { describe, expect, it } from "vitest";

import {
  activeFilters,
  DEFAULT_LIMIT,
  DEFAULT_SORT,
  lastPage,
  readReviewQueueQuery,
  reviewPageHref,
  reviewQueueHref,
  toggleHref,
  toQueueRequest,
} from "./review-query";

import type { ReviewQueueQuery } from "./review-query";

/**
 * The review queue's URL contract.
 *
 * These tests are the reason a link this app renders can never be answered 400. The API runs
 * `whitelist` + `forbidNonWhitelisted` over a closed vocabulary; this module is what guarantees
 * nothing outside that vocabulary is ever put on the wire, and what guarantees the reader is told
 * when something was dropped rather than being shown a differently-filtered queue in silence.
 */

const UNFILTERED: ReviewQueueQuery = { page: 1, limit: DEFAULT_LIMIT, sort: DEFAULT_SORT };

describe("the default query", () => {
  it("is page 1 of 25, newest first, with nothing filtered", () => {
    const { query, rejected } = readReviewQueueQuery({});

    expect(query).toEqual({ page: 1, limit: 25, sort: "-createdAt" });
    expect(rejected).toEqual([]);
  });

  /**
   * Ratified decision D8. The absence of `reviewStatus` here is the whole point: the API's queue
   * predicate is `($2 IS NULL OR review_status = $2)`, so an unset filter means every status, and
   * every status means all 1,546 unapproved subjects rather than the 130 the importer flagged.
   */
  it("sends no reviewStatus, so the queue opens on every unapproved subject", () => {
    const { query } = readReviewQueueQuery({});

    expect(query.reviewStatus).toBeUndefined();
    expect(toQueueRequest(query)).not.toHaveProperty("reviewStatus");
  });

  it("states the window and the ordering on the wire even at their defaults", () => {
    expect(toQueueRequest(UNFILTERED)).toEqual({ page: "1", limit: "25", sort: "-createdAt" });
  });
});

describe("supported filters are parsed and forwarded", () => {
  it("accepts every closed vocabulary the API declares", () => {
    const { query, rejected } = readReviewQueueQuery({
      subjectType: "product_claim",
      reviewStatus: "needs_review",
      claimKind: "approved_by",
      unresolvedFindings: "true",
      sort: "createdAt",
      page: "3",
      limit: "50",
    });

    expect(rejected).toEqual([]);
    expect(query).toEqual({
      subjectType: "product_claim",
      reviewStatus: "needs_review",
      claimKind: "approved_by",
      unresolvedFindings: true,
      sort: "createdAt",
      page: 3,
      limit: 50,
    });
  });

  it("serializes exactly the keys the DTO declares, and no others", () => {
    const { query } = readReviewQueueQuery({
      subjectType: "specification",
      reviewStatus: "source_recorded",
      unresolvedFindings: "false",
      productSlug: "hsb-2000",
      family: "industrial-oils-lubricants",
      productType: "hydraulic-oil",
      propertyKey: "kinematic_viscosity_100c",
      documentLocator: "https://example.test/tds.pdf",
      page: "2",
    });

    expect(toQueueRequest(query)).toEqual({
      page: "2",
      limit: "25",
      sort: "-createdAt",
      subjectType: "specification",
      reviewStatus: "source_recorded",
      unresolvedFindings: "false",
      productSlug: "hsb-2000",
      family: "industrial-oils-lubricants",
      productType: "hydraulic-oil",
      propertyKey: "kinematic_viscosity_100c",
      documentLocator: "https://example.test/tds.pdf",
    });
  });

  it("keeps unresolvedFindings=false, which is a filter rather than an absence", () => {
    const { query } = readReviewQueueQuery({ unresolvedFindings: "false" });

    expect(query.unresolvedFindings).toBe(false);
    expect(toQueueRequest(query).unresolvedFindings).toBe("false");
  });

  it("trims a free-text filter and drops one that is only whitespace", () => {
    const { query } = readReviewQueueQuery({ productSlug: "  hsb-2000  ", family: "   " });

    expect(query.productSlug).toBe("hsb-2000");
    expect(query.family).toBeUndefined();
  });

  it("takes the first value when a parameter is repeated", () => {
    const { query, rejected } = readReviewQueueQuery({ page: ["2", "9"] });

    expect(query.page).toBe(2);
    expect(rejected).toEqual([]);
  });
});

describe("unsupported values are refused, never forwarded", () => {
  it.each([
    ["subjectType", "specifications"],
    ["reviewStatus", "pending"],
    ["claimKind", "endorsed_by"],
  ])("drops an out-of-vocabulary %s and reports it", (param, value) => {
    const { query, rejected } = readReviewQueueQuery({ [param]: value });

    expect(query).not.toHaveProperty(param);
    expect(toQueueRequest(query)).not.toHaveProperty(param);
    expect(rejected.map((entry) => entry.param)).toEqual([param]);
  });

  it("refuses a boolean spelled any way but true or false", () => {
    const { query, rejected } = readReviewQueueQuery({ unresolvedFindings: "1" });

    expect(query.unresolvedFindings).toBeUndefined();
    expect(rejected[0]?.param).toBe("unresolvedFindings");
  });

  it("falls back to the default ordering, because a list always has one", () => {
    const { query, rejected } = readReviewQueueQuery({ sort: "propertyKey" });

    expect(query.sort).toBe(DEFAULT_SORT);
    expect(rejected.map((entry) => entry.param)).toEqual(["sort"]);
  });

  it.each([
    ["page", "0"],
    ["page", "2.5"],
    ["page", "abc"],
    ["page", "10001"],
    ["limit", "0"],
    ["limit", "101"],
  ])("refuses %s=%s and falls back rather than sending it", (param, value) => {
    const { query, rejected } = readReviewQueueQuery({ [param]: value });

    expect(query[param as "page" | "limit"]).toBe(param === "page" ? 1 : DEFAULT_LIMIT);
    expect(rejected.map((entry) => entry.param)).toEqual([param]);
  });

  /** The API caps every free-text filter; over-length is refused here rather than there. */
  it("refuses a free-text filter longer than the API accepts", () => {
    const { query, rejected } = readReviewQueueQuery({ productSlug: "x".repeat(201) });

    expect(query.productSlug).toBeUndefined();
    expect(rejected[0]?.param).toBe("productSlug");
  });

  it("applies the valid filters even when another one was refused", () => {
    const { query, rejected } = readReviewQueueQuery({
      subjectType: "specification",
      reviewStatus: "nonsense",
      page: "4",
    });

    expect(query.subjectType).toBe("specification");
    expect(query.page).toBe(4);
    expect(query.reviewStatus).toBeUndefined();
    expect(rejected.map((entry) => entry.param)).toEqual(["reviewStatus"]);
  });

  it("ignores a key the API does not declare rather than passing it through", () => {
    const { query } = readReviewQueueQuery({ assignee: "someone", q: "viscosity" });

    expect(toQueueRequest(query)).toEqual({ page: "1", limit: "25", sort: "-createdAt" });
  });
});

describe("hrefs", () => {
  it("spells the unfiltered queue with no query string at all", () => {
    expect(reviewQueueHref(UNFILTERED)).toBe("/admin/catalog/review");
  });

  it("omits values that equal the API default", () => {
    expect(reviewQueueHref({ ...UNFILTERED, sort: "-createdAt", limit: 25, page: 1 })).toBe(
      "/admin/catalog/review",
    );
  });

  it("preserves every active filter and the sort when paging", () => {
    const query: ReviewQueueQuery = {
      ...UNFILTERED,
      subjectType: "product_claim",
      reviewStatus: "needs_review",
      unresolvedFindings: true,
      productSlug: "hsb-2000",
      sort: "updatedAt",
      page: 3,
    };

    expect(reviewPageHref(query, 4)).toBe(
      "/admin/catalog/review?subjectType=product_claim&reviewStatus=needs_review" +
        "&unresolvedFindings=true&productSlug=hsb-2000&sort=updatedAt&page=4",
    );
  });

  /**
   * A reader on page 43 who narrows the queue wants the first page of the narrower list. At 133
   * rows matching "unresolved findings" page 43 does not exist, and the queue would render empty —
   * which looks exactly like a filter that matched nothing.
   */
  it("resets to page 1 when a filter changes", () => {
    const query: ReviewQueueQuery = { ...UNFILTERED, page: 43 };

    expect(reviewQueueHref(query, { unresolvedFindings: true })).toBe(
      "/admin/catalog/review?unresolvedFindings=true",
    );
  });

  it("keeps the page only when the patch is the page itself", () => {
    expect(reviewPageHref({ ...UNFILTERED, page: 2 }, 7)).toBe("/admin/catalog/review?page=7");
  });

  it("makes each filter control its own way out", () => {
    const on: ReviewQueueQuery = { ...UNFILTERED, subjectType: "specification" };

    expect(toggleHref(on, "subjectType", "specification")).toBe("/admin/catalog/review");
    expect(toggleHref(on, "subjectType", "product_claim")).toBe(
      "/admin/catalog/review?subjectType=product_claim",
    );
  });

  it("orders the query string the same way every time", () => {
    const a = reviewQueueHref(UNFILTERED, {
      reviewStatus: "needs_review",
      subjectType: "specification",
    });
    const b = reviewQueueHref(UNFILTERED, {
      subjectType: "specification",
      reviewStatus: "needs_review",
    });

    expect(a).toBe(b);
  });
});

describe("activeFilters", () => {
  const describeValue = {
    subjectType: (value: string): string => `type:${value}`,
    reviewStatus: (value: string): string => `status:${value}`,
    claimKind: (value: string): string => `kind:${value}`,
    unresolvedFindings: (value: boolean): string => (value ? "unresolved" : "clear"),
  };

  it("reports nothing when nothing narrows the queue", () => {
    expect(activeFilters(UNFILTERED, describeValue)).toEqual([]);
  });

  it("does not treat the ordering as a filter", () => {
    expect(activeFilters({ ...UNFILTERED, sort: "updatedAt" }, describeValue)).toEqual([]);
  });

  it("describes each active filter and offers a link that removes only it", () => {
    const query: ReviewQueueQuery = {
      ...UNFILTERED,
      subjectType: "specification",
      unresolvedFindings: true,
      productSlug: "hsb-2000",
    };

    const filters = activeFilters(query, describeValue);

    expect(filters.map((filter) => filter.param)).toEqual([
      "subjectType",
      "unresolvedFindings",
      "productSlug",
    ]);
    expect(filters[0]?.value).toBe("type:specification");
    expect(filters[0]?.clearHref).toBe(
      "/admin/catalog/review?unresolvedFindings=true&productSlug=hsb-2000",
    );
  });
});

describe("lastPage", () => {
  it("pages the live catalogue into 62 pages of 25", () => {
    expect(lastPage(1546, 25)).toBe(62);
  });

  it("gives an empty queue one page rather than none", () => {
    expect(lastPage(0, 25)).toBe(1);
  });
});
