import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ACTIVE_LOCALES } from "@test/active-locales";

import { accessibleName, elementsOf, findLinks, findTags, textOf } from "@test/element-tree";

import { CustomRequestForm } from "./sections/custom-request-form";
import { ANCHORS } from "./solutions-anchors";
import { REQUEST_GROUPS } from "./solutions-form";
import { SolutionsExperience } from "./solutions-experience";
import { SolutionsUnavailable } from "./solutions-unavailable";

import type { CustomizedSolutionsContent } from "@sam-group/types";
import type { ReactNode } from "react";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => ({ type: "img", props }),
}));

/**
 * The Customized Solutions page after the CMS-2A cutover.
 *
 * ## What these tests prove
 *
 * Three things, and the second is the whole reason this page was a careful slice:
 *
 * 1. The editorial copy is whatever the CMS served, and a section it holds nothing for is absent.
 * 2. **The request form is not CMS content.** Its anchor cannot be moved by an edit, its fields are
 *    code-owned, and it renders in every state including both failure states.
 * 3. The source swap did not cost the page its semantics.
 *
 * They do not prove contrast, focus order or focus visibility: those need a browser, and this gate
 * verified them there. No axe or jsdom dependency was added.
 */

const VERIFICATION_CONTENT: CustomizedSolutionsContent = {
  hero: {
    eyebrow: "VERIFICATION EYEBROW",
    title: "VERIFICATION SOLUTIONS TITLE",
    supportingText: "VERIFICATION SUPPORTING TEXT",
    requestCta: { label: "VERIFICATION REQUEST ACTION" },
    routeCta: { label: "VERIFICATION ROUTE ACTION", route: "products" },
  },
  introduction: {
    heading: "VERIFICATION INTRO HEADING",
    bodyHtml: "<p>VERIFICATION INTRO BODY</p>",
  },
  capabilities: [
    { title: "VERIFICATION CAPABILITY", description: "VERIFICATION CAPABILITY DETAIL" },
  ],
  process: {
    heading: "VERIFICATION PROCESS HEADING",
    lead: "VERIFICATION PROCESS LEAD",
    steps: [
      { name: "VERIFICATION STEP ONE", description: "VERIFICATION STEP ONE DETAIL" },
      { name: "VERIFICATION STEP TWO", description: null },
    ],
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
  content: CustomizedSolutionsContent = VERIFICATION_CONTENT,
  locale = "en",
): ReactNode {
  return SolutionsExperience({ content, locale, locales: ACTIVE_LOCALES });
}

/** The anchor the request action must always point at — this page's, declared in code. */
const REQUEST_ANCHOR = "#custom-request";

/**
 * Whether a component appears in the tree, walked **unexpanded**.
 *
 * `expand` invokes function components and drops any that throw — which `CustomRequestForm` does
 * outside React, because it is a client component calling `useActionState`. So its markup is not
 * reachable from the expanded tree, and asserting on its rendered text would assert nothing.
 *
 * What matters here is not the form's markup — it has its own tests — but that the page still
 * *mounts* it, in every state. Identity comparison against the imported component answers exactly
 * that, and it cannot pass by accident.
 */
function mounts(node: unknown, component: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => mounts(child, component));
  }

  if (typeof node !== "object" || node === null || !("props" in node)) {
    return false;
  }

  const element = node as { type?: unknown; props?: { children?: unknown } };

  return element.type === component || mounts(element.props?.children, component);
}

