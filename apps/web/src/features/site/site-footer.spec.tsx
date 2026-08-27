import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALE_CODES } from "@test/active-locales";
import { accessibleName, findLinks, findTags, textOf } from "@test/element-tree";

import { SiteFooter } from "./site-footer";
import { PRODUCT_CATEGORIES, ROUTES } from "./site-routes";

/**
 * The footer, actually rendered.
 *
 * `SiteFooter` is a Server Component with no hooks, so `@test/element-tree` expands it for real and
 * these assertions read the tree the browser would receive — every `href`, in every locale. That is
 * the difference between this file and `site-routes.spec.ts`, which tests the model the header maps
 * over because the header itself cannot be rendered in a `node` environment (see its note).
 *
 * `next/link` survives expansion carrying its `href`, which is what `findLinks` matches on.
 */

const hrefsIn = (locale: string): string[] =>
  findLinks(SiteFooter({ locale })).map((link) => link.props.href as string);

describe("SiteFooter", () => {
  it("locale-prefixes every link it renders, in every active locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const hrefs = hrefsIn(code);

      expect(hrefs.length).toBeGreaterThan(0);

      for (const href of hrefs) {
        expect(href.startsWith(`/${code}`)).toBe(true);
        // A second prefix would read `/en/en/...`.
        expect(href.startsWith(`/${code}/${code}`)).toBe(false);
      }
    }
  });

  it("sends the brand mark to the locale's home page, not to `#top`", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const brand = findLinks(SiteFooter({ locale: code })).find(
        (link) => accessibleName(link) === "Sam Group — home",
      );

      expect(brand).toBeDefined();
      expect(brand?.props.href).toBe(`/${code}`);
    }
  });

  it("sends the Products column to the six canonical Family routes, in the locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const hrefs = hrefsIn(code);

      for (const family of PRODUCT_CATEGORIES) {
        expect(hrefs).toContain(`/${code}/products/${family.key}`);
      }
    }
  });

  it("renders the Family labels the canonical table publishes, and invents none", () => {
    const names = findLinks(SiteFooter({ locale: "en" })).map((link) => accessibleName(link));

    for (const family of PRODUCT_CATEGORIES) {
      expect(names).toContain(family.label);
    }

    for (const invented of ["Lubricants", "Industrial fluids", "Automotive", "Specialty"]) {
      expect(names).not.toContain(invented);
    }
  });

  it("sends Contact to the locale's Contact Us route", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(hrefsIn(code)).toContain(`/${code}${ROUTES.contactUs}`);
    }
  });

  it("keeps About Us in the Company column in every locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(hrefsIn(code)).toContain(`/${code}${ROUTES.aboutUs}`);
    }
  });

  it("renders no fragment-only address anywhere — no `#top`, no `#products`", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      for (const href of hrefsIn(code)) {
        expect(href.startsWith("#")).toBe(false);
        expect(href).not.toBe("#top");
        expect(href).not.toBe("#products");
      }
    }
  });

  it("keeps its landmark and heading structure", () => {
    const tree = SiteFooter({ locale: "fa" });

    expect(findTags(tree, "footer")).toHaveLength(1);
    // Three column headings — Products, Company, Contact — and no <h1> in a footer.
    expect(findTags(tree, "h2").length).toBeGreaterThanOrEqual(3);
    expect(findTags(tree, "h1")).toHaveLength(0);
  });

  it("gives every link an accessible name", () => {
    for (const link of findLinks(SiteFooter({ locale: "ar" }))) {
      expect(accessibleName(link).trim().length).toBeGreaterThan(0);
    }
  });

  it("still publishes no contact fact and no certification claim", () => {
    // The launch-safety cleanup that removed these is older than NAV-1; this asserts a link rewrite
    // did not quietly bring one back, in the visible text and in the addresses alike.
    const tree = SiteFooter({ locale: "en" });
    const surface = [textOf(tree), ...hrefsIn("en")].join(" | ");

    for (const forbidden of ["ISO ", "API licensed", "wa.me", "samgroup.example", "mailto:", "@"]) {
      expect(surface).not.toContain(forbidden);
    }
  });
});
