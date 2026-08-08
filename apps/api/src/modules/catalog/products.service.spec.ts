import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { MediaService } from "../media/media.service";
import { SeoService } from "../seo/seo.service";

import { ProductsService } from "./products.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { SeoFields } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const CATEGORY = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Base Oils",
  slug: "base-oils",
  parentId: null,
};

const CREATED_AT = new Date("2026-01-15T09:30:00.000Z");

const PRODUCT_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "SN 500",
  slug: "sn-500",
  description: "A Group I base oil.",
  categoryId: CATEGORY.id,
  createdAt: CREATED_AT,
};

const DETAIL_ROW = {
  id: PRODUCT_ROW.id,
  name: PRODUCT_ROW.name,
  slug: PRODUCT_ROW.slug,
  description: PRODUCT_ROW.description,
  createdAt: CREATED_AT,
  category: CATEGORY,
  specifications: [
    { id: "spec-1", key: "Viscosity Index", value: "95", unit: null },
    { id: "spec-2", key: "Flash Point", value: "230", unit: "°C" },
  ],
};

/** Whatever SeoService returns is opaque here — its own spec covers how it is composed. */
const SEO: SeoFields = {
  locale: "en",
  metaTitle: "SN 500",
  metaDescription: "A Group I base oil.",
  canonicalUrl: null,
  ogTitle: "SN 500",
  ogDescription: "A Group I base oil.",
  ogImageUrl: null,
  twitterCardType: "summary_large_image",
  twitterTitle: "SN 500",
  twitterDescription: "A Group I base oil.",
  twitterImageUrl: null,
  robotsIndex: true,
  robotsFollow: true,
  keywords: [],
  structuredDataOverride: null,
  alternates: [{ locale: "en", slug: "sn-500" }],
};

type Stubs = {
  service: ProductsService;
  productCount: jest.Mock;
  productFindMany: jest.Mock;
  productFindUnique: jest.Mock;
  categoryFindUnique: jest.Mock;
  specificationFindMany: jest.Mock;
  findImagesForOwner: jest.Mock;
  translationFindMany: jest.Mock;
  translationFindFirst: jest.Mock;
  buildSeo: jest.Mock;
};

/** No database is reached — only the delegate methods this service calls are stubbed. */
function createService(): Stubs {
  const productCount = jest.fn().mockResolvedValue(1);
  const productFindMany = jest.fn().mockResolvedValue([PRODUCT_ROW]);
  const productFindUnique = jest.fn().mockResolvedValue(DETAIL_ROW);
  const categoryFindUnique = jest.fn().mockResolvedValue({ id: CATEGORY.id });
  const specificationFindMany = jest.fn().mockResolvedValue(DETAIL_ROW.specifications);
  const findImagesForOwner = jest.fn().mockResolvedValue([]);
  const translationFindMany = jest.fn().mockResolvedValue([]);
  const translationFindFirst = jest.fn().mockResolvedValue(null);
  const buildSeo = jest.fn().mockResolvedValue(SEO);

  const prisma = {
    product: { count: productCount, findMany: productFindMany, findUnique: productFindUnique },
    category: { findUnique: categoryFindUnique },
    specification: { findMany: specificationFindMany },
    contentTranslation: { findMany: translationFindMany, findFirst: translationFindFirst },
  } as unknown as PrismaService;

  // SeoService IS stubbed, unlike the translation service: nothing here asserts on how a SEO
  // record is composed, and the real one would issue queries against the same
  // contentTranslation mock that this file's translation assertions depend on.
  const seo = { buildFor: buildSeo } as unknown as SeoService;

  // MediaService is stubbed for the same reason, and there is no `media` delegate on the
  // Prisma mock above: this service no longer reaches `media` at all. What the query looks
  // like is media.service.spec.ts's assertion; what this service asks for is this file's.
  const media = { findImagesForOwner } as unknown as MediaService;

  return {
    // The real translation service, not a stub: it owns the translation queries these tests
    // assert on, and stubbing it would leave those assertions checking nothing.
    service: new ProductsService(prisma, new ContentTranslationService(prisma), seo, media),
    productCount,
    productFindMany,
    productFindUnique,
    categoryFindUnique,
    specificationFindMany,
    findImagesForOwner,
    translationFindMany,
    translationFindFirst,
    buildSeo,
  };
}

