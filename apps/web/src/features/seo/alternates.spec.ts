import { afterEach, describe, expect, it } from "vitest";

import { localePath, pageAlternates, structuralAlternates } from "./alternates";

import type { SeoAlternate } from "@sam-group/types";

/**
 * Canonicals and `hreflang`.
 *
 * The assertions that matter here are the negative ones. Every route on this platform resolves in
 * three locales, and on most of them the non-default locales serve English — so the tempting
 * implementation, "emit an alternate for every active locale", is exactly the one that would tell a
 * search engine to serve Persian speakers a page that is not in Persian. These tests hold the line
 * that an alternate is emitted only where a translation is on record.
 */

const ORIGINAL = process.env.SITE_PUBLIC_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SITE_PUBLIC_URL;
  else process.env.SITE_PUBLIC_URL = ORIGINAL;
});

describe("localePath", () => {
  it("prefixes a structural path with the locale", () => {
    expect(localePath("fa", "/export-logistics")).toBe("/fa/export-logistics");
  });

  it("renders the home route as `/{locale}`, never with a trailing slash", () => {
    expect(localePath("en", "/")).toBe("/en");
  });
});

describe("a structural route", () => {
  it("gets an absolute canonical", () => {
    expect(structuralAlternates("en", "/quality-certifications").canonical).toBe(
      "https://samgp.com/en/quality-certifications",
    );
  });

  /**
   * The whole point. Structural copy is code-owned English in all three locales, so there is no
   * translated set to annotate — and the honest output is a canonical alone.
   */
  it("gets no `hreflang` at all, in any locale", () => {
    for (const locale of ["en", "fa", "ar"]) {
      expect(structuralAlternates(locale, "/export-logistics").languages).toBeUndefined();
    }
  });

  it("follows the configured origin", () => {
    process.env.SITE_PUBLIC_URL = "https://staging.example.test";

    expect(structuralAlternates("ar", "/about-us").canonical).toBe(
      "https://staging.example.test/ar/about-us",
    );
  });
});

describe("an entity-backed page", () => {
  const pathFor = (locale: string, slug: string): string => `/${locale}/products/${slug}`;

  it("emits one alternate per translated locale, plus x-default on the default", () => {
    const translations: SeoAlternate[] = [
      { locale: "en", slug: "base-oils" },
      { locale: "fa", slug: "base-oils-fa" },
    ];

    const result = pageAlternates({
      canonicalPath: "/fa/products/base-oils-fa",
      translations,
      defaultLocaleCode: "en",
      pathForLocale: pathFor,
    });

    expect(result.canonical).toBe("https://samgp.com/fa/products/base-oils-fa");
    expect(result.languages).toEqual({
      en: "https://samgp.com/en/products/base-oils",
      fa: "https://samgp.com/fa/products/base-oils-fa",
      "x-default": "https://samgp.com/en/products/base-oils",
    });
  });

  /**
   * A set of one is the page itself. Every entity on the platform is in this state today, so this
   * is the common path rather than an edge case.
   */
  it("emits no `hreflang` when only one locale holds a translation", () => {
    const result = pageAlternates({
      canonicalPath: "/en/products/base-oils",
      translations: [{ locale: "en", slug: "base-oils" }],
      defaultLocaleCode: "en",
      pathForLocale: pathFor,
    });

    expect(result.canonical).toBe("https://samgp.com/en/products/base-oils");
    expect(result.languages).toBeUndefined();
  });

  it("emits no `hreflang` when the API reported no alternates at all", () => {
    expect(
      pageAlternates({ canonicalPath: "/en/insights/a-post", pathForLocale: pathFor }).languages,
    ).toBeUndefined();
  });

  /**
   * `x-default` must point at a page that exists in the annotated set. If the default locale is not
   * among the translations, the honest output is the alternates without it rather than a link into
   * a locale the entity was never translated into.
   */
  it("omits x-default when the default locale is not one of the translated ones", () => {
    const result = pageAlternates({
      canonicalPath: "/fa/products/x",
      translations: [
        { locale: "fa", slug: "x" },
        { locale: "ar", slug: "y" },
      ],
      defaultLocaleCode: "en",
      pathForLocale: pathFor,
    });

    expect(result.languages).toEqual({
      fa: "https://samgp.com/fa/products/x",
      ar: "https://samgp.com/ar/products/y",
    });
  });

  it("accepts an editor's absolute canonical override unchanged", () => {
    expect(pageAlternates({ canonicalPath: "https://samgp.com/en/legal/privacy" }).canonical).toBe(
      "https://samgp.com/en/legal/privacy",
    );
  });
});
