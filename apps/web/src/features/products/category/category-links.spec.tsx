import { describe, expect, it } from "vitest";

import { hrefsIn, idsIn, localeEscapees, renderHtml } from "@test/rendered-links";

import { ROUTES } from "@/features/site/site-routes";

import { FAMILIES } from "../products-data";

import { actionHref, type RouteId } from "./category-contract";
import { getCategoryContent, publishedCategorySlugs } from "./data";
import { CategoryApplications } from "./sections/applications";
import { CategoryDocumentation } from "./sections/documentation";
import { CategoryFaq } from "./sections/faq";
import { CategoryHero } from "./sections/hero";
import { CategoryQuality } from "./sections/quality";
import { CategoryRangeSection } from "./sections/range";
import { CategoryRelated } from "./sections/related";
import { CategorySupply } from "./sections/supply";

import type { SectionProps } from "./category-section";

/**
 * NAV-2 — a Product Family page body preserves the route's locale.
 *
 * ## Two layers, because a fixture-driven page needs both
 *
 * One representative family (`base-oils`) is rendered in `fa` and asserted section by section. That
 * covers the shape of the page but only the route ids that one fixture happens to use, so
 * `actionHref` is asserted separately across **every** `RouteId` — including the two no fixture
 * reaches. A family page's actions are chosen by editorial data, and a route id that is correct
 * only because nothing selects it is not correct.
 *
 * The catalog section is absent from this spec on purpose: it is an async Server Component behind a
 * Suspense boundary whose links already went through `filterHref(locale, …)` before NAV-2 and were
 * never part of the defect.
 */

const FAMILY_SLUG = "base-oils";

function propsFor(locale: string, slug = FAMILY_SLUG): SectionProps {
  const content = getCategoryContent(slug);
  const family = FAMILIES.find((entry) => entry.id === slug);

  if (!content || !family) throw new Error(`No fixture for "${slug}"`);

  return { content, family, locale };
}

/** The linking sections of a Family page body, rendered as one surface. */
function familyBody(locale: string, slug = FAMILY_SLUG): string {
  const props = propsFor(locale, slug);

  return [
    renderHtml(<CategoryHero {...props} />),
    renderHtml(<CategoryRangeSection {...props} />),
    renderHtml(<CategoryQuality {...props} />),
    renderHtml(<CategoryApplications {...props} />),
    renderHtml(<CategorySupply {...props} />),
    renderHtml(<CategoryDocumentation {...props} />),
    renderHtml(<CategoryFaq {...props} />),
    renderHtml(<CategoryRelated {...props} />),
  ].join("");
}

describe("a Family page body addresses every route in the reader's locale", () => {
  it("emits no internal link outside /fa", () => {
    expect(localeEscapees(familyBody("fa"), "fa")).toEqual([]);
  });

  it("emits no internal link outside its locale for any of the six families", () => {
    for (const slug of publishedCategorySlugs()) {
      expect(localeEscapees(familyBody("ar", slug), "ar")).toEqual([]);
    }
  });

  it("points the breadcrumb at the Products landing in this locale", () => {
    expect(hrefsIn(renderHtml(<CategoryHero {...propsFor("fa")} />))).toContain("/fa/products");
  });

  it("carries the locale into both hero actions", () => {
    const hrefs = hrefsIn(renderHtml(<CategoryHero {...propsFor("fa")} />));

    expect(hrefs).toContain("/fa/contact-us/request-a-quote");
    expect(hrefs).toContain("/fa/contact-us");
  });

  it("carries the locale into the quality footnote action", () => {
    expect(hrefsIn(renderHtml(<CategoryQuality {...propsFor("fa")} />))).toEqual([
      "/fa/quality-certifications",
    ]);
  });

  it("carries the locale into the FAQ actions", () => {
    const hrefs = hrefsIn(renderHtml(<CategoryFaq {...propsFor("fa")} />));

    expect(hrefs).toContain("/fa/contact-us");
    expect(hrefs).toContain("/fa/customized-solutions");
  });

  it("keeps the documentation pointer on its canonical page, fragment intact", () => {
    expect(hrefsIn(renderHtml(<CategoryDocumentation {...propsFor("fa")} />))).toEqual([
      "/fa/products#documentation",
    ]);
  });

  it("points related-all at the Products landing and every sibling at its own page", () => {
    const hrefs = hrefsIn(renderHtml(<CategoryRelated {...propsFor("fa")} />));

    expect(hrefs[0]).toBe("/fa/products");

    const siblings = FAMILIES.filter((family) => family.id !== FAMILY_SLUG);

    expect(siblings).toHaveLength(5);

    for (const family of siblings) {
      expect(hrefs).toContain(`/fa/products/${family.id}`);
    }

    expect(hrefs).not.toContain(`/fa/products/${FAMILY_SLUG}`);
  });

  it("carries the locale into the downstream family links", () => {
    const hrefs = hrefsIn(renderHtml(<CategoryApplications {...propsFor("fa")} />)).filter((href) =>
      href.startsWith("/"),
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      expect(href).toMatch(/^\/fa\/products\/[a-z-]+$/);
    }
  });
});