describe("the page renders what the CMS served", () => {
  it("prints the hero, the introduction and the process rail", () => {
    const text = textOf(render());

    for (const expected of [
      "VERIFICATION SOLUTIONS TITLE",
      "VERIFICATION SUPPORTING TEXT",
      "VERIFICATION INTRO HEADING",
      "VERIFICATION CAPABILITY",
      "VERIFICATION CAPABILITY DETAIL",
      "VERIFICATION PROCESS HEADING",
      "VERIFICATION PROCESS LEAD",
      "VERIFICATION STEP ONE",
      "VERIFICATION STEP ONE DETAIL",
      "VERIFICATION STEP TWO",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("renders the CMS body as the HTML the API already sanitized", () => {
    const prose = elementsOf(render()).find((element) =>
      String(element.props.className ?? "").includes("cs-intro-prose"),
    );

    expect(prose?.props.dangerouslySetInnerHTML).toEqual({
      __html: "<p>VERIFICATION INTRO BODY</p>",
    });
  });

  it("resolves the route action through its key, never a stored URL", () => {
    const hrefs = findLinks(render(VERIFICATION_CONTENT, "fa")).map((link) => link.props.href);

    expect(hrefs).toContain("/fa/products");
  });

  it("numbers the process from the list, so the count cannot disagree with it", () => {
    const text = textOf(render());

    expect(text).toContain("2 defined stages from requirement capture");
  });
});

describe("the request action is a label, and its target is the page's", () => {
  it("always points at this page's request anchor", () => {
    const hrefs = findLinks(render()).map((link) => link.props.href);

    expect(hrefs).toContain(REQUEST_ANCHOR);
  });

  /**
   * The regression this gate exists to hold. The CMS supplies the wording; the destination is
   * structural. A `route`, an `href` or a target arriving in the content object must change
   * nothing — the API drops them, and this component never reads them.
   */
  it("cannot be redirected by anything in the content object", () => {
    const hijacked = {
      ...VERIFICATION_CONTENT,
      hero: {
        ...VERIFICATION_CONTENT.hero,
        requestCta: {
          label: "VERIFICATION REQUEST ACTION",
          route: "contact-us",
          href: "https://example.invalid/hijacked",
          anchor: "somewhere-else",
        },
      },
    } as unknown as CustomizedSolutionsContent;

    const hrefs = findLinks(render(hijacked)).map((link) => link.props.href);

    expect(hrefs).toContain(REQUEST_ANCHOR);
    expect(hrefs).not.toContain("https://example.invalid/hijacked");
    expect(hrefs.some((href) => String(href).includes("somewhere-else"))).toBe(false);
  });

  /**
   * The link and the target it points at come from one code constant, so they cannot drift apart.
   * The section carrying that id is inside `CustomRequestForm`, which the walker cannot render —
   * the constant is what both read, and it is the thing worth pinning.
   */
  it("takes its target from the same code constant the form section does", () => {
    expect(ANCHORS.request).toBe("custom-request");
    expect(findLinks(render()).map((link) => link.props.href)).toContain(`#${ANCHORS.request}`);
  });

  it("is omitted when the CMS holds no label for it", () => {
    const noRequest: CustomizedSolutionsContent = {
      ...VERIFICATION_CONTENT,
      hero: { ...VERIFICATION_CONTENT.hero, requestCta: null },
    };

    const labels = findLinks(render(noRequest)).map((link) =>
      textOf(link.props.children as ReactNode),
    );

    expect(labels.some((label) => label.includes("VERIFICATION REQUEST ACTION"))).toBe(false);
  });
});

describe("the form is code-owned, not content", () => {
  it("is mounted by the page, from code rather than from content", () => {
    expect(mounts(render(), CustomRequestForm)).toBe(true);
  });

  it("takes its field vocabulary from the module that mirrors the API DTO", () => {
    const names = REQUEST_GROUPS.flatMap((group) => group.fields.map((field) => field.name));

    // The DTO properties `POST /custom-formulation-requests` accepts — code-owned, not editorial.
    expect(names).toContain("companyName");
    expect(names).toContain("productOrApplication");
    expect(names).toContain("requiredSpecifications");
  });

  it("renders unchanged when the CMS holds nothing but a heading", () => {
    const heroOnly: CustomizedSolutionsContent = {
      ...VERIFICATION_CONTENT,
      hero: { ...VERIFICATION_CONTENT.hero, requestCta: null, routeCta: null },
      introduction: null,
      process: null,
    };

    expect(mounts(render(heroOnly), CustomRequestForm)).toBe(true);
  });

  it("renders in both failure states, because it does not depend on the CMS", () => {
    for (const reason of ["not-configured", "service"] as const) {
      expect(
        mounts(
          SolutionsUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason }),
          CustomRequestForm,
        ),
      ).toBe(true);
    }
  });
});

describe("optional sections render absent", () => {
  const heroOnly: CustomizedSolutionsContent = {
    ...VERIFICATION_CONTENT,
    introduction: null,
    process: null,
  };

  it("omits a section the CMS holds nothing for", () => {
    const text = textOf(render(heroOnly));

    expect(text).toContain("VERIFICATION SOLUTIONS TITLE");
    expect(text).not.toContain("VERIFICATION INTRO HEADING");
    expect(text).not.toContain("VERIFICATION PROCESS HEADING");
    expect(text).not.toContain("Our customization process");
  });

  it("omits the hero's step index when there are no steps", () => {
    const text = textOf(render(heroOnly));

    expect(text).not.toContain("steps, from a stated requirement");
  });

  it("still renders exactly one h1", () => {
    expect(findTags(render(heroOnly), "h1")).toHaveLength(1);
  });
});

describe("locale fallback annotation", () => {
  it("marks the served locale on the content, and only on the content", () => {
    const tree = SolutionsExperience({
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
    const tree = SolutionsExperience({
      content: VERIFICATION_CONTENT,
      locale: "ar",
      locales: ACTIVE_LOCALES,
      fallbackLocale: { code: "en", direction: "ltr" },
    });

    expect(elementsOf(tree).some((element) => element.props.role === "note")).toBe(true);
    expect(textOf(tree)).toContain("has not been translated into this language");
  });

  it("annotates nothing when the requested locale is translated", () => {
    const main = findTags(render(VERIFICATION_CONTENT, "ar"), "main")[0];

    expect(main?.props.lang).toBeUndefined();
    expect(main?.props.dir).toBeUndefined();
  });
});

describe("accessibility of the rendered page", () => {
  it("has one h1, and section headings below it", () => {
    const tree = render();

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findTags(tree, "h2").length).toBeGreaterThan(0);
  });

  it("keeps the main landmark the skip link targets", () => {
    expect(findTags(render(), "main")[0]?.props.id).toBe("main-content");
  });

  it("names every navigation landmark", () => {
    for (const nav of findTags(render(), "nav")) {
      expect(accessibleName(nav) !== "" || typeof nav.props["aria-labelledby"] === "string").toBe(
        true,
      );
    }
  });

  it("renders the process as an ordered list", () => {
    expect(findTags(render(), "ol").length).toBeGreaterThan(0);
  });

  it("gives both hero actions distinct accessible names", () => {
    const labels = findLinks(render())
      .map((link) => textOf(link.props.children as ReactNode).trim())
      .filter((label) => label.includes("VERIFICATION"));

    expect(labels.some((label) => label.includes("VERIFICATION REQUEST ACTION"))).toBe(true);
    expect(labels.some((label) => label.includes("VERIFICATION ROUTE ACTION"))).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("the unpublished and unavailable states", () => {
  const states = [
    { reason: "not-configured" as const, phrase: "has not been published" },
    { reason: "service" as const, phrase: "temporary service condition" },
  ];

  it.each(states)("$reason: one h1, a landmark, and a way forward", ({ reason, phrase }) => {
    const tree = SolutionsUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason });

    expect(findTags(tree, "h1")).toHaveLength(1);
    expect(findTags(tree, "main")[0]?.props.id).toBe("main-content");
    expect(textOf(tree)).toContain(phrase);
    expect(findLinks(tree).map((link) => link.props.href)).toContain("/en/products");
  });

  it("says the form still works, so a reader is not turned away", () => {
    for (const { reason } of states) {
      expect(
        textOf(SolutionsUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason })),
      ).toContain("request form below is unaffected");
    }
  });

  it("keeps the two states distinguishable in text", () => {
    const unpublished = textOf(
      SolutionsUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "not-configured" }),
    );
    const unavailable = textOf(
      SolutionsUnavailable({ locale: "en", locales: ACTIVE_LOCALES, reason: "service" }),
    );

    expect(unpublished).not.toEqual(unavailable);
    expect(unpublished).not.toContain("temporary service condition");
    expect(unavailable).not.toContain("has not been published");
  });
});

describe("the fixture is gone", () => {
  it("has no editorial data module left to fall back to", () => {
    // A filesystem check rather than a failed import: a module that does not exist is not a type.
    expect(existsSync(join(__dirname, "solutions-data.ts"))).toBe(false);
  });

  it("keeps the form vocabulary, which was never editorial", () => {
    expect(REQUEST_GROUPS.length).toBeGreaterThan(0);
    expect(vi.isMockFunction(globalThis.fetch)).toBe(false);
  });
});
