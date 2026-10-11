import { describe, expect, it } from "vitest";

import { transitionTarget, type TransitionClick } from "./page-transition-target";

/** Which link clicks play the page transition — and, as importantly, which are left alone. */

const here = new URL("https://samgp.com/en/about-us");

function click(href: string | null, over: Partial<TransitionClick> = {}): TransitionClick {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    href,
    target: null,
    download: false,
    ...over,
  };
}

describe("transitionTarget", () => {
  it("plays for a plain click on another page of the same locale", () => {
    expect(transitionTarget(click("/en/contact-us"), here)).toBe("/en/contact-us");
    expect(transitionTarget(click("/en"), here)).toBe("/en");
    expect(
      transitionTarget(click("https://samgp.com/en/products/finder?segment=x#top"), here),
    ).toBe("/en/products/finder?segment=x#top");
    expect(transitionTarget(click("contact-us"), new URL("https://samgp.com/en/"))).toBe(
      "/en/contact-us",
    );
  });

  it("leaves new-tab, modified and non-primary clicks to the browser", () => {
    for (const over of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
      { target: "_blank" },
      { download: true },
    ] satisfies Partial<TransitionClick>[]) {
      expect(transitionTarget(click("/en/contact-us", over), here)).toBeNull();
    }
    expect(transitionTarget(click("/en/contact-us", { target: "_self" }), here)).toBe(
      "/en/contact-us",
    );
  });

  it("leaves other origins and non-web schemes alone", () => {
    expect(transitionTarget(click("https://example.com/en"), here)).toBeNull();
    expect(transitionTarget(click("https://cms.samgp.com/admin"), here)).toBeNull();
    expect(transitionTarget(click("mailto:info@samgp.com"), here)).toBeNull();
    expect(transitionTarget(click("tel:+100"), here)).toBeNull();
  });

  it("leaves the same page alone: anchors, query changes, trailing slash", () => {
    expect(transitionTarget(click("#main-content"), here)).toBeNull();
    expect(transitionTarget(click("/en/about-us#team"), here)).toBeNull();
    expect(transitionTarget(click("/en/about-us?x=1"), here)).toBeNull();
    expect(transitionTarget(click("/en/about-us/"), here)).toBeNull();
    expect(transitionTarget(click(""), here)).toBeNull();
    expect(transitionTarget(click(null), here)).toBeNull();
  });

  it("never plays for the Admin Dashboard, the API, media or files", () => {
    expect(transitionTarget(click("/admin"), here)).toBeNull();
    expect(transitionTarget(click("/admin/content"), here)).toBeNull();
    expect(transitionTarget(click("/api/v1/locales"), here)).toBeNull();
    expect(transitionTarget(click("/media/datasheet.pdf"), here)).toBeNull();
    expect(transitionTarget(click("/_next/static/x.js"), here)).toBeNull();
    expect(transitionTarget(click("/en/downloads/tds.pdf"), here)).toBeNull();
    // A page whose name merely starts like a reserved one is still a page.
    expect(transitionTarget(click("/en/administration"), here)).toBe("/en/administration");
  });

  it("leaves a change of language to the language menu", () => {
    expect(transitionTarget(click("/fa/about-us"), here)).toBeNull();
    expect(transitionTarget(click("/ar"), here)).toBeNull();
  });
});