async function captureError(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (thrown) {
    return thrown as ApiException;
  }

  throw new Error("Expected the call to reject, but it resolved.");
}

describe("ProductsService.findAll — pagination and sorting", () => {
  it("applies the documented defaults when the query carries none", async () => {
    const { service, productFindMany } = createService();

    const result = await service.findAll(EN, {});

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("translates page and limit into skip and take", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { page: 3, limit: 10 });

    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
  });

  it("maps every accepted sort value onto a column and direction", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { sort: "-createdAt" });
    expect(productFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    );

    await service.findAll(EN, { sort: "createdAt" });
    expect(productFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );

    await service.findAll(EN, { sort: "-name" });
    expect(productFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: [{ name: "desc" }, { id: "asc" }] }),
    );
  });

  it("counts against the same filter it lists with", async () => {
    const { service, productCount, productFindMany } = createService();

    productCount.mockResolvedValue(42);

    const result = await service.findAll(EN, { category: "base-oils" });
    const listed = productFindMany.mock.calls[0]?.[0] as { where: unknown };
    const counted = productCount.mock.calls[0]?.[0] as { where: unknown };

    expect(counted.where).toEqual(listed.where);
    expect(result.total).toBe(42);
  });

  it("serializes createdAt as an ISO string rather than leaking a Date", async () => {
    const { service } = createService();

    const result = await service.findAll(EN, {});

    expect(result.products[0]?.createdAt).toBe("2026-01-15T09:30:00.000Z");
  });
});

describe("ProductsService.findAll — filtering", () => {
  it("sends no filter at all when neither category nor q is given", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, {});

    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  // A filter UI submits every control it owns, so `?q=&category=` is an unfiltered list.
  it("treats blank category and q as omitted", async () => {
    const { service, productFindMany, categoryFindUnique } = createService();

    await service.findAll(EN, { category: "   ", q: "" });

    expect(categoryFindUnique).not.toHaveBeenCalled();
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("resolves ?category= as a slug and filters by the matching id, exactly", async () => {
    const { service, productFindMany, categoryFindUnique } = createService();

    await service.findAll(EN, { category: "base-oils" });

    expect(categoryFindUnique).toHaveBeenCalledWith({
      where: { slug: "base-oils" },
      select: { id: true },
    });
    // `categoryId` equality, not a subtree predicate: children are not pulled in.
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: CATEGORY.id } }),
    );
  });

  it("resolves a locale-specific category slug through content_translations", async () => {
    const { service, productFindMany, translationFindFirst, categoryFindUnique } = createService();

    translationFindFirst.mockResolvedValue({ entityId: CATEGORY.id });

    await service.findAll(FA, { category: "روغن-پایه" });

    expect(translationFindFirst).toHaveBeenCalledWith({
      where: { entityType: "Category", locale: "fa", field: "slug", value: "روغن-پایه" },
      select: { entityId: true },
    });
    expect(categoryFindUnique).not.toHaveBeenCalled();
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: CATEGORY.id } }),
    );
  });

  it("falls back to the default-locale category slug when the locale has no translated one", async () => {
    const { service, categoryFindUnique } = createService();

    await service.findAll(FA, { category: "base-oils" });

    expect(categoryFindUnique).toHaveBeenCalledWith({
      where: { slug: "base-oils" },
      select: { id: true },
    });
  });

  // An empty 200 would be indistinguishable from a genuinely empty category.
  it("rejects a category slug that matches nothing with VALIDATION_ERROR on the field", async () => {
    const { service, categoryFindUnique, productFindMany } = createService();

    categoryFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findAll(EN, { category: "no-such-category" }));

    expect(error).toBeInstanceOf(ApiException);
    expect(error.code).toBe(ErrorCode.ValidationError);
    expect(error.getStatus()).toBe(400);
    expect(error.details).toEqual([{ field: "category", issue: expect.any(String) }]);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("does not echo the rejected category slug back in the message", async () => {
    const { service, categoryFindUnique } = createService();

    categoryFindUnique.mockResolvedValue(null);

    const error = await captureError(
      service.findAll(EN, { category: "<script>alert(1)</script>" }),
    );

    expect(error.message).not.toContain("script");
  });
});

