import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { SeoService } from "../seo/seo.service";

import { CategoriesService } from "./categories.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { SeoFields } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const BASE_OILS = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Base Oils",
  slug: "base-oils",
  parentId: null,
};

/** Whatever SeoService returns is opaque here — its own spec covers how it is composed. */
const SEO: SeoFields = {
  locale: "en",
  metaTitle: "Base Oils",
  metaDescription: null,
  canonicalUrl: null,
  ogTitle: "Base Oils",
  ogDescription: null,
  ogImageUrl: null,
  twitterCardType: "summary_large_image",
  twitterTitle: "Base Oils",
  twitterDescription: null,
  twitterImageUrl: null,
  robotsIndex: true,
  robotsFollow: true,
  keywords: [],
  structuredDataOverride: null,
  alternates: [{ locale: "en", slug: "base-oils" }],
};

type Stubs = {
  service: CategoriesService;
  categoryFindMany: jest.Mock;
  categoryFindUnique: jest.Mock;
  translationFindMany: jest.Mock;
  translationFindFirst: jest.Mock;
  buildSeo: jest.Mock;
};

/** No database is reached — only the delegate methods this service calls are stubbed. */
function createService(): Stubs {
  const categoryFindMany = jest.fn().mockResolvedValue([BASE_OILS]);
  const categoryFindUnique = jest.fn().mockResolvedValue(BASE_OILS);
  const translationFindMany = jest.fn().mockResolvedValue([]);
  const translationFindFirst = jest.fn().mockResolvedValue(null);
  const buildSeo = jest.fn().mockResolvedValue(SEO);

  const prisma = {
    category: { findMany: categoryFindMany, findUnique: categoryFindUnique },
    contentTranslation: { findMany: translationFindMany, findFirst: translationFindFirst },
  } as unknown as PrismaService;

  // The real ContentTranslationService, not a stub: it owns the translation queries these
  // tests assert on, and stubbing it would leave those assertions checking nothing.
  //
  // SeoService IS stubbed, for the mirror-image reason: nothing here asserts on how a SEO
  // record is composed, and the real one would issue queries against the same
  // contentTranslation mock that this file's translation assertions depend on.
  const seo = { buildFor: buildSeo } as unknown as SeoService;

  return {
    service: new CategoriesService(prisma, new ContentTranslationService(prisma), seo),
    categoryFindMany,
    categoryFindUnique,
    translationFindMany,
    translationFindFirst,
    buildSeo,
  };
}

/**
 * Captures the thrown ApiException. A bare `.catch()` types the result as the union of the
 * rejection and the resolved value, and a rejection that never happens has to fail the test
 * rather than pass silently.
 */
async function captureError(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (thrown) {
    return thrown as ApiException;
  }

  throw new Error("Expected the call to reject, but it resolved.");
}

describe("CategoriesService.findAll", () => {
  it("returns top-level categories when no parentId is given", async () => {
    const { service, categoryFindMany } = createService();

    await service.findAll(EN);

    expect(categoryFindMany).toHaveBeenCalledWith({
      where: { parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  });

  it("filters by parentId when one is given", async () => {
    const { service, categoryFindMany } = createService();

    await service.findAll(EN, BASE_OILS.id);

    expect(categoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: BASE_OILS.id } }),
    );
  });

  // The row's own columns hold the default locale, so a default-locale request must not pay
  // for a translation query at all.
  it("queries no translations for the default locale", async () => {
    const { service, translationFindMany } = createService();

    const result = await service.findAll(EN);

    expect(translationFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({ categories: [BASE_OILS], localeFallback: false });
  });

  it("overlays translated fields for a non-default locale", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([
      { entityId: BASE_OILS.id, field: "name", value: "روغن پایه" },
      { entityId: BASE_OILS.id, field: "slug", value: "روغن-پایه" },
    ]);

    const result = await service.findAll(FA);

    expect(result.categories).toEqual([{ ...BASE_OILS, name: "روغن پایه", slug: "روغن-پایه" }]);
    expect(result.localeFallback).toBe(false);
  });

  // API_CONTRACT_FINAL.md §3: the response has to say when a field fell back, so the frontend
  // can decide whether to show a "not yet translated" notice.
  it("reports localeFallback when a field has no translation", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([
      { entityId: BASE_OILS.id, field: "name", value: "روغن پایه" },
    ]);

    const result = await service.findAll(FA);

    expect(result.categories[0]).toEqual({ ...BASE_OILS, name: "روغن پایه" });
    expect(result.localeFallback).toBe(true);
  });

  it("reads all translations in one query rather than one per category", async () => {
    const { service, categoryFindMany, translationFindMany } = createService();
    const second = { ...BASE_OILS, id: "22222222-2222-4222-8222-222222222222", slug: "greases" };

    categoryFindMany.mockResolvedValue([BASE_OILS, second]);

    await service.findAll(FA);

    expect(translationFindMany).toHaveBeenCalledTimes(1);
    expect(translationFindMany).toHaveBeenCalledWith({
      where: {
        entityType: "Category",
        entityId: { in: [BASE_OILS.id, second.id] },
        locale: "fa",
        field: { in: ["name", "slug"] },
      },
      select: { entityId: true, field: true, value: true },
    });
  });

  it("skips the translation query when there are no categories to translate", async () => {
    const { service, categoryFindMany, translationFindMany } = createService();

    categoryFindMany.mockResolvedValue([]);

    await expect(service.findAll(FA)).resolves.toEqual({ categories: [], localeFallback: false });
    expect(translationFindMany).not.toHaveBeenCalled();
  });
});

