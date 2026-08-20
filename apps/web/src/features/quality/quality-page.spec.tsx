import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES } from "@test/active-locales";

import { accessibleName, elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import { QualityExperience } from "./quality-experience";
import { QualityUnavailable } from "./quality-unavailable";

import type { QualityCertificationsContent } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Quality & Certifications page after the CMS-2B cutover — where its content comes from, what it
 * does when there is none, and that the source swap did not cost the page its semantics or soften a
 * single claim.
 *
 * ## What these tests prove
 *
 * They render the Server Components and assert on the tree: the heading hierarchy, the landmarks, the
 * accessible names, the `alt` on an image, and — the point of the gate — that no code path reaches a
 * CMS, renders a 404 for a structural URL, publishes a certification, or turns the documentation
 * register into a download list.
 *
 * They do **not** prove contrast, focus order or focus visibility: those need a browser, and this
 * gate verified them there. No axe or jsdom dependency was added.
 */

const VERIFICATION_CONTENT: QualityCertificationsContent = {
  hero: {
    eyebrow: "VERIFICATION EYEBROW",
    title: "VERIFICATION HERO TITLE",
    supportingText: "VERIFICATION SUPPORTING TEXT",
    indexLabel: "VERIFICATION INDEX LABEL",
    primaryCta: { label: "VERIFICATION PRIMARY", route: "contact-us" },
    secondaryCta: { label: "VERIFICATION SECONDARY", route: "products" },
  },
  approach: {
    eyebrow: "VERIFICATION APPROACH EYEBROW",
    heading: "VERIFICATION APPROACH HEADING",
    lead: "VERIFICATION APPROACH LEAD",
    stages: [
      { name: "VERIFICATION STAGE ONE", when: "VERIFICATION WHEN ONE" },
      { name: "VERIFICATION STAGE TWO", when: "VERIFICATION WHEN TWO" },
    ],
    footnote: "VERIFICATION APPROACH FOOTNOTE",
  },
  laboratory: {
    eyebrow: "VERIFICATION LAB EYEBROW",
    heading: "VERIFICATION LAB HEADING",
    lead: "VERIFICATION LAB LEAD",
    registerLabel: "VERIFICATION REGISTER LABEL",
    orderNote: "VERIFICATION ORDER NOTE",
    properties: [{ name: "VERIFICATION PROPERTY ONE" }, { name: "VERIFICATION PROPERTY TWO" }],
    unpublishedHeading: "VERIFICATION UNPUBLISHED HEADING",
    unpublished: [{ name: "VERIFICATION WITHHELD", why: "VERIFICATION REASON" }],
    figure: {
      image: {
        url: "/media/cms/verification-lab.png",
        alt: "VERIFICATION LAB ALT",
        width: 1600,
        height: 1000,
      },
      caption: "VERIFICATION LAB CAPTION",
    },
  },
  certifications: {
    eyebrow: "VERIFICATION CERTS EYEBROW",
    heading: "VERIFICATION CERTS HEADING",
    status: "VERIFICATION WITHHELD STATUS",
    statement: "VERIFICATION CERTS STATEMENT",
    note: "VERIFICATION CERTS NOTE",
  },
  documentation: {
    eyebrow: "VERIFICATION DOCS EYEBROW",
    heading: "VERIFICATION DOCS HEADING",
    lead: "VERIFICATION DOCS LEAD",
    registerLabel: "VERIFICATION DOCS REGISTER",
    documents: [
      { name: "VERIFICATION DOCUMENT ONE", scope: "VERIFICATION SCOPE" },
      { name: "VERIFICATION DOCUMENT TWO", scope: null },
    ],
    note: "VERIFICATION DOCS NOTE",
  },
  sampling: {
    eyebrow: "VERIFICATION SAMPLING EYEBROW",
    statement: "VERIFICATION SAMPLING STATEMENT",
    familiesLabel: "VERIFICATION FAMILIES LABEL",
    families: ["base-oils", "engine-oils-automotive-lubricants"],
    limit: "VERIFICATION SAMPLING LIMIT",
  },
  closing: {
    eyebrow: "VERIFICATION CLOSING EYEBROW",
    heading: "VERIFICATION CLOSING HEADING",
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

function render(
  content: QualityCertificationsContent = VERIFICATION_CONTENT,
  locale = "en",
): ReactNode {
  return QualityExperience({ content, locale, locales: ACTIVE_LOCALES });
}

describe("the Quality page renders what the CMS served", () => {
  it("prints the hero, the sections and their repeaters", () => {
    const text = textOf(render());

    for (const expected of [
      "VERIFICATION HERO TITLE",
      "VERIFICATION SUPPORTING TEXT",
      "VERIFICATION APPROACH HEADING",
      "VERIFICATION STAGE ONE",
      "VERIFICATION WHEN ONE",
      "VERIFICATION APPROACH FOOTNOTE",
      "VERIFICATION PROPERTY ONE",
      "VERIFICATION WITHHELD",
      "VERIFICATION REASON",
      "VERIFICATION CERTS STATEMENT",
      "VERIFICATION DOCUMENT ONE",
      "VERIFICATION DOCS NOTE",
      "VERIFICATION SAMPLING STATEMENT",
      "VERIFICATION SAMPLING LIMIT",
      "VERIFICATION CLOSING HEADING",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("resolves CMS route keys to locale-prefixed paths, never to a stored URL", () => {
    const hrefs = findLinks(render(VERIFICATION_CONTENT, "fa")).map((link) => link.props.href);

    expect(hrefs).toContain("/fa/contact-us");
    expect(hrefs).toContain("/fa/products");
    expect(hrefs).toContain("/fa/customized-solutions");
    expect(hrefs).toContain("/fa/contact-us/request-a-quote");
  });

  it("renders every band's eyebrow from the CMS", () => {
    const text = textOf(render());

    for (const eyebrow of [
      "VERIFICATION EYEBROW",
      "VERIFICATION APPROACH EYEBROW",
      "VERIFICATION LAB EYEBROW",
      "VERIFICATION CERTS EYEBROW",
      "VERIFICATION DOCS EYEBROW",
      "VERIFICATION SAMPLING EYEBROW",
      "VERIFICATION CLOSING EYEBROW",
    ]) {
      expect(text).toContain(eyebrow);
    }
  });

  it("reads the hero's stage chain off the same list the approach section renders", () => {
    const chain = elementsOf(render()).find(
      (element) => element.props.className === "qc-chain-list reveal-stagger",
    );

    // Two stages in the CMS, two in the chain — the hero cannot disagree with §2 about the count.
    expect(textOf(chain as unknown as ReactNode)).toContain("VERIFICATION STAGE TWO");
  });
});

/**
 * The certification boundary, asserted on the rendered page.
 *
 * The Global cannot model a certificate and the projection cannot serve one. This is the third link:
 * the page has no component that could render a list even if one arrived.
 */
describe("no certification is published, and none can be", () => {
  it("renders the withheld statement and no certificate row of any kind", () => {
    const text = textOf(render());

    expect(text).toContain("VERIFICATION CERTS STATEMENT");
    expect(text).toContain("VERIFICATION WITHHELD STATUS");

    for (const forbidden of [
      "ISO 9001",
      "ISO 14001",
      "API licen",
      "certificate number",
      "valid until",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("renders no list, no image and no link inside the certifications band", () => {
    const band = elementsOf(render()).find(
      (element) => element.props.className === "fs-wrap qc-certs-inner reveal-fade-rise",
    );
    const tree = band as unknown as ReactNode;

    expect(findTags(tree, "ol")).toHaveLength(0);
    expect(findTags(tree, "ul")).toHaveLength(0);
    expect(findTags(tree, "img")).toHaveLength(0);
    expect(findLinks(tree)).toHaveLength(0);
  });

  it("carries the state as text, never as colour alone, with the mark hidden", () => {
    const status = elementsOf(render()).find(
      (element) => element.props.className === "qc-certs-status",
    );
    const dot = elementsOf(render()).find((element) => element.props.className === "qc-certs-dot");

    expect(textOf(status as unknown as ReactNode)).toContain("VERIFICATION WITHHELD STATUS");
    expect(dot?.props["aria-hidden"]).toBe("true");
  });
});

describe("the documentation register is not a download list", () => {
  it("renders document names with no link, no file and no access affordance", () => {
    const register = elementsOf(render()).find(
      (element) => element.props.className === "qc-doclist reveal-stagger",
    );
    const tree = register as unknown as ReactNode;

    expect(textOf(tree)).toContain("VERIFICATION DOCUMENT ONE");
    expect(findLinks(tree)).toHaveLength(0);
    expect(findTags(tree, "button")).toHaveLength(0);
  });

  it("keeps the note that says nothing here is a download", () => {
    expect(textOf(render())).toContain("VERIFICATION DOCS NOTE");
  });
});

describe("the laboratory register carries names and only names", () => {
  it("renders a property as its name, with no method, condition or value beside it", () => {
    const register = elementsOf(render()).find(
      (element) => element.props.className === "qc-register-list",
    );

    expect(textOf(register as unknown as ReactNode)).toContain("VERIFICATION PROPERTY ONE");
    // The ordinal is the only other content on the row; nothing derives a claim from a name.
    expect(textOf(register as unknown as ReactNode)).not.toContain("ASTM");
  });

  it("keeps the withheld caveats as ordinary text, not behind a tooltip", () => {
    const caveats = elementsOf(render()).find(
      (element) => element.props.className === "qc-pending-list",
    );
    const tree = caveats as unknown as ReactNode;

    expect(textOf(tree)).toContain("VERIFICATION WITHHELD");
    expect(textOf(tree)).toContain("VERIFICATION REASON");
    expect(elementsOf(tree).every((element) => element.props.title === undefined)).toBe(true);
  });
});

/**
 * The Product taxonomy boundary, on the rendered page: the CMS supplied keys, and the label and href
 * came from `PRODUCT_CATEGORIES`.
 */
describe("sampling resolves CMS family keys against the canonical product table", () => {
  it("renders each family's canonical label linking to its canonical, locale-prefixed route", () => {
    const list = elementsOf(render(VERIFICATION_CONTENT, "ar")).find(
      (element) => element.props.className === "qc-sampling-families",
    );
    const tree = list as unknown as ReactNode;
    const links = findLinks(tree);

    expect(links.map((link) => link.props.href)).toEqual([
      "/ar/products/base-oils",
      "/ar/products/engine-oils-automotive-lubricants",
    ]);
    expect(textOf(tree)).toContain("Base Oils");
    expect(textOf(tree)).toContain("Engine Oils & Automotive Lubricants");
  });

  it("names each link by the family, with the decorative arrow hidden", () => {
    const links = findLinks(render()).filter((link) =>
      String(link.props.href).includes("/products/base-oils"),
    );

    expect(accessibleName(links[0] as never)).toContain("Base Oils");

    const arrows = elementsOf(render()).filter((element) => element.props.className === "fs-ar");

    expect(arrows.every((arrow) => arrow.props["aria-hidden"] === "true")).toBe(true);
  });

  it("drops a key this application cannot resolve rather than guessing a name for it", () => {
    const tree = render({
      ...VERIFICATION_CONTENT,
      sampling: {
        ...VERIFICATION_CONTENT.sampling!,
        families: ["base-oils", "a-family-from-a-newer-schema" as never],
      },
    });
    const list = elementsOf(tree).find(
      (element) => element.props.className === "qc-sampling-families",
    );

    expect(findLinks(list as unknown as ReactNode)).toHaveLength(1);
  });

  it("does not render the section at all when no key resolves", () => {
    const text = textOf(
      render({
        ...VERIFICATION_CONTENT,
        sampling: {
          ...VERIFICATION_CONTENT.sampling!,
          families: ["a-family-from-a-newer-schema" as never],
        },
      }),
    );

    // The policy is never published without its scope — a broader promise than the source makes.
    expect(text).not.toContain("VERIFICATION SAMPLING STATEMENT");
    expect(text).not.toContain("VERIFICATION SAMPLING LIMIT");
  });
});

describe("optional sections render absent", () => {
  const heroOnly: QualityCertificationsContent = {
    ...VERIFICATION_CONTENT,
    hero: { ...VERIFICATION_CONTENT.hero, secondaryCta: null },
    approach: null,
    laboratory: null,
    certifications: null,
    documentation: null,
    sampling: null,
    closing: null,
  };

  it("omits a section the CMS holds nothing for, without an empty band", () => {
    const text = textOf(render(heroOnly));

    expect(text).toContain("VERIFICATION HERO TITLE");
    expect(text).not.toContain("VERIFICATION APPROACH HEADING");
    expect(text).not.toContain("VERIFICATION PROPERTY ONE");
    expect(text).not.toContain("VERIFICATION CERTS STATEMENT");
    expect(text).not.toContain("VERIFICATION DOCUMENT ONE");
    expect(text).not.toContain("VERIFICATION CLOSING HEADING");
  });

  it("collapses the hero's chain column when no stage exists", () => {
    const hero = elementsOf(render(heroOnly)).find(
      (element) => element.props.className === "fs-wrap qc-hero-inner",
    );

    expect(hero?.props["data-chain"]).toBe("no");
  });

  it("still renders exactly one h1", () => {
    expect(findTags(render(heroOnly), "h1")).toHaveLength(1);
  });

  it("omits an action the CMS did not supply", () => {
    const labels = findLinks(render(heroOnly)).map((link) =>
      textOf(link.props.children as ReactNode),
    );

    expect(labels.some((label) => label.includes("VERIFICATION PRIMARY"))).toBe(true);
    expect(labels.some((label) => label.includes("VERIFICATION SECONDARY"))).toBe(false);
  });

  /**
   * The drafting-table frame that stood here through the proof stage went with the fixture. With no
   * upload the section renders no `<figure>`, no placeholder and no "Image pending" marker.
   */
  it("renders no figure and no pending frame when no photograph is uploaded", () => {
    const noPhoto = render({
      ...VERIFICATION_CONTENT,
      laboratory: { ...VERIFICATION_CONTENT.laboratory!, figure: null },
    });

    expect(findTags(noPhoto, "img")).toHaveLength(0);
    expect(findTags(noPhoto, "figure")).toHaveLength(0);
    expect(textOf(noPhoto)).not.toContain("Image pending");

    const top = elementsOf(noPhoto).find((element) => element.props.className === "qc-lab-top");

    expect(top?.props["data-figure"]).toBe("no");
  });
});

describe("accessibility of the rendered page", () => {
  it("has one h1, and section headings descend without skipping a level", () => {
    const tree = render();

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findTags(tree, "h2").length).toBeGreaterThan(0);
    // h3 is used for the stage names and the withheld heading, both inside h2 sections.
    expect(findTags(tree, "h4")).toHaveLength(0);
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

  it("carries the alt text from the Media record onto the image, with intrinsic dimensions", () => {
    const image = findTags(render(), "img")[0];

    expect(image?.props.alt).toBe("VERIFICATION LAB ALT");
    expect(image?.props.width).toBe(1600);
    expect(image?.props.height).toBe(1000);
  });

  it("renders repeating content as lists rather than as loose markup", () => {
    const tree = render();

    expect(findTags(tree, "ol").length).toBeGreaterThan(0);
    expect(findTags(tree, "ul").length).toBeGreaterThan(0);
  });
});

describe("the locale fallback annotation", () => {
  it("annotates the content container, and only the content container", () => {
    const tree = QualityExperience({
      content: VERIFICATION_CONTENT,
      locale: "ar",
      locales: ACTIVE_LOCALES,
      fallbackLocale: { code: "en", direction: "ltr" },
    });
    const main = findTags(tree, "main")[0];

    expect(main?.props.lang).toBe("en");
    expect(main?.props.dir).toBe("ltr");
    expect(textOf(tree)).toContain("has not been translated into this language");
  });

  it("adds nothing when the requested locale is translated", () => {
    const main = findTags(render(VERIFICATION_CONTENT, "ar"), "main")[0];

    expect(main?.props.lang).toBeUndefined();
    expect(main?.props.dir).toBeUndefined();
    expect(textOf(render(VERIFICATION_CONTENT, "ar"))).not.toContain("has not been translated");
  });
});

describe("the unavailable states", () => {
  it("says the page is unpublished without claiming it does not exist", () => {
    const text = textOf(
      QualityUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "not-configured" }),
    );

    expect(text).toContain("has not been published");
    expect(text.toLowerCase()).not.toContain("not found");
  });

  it("says a service condition is temporary", () => {
    const text = textOf(
      QualityUnavailable({ locale: "ar", locales: ACTIVE_LOCALES, reason: "service" }),
    );

    expect(text).toContain("temporary service condition");
  });

  /**
   * This is the address the platform gives for the certification question, so an unavailable state
   * that volunteered anything *about* certifications would publish a claim in the worst possible
   * place. Naming the page is fine; describing what it will say is not.
   *
   * Scoped to the state's own copy — the shared footer legitimately links to this page by name.
   */
  it("claims nothing about certifications, testing, standards or accreditation", () => {
    for (const reason of ["not-configured", "service"] as const) {
      const inner = elementsOf(
        QualityUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason }),
      ).find((element) => element.props.className === "fs-wrap qc-unavailable-inner");
      const text = textOf(inner as unknown as ReactNode).toLowerCase();

      for (const forbidden of [
        "iso ",
        "api licen",
        "accredit",
        "standard",
        "test",
        "laborator",
        "certificate",
        "certifications are",
        "certifications will",
      ]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("keeps one h1 and a route out of the page", () => {
    const tree = QualityUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "service" });

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findLinks(tree).map((link) => link.props.href)).toContain("/en/products");
  });
});

/**
 * The eyebrow correction, asserted two ways — because either one alone can be satisfied while the
 * bug is still present.
 *
 * `approach`, `laboratory` and `documentation` rendered hardcoded English eyebrows ("Our quality
 * approach", "Laboratory capability", "Documentation we provide") on a page served in `en`, `fa`
 * and `ar`, so a Persian or Arabic reader met an English label above translated content. They are
 * now localized CMS fields with **no fallback string in the components**.
 *
 * The behavioural test proves the CMS value is what renders. The source scan proves no English
 * label is left behind to reappear when a field is empty — a component that rendered
 * `eyebrow ?? "Laboratory capability"` would pass the first test and fail the second.
 */
describe("no visible eyebrow on this page is code-owned", () => {
  /** Every section component, plus the page shell. Spec files are excluded — this file names the strings on purpose. */
  function sectionSources(): { path: string; code: string }[] {
    const sections = join(__dirname, "sections");

    return [
      ...readdirSync(sections).map((name) => join(sections, name)),
      join(__dirname, "quality-experience.tsx"),
    ]
      .filter((path) => /\.tsx?$/.test(path) && !/\.spec\.tsx?$/.test(path))
      .map((path) => ({
        path,
        /*
         * Comments are stripped before scanning. Several of these files explain in prose exactly
         * which English strings were removed and why, so a raw-text scan would fail on its own
         * documentation.
         */
        code: readFileSync(path, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/(^|[^:])\/\/.*$/gm, "$1"),
      }));
  }

  it("scans the section components, so a passing result means something", () => {
    expect(sectionSources().length).toBeGreaterThanOrEqual(8);
  });

  it("contains none of the three English eyebrow strings this correction removed", () => {
    const offenders = sectionSources().filter(({ code }) =>
      /Our quality approach|Laboratory capability|Documentation we provide/i.test(code),
    );

    expect(offenders.map((entry) => entry.path)).toEqual([]);
  });

  it("renders no `fs-eyebrow` from a string literal — every one comes from a prop", () => {
    const offenders = sectionSources().filter(({ code }) =>
      /className="fs-eyebrow"\s*>\s*[A-Za-z]/.test(code),
    );

    expect(offenders.map((entry) => entry.path)).toEqual([]);
  });

  it("supplies no English fallback for an eyebrow the CMS left empty", () => {
    const offenders = sectionSources().filter(({ code }) => /eyebrow\s*\?\?\s*["'`]/.test(code));

    expect(offenders.map((entry) => entry.path)).toEqual([]);
  });

  it("omits the eyebrow cleanly, with no empty decorative element and no heading shift", () => {
    const noEyebrows = render({
      ...VERIFICATION_CONTENT,
      approach: { ...VERIFICATION_CONTENT.approach!, eyebrow: null },
      laboratory: { ...VERIFICATION_CONTENT.laboratory!, eyebrow: null },
      documentation: { ...VERIFICATION_CONTENT.documentation!, eyebrow: null },
    });
    const eyebrows = elementsOf(noEyebrows).filter(
      (element) => element.props.className === "fs-eyebrow",
    );

    // The four sections that still have one, and not a single empty <p> for the three that do not.
    expect(eyebrows).toHaveLength(4);
    expect(eyebrows.every((element) => textOf(element as unknown as ReactNode) !== "")).toBe(true);

    // The hierarchy is unchanged: the headings the eyebrows sat above are still there, at the same level.
    expect(findTags(noEyebrows, "h1")).toHaveLength(1);
    expect(findTags(noEyebrows, "h2")).toHaveLength(findTags(render(), "h2").length);
    expect(textOf(noEyebrows)).toContain("VERIFICATION APPROACH HEADING");
    expect(textOf(noEyebrows)).toContain("VERIFICATION LAB HEADING");
    expect(textOf(noEyebrows)).toContain("VERIFICATION DOCS HEADING");
  });

  it("drops the whole header when a section has neither eyebrow, heading nor lead", () => {
    const bare = render({
      ...VERIFICATION_CONTENT,
      approach: { ...VERIFICATION_CONTENT.approach!, eyebrow: null, heading: null, lead: null },
    });
    const headers = elementsOf(bare).filter(
      (element) => element.props.className === "qc-approach-head reveal-fade-rise",
    );

    expect(headers).toHaveLength(0);
    // The stages themselves still render — the section is not empty, only its header is.
    expect(textOf(bare)).toContain("VERIFICATION STAGE ONE");
  });
});
