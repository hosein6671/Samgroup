import { describe, expect, it, vi } from "vitest";

import { findLinks, findTags, textOf } from "@test/element-tree";

import { FIRST_PAGE, NO_FILTERS, type FinderQuery } from "./finder-query";
import { FinderResults } from "./sections/results";

import type { ProductListResult } from "@/lib/products";

/**
 * What the Finder says when the API refuses a filter.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * Adding the Product Type axis introduced exactly one regression, and it was invisible in review:
 * the `unknown-filter` state had a branch per axis and a catch-all for everything else, so a
 * rejected `productType` fell to the catch-all and told the visitor **"the catalog service did not
 * answer this request"**. The service had answered — correctly, by refusing the slug — and the
 * remedy was one click away. A wrong explanation with no remedy is worse than a bare failure.
 *
 * So the rule is asserted per axis rather than per message: every filter the finder can send must
 * produce a notice that names THAT filter and offers to clear THAT filter.
 */

const rejected = (field: string): ProductListResult => ({
  ok: false,
  reason: "unknown-filter",
  field,
});

/** The three axes the finder puts on the wire, and the copy each must produce. */
const AXES = [
  { field: "category", query: { category: "nope" }, names: "product family", clears: "family" },
  { field: "segment", query: { segment: "nope" }, names: "segment", clears: "segment" },
  {
    field: "productType",
    query: { productType: "nope" },
    names: "product type",
    clears: "product type",
  },
] as const;

async function tree(
  result: ProductListResult,
  query: Partial<FinderQuery>,
): Promise<Awaited<ReturnType<typeof FinderResults>>> {
  return FinderResults({
    products: Promise.resolve(result),
    locale: "en",
    query: { ...NO_FILTERS, ...query },
  });
}

async function render(result: ProductListResult, query: Partial<FinderQuery>): Promise<string> {
  return textOf(await tree(result, query));
}

describe("a filter the API does not recognise", () => {
  it.each(AXES)("names the $field axis rather than a generic failure", async (axis) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const text = await render(rejected(axis.field), axis.query);

    expect(text).toContain(`${axis.names} is not recognised`);
    // The catch-all's wording must NOT appear — that was the regression.
    expect(text).not.toContain("did not answer this request");

    warn.mockRestore();
  });

  it.each(AXES)("offers to clear the $field filter specifically", async (axis) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(await render(rejected(axis.field), axis.query)).toContain(
      `Clear the ${axis.clears} filter`,
    );

    warn.mockRestore();
  });
});

/**
 * Pagination, modelled on the real `?productType=engine-oils` case: 33 products, 20 to a page.
 *
 * ── Why the fixture echoes `meta` rather than deriving it ──────────────────
 *
 * `page`, `limit` and `total` all come off the response, and the component computes the last page
 * from them and nothing else. A fixture that computed its own `meta` would be asserting that the
 * component agrees with the fixture's arithmetic; this one states what the API said and asserts what
 * the visitor is shown.
 */
function listing(rows: number, page: number, total = 33, limit = 20): ProductListResult {
  return {
    ok: true,
    products: Array.from({ length: rows }, (_, index) => ({
      id: `id-${String(page)}-${String(index)}`,
      name: `SAM Demo ${String(index)}`,
      slug: `sam-demo-${String(page)}-${String(index)}`,
      description: null,
      categoryId: "category",
      createdAt: "2026-01-01T00:00:00.000Z",
    })),
    total,
    page,
    limit,
  };
}

/** Every `href` the rendered result emitted, in document order. */
async function hrefs(result: ProductListResult, query: Partial<FinderQuery>): Promise<string[]> {
  return findLinks(await tree(result, query)).map((link) => String(link.props.href));
}

describe("the count states the window, not a prefix", () => {
  it("reports the API's total and which rows this page holds", async () => {
    const text = await render(listing(20, 1), { productType: "engine-oils" });

    expect(text).toContain("33");
    expect(text).toContain("showing 1–20");
  });

  /**
   * The line that pagination made wrong. It read "showing the first 13" on page 2 of 33 — those
   * thirteen rows are the LAST thirteen, and a count that says otherwise is a wrong number rather
   * than an imprecise one.
   */
  it("counts from the page's own offset rather than from one", async () => {
    const text = await render(listing(13, 2), { productType: "engine-oils" });

    expect(text).toContain("showing 21–33");
    expect(text).not.toContain("showing the first");
  });

  it("says nothing about a window when the whole set is on one page", async () => {
    const text = await render(listing(33, 1, 33, 40), { productType: "engine-oils" });

    expect(text).not.toContain("showing");
  });
});

