import { beforeEach, it, expect, vi } from "vitest";
const { publishedStructural, isIndexingEnabled } = vi.hoisted(() => ({
  publishedStructural: vi.fn(),
  isIndexingEnabled: vi.fn(),
}));
vi.mock("./published-structural", () => ({ publishedStructural }));
vi.mock("@/features/seo/indexing", () => ({ isIndexingEnabled }));
import { structuralMetadata } from "./structural-seo";
const fallback = {
  title: "Original",
  description: "Original description",
  alternates: { canonical: "/en/products" },
};
beforeEach(() => {
  publishedStructural.mockReset().mockResolvedValue({ fields: {} });
  isIndexingEnabled.mockReturnValue(true);
});
it("applies a published SEO override and keeps canonical and social cards consistent", async () => {
  publishedStructural.mockResolvedValue({
    fields: {},
    seo: {
      metaTitle: "Edited",
      canonicalUrl: "https://samgp.com/en/products",
      robotsIndex: false,
      ogTitle: "Share",
      twitterCardType: "summary",
    },
  });
  const result = await structuralMetadata("products-landing", "en", fallback);
  expect(result.title).toBe("Edited");
  expect(result.description).toBe("Original description");
  expect(result.alternates?.canonical).toBe("https://samgp.com/en/products");
  expect(result.openGraph).toMatchObject({ title: "Share", url: "https://samgp.com/en/products" });
  expect(result.twitter).toMatchObject({ card: "summary", title: "Edited" });
  expect(result.robots).toMatchObject({ index: false });
});
it("never overrides the global indexing gate or indexes untranslated content", async () => {
  isIndexingEnabled.mockReturnValue(false);
  expect((await structuralMetadata("home", "en", fallback)).robots).toMatchObject({
    index: false,
    follow: false,
  });
  isIndexingEnabled.mockReturnValue(true);
  expect((await structuralMetadata("home", "fa", fallback)).robots).toMatchObject({ index: false });
});
it("keeps fallback content but disables indexing when content cannot be verified", async () => {
  publishedStructural.mockResolvedValue(null);
  const result = await structuralMetadata("home", "en", fallback);
  expect(result.title).toBe("Original");
  expect(result.robots).toMatchObject({ index: false });
});
