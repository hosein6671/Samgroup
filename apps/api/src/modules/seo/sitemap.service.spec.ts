import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "../catalog/categories.service";

import { SitemapService } from "./sitemap.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

const BASE_OILS = { id: "11111111-1111-4111-8111-111111111111", slug: "base-oils" };
const ANTIFREEZE = { id: "22222222-2222-4222-8222-222222222222", slug: "antifreeze-coolants" };

/** A `content_translations` row as the table stores it — `value`, not `slug`. */
function translationRow(
  entityId: string,
  locale: string,
  value: string,
): { entityId: string; locale: string; value: string } {
  return { entityId, locale, value };
}

type Stubs = {
  service: SitemapService;
  findSitemapCandidates: jest.Mock;
  translationFindMany: jest.Mock;
  seoMetaFindMany: jest.Mock;
  resolve: jest.Mock;
};

type Overrides = {
  candidates?: { id: string; slug: string }[];
  translations?: { entityId: string; locale: string; value: string }[];
  noindex?: { entityId: string; locale: string }[];
  locale?: ResolvedLocale;
};

/**
 * No database is reached. ContentTranslationService is the REAL one — it owns the translated
 * slug query these tests assert on, and stubbing it would leave those assertions checking
 * nothing. CategoriesService and LocaleResolutionService are stubbed: what they return is
 * covered by their own specs, and what matters here is only that this service asks them rather
 * than querying `categories` or `locales` itself.
 */
function createService(overrides: Overrides = {}): Stubs {
  const findSitemapCandidates = jest.fn().mockResolvedValue(overrides.candidates ?? [BASE_OILS]);
  const translationFindMany = jest.fn().mockResolvedValue(overrides.translations ?? []);
  const seoMetaFindMany = jest.fn().mockResolvedValue(overrides.noindex ?? []);
  const resolve = jest.fn().mockResolvedValue(overrides.locale ?? EN);

  const prisma = {
    contentTranslation: { findMany: translationFindMany },
    seoMeta: { findMany: seoMetaFindMany },
  } as unknown as PrismaService;

  const categories = { findSitemapCandidates } as unknown as CategoriesService;
  const localeResolution = { resolve } as unknown as LocaleResolutionService;

  const service = new SitemapService(
    prisma,
    categories,
    new ContentTranslationService(prisma),
    localeResolution,
  );

  return { service, findSitemapCandidates, translationFindMany, seoMetaFindMany, resolve };
}

