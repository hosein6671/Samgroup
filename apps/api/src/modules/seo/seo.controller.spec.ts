import { Test } from "@nestjs/testing";

import { ContentEntityType } from "../../common/content/content-entity-type";

import { RedirectsService } from "./redirects.service";
import { SeoController } from "./seo.controller";
import { SitemapService } from "./sitemap.service";

import type { RedirectResponse } from "./dto/redirect.response";
import type { SitemapEntryResponse } from "./dto/sitemap-entry.response";

const RULE: RedirectResponse = {
  fromPath: "/base-oils",
  toPath: "/products/base-oils",
  statusCode: 301,
  locale: null,
};

const ENTRY: SitemapEntryResponse = {
  entityType: ContentEntityType.Category,
  entityId: "11111111-1111-4111-8111-111111111111",
  locale: "en",
  slug: "base-oils",
};

type Harness = {
  controller: SeoController;
  findActive: jest.Mock;
  findEntries: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findActive = jest.fn().mockResolvedValue([RULE]);
  const findEntries = jest.fn().mockResolvedValue([ENTRY]);

  const moduleRef = await Test.createTestingModule({
    controllers: [SeoController],
    providers: [
      { provide: RedirectsService, useValue: { findActive } },
      { provide: SitemapService, useValue: { findEntries } },
    ],
  }).compile();

  return { controller: moduleRef.get(SeoController), findActive, findEntries };
}

describe("SeoController", () => {
  it("returns the active redirects as a bare array for the interceptor to envelope", async () => {
    const { controller } = await createHarness();

    await expect(controller.findRedirects()).resolves.toEqual([RULE]);
  });

  // The endpoint takes no query parameters at all — not even ?locale=, which every
  // content-bearing endpoint accepts. Middleware needs the whole rule set.
  it("passes no arguments to the redirects service", async () => {
    const { controller, findActive } = await createHarness();

    await controller.findRedirects();

    expect(findActive).toHaveBeenCalledWith();
  });

  it("returns the sitemap entries as a bare array for the interceptor to envelope", async () => {
    const { controller } = await createHarness();

    await expect(controller.findSitemapEntries()).resolves.toEqual([ENTRY]);
  });

  // Same reasoning as redirects: app/sitemap.ts sits outside [locale] and produces one document
  // covering every language, so the endpoint is not locale-scoped either.
  it("passes no arguments to the sitemap service", async () => {
    const { controller, findEntries } = await createHarness();

    await controller.findSitemapEntries();

    expect(findEntries).toHaveBeenCalledWith();
  });
});