describe("CategoriesService.findBySlug", () => {
  it("looks the slug up on the row itself for the default locale", async () => {
    const { service, categoryFindUnique, translationFindFirst } = createService();

    const result = await service.findBySlug("base-oils", EN);

    expect(translationFindFirst).not.toHaveBeenCalled();
    expect(categoryFindUnique).toHaveBeenCalledWith({
      where: { slug: "base-oils" },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    expect(result).toEqual({ category: { ...BASE_OILS, seo: SEO }, localeFallback: false });
  });

  it("resolves a locale-specific slug through content_translations", async () => {
    const { service, categoryFindUnique, translationFindFirst, translationFindMany } =
      createService();

    translationFindFirst.mockResolvedValue({ entityId: BASE_OILS.id });
    translationFindMany.mockResolvedValue([
      { entityId: BASE_OILS.id, field: "name", value: "روغن پایه" },
      { entityId: BASE_OILS.id, field: "slug", value: "روغن-پایه" },
    ]);

    const result = await service.findBySlug("روغن-پایه", FA);

    expect(translationFindFirst).toHaveBeenCalledWith({
      where: { entityType: "Category", locale: "fa", field: "slug", value: "روغن-پایه" },
      select: { entityId: true },
    });
    expect(categoryFindUnique).toHaveBeenCalledWith({
      where: { id: BASE_OILS.id },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    expect(result.category.slug).toBe("روغن-پایه");
    expect(result.localeFallback).toBe(false);
  });

  // §3 has untranslated fields fall back, which means an untranslated category is still
  // reachable in fa — at its default-locale path.
  it("falls back to the default slug when the locale has no translated slug", async () => {
    const { service, categoryFindUnique } = createService();

    const result = await service.findBySlug("base-oils", FA);

    expect(categoryFindUnique).toHaveBeenCalledWith({
      where: { slug: "base-oils" },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    expect(result.category).toEqual({ ...BASE_OILS, seo: SEO });
    expect(result.localeFallback).toBe(true);
  });

  it("raises NOT_FOUND when the slug matches nothing in any locale", async () => {
    const { service, categoryFindUnique } = createService();

    categoryFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findBySlug("missing", EN));

    expect(error).toBeInstanceOf(ApiException);
    expect(error.code).toBe(ErrorCode.NotFound);
  });

  it("does not echo the requested slug back in the not-found message", async () => {
    const { service, categoryFindUnique } = createService();

    categoryFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findBySlug("<script>alert(1)</script>", EN));

    expect(error.message).not.toContain("script");
  });
});

describe("CategoriesService.findBySlug — SEO", () => {
  it("attaches the SEO record SeoService built", async () => {
    const { service } = createService();

    const result = await service.findBySlug("base-oils", EN);

    expect(result.category.seo).toBe(SEO);
  });

  it("asks SEO for this category, in the requested locale", async () => {
    const { service, buildSeo } = createService();

    await service.findBySlug("base-oils", FA);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "Category", entityId: BASE_OILS.id }),
      FA,
    );
  });

  // §11 falls the meta title back to the entity's own name, and a Persian page whose title
  // fell back to the English name would advertise the wrong language to a crawler.
  it("passes the localized name as the title fallback", async () => {
    const { service, buildSeo, translationFindFirst, translationFindMany } = createService();

    translationFindFirst.mockResolvedValue({ entityId: BASE_OILS.id });
    translationFindMany.mockResolvedValue([
      { entityId: BASE_OILS.id, field: "name", value: "روغن پایه" },
      { entityId: BASE_OILS.id, field: "slug", value: "روغن-پایه" },
    ]);

    await service.findBySlug("روغن-پایه", FA);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackTitle: "روغن پایه" }),
      FA,
    );
  });

  // The default locale's alternate is the base column. Handing over the localized copy would
  // make hreflang="x-default" point at the Persian path.
  it("passes the base row's slug, not the translated one, as the default slug", async () => {
    const { service, buildSeo, translationFindFirst, translationFindMany } = createService();

    translationFindFirst.mockResolvedValue({ entityId: BASE_OILS.id });
    translationFindMany.mockResolvedValue([
      { entityId: BASE_OILS.id, field: "slug", value: "روغن-پایه" },
    ]);

    await service.findBySlug("روغن-پایه", FA);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({ defaultSlug: "base-oils" }),
      FA,
    );
  });

  // `Category` has no description column, so §11's derived-description step has no source.
  it("passes a null description fallback", async () => {
    const { service, buildSeo } = createService();

    await service.findBySlug("base-oils", EN);

    expect(buildSeo).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackDescription: null }),
      EN,
    );
  });

  // §2.3 attaches SeoFields to the detail endpoint only — a six-row list would otherwise pay
  // for six SEO lookups nothing renders.
  it("builds no SEO record for the list endpoint", async () => {
    const { service, buildSeo } = createService();

    await service.findAll(EN);

    expect(buildSeo).not.toHaveBeenCalled();
  });

  it("builds no SEO record when the slug matches nothing", async () => {
    const { service, categoryFindUnique, buildSeo } = createService();

    categoryFindUnique.mockResolvedValue(null);

    await captureError(service.findBySlug("missing", EN));

    expect(buildSeo).not.toHaveBeenCalled();
  });
});
