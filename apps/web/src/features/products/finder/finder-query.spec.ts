import { describe, expect, it } from "vitest";

import { PRODUCT_TYPES, productTypeName } from "../product-types-data";
import { SEGMENTS } from "../segments-data";

import {
  FIRST_PAGE,
  NO_FILTERS,
  filterHref,
  finderHref,
  finderPath,
  hasFilters,
  pageHref,
  readFinderPage,
  readFinderQuery,
  type FinderQuery,
} from "./finder-query";

/**
 * The Finder's URL state — three taxonomy axes, a search term, and a page.
 *
 * The Finder keeps no client state: every control is an `<a>` to this same route with a different
 * query string, so this module IS the interaction model. The assertions that matter are the ones
 * about composition — that adding an axis did not make "clear all" leave a filter behind, that two
 * routes to the same view still produce the same URL, and that a page number survives exactly the
 * navigations it should and none of the ones it should not.
 */

const FULL: FinderQuery = {
  category: "base-oils",
  segment: "marine",
  productType: "engine-oils",
  q: "15w-40",
  page: FIRST_PAGE,
};

describe("reading the query off the URL", () => {
  it("reads all three axes and the search term", () => {
    expect(
      readFinderQuery({
        category: "base-oils",
        segment: "marine",
        productType: "engine-oils",
        q: "15w-40",
      }),
    ).toEqual(FULL);
  });

  it("reads the page alongside them", () => {
    expect(readFinderQuery({ productType: "greases", page: "3" })).toEqual({
      ...NO_FILTERS,
      productType: "greases",
      page: 3,
    });
  });

  it("treats absent, blank and repeated values alike — as no filter", () => {
    expect(
      readFinderQuery({
        productType: "   ",
        segment: ["a", "b"],
      }),
    ).toEqual(NO_FILTERS);
  });

  /**
   * The slug is passed through unchecked on purpose: whether it resolves is the API's answer (400
   * naming the field), and a second authority in front of that contract would turn one clear
   * rejection into two disagreeing ones.
   */
  it("passes an unknown product type through rather than filtering it out", () => {
    expect(readFinderQuery({ productType: "not-a-type" }).productType).toBe("not-a-type");
  });
});

describe("hasFilters", () => {
  it("is false only for the unfiltered view", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });

  it.each(["category", "segment", "productType", "q"] as const)(
    "is true when only %s is set",
    (axis) => {
      expect(hasFilters({ ...NO_FILTERS, [axis]: "x" })).toBe(true);
    },
  );

  /**
   * A page is a position in a result, not a narrowing of one. Counting it here would offer "Clear
   * search and filters" to a visitor on page 2 of the unfiltered catalog, naming two things that
   * are not in force — and would make the empty catalog report itself as an empty selection.
   */
  it("is false on a later page of an unfiltered list", () => {
    expect(hasFilters({ ...NO_FILTERS, page: 4 })).toBe(false);
  });
});

/**
 * The page reader, which is the only part of this module that can be handed hostile input.
 *
 * A `?page=` arrives from a URL bar, a stale bookmark, a truncated link or a crawler, and every
 * shape that is not a plain positive integer has the same safe answer: page 1. The table is written
 * out rather than summarised because each row fails for a different reason, and three of them —
 * `"2e1"`, `"0x2"`, `"2abc"` — are shapes `Number()` or `parseInt` would have silently accepted as
 * some other page entirely.
 */
describe("reading the page", () => {
  it.each([
    ["2", 2],
    ["1", FIRST_PAGE],
    ["007", 7],
    ["  3  ", 3],
    ["9007199254740991", 9007199254740991],
  ])("reads %s as page %s", (raw, expected) => {
    expect(readFinderPage(raw)).toBe(expected);
  });

  it.each([
    ["absent", undefined],
    ["blank", ""],
    ["whitespace", "   "],
    ["repeated", ["2", "3"]],
    ["zero", "0"],
    ["negative", "-1"],
    ["signed", "+2"],
    ["decimal", "2.0"],
    ["exponential", "2e1"],
    ["hexadecimal", "0x2"],
    ["trailing junk", "2abc"],
    ["non-numeric", "abc"],
    ["past MAX_SAFE_INTEGER", "9007199254740993"],
  ])("normalizes %s to the first page", (_label, raw) => {
    expect(readFinderPage(raw as string | string[] | undefined)).toBe(FIRST_PAGE);
  });

  it("never returns a value the rest of the module has to re-check", () => {
    for (const raw of ["0", "-1", "abc", "2", "1e400", "999999999999999999999"]) {
      const page = readFinderPage(raw);

      expect(Number.isSafeInteger(page)).toBe(true);
      expect(page).toBeGreaterThanOrEqual(FIRST_PAGE);
    }
  });
});

