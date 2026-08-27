import { describe, expect, it } from "vitest";

import { hrefsIn, idsIn, localeEscapees, renderHtml } from "@test/rendered-links";

import { PRODUCT_CATEGORIES } from "@/features/site/site-routes";

import { FAMILIES } from "./products-data";
import { ClosingCta } from "./sections/closing-cta";
import { Documentation } from "./sections/documentation";
import { FinderTeaser } from "./sections/finder-teaser";
import { ProductsHero } from "./sections/hero";
import { ProductRegister } from "./sections/register";

/**
 * NAV-2 — the Products landing body preserves the route's locale.
 *
 * Rendered in `ar` throughout. The landing page is the surface where locale loss was most visible:
 * six family links, two Finder links and three closing routes all resolved through constants that
 * carry no locale, so every one of them left the reader's language to `middleware.ts` to guess.
 *
 * The register's `#family-*` rail is asserted to have survived unprefixed, because a fragment that
 * acquired a locale prefix would stop being a fragment.
 */

/** The Products landing body, rendered as one surface. */
function landingBody(locale: string): string {
  return [
    renderHtml(<ProductsHero locale={locale} />),
    renderHtml(<ProductRegister locale={locale} />),
    renderHtml(<FinderTeaser locale={locale} />),
    renderHtml(<Documentation locale={locale} />),
    renderHtml(<ClosingCta locale={locale} />),
  ].join("");
}

describe("the Products landing body addresses every route in the reader's locale", () => {
  it("emits no internal link outside /ar", () => {
    expect(localeEscapees(landingBody("ar"), "ar")).toEqual([]);
  });

  it("routes all six families to their canonical page in this locale", () => {
    const hrefs = hrefsIn(renderHtml(<ProductRegister locale="ar" />));

    for (const family of FAMILIES) {
      expect(hrefs).toContain(`/ar/products/${family.id}`);
    }

    expect(hrefs.filter((href) => href.startsWith("/ar/products/"))).toHaveLength(6);
  });

  it("carries the locale into both Finder links", () => {
    expect(hrefsIn(renderHtml(<ProductsHero locale="ar" />))).toContain("/ar/products/finder");
    expect(hrefsIn(renderHtml(<FinderTeaser locale="ar" />))).toEqual(["/ar/products/finder"]);
  });

  it("carries the locale into Request a Quote", () => {
    expect(hrefsIn(renderHtml(<ProductsHero locale="ar" />))).toContain(
      "/ar/contact-us/request-a-quote",
    );
  });

  it("carries the locale into Customized Solutions and every closing route", () => {
    expect(hrefsIn(renderHtml(<ClosingCta locale="ar" />))).toEqual([
      "/ar/customized-solutions",
      "/ar/products/finder",
      "/ar/contact-us",
      "/ar/contact-us/request-a-quote",
    ]);
  });
});

describe("the taxonomy fixture stays locale-less", () => {
  /*
   * `FAMILIES[].href` is the canonical `/products/{slug}`, and `products-data.ts` already fails at
   * module load if it ever disagrees with `PRODUCT_CATEGORIES`. Storing an address there instead
   * would mean three fixtures for three locales and would break that invariant on the first one.
   */
  it("keeps FAMILIES and PRODUCT_CATEGORIES on structural paths", () => {
    for (const family of FAMILIES) {
      expect(family.href).toBe(`/products/${family.id}`);
    }

    for (const category of PRODUCT_CATEGORIES) {
      expect(category.href).toBe(`/products/${category.key}`);
    }
  });
});

describe("the register's jump rail is still a set of fragments", () => {
  it("leaves #family-* unprefixed and lands each one on a rendered id", () => {
    const body = landingBody("ar");
    const fragments = hrefsIn(body).filter((href) => href.startsWith("#"));
    const ids = new Set(idsIn(body));

    expect(fragments).toHaveLength(FAMILIES.length * 2);

    for (const family of FAMILIES) {
      expect(fragments).toContain(`#family-${family.id}`);
      expect(ids.has(`family-${family.id}`)).toBe(true);
    }
  });
});
