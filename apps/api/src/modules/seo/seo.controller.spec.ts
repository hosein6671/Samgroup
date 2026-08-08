import { Test } from "@nestjs/testing";

import { RedirectsService } from "./redirects.service";
import { SeoController } from "./seo.controller";

import type { RedirectResponse } from "./dto/redirect.response";

const RULE: RedirectResponse = {
  fromPath: "/base-oils",
  toPath: "/products/base-oils",
  statusCode: 301,
  locale: null,
};

type Harness = {
  controller: SeoController;
  findActive: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findActive = jest.fn().mockResolvedValue([RULE]);

  const moduleRef = await Test.createTestingModule({
    controllers: [SeoController],
    providers: [{ provide: RedirectsService, useValue: { findActive } }],
  }).compile();

  return { controller: moduleRef.get(SeoController), findActive };
}

describe("SeoController", () => {
  it("returns the active redirects as a bare array for the interceptor to envelope", async () => {
    const { controller } = await createHarness();

    await expect(controller.findRedirects()).resolves.toEqual([RULE]);
  });

  // The endpoint takes no query parameters at all — not even ?locale=, which every
  // content-bearing endpoint accepts. Middleware needs the whole rule set.
  it("passes no arguments to the service", async () => {
    const { controller, findActive } = await createHarness();

    await controller.findRedirects();

    expect(findActive).toHaveBeenCalledWith();
  });
});
