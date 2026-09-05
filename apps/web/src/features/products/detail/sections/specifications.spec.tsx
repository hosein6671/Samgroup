import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hrefsIn, renderHtml } from "@test/rendered-links";

import { ProductSpecifications } from "./specifications";

import type { ProductSpecificationResponse } from "@sam-group/types";

/**
 * The empty-state hardening gate: `specifications.length === 0` must render a real, restrained
 * "under review" panel — not nothing, and not anything that could be mistaken for the separate
 * API-failure page (`ProductUnavailable`).
 */

const PUBLISHED_SPEC: ProductSpecificationResponse = {
  id: "spec-1",
  key: "Viscosity, 40°C",
  value: "15.3",
  unit: "mm²/s",
  method: "ASTM D445",
  qualifier: null,
  resultBasis: "typical",
  valueType: "point",
  numericMin: "15.3",
  numericMax: null,
  pairFirst: null,
  pairSecond: null,
  grade: null,
};

describe("ProductSpecifications — empty dataset", () => {
  const html = renderHtml(<ProductSpecifications specifications={[]} />);

  it("renders the 'Technical data' heading and the 'under review' status line", () => {
    expect(html).toContain("Technical data");
    expect(html).toContain("Technical data is under review.");
  });

  it("still exposes the #specifications anchor a page link can land on", () => {
    expect(html).toContain('id="specifications"');
  });

  it("renders a status icon, marked decorative to assistive technology", () => {
    expect(html).toContain("<svg");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("renders no table, no card list, and no placeholder rows", () => {
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<dl>");
    expect(html).not.toContain("<tbody");
  });

  it("offers no PDF or download action", () => {
    expect(hrefsIn(html)).toEqual([]);
    expect(html.toLowerCase()).not.toContain("pdf");
    expect(html.toLowerCase()).not.toContain("download");
  });

  it("names no other manufacturer or source", () => {
    // The internal research register cites these sources; none may ever reach a public panel.
    for (const name of ["Wolf", "BASF", "Glysantin", "ADNOC", "Afzoon"]) {
      expect(html).not.toContain(name);
    }
  });

  it("invents no numeric value, grade, or unit", () => {
    // Text content only — tags stripped, since class names like `fs-d2` and `pd-specs` are not
    // specification values and would otherwise produce a false positive.
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).not.toMatch(/\d/);
  });
});

describe("ProductSpecifications — published dataset", () => {
  const html = renderHtml(<ProductSpecifications specifications={[PUBLISHED_SPEC]} />);

  it("renders the populated heading and the real table, not the empty-state panel", () => {
    expect(html).toContain("Published values");
    expect(html).toContain("<table");
    expect(html).not.toContain("Technical data is under review.");
  });

  it("prints the row's key, value and unit verbatim", () => {
    expect(html).toContain("Viscosity, 40°C");
    expect(html).toContain("15.3");
    expect(html).toContain("mm²/s");
  });
});

describe("the empty-dataset state stays a separate code path from an API failure", () => {
  /*
   * `ProductUnavailable` renders `SiteNav`, a Client Component that reads `usePathname()` — real
   * outside a Next.js request context, so rendering it through `renderToStaticMarkup` here would
   * assert nothing about this gate and only exercise an unrelated crash. The separation this test
   * cares about is structural (two components neither one reaches the other, on two branches of
   * `app/[locale]/products/[slug]/page.tsx`), so it is checked at the source, the same way
   * `icons.spec.ts` checks the wizard icon set's contract without mounting it.
   */
  const pendingHtml = renderHtml(<ProductSpecifications specifications={[]} />);
  const unavailableSource = readFileSync(join(__dirname, "..", "product-unavailable.tsx"), "utf8");
  const specificationsSource = readFileSync(join(__dirname, "specifications.tsx"), "utf8");
  const routePageSource = readFileSync(
    join(__dirname, "..", "..", "..", "..", "app", "[locale]", "products", "[slug]", "page.tsx"),
    "utf8",
  );

  it("the empty-dataset panel never states or implies a service outage", () => {
    expect(pendingHtml).not.toContain("cannot be shown");
    expect(pendingHtml).not.toContain("catalog service did not answer");
    expect(pendingHtml).not.toContain("Catalog unavailable");
  });

  it("neither component imports the other", () => {
    // The doc comment on `SpecificationsPending` names `ProductUnavailable` deliberately, to
    // record the boundary in prose — an `import` statement is the thing that would actually wire
    // one component into the other, so that is what this checks.
    expect(unavailableSource).not.toMatch(/^import .*specifications/m);
    expect(specificationsSource).not.toMatch(/^import .*product-unavailable/m);
  });

  it("the unavailable page never carries the empty-dataset panel's wording", () => {
    expect(unavailableSource).not.toContain("Technical data is under review.");
  });

  it("the route mounts them on two separate branches, never both", () => {
    expect(routePageSource).toContain("<ProductDetailTemplate");
    expect(routePageSource).toContain("<ProductUnavailable");

    const templateIndex = routePageSource.indexOf("<ProductDetailTemplate");
    const unavailableIndex = routePageSource.indexOf("<ProductUnavailable");

    expect(templateIndex).toBeGreaterThan(-1);
    expect(unavailableIndex).toBeGreaterThan(-1);
    expect(templateIndex).not.toBe(unavailableIndex);
  });
});
