import { Test } from "@nestjs/testing";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { ContentPagesController } from "./content-pages.controller";
import { ContentPagesService } from "./content-pages.service";

import type { ContentPageResponse } from "./dto/content-page.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

const PAGE: ContentPageResponse = {
  slug: "cms-demo-page",
  title: "CMS Demo Page",
  bodyHtml: "<p>DEMO / PLACEHOLDER / NON-AUTHORITATIVE.</p>",
  lastUpdatedDate: "2026-08-16T00:00:00.000Z",
};

type Harness = {
  controller: ContentPagesController;
  findBySlug: jest.Mock;
  resolve: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findBySlug = jest.fn().mockResolvedValue({ page: PAGE, localeFallback: false });
  const resolve = jest.fn().mockResolvedValue(EN);

  const moduleRef = await Test.createTestingModule({
    controllers: [ContentPagesController],
    providers: [
      { provide: ContentPagesService, useValue: { findBySlug } },
      { provide: LocaleResolutionService, useValue: { resolve } },
    ],
  }).compile();

  return { controller: moduleRef.get(ContentPagesController), findBySlug, resolve };
}

describe("ContentPagesController", () => {
  it("returns the page with empty meta when nothing fell back", async () => {
    const { controller } = await createHarness();

    const result = await controller.findOne("cms-demo-page", {});

    expect(result.data).toEqual(PAGE);
    expect(result.meta).toEqual({});
  });

  it("reports meta.localeFallback when the service says a field fell back", async () => {
    const { controller, findBySlug } = await createHarness();
    findBySlug.mockResolvedValue({ page: PAGE, localeFallback: true });

    const result = await controller.findOne("cms-demo-page", { locale: "fa" });

    expect(result.meta).toEqual({ localeFallback: true });
  });

  it("resolves the locale before the CMS is consulted", async () => {
    const { controller, findBySlug, resolve } = await createHarness();
    resolve.mockRejectedValue(new Error("INVALID_LOCALE"));

    await expect(controller.findOne("cms-demo-page", { locale: "zz" })).rejects.toThrow();

    // An unknown locale must not cost a CMS request, and must answer identically whether or not
    // the CMS is up.
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it("passes the resolved locale, not the raw query value", async () => {
    const { controller, findBySlug } = await createHarness();

    await controller.findOne("cms-demo-page", { locale: "en" });

    expect(findBySlug).toHaveBeenCalledWith("cms-demo-page", EN);
  });
});
