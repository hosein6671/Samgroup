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

/**
 * Two Segments and one Product Type — ADR-007 §4's two navigation axes. The database is mocked,
 * so these rows stand in for taxonomy tables that currently hold no rows at all.
 */
const INDUSTRIAL = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Industrial",
  slug: "industrial",
};

const MARINE = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Marine",
  slug: "marine",
};

const PRODUCT_TYPE = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Base Oil",
  slug: "base-oil",
};

const DETAIL_ROW = {
  id: PRODUCT_ROW.id,
  name: PRODUCT_ROW.name,
  slug: PRODUCT_ROW.slug,
  description: PRODUCT_ROW.description,
  createdAt: CREATED_AT,
  category: CATEGORY,
  productType: PRODUCT_TYPE,
  // Prisma returns the join rows already ordered; the mock hands back what that read would.
  segments: [{ segment: INDUSTRIAL }, { segment: MARINE }],
  // The raw shape `PUBLIC_SPECIFICATION_SELECT` reads off `Specification` — what Prisma would
  // actually return, not the wire shape `toSpecificationResponse` produces from it. spec-1 is a
  // legacy row (every ADR-014 column at its default); spec-2 is a Grade-level POINT fact with a
  // method; spec-3 is a RANGE fact carrying a qualifier (test condition) and both numeric bounds
  // — every additive column exercised by at least one row.
  specifications: [
    {
      id: "spec-1",
      key: "Viscosity Index",
      value: "95",
      displayValue: null,
      unit: null,
      method: null,
      qualifier: null,
      resultBasis: "UNSPECIFIED",
      valueType: null,
      numericMin: null,
      numericMax: null,
      pairFirst: null,
      pairSecond: null,
      productGrade: null,
    },
    {
      id: "spec-2",
      key: "Flash Point",
      value: "230",
      displayValue: "230 (typical)",
      unit: "°C",
      method: "ASTM D92",
      qualifier: null,
      resultBasis: "TYPICAL",
      valueType: "POINT",
      numericMin: "230",
      numericMax: null,
      pairFirst: null,
      pairSecond: null,
      productGrade: { label: "SAE 15W-40", gradeSystem: "SAE" },
    },
    {
      id: "spec-3",
      key: "Kinematic viscosity",
      value: "legacy-230",
      displayValue: "28.8 – 33.5 mm²/s",
      unit: "mm²/s",
      method: "ASTM D445",
      qualifier: "After shear, 30 cycles (ASTM D6278)",
      resultBasis: "SPECIFICATION_LIMIT",
      valueType: "RANGE",
      numericMin: "28.8",
      numericMax: "33.5",
      pairFirst: null,
      pairSecond: null,
      productGrade: null,
    },
  ],
};

/**
 * What `toSpecificationResponse` turns `DETAIL_ROW.specifications` into — the wire shape both
 * `findBySlug` and `findSpecificationsBySlug` are asserted against. `spec-1`'s `value` is
 * unchanged (no `displayValue` to prefer); `spec-2` and `spec-3`'s are the normalized string, not
 * the legacy one; every enum is lowercased and every decimal is a string, never a JS number.
 */
const EXPECTED_SPECIFICATIONS = [
  {
    id: "spec-1",
    key: "Viscosity Index",
    value: "95",
    unit: null,
    method: null,
    qualifier: null,
    resultBasis: "unspecified",
    valueType: null,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: null,
  },
  {
    id: "spec-2",
    key: "Flash Point",
    value: "230 (typical)",
    unit: "°C",
    method: "ASTM D92",
    qualifier: null,
    resultBasis: "typical",
    valueType: "point",
    numericMin: "230",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: { label: "SAE 15W-40", gradeSystem: "sae" },
  },
  {
    id: "spec-3",
    key: "Kinematic viscosity",
    value: "28.8 – 33.5 mm²/s",
    unit: "mm²/s",
    method: "ASTM D445",
    qualifier: "After shear, 30 cycles (ASTM D6278)",
    resultBasis: "specification_limit",
    valueType: "range",
    numericMin: "28.8",
    numericMax: "33.5",
    pairFirst: null,
    pairSecond: null,
    grade: null,
  },
];

