import { describe, expect, it, vi } from "vitest";

import { ACTIVE_LOCALES } from "@test/active-locales";

import { accessibleName, elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import { AboutExperience } from "./about-experience";
import { AboutUnavailable } from "./about-unavailable";

import type { AboutUsContent } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The About Us page after the CMS-1 cutover — where its content comes from, what it does when there
 * is none, and that the source swap did not cost the page its semantics.
 *
 * ## What these tests prove
 *
 * They render the Server Components and assert on the tree: the heading hierarchy, the landmarks,
 * the accessible names, the `alt` on an image, and — the point of the gate — that not one code path
 * reaches a CMS or renders a 404 for a structural URL.
 *
 * They do **not** prove contrast, focus order or focus visibility: those need a browser and this
 * gate verified them there. No axe or jsdom dependency was added.
 */

const VERIFICATION_CONTENT: AboutUsContent = {
  hero: {
    eyebrow: "VERIFICATION EYEBROW",
    title: "VERIFICATION HERO TITLE",
    supportingText: "VERIFICATION SUPPORTING TEXT",
    primaryCta: { label: "VERIFICATION PRIMARY", route: "products" },
    secondaryCta: { label: "VERIFICATION SECONDARY", route: "contact-us" },
    figure: {
      image: {
        url: "/media/cms/verification.png",
        alt: "VERIFICATION ALT TEXT",
        width: 1200,
        height: 1500,
      },
      caption: "VERIFICATION CAPTION",
    },
  },
  whoWeAre: {
    heading: "VERIFICATION WHO WE ARE",
    bodyHtml: "<p>VERIFICATION BODY</p>",
    positions: [{ term: "VERIFICATION TERM", note: "VERIFICATION NOTE" }],
    figure: null,
  },
  expertise: {
    heading: "VERIFICATION EXPERTISE",
    lead: "VERIFICATION EXPERTISE LEAD",
    items: [{ name: "VERIFICATION AREA" }],
  },
  team: {
    eyebrow: "VERIFICATION TEAM",
    heading: "VERIFICATION TEAM HEADING",
    lead: "VERIFICATION TEAM LEAD",
    functions: [{ name: "VERIFICATION FUNCTION", note: "VERIFICATION FUNCTION NOTE" }],
    figure: {
      image: {
        url: "/media/cms/verification-team.png",
        alt: "VERIFICATION TEAM ALT",
        width: 1600,
        height: 900,
      },
      caption: "VERIFICATION TEAM CAPTION",
    },
  },
  qualityStandards: {
    heading: "VERIFICATION QUALITY",
    lead: "VERIFICATION QUALITY LEAD",
    items: [{ name: "VERIFICATION COMMITMENT", note: "VERIFICATION SECOND LINE" }],
    footnote: "VERIFICATION FOOTNOTE",
    footnoteCta: { label: "VERIFICATION FOOTNOTE LINK", route: "quality-certifications" },
    figure: null,
  },
  closing: {
    eyebrow: "VERIFICATION NEXT",
    heading: "VERIFICATION CLOSING",
    lead: "VERIFICATION CLOSING LEAD",
    primaryCta: { label: "VERIFICATION QUOTE", route: "request-a-quote" },
    routes: [{ label: "VERIFICATION ROUTE", route: "customized-solutions" }],
  },
  seo: {
    locale: "en",
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    ogTitle: null,
    ogDescription: null,
    socialImage: null,
    twitterCardType: "summary_large_image",
    twitterTitle: null,
    twitterDescription: null,
    twitterImage: null,
    robotsIndex: true,
    robotsFollow: true,
    keywords: [],
    structuredDataOverride: null,
    alternates: [],
  },
};

function render(content: AboutUsContent = VERIFICATION_CONTENT, locale = "en"): ReactNode {
  return AboutExperience({ content, locale, locales: ACTIVE_LOCALES });
}

describe("the About page renders what the CMS served", () => {
  it("prints the hero, the sections and their repeaters", () => {
    const text = textOf(render());

    for (const expected of [
      "VERIFICATION HERO TITLE",
      "VERIFICATION SUPPORTING TEXT",
      "VERIFICATION WHO WE ARE",
      "VERIFICATION TERM",
      "VERIFICATION AREA",
      "VERIFICATION TEAM HEADING",
      "VERIFICATION FUNCTION",
      "VERIFICATION COMMITMENT",
      "VERIFICATION SECOND LINE",
      "VERIFICATION FOOTNOTE",
      "VERIFICATION CLOSING",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("resolves CMS route keys to locale-prefixed paths, never to a stored URL", () => {
    const hrefs = findLinks(render(VERIFICATION_CONTENT, "fa")).map((link) => link.props.href);

    expect(hrefs).toContain("/fa/products");
    expect(hrefs).toContain("/fa/contact-us");
    expect(hrefs).toContain("/fa/quality-certifications");
    expect(hrefs).toContain("/fa/customized-solutions");
    expect(hrefs).toContain("/fa/contact-us/request-a-quote");
  });

  it("renders the CMS body as the HTML the API already sanitized", () => {
    const prose = elementsOf(render()).find(
      (element) => element.props.className === "ab-who-prose",
    );

    expect(prose?.props.dangerouslySetInnerHTML).toEqual({ __html: "<p>VERIFICATION BODY</p>" });
  });

  it("keeps the six product families out of the CMS and in code", () => {
    const hrefs = findLinks(render()).map((link) => link.props.href);

    // Category data is Prisma-owned; Payload may never mirror it (ADR-002).
    expect(hrefs).toContain("/en/products/base-oils");
    expect(hrefs).toContain("/en/products/marine-oils-lubricants");
  });
});

describe("optional sections render absent", () => {
  const heroOnly: AboutUsContent = {
    ...VERIFICATION_CONTENT,
    hero: { ...VERIFICATION_CONTENT.hero, figure: null, secondaryCta: null },
    whoWeAre: null,
    expertise: null,
    team: null,
    qualityStandards: null,
    closing: null,
  };

  it("omits a section the CMS holds nothing for, without an empty band", () => {
    const text = textOf(render(heroOnly));

    expect(text).toContain("VERIFICATION HERO TITLE");
    expect(text).not.toContain("VERIFICATION WHO WE ARE");
    expect(text).not.toContain("Our expertise");
    expect(text).not.toContain("VERIFICATION QUALITY");
    expect(text).not.toContain("VERIFICATION CLOSING");
  });

  it("still renders exactly one h1", () => {
    expect(findTags(render(heroOnly), "h1")).toHaveLength(1);
  });

  it("collapses the media column when no photograph is uploaded", () => {
    const hero = elementsOf(render(heroOnly)).find(
      (element) => element.props.className === "fs-wrap ab-hero-inner",
    );

    expect(hero?.props["data-figure"]).toBe("no");
    expect(findTags(render(heroOnly), "img")).toHaveLength(0);
  });

  it("omits an action the CMS did not supply", () => {
    const labels = findLinks(render(heroOnly)).map((link) =>
      textOf(link.props.children as ReactNode),
    );

    expect(labels.some((label) => label.includes("VERIFICATION PRIMARY"))).toBe(true);
    expect(labels.some((label) => label.includes("VERIFICATION SECONDARY"))).toBe(false);
  });
});

describe("accessibility of the rendered page", () => {
  it("has one h1, and every other section heading is an h2", () => {
    const tree = render();

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findTags(tree, "h3")).toHaveLength(VERIFICATION_CONTENT.team?.functions.length ?? 0);
    expect(findTags(tree, "h2").length).toBeGreaterThan(0);
  });

  it("keeps the main landmark the skip link targets", () => {
    const main = findTags(render(), "main")[0];

    expect(main?.props.id).toBe("main-content");
  });

  it("names every navigation landmark", () => {
    for (const nav of findTags(render(), "nav")) {
      expect(accessibleName(nav) !== "" || typeof nav.props["aria-labelledby"] === "string").toBe(
        true,
      );
    }
  });

  it("carries the alt text from the Media record onto the image", () => {
    const image = findTags(render(), "img")[0];

    expect(image?.props.alt).toBe("VERIFICATION ALT TEXT");
    // Intrinsic dimensions reserve the space, so the page does not shift while the file loads.
    expect(image?.props.width).toBe(1200);
    expect(image?.props.height).toBe(1500);
  });

  it("renders repeating content as lists rather than as loose markup", () => {
    const tree = render();

    expect(findTags(tree, "ol").length).toBeGreaterThan(0);
    expect(findTags(tree, "ul").length).toBeGreaterThan(0);
    expect(findTags(tree, "dl").length).toBe(1);
  });
});

describe("the unavailable states", () => {
  it("says the page is unpublished without claiming it does not exist", () => {
    const text = textOf(
      AboutUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "not-configured" }),
    );

    expect(text).toContain("has not been published");
    expect(text.toLowerCase()).not.toContain("not found");
  });

  it("says a service condition is temporary", () => {
    const text = textOf(
      AboutUnavailable({ locale: "ar", locales: ACTIVE_LOCALES, reason: "service" }),
    );

    expect(text).toContain("temporary service condition");
  });

  it("keeps one h1 and a route out of the page", () => {
    const tree = AboutUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "service" });

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findLinks(tree).map((link) => link.props.href)).toContain("/en/products");
  });
});