describe("ProductsService.findAll — search", () => {
  it("matches name, slug and specification values", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { q: "SN 500" });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "SN 500", mode: "insensitive" } },
            { slug: { contains: "SN 500", mode: "insensitive" } },
            { specifications: { some: { value: { contains: "SN 500", mode: "insensitive" } } } },
          ],
        },
      }),
    );
  });

  it("trims the search term", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { q: "  SN 500  " });

    const call = productFindMany.mock.calls[0]?.[0] as { where: { OR: { name?: unknown }[] } };

    expect(call.where.OR[0]).toEqual({ name: { contains: "SN 500", mode: "insensitive" } });
  });

  it("combines a category filter and a search rather than letting one replace the other", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { category: "base-oils", q: "SN" });

    const call = productFindMany.mock.calls[0]?.[0] as {
      where: { categoryId?: string; OR?: unknown[] };
    };

    expect(call.where.categoryId).toBe(CATEGORY.id);
    expect(call.where.OR).toHaveLength(3);
  });

  it("queries no translations for a default-locale search", async () => {
    const { service, translationFindMany } = createService();

    await service.findAll(EN, { q: "SN 500" });

    expect(translationFindMany).not.toHaveBeenCalled();
  });

  it("adds translated matches for a non-default locale", async () => {
    const { service, productFindMany, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([{ entityId: PRODUCT_ROW.id }]);

    await service.findAll(FA, { q: "روغن" });

    const call = productFindMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };

    expect(call.where.OR).toHaveLength(4);
    expect(call.where.OR[3]).toEqual({ id: { in: [PRODUCT_ROW.id] } });
  });

  it("omits the translated branch when no translation matched", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(FA, { q: "روغن" });

    const call = productFindMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };

    expect(call.where.OR).toHaveLength(3);
  });
});

describe("ProductsService.findAll — localization", () => {
  it("overlays translated fields and reports no fallback when all are present", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([
      { entityId: PRODUCT_ROW.id, field: "name", value: "اس‌ان ۵۰۰" },
      { entityId: PRODUCT_ROW.id, field: "slug", value: "اس‌ان-۵۰۰" },
      { entityId: PRODUCT_ROW.id, field: "description", value: "روغن پایه گروه یک." },
    ]);

    const result = await service.findAll(FA, {});

    expect(result.products[0]).toEqual({
      id: PRODUCT_ROW.id,
      name: "اس‌ان ۵۰۰",
      slug: "اس‌ان-۵۰۰",
      description: "روغن پایه گروه یک.",
      categoryId: CATEGORY.id,
      createdAt: "2026-01-15T09:30:00.000Z",
    });
    expect(result.localeFallback).toBe(false);
  });

  it("reports localeFallback when a field has no translation", async () => {
    const { service } = createService();

    const result = await service.findAll(FA, {});

    expect(result.products[0]?.name).toBe("SN 500");
    expect(result.localeFallback).toBe(true);
  });
});