/** Whatever SeoService returns is opaque here — its own spec covers how it is composed. */
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

type Stubs = {
  service: ProductsService;
  productCount: jest.Mock;
  productFindMany: jest.Mock;
  productFindUnique: jest.Mock;
  categoryFindUnique: jest.Mock;
  segmentFindUnique: jest.Mock;
  productTypeFindUnique: jest.Mock;
  specificationFindMany: jest.Mock;
  findImagesForOwner: jest.Mock;
  translationFindMany: jest.Mock;
  translationFindFirst: jest.Mock;
  buildSeo: jest.Mock;
  queryRawUnsafe: jest.Mock;
};

/** No database is reached — only the delegate methods this service calls are stubbed. */
function createService(): Stubs {
  const productCount = jest.fn().mockResolvedValue(1);
  const productFindMany = jest.fn().mockResolvedValue([PRODUCT_ROW]);
  const productFindUnique = jest.fn().mockResolvedValue(DETAIL_ROW);
  const categoryFindUnique = jest.fn().mockResolvedValue({ id: CATEGORY.id });
  const segmentFindUnique = jest.fn().mockResolvedValue({ id: INDUSTRIAL.id });
  const productTypeFindUnique = jest.fn().mockResolvedValue({ id: PRODUCT_TYPE.id });
  const specificationFindMany = jest.fn().mockResolvedValue(DETAIL_ROW.specifications);
  const findImagesForOwner = jest.fn().mockResolvedValue([]);
  const translationFindMany = jest.fn().mockResolvedValue([]);
  const translationFindFirst = jest.fn().mockResolvedValue(null);
  const buildSeo = jest.fn().mockResolvedValue(SEO);

  /*
   * The approved-copy read (ADR-019 §5), which is raw SQL against `v_product_copy_public`.
   *
   * Empty by default, and that is the state of the live catalogue: no copy has been approved, so
   * every product serves the `description` column exactly as this file's other assertions expect.
   * A test that wants the overlay sets a resolved value on this mock — see the ADR-019 cases.
   *
   * The view is not re-implemented here. What it selects is the database's assertion, proved on a
   * real clone in `product-copy-review-integration.spec.ts`; what this service DOES with the rows
   * is this file's.
   */
  const queryRawUnsafe = jest.fn().mockResolvedValue([]);

  const prisma = {
    $queryRawUnsafe: queryRawUnsafe,
    product: { count: productCount, findMany: productFindMany, findUnique: productFindUnique },
    category: { findUnique: categoryFindUnique },
    segment: { findUnique: segmentFindUnique },
    productType: { findUnique: productTypeFindUnique },
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
    queryRawUnsafe,
    productFindMany,
    productFindUnique,
    categoryFindUnique,
    segmentFindUnique,
    productTypeFindUnique,
    specificationFindMany,
    findImagesForOwner,
    translationFindMany,
    translationFindFirst,
    buildSeo,
  };
}

/**
 * Routes `contentTranslation.findMany` by the entity type it asks for.
 *
 * The detail endpoint localizes four entity types in one request, so a mock that answers every
 * call with the same rows would hand a Segment the Product's translations. An entity type
 * absent from the map has no translations, which is what makes a fallback assertion mean
 * something.
 */
