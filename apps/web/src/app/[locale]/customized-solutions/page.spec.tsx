import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findTags, textOf } from "@test/element-tree";

import CustomizedSolutionsPage, { generateMetadata } from "./page";

import type { CustomizedSolutionsContent } from "@sam-group/types";

/**
 * `/{locale}/customized-solutions` — the three conditions, and a locale identity that must not move.
 *
 * The rules are the ones About Us established and this page inherits: a recognised Global with
 * nothing published is not a missing resource, infrastructure failure is not a missing resource,
 * and neither may become a canonical 404 on a structural URL. `notFound` is mocked to throw, so any
 * call to it fails these tests loudly.
 */

const { getCustomizedSolutionsContent } = vi.hoisted(() => ({
  getCustomizedSolutionsContent: vi.fn(),
}));
const { getActiveLocales } = vi.hoisted(() => ({ getActiveLocales: vi.fn() }));
/*
 * `getContentPage` is mocked alongside the page's own reader because the shared footer now asks
 * whether a Privacy Policy is published before it decides whether to link one. It answers
 * `not-found`, which is the true state of this project: no policy is published, so no link is
 * rendered. Without it this module-level mock would be missing an export the footer imports.
 */
const { getContentPage } = vi.hoisted(() => ({
  getContentPage: vi.fn(async () => ({ ok: false, reason: "not-found" })),
}));

vi.mock("@/lib/content", () => ({ getCustomizedSolutionsContent, getContentPage }));
vi.mock("@/lib/locales", () => ({ getActiveLocales }));

const LOCALES = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "Farsi", direction: "rtl", isDefault: false },
  { code: "ar", name: "Arabic", nativeName: "Arabic", direction: "rtl", isDefault: false },
];

class NotFoundSignal extends Error {}

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new NotFoundSignal();
  },
}));

const CONTENT: CustomizedSolutionsContent = {
  hero: {
    eyebrow: null,
    title: "VERIFICATION SOLUTIONS TITLE",
    supportingText: null,
    requestCta: { label: "VERIFICATION REQUEST ACTION" },
    routeCta: null,
  },
  introduction: null,
  capabilities: [],
  process: null,
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

const FAILURES = [
  { ok: false, reason: "not-configured" },
  { ok: false, reason: "unreachable" },
  { ok: false, reason: "api-error", status: 503 },
  { ok: false, reason: "api-error", status: 404 },
  { ok: false, reason: "api-error", status: 500 },
];

describe("/{locale}/customized-solutions", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    getActiveLocales.mockResolvedValue(LOCALES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getCustomizedSolutionsContent.mockReset();
    getActiveLocales.mockReset();
  });

  it("reads the page from NestJS for the requested locale", async () => {
    getCustomizedSolutionsContent.mockResolvedValue({
      ok: true,
      content: CONTENT,
      localeFallback: false,
    });

    await CustomizedSolutionsPage({ params: params("ar") });

    expect(getCustomizedSolutionsContent).toHaveBeenCalledWith("ar");
  });

  it("renders the CMS content when there is content", async () => {
    getCustomizedSolutionsContent.mockResolvedValue({
      ok: true,
      content: CONTENT,
      localeFallback: false,
    });

    expect(textOf(await CustomizedSolutionsPage({ params: params() }))).toContain(
      "VERIFICATION SOLUTIONS TITLE",
    );
  });

  describe("the three conditions", () => {
    it("unpublished — renders the not-published state, never a 404", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({ ok: false, reason: "not-configured" });

      const text = textOf(await CustomizedSolutionsPage({ params: params() }));

      expect(text).toContain("has not been published");
      expect(text).not.toContain("temporary service condition");
    });

    it("CMS down behind the API (503) — renders the unavailable state", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({
        ok: false,
        reason: "api-error",
        status: 503,
      });

      const text = textOf(await CustomizedSolutionsPage({ params: params() }));

      expect(text).toContain("temporary service condition");
      expect(text).not.toContain("has not been published");
    });

    it("API unreachable — renders the unavailable state", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({ ok: false, reason: "unreachable" });

      expect(textOf(await CustomizedSolutionsPage({ params: params() }))).toContain(
        "temporary service condition",
      );
    });

    it("never calls notFound(), in any condition", async () => {
      for (const failure of FAILURES) {
        getCustomizedSolutionsContent.mockResolvedValue(failure);

        await expect(CustomizedSolutionsPage({ params: params() })).resolves.toBeDefined();
      }
    });

    it("keeps a route out of the page in every failure state", async () => {
      for (const failure of FAILURES) {
        getCustomizedSolutionsContent.mockResolvedValue(failure);

        const text = textOf(await CustomizedSolutionsPage({ params: params() }));

        expect(text.length).toBeGreaterThan(80);
        // The form is the page's purpose and survives an editorial outage; the page says so.
        expect(text).toContain("request form below is unaffected");
      }
    });
  });

  describe("locale identity under a CMS fallback", () => {
    it("annotates the fallback content with the locale that was actually served", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({
        ok: true,
        content: CONTENT,
        localeFallback: true,
      });

      const main = findTags(await CustomizedSolutionsPage({ params: params("ar") }), "main")[0];

      expect(main?.props.lang).toBe("en");
      expect(main?.props.dir).toBe("ltr");
    });

    it("leaves the content unannotated when the requested locale is translated", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({
        ok: true,
        content: CONTENT,
        localeFallback: false,
      });

      const main = findTags(await CustomizedSolutionsPage({ params: params("ar") }), "main")[0];

      expect(main?.props.lang).toBeUndefined();
      expect(main?.props.dir).toBeUndefined();
    });

    it("does not touch the route locale or anything above main", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({
        ok: true,
        content: CONTENT,
        localeFallback: true,
      });

      const tree = await CustomizedSolutionsPage({ params: params("ar") });

      expect(findTags(tree, "html")).toHaveLength(0);
      expect(findTags(tree, "main")).toHaveLength(1);
    });
  });

  describe("metadata", () => {
    it("comes from the Global's SEO record", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({
        ok: true,
        content: CONTENT,
        localeFallback: false,
      });

      const metadata = await generateMetadata({ params: params() });

      expect(metadata.title).toBe("VERIFICATION META TITLE");
      expect(metadata.description).toBe("VERIFICATION META DESCRIPTION");
    });

    it("falls back to the hero heading when no meta title is set", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({
        ok: true,
        content: { ...CONTENT, seo: { ...CONTENT.seo, metaTitle: null } },
        localeFallback: false,
      });

      expect((await generateMetadata({ params: params() })).title).toBe(
        "VERIFICATION SOLUTIONS TITLE",
      );
    });

    it("is empty rather than invented when there is no content", async () => {
      getCustomizedSolutionsContent.mockResolvedValue({ ok: false, reason: "not-configured" });

      await expect(generateMetadata({ params: params() })).resolves.toEqual({});
    });
  });
});