describe("ProductsService.findBySlug", () => {
  it("reads the slug off the row itself for the default locale", async () => {
    const { service, productFindUnique, translationFindFirst } = createService();

    const result = await service.findBySlug("sn-500", EN);

    expect(translationFindFirst).not.toHaveBeenCalled();
    expect(productFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "sn-500" } }),
    );
    expect(result.product.id).toBe(PRODUCT_ROW.id);
    expect(result.localeFallback).toBe(false);
  });

  it("resolves a locale-specific slug through content_translations", async () => {
    const { service, productFindUnique, translationFindFirst } = createService();

    translationFindFirst.mockResolvedValue({ entityId: PRODUCT_ROW.id });

    await service.findBySlug("اس‌ان-۵۰۰", FA);

    expect(productFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PRODUCT_ROW.id } }),
    );
  });

  it("falls back to the default slug when the locale has no translated slug", async () => {
    const { service, productFindUnique } = createService();

    await service.findBySlug("sn-500", FA);

    expect(productFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "sn-500" } }),
    );
  });

  it("raises NOT_FOUND when the slug matches nothing in any locale", async () => {
    const { service, productFindUnique } = createService();

    productFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findBySlug("missing", EN));

    expect(error).toBeInstanceOf(ApiException);
    expect(error.code).toBe(ErrorCode.NotFound);
    expect(error.getStatus()).toBe(404);
  });

  it("does not echo the requested slug back in the not-found message", async () => {
    const { service, productFindUnique } = createService();

    productFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findBySlug("<script>alert(1)</script>", EN));

    expect(error.message).not.toContain("script");
  });

  it("returns the category, the specifications and the images in one response", async () => {
    const { service, findImagesForOwner } = createService();

    findImagesForOwner.mockResolvedValue([
      { id: "media-1", url: "/img/sn-500.webp", altText: "SN 500" },
    ]);

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product.category).toEqual(CATEGORY);
    expect(result.product.specifications).toEqual(DETAIL_ROW.specifications);
    expect(result.product.images).toEqual([
      { id: "media-1", url: "/img/sn-500.webp", altText: "SN 500" },
    ]);
  });

  // What this service is responsible for is naming BOTH halves of the polymorphic owner key.
  // Which rows that selects — the `type = image` filter that keeps COA, SDS and TDS out of a
  // public gallery — is MediaService's to enforce and media.service.spec.ts's to assert.
  it("asks MediaService for the images owned by this product", async () => {
    const { service, findImagesForOwner } = createService();

    await service.findBySlug("sn-500", EN);

    expect(findImagesForOwner).toHaveBeenCalledWith("Product", PRODUCT_ROW.id);
  });

  it("localizes the nested category as well as the product", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockImplementation(
      (args: { where: { entityType: string } }): Promise<unknown[]> =>
        Promise.resolve(
          args.where.entityType === "Category"
            ? [{ entityId: CATEGORY.id, field: "name", value: "روغن پایه" }]
            : [],
        ),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.product.category.name).toBe("روغن پایه");
    // The product's own fields did not translate, and the flag has to say so even though the
    // category partly did.
    expect(result.localeFallback).toBe(true);
  });

  it("does not report a fallback when a null description has no translation", async () => {
    const { service, productFindUnique, translationFindMany } = createService();

    productFindUnique.mockResolvedValue({ ...DETAIL_ROW, description: null });
    translationFindMany.mockImplementation(
      (args: { where: { entityType: string } }): Promise<unknown[]> =>
        Promise.resolve(
          args.where.entityType === "Category"
            ? [
                { entityId: CATEGORY.id, field: "name", value: "روغن پایه" },
                { entityId: CATEGORY.id, field: "slug", value: "روغن-پایه" },
              ]
            : [
                { entityId: PRODUCT_ROW.id, field: "name", value: "اس‌ان ۵۰۰" },
                { entityId: PRODUCT_ROW.id, field: "slug", value: "اس‌ان-۵۰۰" },
              ],
        ),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.product.description).toBeNull();
    expect(result.localeFallback).toBe(false);
  });
});