function translationsByEntityType(
  byType: Partial<Record<string, { entityId: string; field: string; value: string }[]>>,
): (args: { where: { entityType: string } }) => Promise<unknown[]> {
  return (args) => Promise.resolve(byType[args.where.entityType] ?? []);
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

/**
 * ADR-008's B2 filter contract. Both axes resolve a SLUG on the same rules `?category=` already
 * uses, and both narrow conjunctively — the point of the combination tests below is that adding
 * a second filter never replaces the first.
 */
describe("ProductsService.findAll — taxonomy filters", () => {
  it("resolves ?segment= as a slug and filters on membership", async () => {
    const { service, productFindMany, segmentFindUnique } = createService();

    await service.findAll(EN, { segment: "passenger-cars" });

    expect(segmentFindUnique).toHaveBeenCalledWith({
      where: { slug: "passenger-cars" },
      select: { id: true },
    });
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { segments: { some: { segmentId: INDUSTRIAL.id } } } }),
    );
  });

  it("resolves ?productType= as a slug and filters on the single-valued column", async () => {
    const { service, productFindMany, productTypeFindUnique } = createService();

    await service.findAll(EN, { productType: "base-oil" });

    expect(productTypeFindUnique).toHaveBeenCalledWith({
      where: { slug: "base-oil" },
      select: { id: true },
    });
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productTypeId: PRODUCT_TYPE.id } }),
    );
  });

  it("resolves a locale-specific segment slug through content_translations", async () => {
    const { service, productFindMany, translationFindFirst, segmentFindUnique } = createService();

    translationFindFirst.mockResolvedValue({ entityId: INDUSTRIAL.id });

    await service.findAll(FA, { segment: "خودروی-سواری" });

    expect(translationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: "Segment", field: "slug" }),
      }),
    );
    expect(segmentFindUnique).not.toHaveBeenCalled();
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { segments: { some: { segmentId: INDUSTRIAL.id } } } }),
    );
  });

  it("resolves a locale-specific productType slug through content_translations", async () => {
    const { service, productFindMany, translationFindFirst, productTypeFindUnique } =
      createService();

    translationFindFirst.mockResolvedValue({ entityId: PRODUCT_TYPE.id });

    await service.findAll(FA, { productType: "روغن-پایه" });

    expect(translationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: "ProductType", field: "slug" }),
      }),
    );
    expect(productTypeFindUnique).not.toHaveBeenCalled();
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productTypeId: PRODUCT_TYPE.id } }),
    );
  });

  it("falls back to the base segment slug when the locale has no translated one", async () => {
    const { service, segmentFindUnique } = createService();

    await service.findAll(FA, { segment: "passenger-cars" });

    expect(segmentFindUnique).toHaveBeenCalledWith({
      where: { slug: "passenger-cars" },
      select: { id: true },
    });
  });

  it("falls back to the base productType slug when the locale has no translated one", async () => {
    const { service, productTypeFindUnique } = createService();

    await service.findAll(FA, { productType: "base-oil" });

    expect(productTypeFindUnique).toHaveBeenCalledWith({
      where: { slug: "base-oil" },
      select: { id: true },
    });
  });

  it("queries no segment translation at all for the default locale", async () => {
    const { service, translationFindFirst } = createService();

    await service.findAll(EN, { segment: "passenger-cars" });

    expect(translationFindFirst).not.toHaveBeenCalled();
  });

  it("queries no productType translation at all for the default locale", async () => {
    const { service, translationFindFirst } = createService();

    await service.findAll(EN, { productType: "base-oil" });

    expect(translationFindFirst).not.toHaveBeenCalled();
  });

  // Same reasoning as the category filter: an empty 200 would be indistinguishable from a
  // Segment that genuinely has no products.
  it("rejects a segment slug that matches nothing with VALIDATION_ERROR on the field", async () => {
    const { service, segmentFindUnique, productFindMany } = createService();

    segmentFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findAll(EN, { segment: "no-such-segment" }));

    expect(error.code).toBe(ErrorCode.ValidationError);
    expect(error.getStatus()).toBe(400);
    expect(error.details).toEqual([{ field: "segment", issue: expect.any(String) }]);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  // The state of every productType request until a Product Type vocabulary is approved.
  it("rejects a productType slug that matches nothing with VALIDATION_ERROR on the field", async () => {
    const { service, productTypeFindUnique, productFindMany } = createService();

    productTypeFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findAll(EN, { productType: "no-such-type" }));

    expect(error.code).toBe(ErrorCode.ValidationError);
    expect(error.getStatus()).toBe(400);
    expect(error.details).toEqual([{ field: "productType", issue: expect.any(String) }]);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("does not echo the rejected segment slug back in the message", async () => {
    const { service, segmentFindUnique } = createService();

    segmentFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findAll(EN, { segment: "<script>alert(1)</script>" }));

    expect(error.message).not.toContain("script");
  });

  it("does not echo the rejected productType slug back in the message", async () => {
    const { service, productTypeFindUnique } = createService();

    productTypeFindUnique.mockResolvedValue(null);

    const error = await captureError(
      service.findAll(EN, { productType: "<script>alert(1)</script>" }),
    );

    expect(error.message).not.toContain("script");
  });

  it("treats blank segment and productType as omitted", async () => {
    const { service, productFindMany, segmentFindUnique, productTypeFindUnique } = createService();

    await service.findAll(EN, { segment: "   ", productType: "" });

    expect(segmentFindUnique).not.toHaveBeenCalled();
    expect(productTypeFindUnique).not.toHaveBeenCalled();
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("trims a segment slug before resolving it", async () => {
    const { service, segmentFindUnique } = createService();

    await service.findAll(EN, { segment: "  passenger-cars  " });

    expect(segmentFindUnique).toHaveBeenCalledWith({
      where: { slug: "passenger-cars" },
      select: { id: true },
    });
  });

  it("ANDs category and segment", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { category: "base-oils", segment: "passenger-cars" });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categoryId: CATEGORY.id,
          segments: { some: { segmentId: INDUSTRIAL.id } },
        },
      }),
    );
  });

  it("ANDs category and productType", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { category: "base-oils", productType: "base-oil" });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: CATEGORY.id, productTypeId: PRODUCT_TYPE.id },
      }),
    );
  });

  it("ANDs segment and productType", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { segment: "passenger-cars", productType: "base-oil" });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          segments: { some: { segmentId: INDUSTRIAL.id } },
          productTypeId: PRODUCT_TYPE.id,
        },
      }),
    );
  });

  it("ANDs all three of category, segment and productType", async () => {
    const { service, productFindMany, productCount } = createService();

    await service.findAll(EN, {
      category: "base-oils",
      segment: "passenger-cars",
      productType: "base-oil",
    });

    const expected = {
      categoryId: CATEGORY.id,
      segments: { some: { segmentId: INDUSTRIAL.id } },
      productTypeId: PRODUCT_TYPE.id,
    };

    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expected }));
    // The count must see the same predicate, or `total` would describe a different set than
    // the page it paginates.
    expect(productCount).toHaveBeenCalledWith({ where: expected });
  });

  it("combines a search with a segment filter rather than letting one replace the other", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { q: "SN", segment: "passenger-cars" });

    const call = productFindMany.mock.calls[0]?.[0] as {
      where: { segments?: unknown; OR?: unknown[] };
    };

    expect(call.where.segments).toEqual({ some: { segmentId: INDUSTRIAL.id } });
    // The search's own OR branches are untouched by the taxonomy filter beside them.
    expect(call.where.OR).toHaveLength(3);
  });

  it("combines a search with a productType filter", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { q: "SN", productType: "base-oil" });

    const call = productFindMany.mock.calls[0]?.[0] as {
      where: { productTypeId?: string; OR?: unknown[] };
    };

    expect(call.where.productTypeId).toBe(PRODUCT_TYPE.id);
    expect(call.where.OR).toHaveLength(3);
  });

  it("combines a search with all three taxonomy filters", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, {
      q: "SN",
      category: "base-oils",
      segment: "passenger-cars",
      productType: "base-oil",
    });

    const call = productFindMany.mock.calls[0]?.[0] as {
      where: {
        categoryId?: string;
        segments?: unknown;
        productTypeId?: string;
        OR?: unknown[];
      };
    };

    expect(call.where.categoryId).toBe(CATEGORY.id);
    expect(call.where.segments).toEqual({ some: { segmentId: INDUSTRIAL.id } });
    expect(call.where.productTypeId).toBe(PRODUCT_TYPE.id);
    expect(call.where.OR).toHaveLength(3);
  });

  // B2 adds filters, not response fields: the list stays the shape §2.7 contracts.
  it("exposes no taxonomy fields in the list response", async () => {
    const { service } = createService();

    const result = await service.findAll(EN, { segment: "passenger-cars" });

    expect(result.products[0]).not.toHaveProperty("segments");
    expect(result.products[0]).not.toHaveProperty("productType");
  });

  it("leaves pagination and sorting untouched when a taxonomy filter is applied", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { segment: "passenger-cars", page: 2, limit: 5, sort: "-createdAt" });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
  });
});

