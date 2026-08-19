import { describe, expect, it } from "vitest";

import {
  PAGE_SIZE,
  inboxFilterHref,
  inboxPageHref,
  lastPage,
  readFormulationInboxQuery,
  readInquiryInboxQuery,
} from "./lead-query";
import { INQUIRIES_PATH } from "./lead-routes";

/**
 * How an inbox URL is read, and how the next one is built.
 *
 * The property under test throughout is that **nothing caller-controlled survives unexamined**. A
 * page number is parsed and bounded, a filter is matched against a closed list, and an unrecognised
 * parameter is dropped rather than proxied to the API — so a hand-edited URL renders page 1 instead
 * of a 400 the operator would read as an outage.
 */

describe("readInquiryInboxQuery", () => {
  it("defaults to the first page at the inbox page size", () => {
    expect(readInquiryInboxQuery({})).toEqual({ page: 1, limit: PAGE_SIZE });
  });

  it("reads a page number", () => {
    expect(readInquiryInboxQuery({ page: "4" })).toEqual({ page: 4, limit: PAGE_SIZE });
  });

  it.each(["0", "-2", "1.5", "abc", "", " ", "1e9", "99999999"])(
    "falls back to page 1 for %p rather than passing it on",
    (page) => {
      expect(readInquiryInboxQuery({ page }).page).toBe(1);
    },
  );

  it("takes the first value of a repeated parameter — two pages is not a request", () => {
    expect(readInquiryInboxQuery({ page: ["3", "9"] }).page).toBe(3);
  });

  it("accepts a filter that names a real inquiry type", () => {
    expect(readInquiryInboxQuery({ inquiryType: "sample_request" })).toEqual({
      page: 1,
      limit: PAGE_SIZE,
      inquiryType: "sample_request",
    });
  });

  it("drops a filter value outside the vocabulary instead of forwarding it", () => {
    expect(readInquiryInboxQuery({ inquiryType: "quote" })).toEqual({ page: 1, limit: PAGE_SIZE });
  });

  /**
   * SECURITY.md §RBAC integration: lead scoping is applied by the server, never requested by the
   * client. There is no URL spelling of it, so a hand-crafted one must not reach the API — and the
   * API declares no such parameter either, so it would be answered 400 if it did.
   */
  it("has no URL spelling for a scoping parameter", () => {
    const query = readInquiryInboxQuery({
      assignedToId: "33333333-3333-4333-8333-333333333333",
      status: "closed",
      limit: "1000",
    });

    expect(query).toEqual({ page: 1, limit: PAGE_SIZE });
    expect(query).not.toHaveProperty("assignedToId");
    expect(query).not.toHaveProperty("status");
  });

  it("pins the page size rather than letting a URL choose it", () => {
    expect(readInquiryInboxQuery({ limit: "1000" }).limit).toBe(PAGE_SIZE);
  });
});

describe("readFormulationInboxQuery", () => {
  it("carries a page and nothing else — the endpoint declares no filter", () => {
    expect(readFormulationInboxQuery({ page: "2", inquiryType: "sample_request" })).toEqual({
      page: 2,
      limit: PAGE_SIZE,
    });
  });
});

describe("inboxPageHref", () => {
  it("omits page=1, so the first page has one URL", () => {
    expect(inboxPageHref(INQUIRIES_PATH, { page: 2, limit: PAGE_SIZE }, 1)).toBe(INQUIRIES_PATH);
  });

  it("carries the active filter across a page change", () => {
    expect(
      inboxPageHref(
        INQUIRIES_PATH,
        { page: 1, limit: PAGE_SIZE, inquiryType: "request_a_quote" },
        2,
      ),
    ).toBe(`${INQUIRIES_PATH}?inquiryType=request_a_quote&page=2`);
  });

  /**
   * The link is built from the **parsed** query, not from the incoming URL, so anything the parser
   * refused cannot ride along on a click. A previous/next built by mutating the request URL would
   * preserve it.
   */
  it("carries nothing the query vocabulary does not contain", () => {
    const query = readInquiryInboxQuery({ page: "2", assignedToId: "someone", debug: "1" });

    expect(inboxPageHref(INQUIRIES_PATH, query, 3)).toBe(`${INQUIRIES_PATH}?page=3`);
  });
});

describe("inboxFilterHref", () => {
  it("returns to the unfiltered first page when no type is selected", () => {
    expect(inboxFilterHref(INQUIRIES_PATH, undefined)).toBe(INQUIRIES_PATH);
  });

  it("drops the page when a filter changes — a filtered set has its own page 1", () => {
    expect(inboxFilterHref(INQUIRIES_PATH, "general_inquiry")).toBe(
      `${INQUIRIES_PATH}?inquiryType=general_inquiry`,
    );
  });
});

describe("lastPage", () => {
  it("is 1 for an empty inbox — page 1 of 1, not page 1 of 0", () => {
    expect(lastPage(0, 25)).toBe(1);
  });

  it("rounds a partial final page up", () => {
    expect(lastPage(26, 25)).toBe(2);
    expect(lastPage(50, 25)).toBe(2);
    expect(lastPage(51, 25)).toBe(3);
  });
});
