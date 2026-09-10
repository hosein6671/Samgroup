import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/api-client";
import { sharedCategoryFaq } from "./shared-faq";
import { publishedCategoryContent } from "./published-category-content";
import { getCategoryContent } from "./data";

vi.mock("@/lib/api-client", () => ({ apiGet: vi.fn() }));
const get = vi.mocked(apiGet);
const reply = (data: unknown, total = 0): { ok: true; data: unknown; meta: { total: number } } => ({
  ok: true,
  data,
  meta: { total },
});
describe("shared FAQ publication boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("reads every page without exposing partial results", async () => {
    const row = { entryKey: "first", question: "Question", answer: "Answer" };
    get.mockResolvedValueOnce(
      reply(
        Array.from({ length: 100 }, () => row),
        101,
      ),
    );
    get.mockResolvedValueOnce(reply([{ ...row, entryKey: "last" }], 101));
    expect(await sharedCategoryFaq("base-oils", "en")).toHaveLength(101);
    expect(get).toHaveBeenLastCalledWith("/content/faq", {
      locale: "en",
      relatedCategory: "base-oils",
      page: "2",
      limit: "100",
    });
  });
  it("rejects a failed subsequent page", async () => {
    get.mockResolvedValueOnce(reply([{ entryKey: "one", question: "Q", answer: "A" }], 101));
    get.mockResolvedValueOnce(reply(null));
    expect(await sharedCategoryFaq("base-oils", "en")).toBeNull();
  });
  it("keeps existing FAQ on failure but honors intentionally empty published lists", async () => {
    const content = getCategoryContent("base-oils")!;
    const category = reply({ available: true, fields: { useSharedFaq: true } });
    get.mockResolvedValueOnce(category).mockResolvedValueOnce(reply(null));
    expect((await publishedCategoryContent(content, "en")).faq).toBe(content.faq);
    get.mockResolvedValueOnce(category).mockResolvedValueOnce(reply([]));
    expect((await publishedCategoryContent(content, "en")).faq).toEqual([]);
  });
});