describe("ProductsService.findAll — search", () => {
  it("matches name, slug and PUBLISHED specification values", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, { q: "SN 500" });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "SN 500", mode: "insensitive" } },
            { slug: { contains: "SN 500", mode: "insensitive" } },
            {
              // A `?q=` that matched an unapproved value would answer "does the platform hold
              // a specification saying this?" for data nobody published. Confirming a value is
              // a way of reading it.
              specifications: {
                some: {
                  reviewStatus: "APPROVED",
                  deletedAt: null,
                  value: { contains: "SN 500", mode: "insensitive" },
                },
              },
            },
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
    expect(result.product.specifications).toEqual(EXPECTED_SPECIFICATIONS);
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
      translationsByEntityType({
        Product: [
          { entityId: PRODUCT_ROW.id, field: "name", value: "اس‌ان ۵۰۰" },
          { entityId: PRODUCT_ROW.id, field: "slug", value: "اس‌ان-۵۰۰" },
        ],
        Category: [
          { entityId: CATEGORY.id, field: "name", value: "روغن پایه" },
          { entityId: CATEGORY.id, field: "slug", value: "روغن-پایه" },
        ],
        Segment: [
          { entityId: INDUSTRIAL.id, field: "name", value: "صنعتی" },
          { entityId: INDUSTRIAL.id, field: "slug", value: "صنعتی" },
          { entityId: MARINE.id, field: "name", value: "دریایی" },
          { entityId: MARINE.id, field: "slug", value: "دریایی" },
        ],
        ProductType: [
          { entityId: PRODUCT_TYPE.id, field: "name", value: "روغن پایه" },
          { entityId: PRODUCT_TYPE.id, field: "slug", value: "روغن-پایه" },
        ],
      }),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.product.description).toBeNull();
    expect(result.localeFallback).toBe(false);
  });
});