describe("SitemapService.findEntries", () => {
  it("emits the default locale's entry from the entity's own slug column", async () => {
    const { service } = createService({ candidates: [BASE_OILS, ANTIFREEZE] });

    await expect(service.findEntries()).resolves.toEqual([
      {
        entityType: ContentEntityType.Category,
        entityId: BASE_OILS.id,
        locale: "en",
        slug: "base-oils",
      },
      {
        entityType: ContentEntityType.Category,
        entityId: ANTIFREEZE.id,
        locale: "en",
        slug: "antifreeze-coolants",
      },
    ]);
  });

  it("emits one additional entry per translated slug, carrying that locale's own slug", async () => {
    const { service } = createService({
      translations: [
        translationRow(BASE_OILS.id, "ar", "زيوت-الأساس"),
        translationRow(BASE_OILS.id, "fa", "روغن-پایه"),
      ],
    });

    await expect(service.findEntries()).resolves.toEqual([
      { entityType: "Category", entityId: BASE_OILS.id, locale: "en", slug: "base-oils" },
      { entityType: "Category", entityId: BASE_OILS.id, locale: "ar", slug: "زيوت-الأساس" },
      { entityType: "Category", entityId: BASE_OILS.id, locale: "fa", slug: "روغن-پایه" },
    ]);
  });

  // The base column is authoritative for the default locale. A duplicate <url> for one page is
  // a sitemap error — the same guard SeoService.buildAlternates applies to hreflang.
  it("does not emit the default locale twice when a slug translation exists for it", async () => {
    const { service } = createService({
      translations: [
        translationRow(BASE_OILS.id, "en", "base-oils-alternate"),
        translationRow(BASE_OILS.id, "fa", "روغن-پایه"),
      ],
    });

    const entries = await service.findEntries();

    expect(entries.filter((entry) => entry.locale === "en")).toEqual([
      { entityType: "Category", entityId: BASE_OILS.id, locale: "en", slug: "base-oils" },
    ]);
  });

  // INTERNATIONALIZATION_STRATEGY.md §4: a locale with no translated slug renders at the
  // default-locale path via §3's content fallback, but it is not a distinct URL and is not
  // submitted. Fallback and hreflang deliberately disagree.
  it("omits a locale the entity has no translated slug for, rather than pointing at a fallback", async () => {
    const { service } = createService({
      translations: [translationRow(BASE_OILS.id, "fa", "روغن-پایه")],
    });

    const entries = await service.findEntries();

    expect(entries.map((entry) => entry.locale)).toEqual(["en", "fa"]);
  });

  it("asks for translated slugs in ACTIVE locales only, in one query for every entity", async () => {
    const { service, translationFindMany } = createService({
      candidates: [BASE_OILS, ANTIFREEZE],
    });

    await service.findEntries();

    expect(translationFindMany).toHaveBeenCalledTimes(1);
    expect(translationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: "Category",
          entityId: { in: [BASE_OILS.id, ANTIFREEZE.id] },
          field: "slug",
          localeRef: { isActive: true },
        },
      }),
    );
  });

  it("excludes an entity/locale pair an editor marked noindex, keeping its other locales", async () => {
    const { service } = createService({
      translations: [translationRow(BASE_OILS.id, "fa", "روغن-پایه")],
      noindex: [{ entityId: BASE_OILS.id, locale: "fa" }],
    });

    await expect(service.findEntries()).resolves.toEqual([
      { entityType: "Category", entityId: BASE_OILS.id, locale: "en", slug: "base-oils" },
    ]);
  });

  // The approved clarification to D-5: only an explicit `false` excludes. `robots_index` is NOT
  // NULL with a `true` default, so the query can only ever match a deliberate opt-out, and an
  // entity nobody has written SEO for has no row at all and stays indexable.
  it("queries for robotsIndex false only, so a missing seo_meta row stays indexable", async () => {
    const { service, seoMetaFindMany } = createService({ noindex: [] });

    await expect(service.findEntries()).resolves.toHaveLength(1);

    expect(seoMetaFindMany).toHaveBeenCalledWith({
      where: {
        entityType: "Category",
        entityId: { in: [BASE_OILS.id] },
        robotsIndex: false,
      },
      select: { entityId: true, locale: true },
    });
  });

  // FRONTEND_ARCHITECTURE.md §1: there is no [productSlug] route, so a product entry would name
  // a URL that 404s. This is a decision rather than a limitation, hence an explicit test.
  it("emits no Product entries and reads no product data", async () => {
    const { service, translationFindMany, seoMetaFindMany } = createService({
      candidates: [BASE_OILS, ANTIFREEZE],
      translations: [translationRow(BASE_OILS.id, "fa", "روغن-پایه")],
    });

    const entries = await service.findEntries();

    expect(entries.every((entry) => entry.entityType === ContentEntityType.Category)).toBe(true);

    for (const mock of [translationFindMany, seoMetaFindMany]) {
      const call = mock.mock.calls[0]?.[0] as { where: { entityType: string } };

      expect(call.where.entityType).toBe(ContentEntityType.Category);
    }
  });

  // A platform whose catalog has not been seeded yet is an empty sitemap, not an error: this is
  // a collection endpoint, exactly as GET /locales is.
  it("returns an empty array when no category has a page", async () => {
    const { service, translationFindMany, seoMetaFindMany } = createService({ candidates: [] });

    await expect(service.findEntries()).resolves.toEqual([]);

    expect(translationFindMany).not.toHaveBeenCalled();
    expect(seoMetaFindMany).not.toHaveBeenCalled();
  });

  it("resolves the default locale from the Locale table rather than assuming en", async () => {
    const { service, resolve } = createService({
      locale: { code: "fa", defaultCode: "fa", isDefault: true },
    });

    await expect(service.findEntries()).resolves.toEqual([
      { entityType: "Category", entityId: BASE_OILS.id, locale: "fa", slug: "base-oils" },
    ]);

    // No argument: the endpoint names no locale, which is precisely the "?locale= omitted" case
    // LocaleResolutionService already answers with the platform default.
    expect(resolve).toHaveBeenCalledWith();
  });

  it("reads categories through the owning module's service, never a category query of its own", async () => {
    const { service, findSitemapCandidates } = createService();

    await service.findEntries();

    expect(findSitemapCandidates).toHaveBeenCalledTimes(1);
    expect(findSitemapCandidates).toHaveBeenCalledWith();
  });

  it("returns the same entries in the same order across two invocations", async () => {
    const { service } = createService({
      candidates: [BASE_OILS, ANTIFREEZE],
      translations: [
        translationRow(BASE_OILS.id, "ar", "زيوت-الأساس"),
        translationRow(BASE_OILS.id, "fa", "روغن-پایه"),
        translationRow(ANTIFREEZE.id, "fa", "ضدیخ"),
      ],
    });

    const [first, second] = await Promise.all([service.findEntries(), service.findEntries()]);

    expect(first).toEqual(second);
    expect(first.map((entry) => `${entry.entityId}:${entry.locale}`)).toEqual([
      `${BASE_OILS.id}:en`,
      `${BASE_OILS.id}:ar`,
      `${BASE_OILS.id}:fa`,
      `${ANTIFREEZE.id}:en`,
      `${ANTIFREEZE.id}:fa`,
    ]);
  });
});
