import { Test } from "@nestjs/testing";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

import type { CategoryResponse } from "./dto/category.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

const CATEGORY: CategoryResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Base Oils",
  slug: "base-oils",
  parentId: null,
};

type Harness = {
  controller: CategoriesController;
  findAll: jest.Mock;
  findBySlug: jest.Mock;
  resolve: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findAll = jest.fn().mockResolvedValue({ categories: [CATEGORY], localeFallback: false });
  const findBySlug = jest.fn().mockResolvedValue({ category: CATEGORY, localeFallback: false });
  const resolve = jest.fn().mockResolvedValue(EN);

  const moduleRef = await Test.createTestingModule({
    controllers: [CategoriesController],
    providers: [
      { provide: CategoriesService, useValue: { findAll, findBySlug } },
      { provide: LocaleResolutionService, useValue: { resolve } },
    ],
  }).compile();

  return { controller: moduleRef.get(CategoriesController), findAll, findBySlug, resolve };
}

describe("CategoriesController", () => {
  it("resolves the locale before querying the catalog", async () => {
    const { controller, resolve, findAll } = await createHarness();

    await controller.findAll({ locale: "fa" });

    expect(resolve).toHaveBeenCalledWith("fa");
    expect(findAll).toHaveBeenCalledWith(EN, undefined);
  });

  it("passes parentId through to the service", async () => {
    const { controller, findAll } = await createHarness();

    await controller.findAll({ parentId: CATEGORY.id });

    expect(findAll).toHaveBeenCalledWith(EN, CATEGORY.id);
  });

  // The global interceptor unwraps this into {data, meta}; what matters here is that the
  // handler puts the payload in `data` and never composes the envelope itself.
  it("returns the categories as the envelope's data", async () => {
    const { controller } = await createHarness();

    const response = await controller.findAll({});

    expect(response.data).toEqual([CATEGORY]);
  });

  // API_CONTRACT_FINAL.md §3 words this as "responses include localeFallback: true when any
  // field fell back" — a `false` on every fully translated response is not that contract.
  it("omits localeFallback entirely when nothing fell back", async () => {
    const { controller } = await createHarness();

    const response = await controller.findAll({});

    expect(response.meta).toEqual({});
  });

  it("sets meta.localeFallback when the service reports a fallback", async () => {
    const { controller, findAll } = await createHarness();

    findAll.mockResolvedValue({ categories: [CATEGORY], localeFallback: true });

    const response = await controller.findAll({});

    expect(response.meta).toEqual({ localeFallback: true });
  });

  it("returns a single category, not an array, for the slug endpoint", async () => {
    const { controller, findBySlug, resolve } = await createHarness();

    const response = await controller.findOne("base-oils", {});

    expect(resolve).toHaveBeenCalledWith(undefined);
    expect(findBySlug).toHaveBeenCalledWith("base-oils", EN);
    expect(response.data).toEqual(CATEGORY);
  });

  it("carries meta.localeFallback on the slug endpoint too", async () => {
    const { controller, findBySlug } = await createHarness();

    findBySlug.mockResolvedValue({ category: CATEGORY, localeFallback: true });

    const response = await controller.findOne("base-oils", { locale: "fa" });

    expect(response.meta).toEqual({ localeFallback: true });
  });
});