describe("ProductsService.findBySlug — taxonomy", () => {
  it("returns every Segment the product belongs to", async () => {
    const { service } = createService();

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product.segments).toEqual([
      { name: "Industrial", slug: "industrial" },
      { name: "Marine", slug: "marine" },
    ]);
  });

  // `sortOrder` carries no uniqueness constraint, so two Segments may share one — without the
  // second term the same product could emit its Segments in two different orders.
  it("orders Segments by sortOrder, with Segment id as the tiebreaker", async () => {
    const { service, productFindUnique } = createService();

    await service.findBySlug("sn-500", EN);

    const call = productFindUnique.mock.calls[0]?.[0] as {
      select: { segments: { orderBy: unknown } };
    };

    expect(call.select.segments.orderBy).toEqual([
      { segment: { sortOrder: "asc" } },
      { segment: { id: "asc" } },
    ]);
  });

  // Segment is a navigation/facet axis, not URL ancestry: nothing addresses one by id, and the
  // id is selected only because content_translations keys on it.
  it("exposes name and slug only, leaking no Segment id", async () => {
    const { service } = createService();

    const result = await service.findBySlug("sn-500", EN);

    for (const segment of result.product.segments) {
      expect(Object.keys(segment).sort()).toEqual(["name", "slug"]);
    }

    expect(JSON.stringify(result.product.segments)).not.toContain(INDUSTRIAL.id);
  });

  it("returns an empty array for a product in no Segment", async () => {
    const { service, productFindUnique } = createService();

    productFindUnique.mockResolvedValue({ ...DETAIL_ROW, segments: [] });

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product.segments).toEqual([]);
  });

  it("returns the primary Product Type as name and slug", async () => {
    const { service } = createService();

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product.productType).toEqual({ name: "Base Oil", slug: "base-oil" });
  });

  it("leaks no ProductType id", async () => {
    const { service } = createService();

    const result = await service.findBySlug("sn-500", EN);

    expect(Object.keys(result.product.productType ?? {}).sort()).toEqual(["name", "slug"]);
    expect(JSON.stringify(result.product.productType)).not.toContain(PRODUCT_TYPE.id);
  });

  // The state of every product until a ProductType row is approved.
  it("returns null for a product with no Product Type", async () => {
    const { service, productFindUnique } = createService();

    productFindUnique.mockResolvedValue({ ...DETAIL_ROW, productType: null });

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product.productType).toBeNull();
  });

  it("localizes Segment names and slugs", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockImplementation(
      translationsByEntityType({
        Segment: [
          { entityId: INDUSTRIAL.id, field: "name", value: "صنعتی" },
          { entityId: INDUSTRIAL.id, field: "slug", value: "صنعتی" },
          { entityId: MARINE.id, field: "name", value: "دریایی" },
        ],
      }),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.product.segments).toEqual([
      { name: "صنعتی", slug: "صنعتی" },
      // Marine's slug has no translation and falls back to the base column — §3.
      { name: "دریایی", slug: "marine" },
    ]);
  });

  it("localizes the Product Type name and slug", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockImplementation(
      translationsByEntityType({
        ProductType: [
          { entityId: PRODUCT_TYPE.id, field: "name", value: "روغن پایه" },
          { entityId: PRODUCT_TYPE.id, field: "slug", value: "روغن-پایه" },
        ],
      }),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.product.productType).toEqual({ name: "روغن پایه", slug: "روغن-پایه" });
  });

  it("queries no translations for the default locale", async () => {
    const { service, translationFindMany } = createService();

    await service.findBySlug("sn-500", EN);

    expect(translationFindMany).not.toHaveBeenCalled();
  });

  // §3 has the flag describe what was served: a Segment name served in English inside a Persian
  // response is exactly what the frontend's "not yet translated" notice exists for.
  it("raises localeFallback when only the taxonomy failed to translate", async () => {
    const { service, productFindUnique, translationFindMany } = createService();

    productFindUnique.mockResolvedValue({ ...DETAIL_ROW, description: null, productType: null });
    translationFindMany.mockImplementation(
      translationsByEntityType({
        Product: [
          { entityId: PRODUCT_ROW.id, field: "name", value: "اس‌ان ۵۰۰" },
          { entityId: PRODUCT_ROW.id, field: "slug", value: "اس‌ان-۵۰۰" },
        ],
        Category: [
          { entityId: CATEGORY.id, field: "name", value: "روغن پایه" },
          { entityId: CATEGORY.id, field: "slug", value: "روغن-پایه" },
        ],
      }),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.localeFallback).toBe(true);
  });

  // An absent relation has nothing it could have fallen back FROM.
  it("reports no fallback for an empty taxonomy when everything else translated", async () => {
    const { service, productFindUnique, translationFindMany } = createService();

    productFindUnique.mockResolvedValue({
      ...DETAIL_ROW,
      description: null,
      segments: [],
      productType: null,
    });
    translationFindMany.mockImplementation(
      translationsByEntityType({
        Product: [
          { entityId: PRODUCT_ROW.id, field: "name", value: "اس‌ان ۵۰۰" },
          { entityId: PRODUCT_ROW.id, field: "slug", value: "اس‌ان-۵۰۰" },
        ],
        Category: [
          { entityId: CATEGORY.id, field: "name", value: "روغن پایه" },
          { entityId: CATEGORY.id, field: "slug", value: "روغن-پایه" },
        ],
      }),
    );

    const result = await service.findBySlug("sn-500", FA);

    expect(result.localeFallback).toBe(false);
  });

  it("asks content_translations for Segment and ProductType by their own entity types", async () => {
    const { service, translationFindMany } = createService();

    await service.findBySlug("sn-500", FA);

    const entityTypes = translationFindMany.mock.calls.map(
      (call) => (call[0] as { where: { entityType: string } }).where.entityType,
    );

    expect(entityTypes).toContain("Segment");
    expect(entityTypes).toContain("ProductType");
  });

  it("leaves every pre-existing detail field untouched", async () => {
    const { service, findImagesForOwner } = createService();

    findImagesForOwner.mockResolvedValue([
      { id: "media-1", url: "/img/sn-500.webp", altText: "SN 500" },
    ]);

    const result = await service.findBySlug("sn-500", EN);

    expect(result.product).toEqual({
      id: PRODUCT_ROW.id,
      name: "SN 500",
      slug: "sn-500",
      description: "A Group I base oil.",
      createdAt: "2026-01-15T09:30:00.000Z",
      category: CATEGORY,
      segments: [
        { name: "Industrial", slug: "industrial" },
        { name: "Marine", slug: "marine" },
      ],
      productType: { name: "Base Oil", slug: "base-oil" },
      specifications: EXPECTED_SPECIFICATIONS,
      images: [{ id: "media-1", url: "/img/sn-500.webp", altText: "SN 500" }],
      seo: SEO,
    });
  });
});

