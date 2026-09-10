import { CategoryContentService } from "./category-content.controller";
import type { PayloadClient } from "./payload.client";

describe("published category narrative", () => {
  const find = jest.fn();
  const service = new CategoryContentService({ find } as unknown as PayloadClient);
  beforeEach(() => find.mockReset());
  it("projects published narrative only and never internal fields", async () => {
    find.mockResolvedValue({
      docs: [
        {
          categoryKey: "base-oils",
          _status: "published",
          heroTitle: "Published",
          id: 4,
          secret: "hidden",
        },
      ],
    });
    expect(await service.read("base-oils", "en")).toEqual({
      available: true,
      fields: { heroTitle: "Published" },
    });
    expect(find.mock.calls[0][1]["where[_status][equals]"]).toBe("published");
    expect(find.mock.calls[0][1]).not.toHaveProperty("draft");
  });
  it("does not serve drafts even when upstream returns one", async () => {
    find.mockResolvedValue({
      docs: [{ categoryKey: "base-oils", _status: "draft", heroTitle: "Private" }],
    });
    expect(await service.read("base-oils", "en")).toEqual({ available: false, fields: {} });
  });
  it("rejects unknown keys and leaves deferred locales alone", async () => {
    await expect(service.read("unknown", "en")).rejects.toThrow();
    expect(await service.read("base-oils", "fa")).toEqual({ available: false, fields: {} });
    expect(find).not.toHaveBeenCalled();
  });
  it("does not turn upstream failure into empty content", async () => {
    find.mockRejectedValue(new Error("unavailable"));
    await expect(service.read("base-oils", "en")).rejects.toThrow("unavailable");
  });
});