describe("ProductsService.findBySlug — SEO", () => {
  it("attaches the SEO record SeoService built", async () => {
    const { service } = createService();

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product.seo).toBe(SEO);
  });

  it("asks SEO for this product, in the requested locale", async () => {
    const { service, buildSeo } = createService();

    await service.findBySlug("sn-500", FA);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "Product", entityId: PRODUCT_ROW.id }),
      FA,
    );
  });

  // §11 falls the meta title and description back to the entity's own content, and a Persian
  // page whose title fell back to English would advertise the wrong language to a crawler.
  it("passes the localized name and description as fallbacks", async () => {
    const { service, buildSeo, translationFindMany } = createService();

    translationFindMany.mockImplementation(
      (args: { where: { entityType: string } }): Promise<unknown[]> =>
        Promise.resolve(
          args.where.entityType === "Product"
            ? [
                { entityId: PRODUCT_ROW.id, field: "name", value: "اس‌ان ۵۰۰" },
                { entityId: PRODUCT_ROW.id, field: "description", value: "روغن پایه گروه یک." },
              ]
            : [],
        ),
    );

    await service.findBySlug("sn-500", FA);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackTitle: "اس‌ان ۵۰۰",
        fallbackDescription: "روغن پایه گروه یک.",
      }),
      FA,
    );
  });

  // The default locale's alternate is the base column. Handing over the localized copy would
  // make hreflang="x-default" point at the Persian path.
  it("passes the base row's slug, not the translated one, as the default slug", async () => {
    const { service, buildSeo, translationFindFirst, translationFindMany } = createService();

    translationFindFirst.mockResolvedValue({ entityId: PRODUCT_ROW.id });
    translationFindMany.mockImplementation(
      (args: { where: { entityType: string } }): Promise<unknown[]> =>
        Promise.resolve(
          args.where.entityType === "Product"
            ? [{ entityId: PRODUCT_ROW.id, field: "slug", value: "اس‌ان-۵۰۰" }]
            : [],
        ),
    );

    const result = await service.findBySlug("اس‌ان-۵۰۰", FA);

    expect(result.product.slug).toBe("اس‌ان-۵۰۰");
    expect(buildSeo).toHaveBeenCalledWith(expect.objectContaining({ defaultSlug: "sn-500" }), FA);
  });

  // §2.3 attaches SeoFields to the detail endpoint only — a 20-row page would otherwise pay
  // for 20 SEO lookups no list layout renders.
  it("builds no SEO record for the list endpoint", async () => {
    const { service, buildSeo } = createService();

    await service.findAll(EN, {});

    expect(buildSeo).not.toHaveBeenCalled();
  });

  it("builds no SEO record for the specifications endpoint", async () => {
    const { service, buildSeo } = createService();

    await service.findSpecificationsBySlug("sn-500", EN);

    expect(buildSeo).not.toHaveBeenCalled();
  });

  it("builds no SEO record when the slug matches nothing", async () => {
    const { service, productFindUnique, buildSeo } = createService();

    productFindUnique.mockResolvedValue(null);

    await captureError(service.findBySlug("missing", EN));

    expect(buildSeo).not.toHaveBeenCalled();
  });
});

describe("ProductsService.findSpecificationsBySlug", () => {
  it("returns the specifications of the product the slug names", async () => {
    const { service, specificationFindMany } = createService();

    const result = await service.findSpecificationsBySlug("sn-500", EN);

    expect(specificationFindMany).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ROW.id },
      orderBy: [{ key: "asc" }, { value: "asc" }],
      select: { id: true, key: true, value: true, unit: true },
    });
    expect(result).toEqual(DETAIL_ROW.specifications);
  });

  it("resolves a locale-specific slug the same way the detail endpoint does", async () => {
    const { service, productFindUnique, translationFindFirst } = createService();

    translationFindFirst.mockResolvedValue({ entityId: PRODUCT_ROW.id });

    await service.findSpecificationsBySlug("اس‌ان-۵۰۰", FA);

    expect(productFindUnique).toHaveBeenCalledWith({
      where: { id: PRODUCT_ROW.id },
      select: { id: true },
    });
  });

  it("raises NOT_FOUND rather than an empty array for an unknown slug", async () => {
    const { service, productFindUnique, specificationFindMany } = createService();

    productFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findSpecificationsBySlug("missing", EN));

    expect(error.code).toBe(ErrorCode.NotFound);
    expect(specificationFindMany).not.toHaveBeenCalled();
  });
});