describe("ProductsService.findAll — taxonomy is absent from the list", () => {
  // §2.7's list is a Product Finder page, not a detail page: a 20-row page would otherwise pay
  // for two more joins per row that no list layout renders.
  it("selects no taxonomy relation for the list", async () => {
    const { service, productFindMany } = createService();

    await service.findAll(EN, {});

    const call = productFindMany.mock.calls[0]?.[0] as { select: Record<string, unknown> };

    expect(Object.keys(call.select).sort()).toEqual([
      "categoryId",
      "createdAt",
      "description",
      "id",
      "name",
      "slug",
    ]);
  });

  it("exposes no segments or productType on a list row", async () => {
    const { service } = createService();

    const result = await service.findAll(EN, {});

    expect(Object.keys(result.products[0] ?? {}).sort()).toEqual([
      "categoryId",
      "createdAt",
      "description",
      "id",
      "name",
      "slug",
    ]);
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
      // The partial-refresh route carries the same public predicate as the detail select. An
      // endpoint that served what the full response withholds would be the leak the filter
      // exists to prevent.
      where: { productId: PRODUCT_ROW.id, reviewStatus: "APPROVED", deletedAt: null },
      orderBy: [{ key: "asc" }, { value: "asc" }],
      select: {
        id: true,
        key: true,
        value: true,
        displayValue: true,
        unit: true,
        method: true,
        qualifier: true,
        resultBasis: true,
        valueType: true,
        numericMin: true,
        numericMax: true,
        pairFirst: true,
        pairSecond: true,
        productGrade: { select: { label: true, gradeSystem: true } },
      },
    });
    expect(result).toEqual(EXPECTED_SPECIFICATIONS);
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

/* ========================================================================== */
/*  Approved editorial copy (ADR-019 §5)                                       */
/* ========================================================================== */

/**
 * What an APPROVED `product_copy` row does to the served description.
 *
 * The rule is one-directional and that is the whole safety property: an approved row in the
 * requested locale replaces the description, and everything else — no row, an unapproved row, a
 * rejected one, a row in an inactive locale — serves exactly what the product served before
 * ADR-019. All 100 catalogue products are in that second case today.
 *
 * `v_product_copy_public` is what decides which rows exist at all, and it is not re-implemented
 * here: these mocks stand for rows the VIEW already returned. That the view excludes unapproved,
 * retired and inactive-locale rows is proved against a real database in
 * `product-copy-review-integration.spec.ts`.
 */
const APPROVED_COPY_EN = {
  productId: PRODUCT_ROW.id,
  locale: "en",
  summary: "A Group I base oil for industrial blending, as the datasheet describes it.",
};

const APPROVED_COPY_FA = {
  productId: PRODUCT_ROW.id,
  locale: "fa",
  summary: "یک روغن پایه گروه یک برای آمیزه‌سازی صنعتی.",
};

describe("approved product copy overlays the description", () => {
  it("serves the product's own description when no copy is approved", async () => {
    const { service, queryRawUnsafe } = createService();

    const { product } = await service.findBySlug("sn-500", EN);

    expect(queryRawUnsafe).toHaveBeenCalled();
    expect(product.description).toBe(PRODUCT_ROW.description);
  });

  it("replaces the description with the approved copy for the requested locale", async () => {
    const { service, queryRawUnsafe } = createService();
    queryRawUnsafe.mockResolvedValue([APPROVED_COPY_EN]);

    const { product } = await service.findBySlug("sn-500", EN);

    expect(product.description).toBe(APPROVED_COPY_EN.summary);
  });

  it("prefers the requested locale over the default when both are approved", async () => {
    const { service, queryRawUnsafe } = createService();
    // Default-locale row FIRST, so the assertion cannot pass by arrival order.
    queryRawUnsafe.mockResolvedValue([APPROVED_COPY_EN, APPROVED_COPY_FA]);

    const { product } = await service.findBySlug("sn-500", FA);

    expect(product.description).toBe(APPROVED_COPY_FA.summary);
  });

  it("falls back to the default locale's copy when the requested locale has none", async () => {
    const { service, queryRawUnsafe } = createService();
    queryRawUnsafe.mockResolvedValue([APPROVED_COPY_EN]);

    const { product } = await service.findBySlug("sn-500", FA);

    expect(product.description).toBe(APPROVED_COPY_EN.summary);
  });

  /**
   * The overlay must reach SEO, or the page would tell a search engine one thing and a reader
   * another. §11 falls the meta description back to the entity's description, and the value it
   * falls back to has to be the one actually rendered.
   */
  it("feeds the approved copy to the SEO meta description fallback", async () => {
    const { service, queryRawUnsafe, buildSeo } = createService();
    queryRawUnsafe.mockResolvedValue([APPROVED_COPY_EN]);

    await service.findBySlug("sn-500", EN);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackDescription: APPROVED_COPY_EN.summary }),
      EN,
    );
  });

  it("overlays the list as well, so a card and its page agree", async () => {
    const { service, queryRawUnsafe } = createService();
    queryRawUnsafe.mockResolvedValue([APPROVED_COPY_EN]);

    const { products } = await service.findAll(EN, {});

    expect(products[0]?.description).toBe(APPROVED_COPY_EN.summary);
  });

  it("asks for nothing when the list is empty", async () => {
    const { service, queryRawUnsafe, productFindMany, productCount } = createService();
    productFindMany.mockResolvedValue([]);
    productCount.mockResolvedValue(0);

    const { products } = await service.findAll(EN, {});

    expect(products).toEqual([]);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("reads only the requested and default locales, and only these products", async () => {
    const { service, queryRawUnsafe } = createService();

    await service.findAll(FA, {});

    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("v_product_copy_public"),
      [PRODUCT_ROW.id],
      "fa",
      "en",
    );
  });
});
