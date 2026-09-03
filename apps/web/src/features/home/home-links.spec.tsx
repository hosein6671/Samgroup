import { describe, expect, it } from "vitest";

import { hrefsIn, idsIn, isInternalPath, localeEscapees, renderHtml } from "@test/rendered-links";

import { CUSTOM_CTA } from "./home-data";
import { CustomFormulation } from "./sections/custom-formulation";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Insights } from "./sections/insights";
import { WhoWeAre } from "./sections/who-we-are";

/**
 * NAV-2 — the homepage body preserves the route's locale.
 *
 * ## What these tests prove
 *
 * Every internal link the homepage body emits is addressed in the locale the page was rendered in,
 * and every fragment it keeps still lands on an id the page actually renders. They are written
 * against **rendered markup** rather than against props, because two of the sections below are
 * `"use client"` canvas sections that a synchronous tree walk cannot render at all.
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
 *
 * ## What the Home-page realignment changed here
 *
 * The body used to be five sections and is now five different ones. `Lab` and `Partnership` are
 * gone with the sections themselves — the workbook's `Home Page` sheet has no segment for either —
 * and `WhoWeAre` and `CustomFormulation` are the two new link-emitting sections that replaced
 * them. The `CTA_LINKS` fixture went with `Partnership`; `CUSTOM_CTA` is the pair that took its
 * place, and the same locale-less assertion is made about it.
 *
 * The link count stays at seven, which is a coincidence worth spelling out rather than leaving to
 * look like nothing changed: `Partnership` emitted three closing links and `Lab` one, and the
 * four that replaced them are the hero's second action, Who We Are's, and Custom Formulation's
 * two. Hero 2 + Who We Are 1 + Portfolio 1 + Custom Formulation 2 + Insights 1.
 */

/** The homepage body sections that emit a link, rendered as one surface. */
function homeBody(locale: string): string {
  return [
    renderHtml(<Hero locale={locale} />),
    renderHtml(<WhoWeAre locale={locale} />),
    renderHtml(<Ecosystem locale={locale} />),
    renderHtml(<CustomFormulation locale={locale} />),
    renderHtml(<Insights locale={locale} />),
  ].join("");
}

describe("the homepage body addresses every route in the reader's locale", () => {
  it("emits no internal link outside /fa", () => {
    expect(localeEscapees(homeBody("fa"), "fa")).toEqual([]);
  });

  it("points the editorial action at the Insights index in this locale", () => {
    expect(hrefsIn(renderHtml(<Insights locale="fa" />))).toEqual(["/fa/insights"]);
  });

  it("sends the hero's two actions to Products and to Request a Quote", () => {
    expect(hrefsIn(renderHtml(<Hero locale="fa" />))).toEqual([
      "/fa/products",
      "/fa/contact-us/request-a-quote",
    ]);
  });

  it("sends the Who We Are action to About Us", () => {
    expect(hrefsIn(renderHtml(<WhoWeAre locale="fa" />))).toEqual(["/fa/about-us"]);
  });

  /*
   * The product portfolio's action follows the SELECTED family, and the first family is Base Oils.
   * This asserts the default selection's address, which is the one a server render emits.
   */
  it("links the portfolio action to the selected family's canonical page", () => {
    expect(hrefsIn(renderHtml(<Ecosystem locale="fa" />))).toEqual(["/fa/products/base-oils"]);
  });

  it("carries the locale into both customization actions", () => {
    expect(hrefsIn(renderHtml(<CustomFormulation locale="fa" />))).toEqual([
      "/fa/customized-solutions",
      "/fa/contact-us",
    ]);
  });

  it("prefixes the same seven links differently in a different locale", () => {
    const fa = hrefsIn(homeBody("fa")).filter(isInternalPath);
    const ar = hrefsIn(homeBody("ar")).filter(isInternalPath);

    expect(fa).toHaveLength(7);
    expect(ar).toEqual(fa.map((href) => href.replace("/fa/", "/ar/")));
  });
});

describe("the fixture stays locale-less", () => {
  /*
   * The half of the decision that a render assertion cannot see. `CUSTOM_CTA` is static content,
   * and a locale stored in it would be per-request state in a module constant — three copies of
   * the same two links, and a fourth locale unable to reuse any of them.
   */
  it("stores structural paths in CUSTOM_CTA, never addresses", () => {
    for (const action of [CUSTOM_CTA.primary, CUSTOM_CTA.secondary]) {
      expect(action.href.startsWith("/en")).toBe(false);
      expect(action.href.startsWith("/fa")).toBe(false);
      expect(action.href.startsWith("/ar")).toBe(false);
    }

    expect([CUSTOM_CTA.primary.href, CUSTOM_CTA.secondary.href]).toEqual([
      "/customized-solutions",
      "/contact-us",
    ]);
  });
});

describe("the same-page fragments survive, and still land somewhere", () => {
  /*
   * `#partnership` was the body's only in-page action and it went with that section. Nothing
   * replaced it: every action on the realigned page goes to another route, which is what makes the
   * CTA flow legible after the closing section was removed.
   */
  it("emits no in-page fragment from the body", () => {
    expect(hrefsIn(homeBody("fa")).filter((href) => href.startsWith("#"))).toEqual([]);
  });

  it("renders an id for every fragment the body links to", () => {
    const body = homeBody("fa");
    const ids = new Set(idsIn(body));

    for (const fragment of hrefsIn(body).filter((href) => href.startsWith("#"))) {
      expect(ids.has(fragment.slice(1))).toBe(true);
    }
  });
});