describe("Previous and Next", () => {
  const filtered = { productType: "engine-oils" };

  it("offers Next but not Previous on the first page", async () => {
    const text = await render(listing(20, 1), filtered);
    const links = await hrefs(listing(20, 1), filtered);

    expect(text).toContain("Page 1 of 2");
    expect(links).toContain("/en/products/finder?productType=engine-oils&page=2");
    // Previous is rendered, so the row keeps its shape — but it is not a link.
    expect(text).toContain("Previous");
    expect(links.some((href) => href.endsWith("page=0"))).toBe(false);
  });

  it("offers Previous but not Next on the last page", async () => {
    const text = await render(listing(13, 2), filtered);
    const links = await hrefs(listing(13, 2), filtered);

    expect(text).toContain("Page 2 of 2");
    // Back to page 1, which is written as the bare selection rather than as `page=1`.
    expect(links).toContain("/en/products/finder?productType=engine-oils");
    expect(links.some((href) => href.includes("page=3"))).toBe(false);
  });

  it("offers both on a middle page", async () => {
    const links = await hrefs(listing(20, 2, 60), filtered);

    expect(links).toContain("/en/products/finder?productType=engine-oils");
    expect(links).toContain("/en/products/finder?productType=engine-oils&page=3");
    expect(await render(listing(20, 2, 60), filtered)).toContain("Page 2 of 3");
  });

  /** Three controls saying there is nowhere to go is not a control, it is noise. */
  it("is absent entirely when the result fits on one page", async () => {
    const text = await render(listing(5, 1, 5), filtered);

    expect(text).not.toContain("Page 1 of 1");
    expect(text).not.toContain("Previous");
    expect(text).not.toContain("Next");
  });

  /**
   * Paging must not be able to change what is being paged through. Every axis and the search term
   * ride along on both directions.
   */
  it("carries every active filter and the search term", async () => {
    const links = await hrefs(listing(20, 2, 60), {
      category: "base-oils",
      segment: "marine",
      productType: "engine-oils",
      q: "15w-40",
    });

    expect(links).toContain(
      "/en/products/finder?category=base-oils&segment=marine&productType=engine-oils&q=15w-40&page=3",
    );
    expect(links).toContain(
      "/en/products/finder?category=base-oils&segment=marine&productType=engine-oils&q=15w-40",
    );
  });

  it("names the directions for a screen reader without contradicting the visible word", async () => {
    const labels = findTags(await tree(listing(20, 2, 60), filtered), "a")
      .map((element) => element.props["aria-label"])
      .filter((label): label is string => typeof label === "string");

    expect(labels).toContain("Previous page");
    expect(labels).toContain("Next page");
  });

  it("marks the unavailable direction as disabled rather than removing it", async () => {
    const disabled = findTags(await tree(listing(20, 1), filtered), "span").filter(
      (element) => element.props["aria-disabled"] === "true",
    );

    expect(disabled).toHaveLength(1);
    expect(textOf(disabled[0]?.props.children as never)).toContain("Previous");
  });
});

/**
 * The page past the end of a real result.
 *
 * A 200 carrying zero rows is byte-for-byte what "nothing matches" looks like, and telling a visitor
 * their selection is empty when it holds thirty-three products two pages back is the same class of
 * error as reporting an outage as an empty catalog. `meta.total` is what tells the two apart, and it
 * arrives in the response the component was already given — no second request is made to find out.
 */
