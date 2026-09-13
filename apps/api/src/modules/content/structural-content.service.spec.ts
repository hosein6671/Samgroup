import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { structuralLists } from "@sam-group/types/structural-lists";
import { StructuralContentService } from "./structural-content.service";
import { PayloadClient } from "./payload.client";
const en = { code: "en", defaultCode: "en", isDefault: true };
describe("structural content publication boundary", () => {
  const findGlobal = jest.fn();
  const service = new StructuralContentService({ findGlobal } as unknown as PayloadClient);
  beforeEach(() => jest.resetAllMocks());
  it.each(Object.keys(STRUCTURAL_DEFAULTS) as (keyof typeof STRUCTURAL_DEFAULTS)[])(
    "projects %s without internal data",
    async (scope) => {
      const fields = { ...STRUCTURAL_DEFAULTS[scope], lists: structuralLists(scope) };
      findGlobal.mockResolvedValue({
        ...fields,
        _status: "published",
        secret: "private",
        seo: { robotsIndex: false },
      });
      const result = await service.read(scope, en);
      expect(result.response).toMatchObject({
        available: true,
        content: { fields, seo: { robotsIndex: false } },
      });
      expect(JSON.stringify(result)).not.toContain("private");
      expect(findGlobal).toHaveBeenCalledWith(scope, {
        locale: "en",
        "fallback-locale": "none",
        depth: "0",
      });
    },
  );
  it("does not expose drafts or incomplete records", async () => {
    findGlobal.mockResolvedValue({
      ...STRUCTURAL_DEFAULTS.home,
      lists: structuralLists("home"),
      _status: "draft",
    });
    expect((await service.read("home", en)).response.available).toBe(false);
    findGlobal.mockResolvedValue({ _status: "published" });
    expect((await service.read("home", en)).response.available).toBe(false);
  });
  it("does not claim an English fallback is translated", async () => {
    expect(
      (await service.read("home", { code: "fa", defaultCode: "en", isDefault: false })).response
        .available,
    ).toBe(false);
    expect(findGlobal).not.toHaveBeenCalled();
  });
  it("preserves infrastructure failures", async () => {
    findGlobal.mockRejectedValue(new Error("unavailable"));
    await expect(service.read("home", en)).rejects.toThrow("unavailable");
  });
});
