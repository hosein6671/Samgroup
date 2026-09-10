import { afterEach, describe, expect, it } from "vitest";
import type { SeoFields } from "@sam-group/types";
import { faqPageMetadata, faqInSitemap } from "./page-content";
describe("FAQ page SEO policy", () => {
  const original = process.env.SITE_SEO_INDEXING;
  afterEach(() => {
    if (original === undefined) delete process.env.SITE_SEO_INDEXING;
    else process.env.SITE_SEO_INDEXING = original;
  });
  it("respects the launch gate, publication availability and filtered URLs", () => {
    delete process.env.SITE_SEO_INDEXING;
    expect(faqPageMetadata("en", { fields: {} }, true, false).robots).toEqual({
      index: false,
      follow: false,
    });
    process.env.SITE_SEO_INDEXING = "true";
    for (const metadata of [
      faqPageMetadata("en", null, true, false),
      faqPageMetadata("en", { fields: {} }, false, false),
      faqPageMetadata("en", { fields: {} }, true, true),
    ])
      expect(metadata.robots).toMatchObject({ index: false });
  });
  it("uses published search and social fields and excludes noindex or other canonical pages", () => {
    process.env.SITE_SEO_INDEXING = "true";
    const content = {
      fields: {},
      seo: {
        metaTitle: "Edited title",
        metaDescription: "Edited description",
        ogTitle: "Social",
        robotsIndex: false,
        robotsFollow: false,
        canonicalUrl: "https://example.com/faq",
      } as SeoFields,
    };
    const meta = faqPageMetadata("en", content, true, false);
    expect(meta.title).toBe("Edited title");
    expect(meta.openGraph).toMatchObject({ title: "Social" });
    expect(meta.alternates).toEqual({ canonical: "https://example.com/faq" });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(faqInSitemap("en", content)).toBe(false);
    expect(faqInSitemap("en", null)).toBe(false);
    expect(faqInSitemap("en", { fields: {} })).toBe(true);
    expect(faqInSitemap("fa", { fields: {} })).toBe(false);
  });
});