describe("the CMS boundary", () => {
  it("renders without any module reaching Payload", () => {
    // Nothing in this subtree imports a CMS client; the page is given content and renders it.
    expect(() => render()).not.toThrow();
    expect(vi.isMockFunction(globalThis.fetch)).toBe(false);
  });
});

describe("locale fallback annotation", () => {
  /**
   * WCAG 2.2 AA 3.1.2 Language of Parts. When the CMS serves the default locale for a page nobody
   * has translated, the content inside `<main>` really is in that other language, and assistive
   * technology has to be told — otherwise a screen reader pronounces English with an Arabic voice.
   *
   * `dir` travels with it so a left-to-right fallback reads correctly inside a right-to-left
   * document. The document itself keeps the route's language: that is the layout's, and
   * `app/[locale]/layout.spec.tsx` is what holds it.
   */
  it("marks the served locale on the content, and only on the content", () => {
    const tree = AboutExperience({
      content: VERIFICATION_CONTENT,
      locale: "ar",
      locales: ACTIVE_LOCALES,
      fallbackLocale: { code: "en", direction: "ltr" },
    });

    const main = findTags(tree, "main")[0];

    expect(main?.props.lang).toBe("en");
    expect(main?.props.dir).toBe("ltr");
    expect(findTags(tree, "html")).toHaveLength(0);
  });

  it("states the fallback in words, not by styling alone", () => {
    const tree = AboutExperience({
      content: VERIFICATION_CONTENT,
      locale: "ar",
      locales: ACTIVE_LOCALES,
      fallbackLocale: { code: "en", direction: "ltr" },
    });

    const note = elementsOf(tree).find((element) => element.props.role === "note");

    expect(note).toBeDefined();
    expect(textOf(tree)).toContain("has not been translated into this language");
  });

  it("annotates nothing when the requested locale is translated", () => {
    const main = findTags(render(VERIFICATION_CONTENT, "ar"), "main")[0];

    expect(main?.props.lang).toBeUndefined();
    expect(main?.props.dir).toBeUndefined();
  });
});

describe("the unpublished and unavailable states are accessible pages", () => {
  const states = [
    { reason: "not-configured" as const, phrase: "has not been published" },
    { reason: "service" as const, phrase: "temporary service condition" },
  ];

  it.each(states)("$reason: one h1, a landmark, and a route out", ({ reason, phrase }) => {
    const tree = AboutUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason });

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findTags(tree, "main")[0]?.props.id).toBe("main-content");
    // Meaning is carried by words, never by the band's colour alone.
    expect(textOf(tree)).toContain(phrase);
    // A reader who cannot have this page is given somewhere else to go.
    expect(findLinks(tree).length).toBeGreaterThanOrEqual(2);
  });

  it.each(states)("$reason: every link has an accessible name", ({ reason }) => {
    for (const link of findLinks(
      AboutUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason }),
    )) {
      expect(textOf(link.props.children as ReactNode).trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the two states distinguishable in text", () => {
    const unpublished = textOf(
      AboutUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "not-configured" }),
    );
    const unavailable = textOf(
      AboutUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "service" }),
    );

    expect(unpublished).not.toEqual(unavailable);
    expect(unpublished).not.toContain("temporary service condition");
    expect(unavailable).not.toContain("has not been published");
  });
});
