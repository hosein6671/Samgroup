import { Test } from "@nestjs/testing";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";

import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

import type { ProductListQuery } from "./dto/product-list.query";
import type { ProductDetailResponse, ProductListItemResponse } from "./dto/product.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { SeoFields } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

const LIST_ITEM: ProductListItemResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "SN 500",
  slug: "sn-500",
  description: "A Group I base oil.",
  categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  createdAt: "2026-01-15T09:30:00.000Z",
};

const SPECIFICATIONS = [
  {
    id: "spec-1",
    key: "Viscosity Index",
    value: "95",
    unit: null,
    method: null,
    qualifier: null,
    resultBasis: "unspecified" as const,
    valueType: null,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: null,
  },
];

/** Opaque here — SeoService's own spec covers how a record is composed. */
const SEO: SeoFields = {
  locale: "en",
  metaTitle: "SN 500",
  metaDescription: "A Group I base oil.",
  canonicalUrl: null,
  ogTitle: "SN 500",
  ogDescription: "A Group I base oil.",
  socialImage: null,
  twitterCardType: "summary_large_image",
  twitterTitle: "SN 500",
  twitterDescription: "A Group I base oil.",
  twitterImage: null,
  robotsIndex: true,
  robotsFollow: true,
  keywords: [],
  structuredDataOverride: null,
  alternates: [{ locale: "en", slug: "sn-500" }],
};

const DETAIL: ProductDetailResponse = {
  id: LIST_ITEM.id,
  name: LIST_ITEM.name,
  slug: LIST_ITEM.slug,
  description: LIST_ITEM.description,
  createdAt: LIST_ITEM.createdAt,
  category: { id: LIST_ITEM.categoryId, name: "Base Oils", slug: "base-oils", parentId: null },
  segments: [{ name: "Industrial", slug: "industrial" }],
  productType: { name: "Base Oil", slug: "base-oil" },
  specifications: SPECIFICATIONS,
  images: [],
  seo: SEO,
};

type Harness = {
  controller: ProductsController;
  findAll: jest.Mock;
  findBySlug: jest.Mock;
  findSpecificationsBySlug: jest.Mock;
  resolve: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findAll = jest.fn().mockResolvedValue({
    products: [LIST_ITEM],
    total: 1,
    page: 1,
    limit: 20,
    localeFallback: false,
  });
  const findBySlug = jest.fn().mockResolvedValue({ product: DETAIL, localeFallback: false });
  const findSpecificationsBySlug = jest.fn().mockResolvedValue(SPECIFICATIONS);
  const resolve = jest.fn().mockResolvedValue(EN);

  const moduleRef = await Test.createTestingModule({
    controllers: [ProductsController],
    providers: [
      {
        provide: ProductsService,
        useValue: { findAll, findBySlug, findSpecificationsBySlug },
      },
      { provide: LocaleResolutionService, useValue: { resolve } },
    ],
  }).compile();

  return {
    controller: moduleRef.get(ProductsController),
    findAll,
    findBySlug,
    findSpecificationsBySlug,
    resolve,
  };
}

describe("ProductsController.findAll", () => {
  it("resolves the locale before querying the catalog", async () => {
    const { controller, resolve, findAll } = await createHarness();

    await controller.findAll({ locale: "fa" });

    expect(resolve).toHaveBeenCalledWith("fa");
    expect(findAll).toHaveBeenCalledWith(EN, { locale: "fa" });
  });

  it("passes the filter, pagination and sort parameters straight through", async () => {
    const { controller, findAll } = await createHarness();
    const query: ProductListQuery = {
      category: "base-oils",
      q: "SN 500",
      page: 2,
      limit: 50,
      sort: "-createdAt",
    };

    await controller.findAll(query);

    expect(findAll).toHaveBeenCalledWith(EN, query);
  });

  it("returns the products as the envelope's data", async () => {
    const { controller } = await createHarness();

    const response = await controller.findAll({});

    expect(response.data).toEqual([LIST_ITEM]);
  });

  // API_DESIGN.md §Pagination & Filtering: list responses ALWAYS carry total, page and limit.
  it("always reports total, page and limit in meta", async () => {
    const { controller } = await createHarness();

    const response = await controller.findAll({});

    expect(response.meta).toEqual({ total: 1, page: 1, limit: 20 });
  });

  it("echoes the effective page and limit the service applied, not the raw query", async () => {
    const { controller, findAll } = await createHarness();

    findAll.mockResolvedValue({
      products: [],
      total: 0,
      page: 1,
      limit: 20,
      localeFallback: false,
    });

    const response = await controller.findAll({});

    expect(response.meta).toEqual({ total: 0, page: 1, limit: 20 });
  });

  it("adds meta.localeFallback only when the service reports a fallback", async () => {
    const { controller, findAll } = await createHarness();

    findAll.mockResolvedValue({
      products: [LIST_ITEM],
      total: 1,
      page: 1,
      limit: 20,
      localeFallback: true,
    });

    const response = await controller.findAll({ locale: "fa" });

    expect(response.meta).toEqual({ total: 1, page: 1, limit: 20, localeFallback: true });
  });
});

describe("ProductsController.findOne", () => {
  it("returns a single product, not an array", async () => {
    const { controller, findBySlug, resolve } = await createHarness();

    const response = await controller.findOne("sn-500", {});

    expect(resolve).toHaveBeenCalledWith(undefined);
    expect(findBySlug).toHaveBeenCalledWith("sn-500", EN);
    expect(response.data).toEqual(DETAIL);
  });

  it("omits localeFallback entirely when nothing fell back", async () => {
    const { controller } = await createHarness();

    const response = await controller.findOne("sn-500", {});

    expect(response.meta).toEqual({});
  });

  it("carries meta.localeFallback when the service reports one", async () => {
    const { controller, findBySlug } = await createHarness();

    findBySlug.mockResolvedValue({ product: DETAIL, localeFallback: true });

    const response = await controller.findOne("sn-500", { locale: "fa" });

    expect(response.meta).toEqual({ localeFallback: true });
  });
});

describe("ProductsController.findSpecifications", () => {
  it("resolves the locale, then returns the specifications as the response body", async () => {
    const { controller, resolve, findSpecificationsBySlug } = await createHarness();

    const response = await controller.findSpecifications("sn-500", { locale: "fa" });

    expect(resolve).toHaveBeenCalledWith("fa");
    expect(findSpecificationsBySlug).toHaveBeenCalledWith("sn-500", EN);
    expect(response).toEqual(SPECIFICATIONS);
  });
});