describe("building the href", () => {
  it("omits every null axis, so the unfiltered view is the bare path", () => {
    expect(finderHref("en", NO_FILTERS)).toBe(finderPath("en"));
    expect(finderHref("en", NO_FILTERS)).toBe("/en/products/finder");
  });

  it("emits the axes in one fixed order whatever order they were set in", () => {
    const built = finderHref("fa", { ...NO_FILTERS, q: "x", productType: "greases" });
    const rebuilt = finderHref("fa", { ...NO_FILTERS, productType: "greases", q: "x" });

    expect(built).toBe(rebuilt);
    expect(built).toBe("/fa/products/finder?productType=greases&q=x");
  });

  it("carries all three axes together", () => {
    expect(finderHref("ar", FULL)).toBe(
      "/ar/products/finder?category=base-oils&segment=marine&productType=engine-oils&q=15w-40",
    );
  });

  /**
   * The regression a third axis invites: a "clear all" built from a literal rather than from
   * `NO_FILTERS` keeps whichever axis the literal forgot. `results.tsx` had exactly that shape.
   */
  it("clears every axis, leaving nothing behind", () => {
    expect(finderHref("en", NO_FILTERS)).not.toContain("?");
  });

  it("round-trips through the reader", () => {
    const href = finderHref("en", FULL);
    const params = Object.fromEntries(new URL(href, "https://example.test").searchParams);

    expect(readFinderQuery(params)).toEqual(FULL);
  });

  /* --------------------------------------------------------------- the page */

  /**
   * Page 1 is written as no parameter at all. `?page=1` and no `page` are the same request, and a
   * canonical URL carrying it would put a position into every shared link, every chip and every
   * "clear all" on the first page of every result.
   */
  it("omits the page when it is the first one", () => {
    expect(finderHref("en", { ...NO_FILTERS, page: FIRST_PAGE })).toBe("/en/products/finder");
    expect(finderHref("en", { ...FULL, page: FIRST_PAGE })).not.toContain("page=");
  });

  it("writes the page last, after every axis", () => {
    expect(finderHref("ar", { ...FULL, page: 2 })).toBe(
      "/ar/products/finder?category=base-oils&segment=marine&productType=engine-oils&q=15w-40&page=2",
    );
  });

  it("round-trips a later page through the reader", () => {
    const href = finderHref("en", { ...FULL, page: 12 });
    const params = Object.fromEntries(new URL(href, "https://example.test").searchParams);

    expect(readFinderQuery(params)).toEqual({ ...FULL, page: 12 });
  });

  /** A redundant page in the URL comes back canonical: `?page=007` is emitted again as `page=7`. */
  it("re-emits a redundantly written page canonically", () => {
    expect(finderHref("en", readFinderQuery({ page: "007" }))).toBe("/en/products/finder?page=7");
  });
});

/**
 * The two link builders, and the one difference between them that the whole design rests on.
 *
 * `filterHref` changes what is being selected and therefore drops the page; `pageHref` moves within
 * a selection and therefore keeps everything else. A single function used for both would be correct
 * for one caller and quietly wrong for the other.
 */
