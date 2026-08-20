import { describe, expect, it } from "vitest";

import { hrefsIn, idsIn, isInternalPath, localeEscapees, renderHtml } from "@test/rendered-links";

import { CTA_LINKS } from "./home-data";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Insights } from "./sections/insights";
import { Lab } from "./sections/lab";
import { Partnership } from "./sections/partnership";

/**
 * NAV-2 — the homepage body preserves the route's locale.
 *
 * ## What these tests prove
 *
 * Every internal link the homepage body emits is addressed in the locale the page was rendered in,
 * and every fragment it keeps still lands on an id the page actually renders. They are written
 * against **rendered markup** rather than against props, because four of the five sections below
 * are `"use client"` canvas sections that a synchronous tree walk cannot render at all.
 *
 * ## What they do not prove
 *
 * Not contrast, not focus order, not target size — those need a browser and are reported from the
 * gate's own runtime pass. Not `middleware.ts`'s behaviour either: these assert that no request for
 * a re-negotiation is emitted, which is upstream of whatever the middleware would have done with
 * one.
 *
 * `fa` is the render locale throughout, deliberately: a bug that prefixed everything with the
 * default `en` would pass a spec written in `en` and fail this one.
 */

/** The homepage body sections that emit a link, rendered as one surface. */
function homeBody(locale: string): string {
  return [
    renderHtml(<Hero />),
    renderHtml(<Ecosystem />),
    renderHtml(<Lab />),
    renderHtml(<Insights locale={locale} />),
    renderHtml(<Partnership locale={locale} />),
  ].join("");
}

describe("the homepage body addresses every route in the reader's locale", () => {
  it("emits no internal link outside /fa", () => {
    expect(localeEscapees(homeBody("fa"), "fa")).toEqual([]);
  });

  it("points the editorial action at the Insights index in this locale", () => {
    expect(hrefsIn(renderHtml(<Insights locale="fa" />))).toEqual(["/fa/insights"]);
  });

  it("carries the locale into all three closing routes and both panel actions", () => {
    const hrefs = hrefsIn(renderHtml(<Partnership locale="fa" />));

    expect(hrefs).toEqual([
      "/fa/contact-us",
      "/fa/contact-us/request-a-quote",
      "/fa/products#documentation",
      "/fa/contact-us",
      "/fa/contact-us/request-a-quote",
    ]);
  });

  it("keeps the documentation link on its canonical page, fragment intact", () => {
    expect(hrefsIn(renderHtml(<Partnership locale="ar" />))).toContain(
      "/ar/products#documentation",
    );
  });

  it("prefixes the same six links differently in a different locale", () => {
    const fa = hrefsIn(homeBody("fa")).filter(isInternalPath);
    const ar = hrefsIn(homeBody("ar")).filter(isInternalPath);

    expect(fa).toHaveLength(6);
    expect(ar).toEqual(fa.map((href) => href.replace("/fa/", "/ar/")));
  });
});

describe("the fixture stays locale-less", () => {
  /*
   * The half of the decision that a render assertion cannot see. `CTA_LINKS` is static content, and
   * a locale stored in it would be per-request state in a module constant — three copies of the
   * same three links, and a fourth locale unable to reuse any of them.
   */
  it("stores structural paths in CTA_LINKS, never addresses", () => {
    for (const link of CTA_LINKS) {
      expect(link.href.startsWith("/en")).toBe(false);
      expect(link.href.startsWith("/fa")).toBe(false);
      expect(link.href.startsWith("/ar")).toBe(false);
    }

    expect(CTA_LINKS.map((link) => link.href)).toEqual([
      "/contact-us",
      "/contact-us/request-a-quote",
      "/products#documentation",
    ]);
  });
});

describe("the same-page fragments survive, and still land somewhere", () => {
  it("leaves #products and #partnership unprefixed", () => {
    const fragments = hrefsIn(homeBody("fa")).filter((href) => href.startsWith("#"));

    expect(new Set(fragments)).toEqual(new Set(["#products", "#partnership"]));
  });

  it("renders an id for every fragment the body links to", () => {
    const body = homeBody("fa");
    const ids = new Set(idsIn(body));

    for (const fragment of hrefsIn(body).filter((href) => href.startsWith("#"))) {
      expect(ids.has(fragment.slice(1))).toBe(true);
    }
  });
});
