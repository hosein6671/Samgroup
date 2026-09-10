import { FaqPageService } from "./faq-page.service";
import { PayloadClient } from "./payload.client";
describe("FAQ page public projection", () => {
  const findGlobal = jest.fn();
  const service = new FaqPageService({ findGlobal } as unknown as PayloadClient);
  const en = { code: "en", defaultCode: "en", isDefault: true };
  beforeEach(() => jest.resetAllMocks());
  it("rejects drafts and incomplete content", async () => {
    findGlobal.mockResolvedValue({ _status: "draft", title: "Private" });
    expect((await service.find(en)).response.available).toBe(false);
    findGlobal.mockResolvedValue({ _status: "published", title: "Incomplete" });
    expect((await service.find(en)).response.available).toBe(false);
  });
  it("projects only published fields and SEO", async () => {
    const fields = Object.fromEntries(
      [
        "eyebrow",
        "title",
        "introduction",
        "questionsHeading",
        "contactHeading",
        "contactText",
        "contactLabel",
      ].map((key) => [key, "Public"]),
    );
    findGlobal.mockResolvedValue({
      ...fields,
      _status: "published",
      secret: "Hidden",
      seo: { robotsIndex: false },
    });
    const result = await service.find(en);
    expect(result.response).toMatchObject({
      available: true,
      content: { fields, seo: { robotsIndex: false } },
    });
    expect(JSON.stringify(result)).not.toContain("Hidden");
    expect(findGlobal).toHaveBeenCalledWith("faq-page", {
      locale: "en",
      "fallback-locale": "none",
      depth: "0",
    });
  });
});
