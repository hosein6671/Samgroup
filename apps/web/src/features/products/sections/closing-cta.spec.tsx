import { describe, expect, it } from "vitest";

import { hrefsIn, renderHtml } from "@test/rendered-links";

import { ClosingCta } from "./closing-cta";

/**
 * NAV-2 — the shared closing CTA, in both of its branches.
 *
 * ## The defect this pins
 *
 * The section used to take an optional `context` that carried the locale **beside** the product,
 * which made the locale optional in practice. The Products landing and the six Family pages passed
 * nothing and got four locale-less hrefs; and even a Product Detail page, which did pass a context,
 * got a locale-less Finder link, because `hrefFor` returned before the prefix was applied.
 *
 * `locale` is now a required prop and the prefix is applied before the branch, so both halves are
 * asserted here: what the section emits with a product, and what it emits without one.
 */

describe("without a product — the Products landing and the six Family pages", () => {
  it("addresses all four routes in the reader's locale", () => {
    expect(hrefsIn(renderHtml(<ClosingCta locale="fa" />))).toEqual([
      "/fa/customized-solutions",
      "/fa/products/finder",
      "/fa/contact-us",
      "/fa/contact-us/request-a-quote",
    ]);
  });

  it("adds no product query when there is no product", () => {
    for (const href of hrefsIn(renderHtml(<ClosingCta locale="fa" />))) {
      expect(href).not.toContain("?");
    }
  });
});

describe("with a product — a Product Detail page", () => {
  const detail = (locale: string, productSlug: string): string[] =>
    hrefsIn(renderHtml(<ClosingCta locale={locale} productSlug={productSlug} />));

  it("keeps the Finder locale-prefixed and free of the product", () => {
    const hrefs = detail("fa", "sn-500");

    expect(hrefs).toContain("/fa/products/finder");
    expect(hrefs.filter((href) => href.includes("finder"))).toEqual(["/fa/products/finder"]);
  });

  it("carries the product into the two inquiry routes, exactly as before", () => {
    expect(detail("fa", "sn-500")).toEqual([
      "/fa/customized-solutions",
      "/fa/products/finder",
      "/fa/contact-us?type=sample_request&product=sn-500",
      "/fa/contact-us/request-a-quote?product=sn-500",
    ]);
  });

  it("still encodes a slug that needs encoding", () => {
    expect(detail("ar", "group iii/+")).toEqual([
      "/ar/customized-solutions",
      "/ar/products/finder",
      "/ar/contact-us?type=sample_request&product=group%20iii%2F%2B",
      "/ar/contact-us/request-a-quote?product=group%20iii%2F%2B",
    ]);
  });

  it("never doubles the locale prefix", () => {
    for (const href of detail("en", "sn-500")) {
      expect(href.startsWith("/en/en")).toBe(false);
    }
  });
});
