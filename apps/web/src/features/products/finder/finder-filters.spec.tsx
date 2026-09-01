import { describe, expect, it } from "vitest";

import { hrefsIn, renderHtml } from "@test/rendered-links";

import { PRODUCT_TYPES } from "../product-types-data";
import { FAMILIES } from "../products-data";
import { SEGMENTS } from "../segments-data";

import { FIRST_PAGE, NO_FILTERS, type FinderQuery } from "./finder-query";
import { FinderFilters } from "./sections/filters";

/**
 * The Finder's filter bar, with the Product Type axis ADR-020 §2 approved for this surface.
 *
 * ── What is worth asserting about a bar made of links ───────────────────────
 *
 * Not that eight chips exist — that is `PRODUCT_TYPES` restated. What a third axis can actually
 * break is **composition**: a chip that drops another axis, a hidden input that does not follow the
 * search field, and a "clear all" that leaves the newest axis in force. Each of those renders
 * perfectly and is wrong only in the URL it carries, which is precisely what a rendered-markup
 * assertion can see and a reader cannot.
 *
 * The bar ships no JavaScript, so the markup below is the whole interaction model.
 */

/** One filter state with every axis occupied, so a dropped axis has somewhere to be dropped from. */
const FULL: FinderQuery = {
  category: "base-oils",
  segment: "marine",
  productType: "gear-oils",
  q: "15w-40",
  page: FIRST_PAGE,
};

function markup(query: FinderQuery, locale = "en"): string {
  return renderHtml(<FinderFilters locale={locale} query={query} />);
}

const BASE = "/en/products/finder";

describe("the Product Type row", () => {
  it("draws one chip per approved slug, and no ninth", () => {
    const html = markup(NO_FILTERS);

    for (const type of PRODUCT_TYPES) {
      expect(hrefsIn(html)).toContain(`/en/products/finder?productType=${type.slug}`);
    }

    const productTypeHrefs = hrefsIn(html).filter((href) => href.includes("productType="));

    expect(productTypeHrefs).toHaveLength(PRODUCT_TYPES.length);
  });

  it("labels each chip with the ADR-020 display name, verbatim", () => {
    const html = markup(NO_FILTERS);

    for (const type of PRODUCT_TYPES) {
      expect(html).toContain(`>${type.name}</a>`);
    }
  });

  /**
   * ADR-020's Non-Goals put "any translation of a Product Type name or slug" outside what is
   * approved, so `fa` and `ar` get the same English labels rather than an invented rendering. Only
   * the locale prefix on the href moves.
   */
  it.each(["fa", "ar"])(
    "keeps the approved English labels in %s, and only moves the prefix",
    (locale) => {
      const html = markup(NO_FILTERS, locale);

      for (const type of PRODUCT_TYPES) {
        expect(html).toContain(`>${type.name}</a>`);
        expect(hrefsIn(html)).toContain(`/${locale}/products/finder?productType=${type.slug}`);
      }

      expect(hrefsIn(html).every((href) => href.startsWith(`/${locale}/products/finder`))).toBe(
        true,
      );
    },
  );

  it("marks the active chip for the stylesheet and the screen reader together", () => {
    const html = markup({ ...NO_FILTERS, productType: "greases" });

    // One condition sets both attributes, so the count of each has to match the other.
    expect(html.match(/data-active="true"/g)).toHaveLength(3);
    expect(html.match(/aria-current="true"/g)).toHaveLength(3);
  });

  it("gives every row its own accessible name rather than one bar-wide label", () => {
    const html = markup(NO_FILTERS);

    expect(html).toContain('aria-label="Filter products by product family"');
    expect(html).toContain('aria-label="Filter products by segment"');
    expect(html).toContain('aria-label="Filter products by product type"');
  });
});

describe("selecting one axis preserves the others", () => {
  /**
   * The conjunctive semantics ADR-008 fixed in the API, kept in the interface. A chip that reset a
   * sibling axis would contradict the request it is about to issue.
   *
   * Asserted as whole URLs rather than as substrings, because a substring is exactly what fails to
   * tell two rows apart: the Family row's "All" chip also contains `segment=marine`, and a spec
   * that matched on that would pass while reading the wrong control. Each expected URL is a value a
   * different chip could not produce, and each names a value other than the active one, so it is a
   * real change of selection rather than the active chip pointing at itself.
   */
  it.each([
    {
      axis: "Product Type",
      href: `${BASE}?category=base-oils&segment=marine&productType=greases&q=15w-40`,
    },
    {
      axis: "Segment",
      href: `${BASE}?category=base-oils&segment=industry&productType=gear-oils&q=15w-40`,
    },
    {
      axis: "Family",
      href: `${BASE}?category=marine-oils-lubricants&segment=marine&productType=gear-oils&q=15w-40`,
    },
  ])("a $axis chip carries the other axes and the search term", ({ href }) => {
    expect(hrefsIn(markup(FULL))).toContain(href);
  });

  /** The per-axis "All" chip clears exactly one axis, which is what makes it not a second reset. */
  it.each([
    { axis: "Product Type", href: `${BASE}?category=base-oils&segment=marine&q=15w-40` },
    { axis: "Segment", href: `${BASE}?category=base-oils&productType=gear-oils&q=15w-40` },
    { axis: "Family", href: `${BASE}?segment=marine&productType=gear-oils&q=15w-40` },
  ])("the $axis All chip clears its own axis and nothing else", ({ href }) => {
    expect(hrefsIn(markup(FULL))).toContain(href);
  });
});