describe("Export & Logistics — locale fixed, destination still missing", () => {
  /*
   * `ROUTES.exportLogistics` is in the canonical route table and no route implements it, so this
   * link resolves to a 404. NAV-2 fixes only which locale that 404 happens in; the CTA is not
   * suppressed, not rewritten and not pointed anywhere else, because all three would be content
   * decisions. See the gate report's deferred items.
   */
  it("addresses the missing route in the reader's locale rather than re-negotiating it", () => {
    expect(hrefsIn(renderHtml(<CategorySupply {...propsFor("fa")} />))).toEqual([
      "/fa/export-logistics",
    ]);
    expect(actionHref("fa", "exportLogistics")).toBe(`/fa${ROUTES.exportLogistics}`);
  });
});

describe("actionHref covers every route id, not only the ones a fixture selects", () => {
  const EXPECTED: Readonly<Record<RouteId, string>> = {
    quote: "/fa/contact-us/request-a-quote",
    sample: "/fa/contact-us",
    customization: "/fa/customized-solutions",
    finder: "/fa/products/finder",
    quality: "/fa/quality-certifications",
    exportLogistics: "/fa/export-logistics",
    products: "/fa/products",
  };

  it("resolves each id to its canonical path in the given locale", () => {
    for (const [route, href] of Object.entries(EXPECTED)) {
      expect(actionHref("fa", route as RouteId)).toBe(href);
    }
  });

  it("is idempotent, so no composition can produce /fa/fa", () => {
    for (const route of Object.keys(EXPECTED) as RouteId[]) {
      const once = actionHref("fa", route);

      expect(once.startsWith("/fa/fa")).toBe(false);
    }
  });
});

describe("the range fragments survive, and still land somewhere", () => {
  it("leaves #range-* unprefixed and lands each one on a rendered id", () => {
    const props = propsFor("fa");
    const linking = [
      renderHtml(<CategoryHero {...props} />),
      renderHtml(<CategoryApplications {...props} />),
    ].join("");
    const ids = new Set(idsIn(renderHtml(<CategoryRangeSection {...props} />)));

    const fragments = hrefsIn(linking).filter((href) => href.startsWith("#"));

    expect(fragments.length).toBeGreaterThan(0);

    for (const fragment of fragments) {
      expect(fragment.startsWith("#range-")).toBe(true);
      expect(ids.has(fragment.slice(1))).toBe(true);
    }
  });
});

describe("the fixtures keep their keys", () => {
  it("still publishes the six canonical family slugs, unchanged", () => {
    expect([...publishedCategorySlugs()].sort()).toEqual(
      FAMILIES.map((family) => family.id).sort(),
    );
  });
});
