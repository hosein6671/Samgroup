import { STRUCTURAL_DEFAULTS, structuralImageSlots } from "@sam-group/types/structural-content";
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
        // Only a scope with photograph slots expands uploads.
        depth: Object.keys(structuralImageSlots(scope)).length > 0 ? "1" : "0",
      });
    },
  );
  it("projects photographs to url, alt and size, and an empty or unexpanded slot to null", async () => {
    findGlobal.mockResolvedValue({
      ...STRUCTURAL_DEFAULTS.home,
      lists: structuralLists("home"),
      _status: "published",
      images: {
        who_we_are: {
          id: 7,
          url: "/cms-media/who.webp",
          alt: "Plant floor",
          width: 1600,
          height: 900,
          filename: "who.webp",
          prefix: "private-prefix",
        },
        custom_formulation: 12,
        network: null,
      },
    });
    const result = await service.read("home", en);
    const content = result.response.content as { fields: Record<string, unknown> };
    expect(content.fields.images).toEqual({
      who_we_are: { url: "/cms-media/who.webp", alt: "Plant floor", width: 1600, height: 900 },
      custom_formulation: null,
      network: null,
    });
    expect(JSON.stringify(result)).not.toContain("private-prefix");
  });
  it("gives every photograph slot even when the document has no images group", async () => {
    findGlobal.mockResolvedValue({
      ...STRUCTURAL_DEFAULTS.home,
      lists: structuralLists("home"),
      _status: "published",
    });
    const content = (await service.read("home", en)).response.content as {
      fields: Record<string, unknown>;
    };
    expect(content.fields.images).toEqual({
      who_we_are: null,
      custom_formulation: null,
      network: null,
    });
  });
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