describe("the search field", () => {
  it("carries a hidden input for each active axis so a search keeps the chips", () => {
    const html = markup(FULL);

    expect(html).toContain('type="hidden" name="category" value="base-oils"');
    expect(html).toContain('type="hidden" name="segment" value="marine"');
    expect(html).toContain('type="hidden" name="productType" value="gear-oils"');
  });

  /**
   * An inactive axis contributes no input at all. A hidden field carrying `""` would put
   * `?productType=` into every URL the form produces — a parameter that is not a filter, in a URL
   * whose whole job is to be shared.
   */
  it("emits no hidden input for an inactive axis", () => {
    const html = markup({ ...NO_FILTERS, category: "base-oils" });

    expect(html).toContain('name="category"');
    expect(html).not.toContain('name="segment"');
    expect(html).not.toContain('name="productType"');
  });

  it("submits back to the finder's own path in the active locale", () => {
    expect(markup(NO_FILTERS, "fa")).toContain('action="/fa/products/finder"');
  });
});

describe("clear search and filters", () => {
  /**
   * The regression a third axis invites, and the one this file exists for: a reset built from a
   * literal keeps whichever axis the literal forgot, while still rendering as "clear".
   */
  it("returns to the bare path with no axis left behind", () => {
    const html = markup(FULL);

    expect(html).toContain('href="/en/products/finder">Clear search and filters');
  });

  it("is offered for any single active axis, including Product Type alone", () => {
    for (const axis of ["category", "segment", "productType", "q"] as const) {
      expect(markup({ ...NO_FILTERS, [axis]: "x" })).toContain("Clear search and filters");
    }
  });

  it("is absent on the unfiltered view, where it would have nothing to do", () => {
    expect(markup(NO_FILTERS)).not.toContain("Clear search and filters");
  });
});

/**
 * Every control in the bar resets the page, and none of them is exempt.
 *
 * This is asserted over the WHOLE bar rather than per control, because the failure it guards is a
 * single control that was built with the wrong helper. A chip carrying `?page=4` into a narrower
 * selection lands the visitor on page 4 of a one-page result, where the finder correctly reports
 * that the page does not exist — a dead end produced entirely by the interface.
 */
describe("changing the selection resets the page", () => {
  const onPageFour: FinderQuery = { ...FULL, page: 4 };

  it("emits no page on any href in the bar", () => {
    const carriesPage = hrefsIn(markup(onPageFour)).filter((href) => href.includes("page="));

    expect(carriesPage).toEqual([]);
  });

  it("still carries every axis, so only the page was dropped", () => {
    expect(hrefsIn(markup(onPageFour))).toContain(
      `${BASE}?category=base-oils&segment=marine&productType=greases&q=15w-40`,
    );
  });

  it("clears to the bare path from a later page", () => {
    expect(markup(onPageFour)).toContain('href="/en/products/finder">Clear search and filters');
  });

  /**
   * The search form resets by construction: a `GET` form submits its own controls and nothing else,
   * so a hidden `page` is the only way it could carry one — and there is none.
   */
  it("submits no page from the search field", () => {
    expect(markup(onPageFour)).not.toContain('name="page"');
  });
});

describe("the three vocabularies stay three", () => {
  /**
   * ADR-020 §3: Product Type does not replace or rename the six Product Families. `lubricant-additives`
   * and `antifreeze-coolants` name a Family and a Product Type alike, and the bar has to send them
   * as different parameters — a chip that sent the Family slug as `?productType=` would look
   * identical and filter on the wrong column.
   */
  it.each(["lubricant-additives", "antifreeze-coolants"])(
    "sends %s as both a family and a product type, on different parameters",
    (slug) => {
      const html = markup(NO_FILTERS);

      expect(FAMILIES.some((family) => family.id === slug)).toBe(true);
      expect(PRODUCT_TYPES.some((type) => type.slug === slug)).toBe(true);

      expect(hrefsIn(html)).toContain(`/en/products/finder?category=${slug}`);
      expect(hrefsIn(html)).toContain(`/en/products/finder?productType=${slug}`);
    },
  );

  it("draws every axis exactly once, with its own All chip", () => {
    const html = markup(NO_FILTERS);
    const rows = FAMILIES.length + SEGMENTS.length + PRODUCT_TYPES.length;

    // Three "All" chips, one per row, and one chip per vocabulary entry.
    expect(hrefsIn(html)).toHaveLength(rows + 3);
  });
});
