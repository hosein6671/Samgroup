import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_LOCALE_CODES } from "@test/active-locales";
import { accessibleName, findLinks, findTags, textOf } from "@test/element-tree";

import { PRODUCT_CATEGORIES, ROUTES } from "./site-routes";

import type { ReactNode } from "react";

/**
 * The footer, actually rendered.
 *
 * `SiteFooter` is a Server Component whose only hook is one API read, so `@test/element-tree`
 * expands it for real and these assertions read the tree the browser would receive — every `href`,
 * in every locale. That is the difference between this file and `site-routes.spec.ts`, which tests
 * the model the header maps over because the header itself cannot be rendered in a `node`
 * environment (see its note).
 *
 * `next/link` survives expansion carrying its `href`, which is what `findLinks` matches on.
 *
 * ## Why the component is awaited, and `@/lib/content` is mocked
 *
 * The footer became `async` when it started carrying the Privacy Policy link: the canonical policy
 * route 404s until an editor publishes one, so the address is asked for rather than assumed. The
 * lookup goes through `getContentPage`, which is mocked here so each state can be asserted
 * deliberately instead of depending on whether an API happens to be running.
 */

const { getContentPage } = vi.hoisted(() => ({ getContentPage: vi.fn() }));

vi.mock("@/lib/content", () => ({ getContentPage }));

const { SiteFooter } = await import("./site-footer");

/** The CMS holds no published Privacy Policy — the platform's actual state today. */
function noPublishedPolicy(): void {
  getContentPage.mockResolvedValue({ ok: false, reason: "not-found" });
}

/** A published policy exists, so the footer may link it. */
function publishedPolicy(): void {
  getContentPage.mockResolvedValue({
    ok: true,
    localeFallback: false,
    page: {
      slug: "privacy-policy",
      title: "Privacy Policy",
      bodyHtml: "<p>…</p>",
      lastUpdatedDate: null,
      seo: {},
    },
  });
}

const render = (locale: string): Promise<ReactNode> => SiteFooter({ locale });

const hrefsIn = async (locale: string): Promise<string[]> =>
  findLinks(await render(locale)).map((link) => link.props.href as string);

beforeEach(() => {
  getContentPage.mockReset();
  noPublishedPolicy();
});

describe("SiteFooter", () => {
  it("locale-prefixes every link it renders, in every active locale", async () => {
    publishedPolicy();

    for (const code of ACTIVE_LOCALE_CODES) {
      const hrefs = await hrefsIn(code);

      expect(hrefs.length).toBeGreaterThan(0);

      for (const href of hrefs) {
        expect(href.startsWith(`/${code}`)).toBe(true);
        // A second prefix would read `/en/en/...`.
        expect(href.startsWith(`/${code}/${code}`)).toBe(false);
      }
    }
  });

  it("sends the brand mark to the locale's home page, not to `#top`", async () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const brand = findLinks(await render(code)).find(
        (link) => accessibleName(link) === "Sam Group — home",
      );

      expect(brand).toBeDefined();
      expect(brand?.props.href).toBe(`/${code}`);
    }
  });

  it("sends the Products column to the six canonical Family routes, in the locale", async () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const hrefs = await hrefsIn(code);

      for (const family of PRODUCT_CATEGORIES) {
        expect(hrefs).toContain(`/${code}/products/${family.key}`);
      }
    }
  });

  it("renders the Family labels the canonical table publishes, and invents none", async () => {
    const names = findLinks(await render("en")).map((link) => accessibleName(link));

    for (const family of PRODUCT_CATEGORIES) {
      expect(names).toContain(family.label);
    }

    for (const invented of ["Lubricants", "Industrial fluids", "Automotive", "Specialty"]) {
      expect(names).not.toContain(invented);
    }
  });

  it("sends Contact to the locale's Contact Us route", async () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(await hrefsIn(code)).toContain(`/${code}${ROUTES.contactUs}`);
    }
  });

  it("keeps About Us in the Company column in every locale", async () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(await hrefsIn(code)).toContain(`/${code}${ROUTES.aboutUs}`);
    }
  });

  it("renders no fragment-only address anywhere — no `#top`, no `#products`", async () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      for (const href of await hrefsIn(code)) {
        expect(href.startsWith("#")).toBe(false);
        expect(href).not.toBe("#top");
        expect(href).not.toBe("#products");
      }
    }
  });

  it("keeps its landmark and heading structure", async () => {
    const tree = await render("fa");

    expect(findTags(tree, "footer")).toHaveLength(1);
    // Three column headings — Products, Company, Contact — and no <h1> in a footer.
    expect(findTags(tree, "h2").length).toBeGreaterThanOrEqual(3);
    expect(findTags(tree, "h1")).toHaveLength(0);
  });

  it("gives every link an accessible name", async () => {
    publishedPolicy();

    for (const link of findLinks(await render("ar"))) {
      expect(accessibleName(link).trim().length).toBeGreaterThan(0);
    }
  });

  it("still publishes no contact fact and no certification claim", async () => {
    // The launch-safety cleanup that removed these is older than NAV-1; this asserts a link rewrite
    // did not quietly bring one back, in the visible text and in the addresses alike.
    publishedPolicy();

    const tree = await render("en");
    const surface = [textOf(tree), ...(await hrefsIn("en"))].join(" | ");

    for (const forbidden of ["ISO ", "API licensed", "wa.me", "samgroup.example", "mailto:", "@"]) {
      expect(surface).not.toContain(forbidden);
    }
  });
});

/**
 * The legal bar's one conditional link.
 *
 * SITE_STRUCTURE §0 puts the Privacy Policy in the footer, and the footer renders on every page —
 * which is precisely why it may not link the route on faith. The canonical route answers 404 until
 * a policy is published, so a link emitted while none exists would be a broken promise repeated on
 * every page of the platform.
 */
describe("the Privacy Policy link", () => {
  it("is rendered when the CMS is serving a published policy, in the reader's locale", async () => {
    publishedPolicy();

    for (const code of ACTIVE_LOCALE_CODES) {
      const link = findLinks(await render(code)).find(
        (entry) => entry.props.href === `/${code}${ROUTES.privacyPolicy}`,
      );

      expect(link).toBeDefined();
      expect(accessibleName(link!)).toBe("Privacy Policy");
    }
  });

  it("is absent when no policy is published — the route would answer 404", async () => {
    noPublishedPolicy();

    for (const code of ACTIVE_LOCALE_CODES) {
      expect(await hrefsIn(code)).not.toContain(`/${code}${ROUTES.privacyPolicy}`);
    }
  });

  /**
   * The three ways the lookup can fail to confirm a published policy. Each is a different fact and
   * none of them is "a policy exists", so none of them may produce a link.
   */
  it.each([
    { label: "only a draft exists", result: { ok: false, reason: "not-found" } },
    { label: "the API is unreachable", result: { ok: false, reason: "unreachable" } },
    { label: "the CMS did not answer", result: { ok: false, reason: "api-error", status: 503 } },
  ])("is absent when $label", async ({ result }) => {
    getContentPage.mockResolvedValue(result);

    expect(await hrefsIn("en")).not.toContain(`/en${ROUTES.privacyPolicy}`);
  });

  it("asks for the canonical slug and nothing else", async () => {
    await render("fa");

    expect(getContentPage).toHaveBeenCalledWith("privacy-policy", "fa");
  });
});
