import { describe, expect, it, vi } from "vitest";
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiGet }));
import { getPublishedCategoryData, publishedCategoryContent } from "./published-category-content";
import { getCategoryContent } from "./data";

describe("published category lookup", () => {
  it("distinguishes successful absence from an unavailable service", async () => {
    apiGet.mockResolvedValue({ ok: true, data: { available: false, fields: {} } });
    expect(await getPublishedCategoryData("base-oils", "en")).toEqual({
      available: false,
      fields: {},
    });
    apiGet.mockResolvedValue({ ok: false });
    expect(await getPublishedCategoryData("base-oils", "en")).toBeNull();
  });
  it("does not overlay unpublished fields", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: { available: false, fields: { heroTitle: "Private" } },
    });
    const content = getCategoryContent("base-oils")!;
    expect(await publishedCategoryContent(content, "en")).toBe(content);
  });
});
