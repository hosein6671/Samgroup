import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { elementsOf, findTags, textOf } from "@test/element-tree";

import AboutUsPage, { generateMetadata } from "./page";

import type { AboutUsContent } from "@sam-group/types";

/**
 * `/{locale}/about-us` — three conditions that must stay three, and a locale identity that must not
 * move.
 *
 * ## Why none of this may become a 404
 *
 * `/about-us` is a structural URL: it is in the header, the footer and the sitemap. A canonical 404
 * on it states that the company has no About page — to a visitor, and to a crawler that will act on
 * it. Neither "no published document" nor "the API did not answer" is that statement, which is the
 * rule ADR-010 §7 fixes for Product Detail held for a corporate route.
 *
 * `notFound` is mocked to throw, so any call to it fails these tests loudly rather than silently
 * returning a page.
 *
 * ## Why the locale tests are here
 *
 * A CMS fallback changes what language the *content* is in. It must never change what language the
 * *page* is: `/ar/about-us` is an Arabic URL whose document language is `ar` whether or not an
 * editor has translated the page. The document's `lang`/`dir` are the layout's — asserted in
 * `layout.spec.tsx` — and what this file asserts is the other half: that the page annotates the
 * content it received and touches nothing above it.
 */

const { getAboutUsContent } = vi.hoisted(() => ({ getAboutUsContent: vi.fn() }));
const { getActiveLocales } = vi.hoisted(() => ({ getActiveLocales: vi.fn() }));

vi.mock("@/lib/content", () => ({ getAboutUsContent }));
vi.mock("@/lib/locales", () => ({ getActiveLocales }));

/** The frozen Phase 1 set, in the shape the `Locale` table serves it. */
const LOCALES = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "Farsi", direction: "rtl", isDefault: false },
  { code: "ar", name: "Arabic", nativeName: "Arabic", direction: "rtl", isDefault: false },
];

class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new NotFoundSignal();
  },
}));