describe("a page past the end", () => {
  const beyond = listing(0, 5);

  it("says the page does not exist rather than that nothing matched", async () => {
    const text = await render(beyond, { productType: "engine-oils" });

    expect(text).toContain("That page does not exist");
    expect(text).not.toContain("No products match");
    expect(text).not.toContain("No products published yet");
  });

  it("states the size of the selection it is out of range for", async () => {
    expect(await render(beyond, { productType: "engine-oils" })).toContain(
      "holds 33 products across 2 pages, so there is no page 5",
    );
  });

  it("offers page 1 of the same selection, filters intact", async () => {
    expect(await hrefs(beyond, { category: "base-oils", productType: "engine-oils" })).toContain(
      "/en/products/finder?category=base-oils&productType=engine-oils",
    );
  });

  it("invents no products and draws no pagination controls", async () => {
    const text = await render(beyond, { productType: "engine-oils" });

    expect(text).not.toContain("SAM Demo");
    expect(text).not.toContain("Page 5 of");
  });

  /**
   * An empty result has no page to be past the end of. The truthful statement is that the selection
   * is empty — and "page 3 does not exist", followed by an empty page 1, would be two answers where
   * one is true.
   */
  it("defers to the empty state when the selection matched nothing at all", async () => {
    const text = await render(listing(0, 3, 0), { productType: "greases" });

    expect(text).toContain("No products match this search");
    expect(text).not.toContain("That page does not exist");
  });

  /** With no filters and no products the catalog is empty, whatever page was asked for. */
  it("defers to the empty catalog state when nothing is filtered", async () => {
    const text = await render(listing(0, 3, 0), { page: 3 });

    expect(text).toContain("No products published yet");
    expect(text).not.toContain("That page does not exist");
  });

  /**
   * `getProducts` falls `limit` back to `products.length` when the envelope omits it, and on an
   * out-of-range page that length is zero. A last page of `ceil(33 / 0)` would be `Infinity`.
   */
  it("survives a response that carried no limit", async () => {
    const text = await render(listing(0, 5, 33, 0), { productType: "engine-oils" });

    expect(text).not.toContain("Infinity");
    expect(text).not.toContain("NaN");
  });
});

/** Nothing about paging may reach a page that is not one of the API's. */
describe("no page below the first is ever linked", () => {
  it.each([FIRST_PAGE, 2, 3])("emits no page=0 or negative page from page %s", async (page) => {
    const links = await hrefs(listing(20, page, 200), { productType: "engine-oils" });

    for (const href of links) {
      expect(href).not.toMatch(/page=(0|-)/u);
    }
  });
});

/**
 * The other place a third axis went missing without failing anything.
 *
 * `selectionSentence` was a cascade of `if`s over two axes, so a filtered-empty page with only a
 * Product Type chip active fell through to "the requested filters" — a page showing **Greases** as
 * selected, telling the visitor nothing was found for something it declined to name. The rule is
 * that every axis the bar can set is an axis the sentence can name.
 */
describe("what the filtered empty state says was selected", () => {
  const empty: ProductListResult = { ok: true, products: [], total: 0, page: 1, limit: 20 };

  it.each([
    { label: "a product type alone", query: { productType: "greases" }, says: "Greases" },
    { label: "a family alone", query: { category: "base-oils" }, says: "Base Oils" },
    { label: "a segment alone", query: { segment: "marine" }, says: "Marine" },
    {
      label: "all three axes",
      query: { category: "base-oils", segment: "marine", productType: "greases" },
      says: "Base Oils in Marine in Greases",
    },
    {
      label: "a search inside a product type",
      query: { productType: "greases", q: "15w-40" },
      says: "the search within Greases",
    },
  ])("names $label", async ({ query, says }) => {
    expect(await render(empty, query)).toContain(`no published product for ${says}.`);
  });

  /**
   * A hand-typed slug the API has not rejected. It is caller-supplied text, so it is not echoed —
   * the sentence goes generic rather than putting an unapproved string where an ADR-020 display
   * name belongs.
   */
  it("never echoes a slug the registry does not hold", async () => {
    const text = await render(empty, { productType: "not-a-type" });

    expect(text).not.toContain("not-a-type");
    expect(text).toContain("no published product for the requested filters.");
  });

  /** The unfiltered empty catalog is a different statement and keeps its own wording. */
  it("says the catalog is empty when nothing is filtered", async () => {
    expect(await render(empty, {})).toContain("No products published yet");
  });
});

describe("a failure the visitor cannot act on", () => {
  /**
   * The catch-all is still correct for its own cases, and must stay reachable — a branch per field
   * plus an unreachable catch-all would be the opposite mistake.
   */
  it.each([
    { label: "the API is unreachable", result: { ok: false, reason: "unreachable", detail: "X" } },
    { label: "the API answered 500", result: { ok: false, reason: "api-error", status: 500 } },
    {
      label: "a field the finder never sends is rejected",
      result: { ok: false, reason: "unknown-filter", field: "somethingElse" },
    },
  ])("reports it as unavailable when $label", async ({ result }) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const text = await render(result as ProductListResult, {});

    expect(text).toContain("Product list unavailable");
    expect(text).not.toContain("is not recognised");

    warn.mockRestore();
  });
});
