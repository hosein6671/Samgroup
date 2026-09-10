import { FaqQuery, FaqService } from "./faq.controller";
import type { PayloadClient } from "./payload.client";

describe("published shared FAQ", () => {
  const findPage = jest.fn();
  const service = new FaqService({ findPage } as unknown as PayloadClient);
  beforeEach(() => findPage.mockReset());
  it("combines filters and projects only public answer fields", async () => {
    findPage.mockResolvedValue({
      docs: [
        {
          _status: "published",
          entryKey: "key",
          question: "Question",
          answer: "Answer",
          secret: "hidden",
        },
      ],
      total: 1,
    });
    const query = Object.assign(new FaqQuery(), {
      relatedCategory: "base-oils",
      category: "products",
      contact: "true",
    });
    expect(await service.list(query, "en")).toEqual({
      items: [{ entryKey: "key", question: "Question", answer: "Answer" }],
      total: 1,
    });
    expect(findPage).toHaveBeenCalledWith(
      "faq-entries",
      expect.objectContaining({
        "where[_status][equals]": "published",
        "where[relatedCategoryKeys][contains]": "base-oils",
        "where[topic][equals]": "products",
        "where[showOnContactPage][equals]": "true",
      }),
    );
  });
  it("does not return drafts or collapse failure into empty content", async () => {
    findPage.mockResolvedValue({ docs: [{ _status: "draft" }], total: 1 });
    await expect(service.list(new FaqQuery(), "en")).rejects.toThrow();
    findPage.mockRejectedValue(new Error("unavailable"));
    await expect(service.list(new FaqQuery(), "en")).rejects.toThrow("unavailable");
  });
  it("leaves untranslated locales deferred", async () => {
    expect(await service.list(new FaqQuery(), "fa")).toEqual({ items: [], total: 0 });
    expect(findPage).not.toHaveBeenCalled();
  });
});
