import { afterEach, describe, expect, it } from "vitest";
import { getCategoryContent } from "./data";
import { categoryMetadata } from "./category-metadata";
import type { SeoFields } from "@sam-group/types";

describe("category published SEO", () => {
  const original = process.env.SITE_SEO_INDEXING;
  afterEach(() => {
    if (original === undefined) delete process.env.SITE_SEO_INDEXING;
    else process.env.SITE_SEO_INDEXING = original;
  });
  const content = getCategoryContent("base-oils")!;
  it("keeps the global launch gate above page preferences", () => {
    delete process.env.SITE_SEO_INDEXING;
    expect(
      categoryMetadata(content, "en", { robotsIndex: true, robotsFollow: true } as SeoFields)
        .robots,
    ).toEqual({ index: false, follow: false });
    process.env.SITE_SEO_INDEXING = "true";
    expect(categoryMetadata(content, "en", undefined, true).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(
      categoryMetadata(content, "en", { robotsIndex: false, robotsFollow: true } as SeoFields)
        .robots,
    ).toEqual({ index: false, follow: true });
  });
  it("uses published overrides consistently across search and sharing", () => {
    const meta = categoryMetadata(content, "en", {
      metaTitle: "Edited title",
      metaDescription: "Edited description",
      canonicalUrl: "https://samgp.com/en/products/base-oils",
      keywords: ["base oils"],
      twitterCardType: "summary",
    } as SeoFields);
    expect(meta.title).toBe("Edited title");
    expect(meta.openGraph).toMatchObject({
      title: "Edited title",
      description: "Edited description",
      url: meta.alternates?.canonical,
    });
    expect(meta.twitter).toMatchObject({ card: "summary", title: "Edited title" });
  });
  it("retains existing metadata until SEO is published", () => {
    expect(categoryMetadata(content, "en").title).toBe(content.meta.title);
    expect(categoryMetadata(content, "en").alternates?.canonical).toBe("/en/products/base-oils");
  });
});