describe("filterHref resets the page", () => {
  const onPageFour: FinderQuery = { ...FULL, page: 4 };

  it.each(["category", "segment", "productType"] as const)(
    "drops the page when the %s chip changes",
    (axis) => {
      expect(filterHref("en", onPageFour, { [axis]: "something-else" })).not.toContain("page=");
    },
  );

  it("drops the page when a row is cleared to All", () => {
    expect(filterHref("en", onPageFour, { productType: null })).toBe(
      "/en/products/finder?category=base-oils&segment=marine&q=15w-40",
    );
  });

  it("drops the page when everything is cleared", () => {
    expect(filterHref("en", onPageFour, NO_FILTERS)).toBe("/en/products/finder");
  });

  it("keeps every axis it was not asked to change", () => {
    expect(filterHref("en", onPageFour, { segment: "industry" })).toBe(
      "/en/products/finder?category=base-oils&segment=industry&productType=engine-oils&q=15w-40",
    );
  });

  /** A caller cannot smuggle a page through the patch — that is what `pageHref` is for. */
  it("overrides a page supplied in the patch", () => {
    expect(filterHref("en", onPageFour, { page: 9 })).not.toContain("page=");
  });
});

describe("pageHref keeps the selection", () => {
  it("carries every axis and the search term to another page", () => {
    expect(pageHref("en", FULL, 3)).toBe(
      "/en/products/finder?category=base-oils&segment=marine&productType=engine-oils&q=15w-40&page=3",
    );
  });

  it("returns to the bare selection when it moves back to page 1", () => {
    expect(pageHref("en", { ...FULL, page: 6 }, FIRST_PAGE)).toBe(
      "/en/products/finder?category=base-oils&segment=marine&productType=engine-oils&q=15w-40",
    );
  });

  it("round-trips: paging forward then back is the URL it started from", () => {
    const start = { ...NO_FILTERS, productType: "engine-oils" };
    const forward = pageHref("en", start, 2);
    const back = pageHref("en", readFinderQuery(paramsOf(forward)), FIRST_PAGE);

    expect(back).toBe(finderHref("en", start));
  });
});

/** One built href, read back as the `searchParams` record the route would hand the reader. */
function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "https://example.test").searchParams);
}

/**
 * The registry mirrors persisted reference data, and ADR-020 §1 is what says which rows.
 *
 * An earlier draft of this block asserted only shape — eight entries, each with a slug and a
 * non-empty name — on the grounds that which types exist is `sam_platform`'s to say. That is right
 * about the database and wrong about this file: ADR-020 **closed the set** on 31 August 2026, so a
 * ninth entry, a renamed display name or a re-slugged one is not a mirror drifting from its source
 * but an edit past an owner decision, and the whole point of a closed set is that adding to it
 * fails somewhere. The eight pairs are transcribed from the ADR's own table.
 */
describe("the Product Type registry", () => {
  it("holds exactly the eight ADR-020 §1 slugs and display names", () => {
    expect(PRODUCT_TYPES.map((type) => [type.slug, type.name])).toEqual([
      ["antifreeze-coolants", "Antifreeze Coolants"],
      ["engine-oils", "Engine Oils"],
      ["gear-oils", "Gear Oils"],
      ["greases", "Greases"],
      ["hydraulic-oils", "Hydraulic Oils"],
      ["industrial-oils", "Industrial Oils"],
      ["lubricant-additives", "Lubricant Additives"],
      ["marine-oils", "Marine Oils"],
    ]);
  });

  it("keeps every slug in the shape a URL and a database key share", () => {
    for (const type of PRODUCT_TYPES) {
      expect(type.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/u);
      expect(type.name.trim()).not.toBe("");
    }
  });

  /**
   * `null`, never the slug. The finder's selection sentence is built from approved names only, and
   * a lookup that answered with its argument would quietly turn a hand-typed `?productType=` into
   * rendered copy — in a locale where even the approved names are unapproved in translation.
   */
  it("answers null for a slug outside the approved set", () => {
    expect(productTypeName("engine-oils")).toBe("Engine Oils");
    expect(productTypeName("not-a-type")).toBeNull();
  });

  it("has no duplicate slug", () => {
    const slugs = PRODUCT_TYPES.map((type) => type.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /**
   * The two axes are independent vocabularies against different columns. A slug appearing in both
   * would not break anything, but it would mean one of the registries had been edited to look like
   * the other rather than copied from its own source.
   */
  it("is a separate vocabulary from Segment", () => {
    const segmentSlugs = new Set(SEGMENTS.map((segment) => segment.slug));

    expect(PRODUCT_TYPES.filter((type) => segmentSlugs.has(type.slug))).toEqual([]);
  });
});