const CONTENT: AboutUsContent = {
  hero: {
    eyebrow: null,
    title: "VERIFICATION HERO TITLE",
    supportingText: null,
    primaryCta: null,
    secondaryCta: null,
    figure: null,
  },
  whoWeAre: null,
  expertise: null,
  qualityStandards: null,
  closing: null,
  seo: {
    locale: "en",
    metaTitle: "VERIFICATION META TITLE",
    metaDescription: "VERIFICATION META DESCRIPTION",
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

const params = (locale = "en"): Promise<{ locale: string }> => Promise.resolve({ locale });

/** Every failure this route can meet, so a blanket assertion can be made over all of them. */
const FAILURES = [
  { ok: false, reason: "not-configured" },
  { ok: false, reason: "unreachable" },
  { ok: false, reason: "api-error", status: 503 },
  { ok: false, reason: "api-error", status: 404 },
  { ok: false, reason: "api-error", status: 500 },
];

describe("/{locale}/about-us", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    getActiveLocales.mockResolvedValue(LOCALES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getAboutUsContent.mockReset();
    getActiveLocales.mockReset();
  });

  it("reads the page from NestJS for the requested locale", async () => {
    getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: false });

    await AboutUsPage({ params: params("ar") });

    expect(getAboutUsContent).toHaveBeenCalledWith("ar");
  });

  it("renders the CMS content when there is content", async () => {
    getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: false });

    const text = textOf(await AboutUsPage({ params: params() }));

    expect(text).toContain("VERIFICATION HERO TITLE");
  });

  describe("the three conditions", () => {
    it("unpublished — renders the not-published state, never a 404", async () => {
      getAboutUsContent.mockResolvedValue({ ok: false, reason: "not-configured" });

      const text = textOf(await AboutUsPage({ params: params() }));

      expect(text).toContain("has not been published");
      expect(text).not.toContain("temporary service condition");
    });

    it("CMS down behind the API (503) — renders the unavailable state", async () => {
      getAboutUsContent.mockResolvedValue({ ok: false, reason: "api-error", status: 503 });

      const text = textOf(await AboutUsPage({ params: params() }));

      expect(text).toContain("temporary service condition");
      expect(text).not.toContain("has not been published");
    });

    it("API unreachable — renders the unavailable state", async () => {
      getAboutUsContent.mockResolvedValue({ ok: false, reason: "unreachable" });

      const text = textOf(await AboutUsPage({ params: params() }));

      expect(text).toContain("temporary service condition");
    });

    /**
     * A 404 can only mean the API stopped serving a name this route hardcodes. That is a broken
     * deployment, not an unpublished page — so it renders the service state and is logged, rather
     * than telling a reader the page is merely awaiting an editor.
     */
    it("a 404 from the API — renders the unavailable state, not the unpublished one", async () => {
      getAboutUsContent.mockResolvedValue({ ok: false, reason: "api-error", status: 404 });

      const text = textOf(await AboutUsPage({ params: params() }));

      expect(text).toContain("temporary service condition");
      expect(text).not.toContain("has not been published");
    });

    it("never calls notFound(), in any condition", async () => {
      for (const failure of FAILURES) {
        getAboutUsContent.mockResolvedValue(failure);

        await expect(AboutUsPage({ params: params() })).resolves.toBeDefined();
      }
    });

    it("never renders a blank page", async () => {
      for (const failure of FAILURES) {
        getAboutUsContent.mockResolvedValue(failure);

        const text = textOf(await AboutUsPage({ params: params() }));

        expect(text.length).toBeGreaterThan(80);
      }
    });
  });

  describe("locale identity under a CMS fallback", () => {
    it("annotates the fallback content with the locale that was actually served", async () => {
      getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: true });

      const main = findTags(await AboutUsPage({ params: params("ar") }), "main")[0];

      // The default locale — `en`, ltr — because that is what Payload's fallback serves.
      expect(main?.props.lang).toBe("en");
      expect(main?.props.dir).toBe("ltr");
    });

    it("says so on the page, rather than leaving the reader to notice", async () => {
      getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: true });

      const tree = await AboutUsPage({ params: params("ar") });
      const note = elementsOf(tree).find((element) => element.props.role === "note");

      expect(note).toBeDefined();
      expect(textOf(tree)).toContain("has not been translated into this language");
    });

    it("leaves the content unannotated when the requested locale is translated", async () => {
      getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: false });

      const tree = await AboutUsPage({ params: params("ar") });
      const main = findTags(tree, "main")[0];

      expect(main?.props.lang).toBeUndefined();
      expect(main?.props.dir).toBeUndefined();
      expect(textOf(tree)).not.toContain("has not been translated");
    });

    /**
     * The regression this pair exists for: nothing in the page may rewrite the route's own locale
     * to the one the CMS fell back to. The document's `lang`/`dir` are set by the layout from the
     * route segment, and the page must not reach past `<main>` to change them.
     */
    it("does not touch the route locale or anything above main", async () => {
      getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: true });

      const tree = await AboutUsPage({ params: params("ar") });

      expect(findTags(tree, "html")).toHaveLength(0);
      expect(findTags(tree, "body")).toHaveLength(0);
      // The page renders one main, and the annotation is on it and nowhere else.
      expect(findTags(tree, "main")).toHaveLength(1);
    });
  });

  describe("metadata", () => {
    it("comes from the Global's SEO record", async () => {
      getAboutUsContent.mockResolvedValue({ ok: true, content: CONTENT, localeFallback: false });

      const metadata = await generateMetadata({ params: params() });

      expect(metadata.title).toBe("VERIFICATION META TITLE");
      expect(metadata.description).toBe("VERIFICATION META DESCRIPTION");
    });

    it("falls back to the hero heading when no meta title is set", async () => {
      getAboutUsContent.mockResolvedValue({
        ok: true,
        content: { ...CONTENT, seo: { ...CONTENT.seo, metaTitle: null } },
        localeFallback: false,
      });

      const metadata = await generateMetadata({ params: params() });

      expect(metadata.title).toBe("VERIFICATION HERO TITLE");
    });

    it("is empty rather than invented when there is no content", async () => {
      getAboutUsContent.mockResolvedValue({ ok: false, reason: "not-configured" });

      await expect(generateMetadata({ params: params() })).resolves.toEqual({});
    });
  });
});
