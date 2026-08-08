import { PrismaService } from "../../prisma/prisma.service";

import { ContentEntityType } from "./content-entity-type";
import { ContentTranslationService } from "./content-translation.service";

import type { ResolvedLocale } from "../locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

type Stubs = {
  service: ContentTranslationService;
  findMany: jest.Mock;
  findFirst: jest.Mock;
};

/** No database is reached — only the two contentTranslation delegates this service calls. */
function createService(): Stubs {
  const findMany = jest.fn().mockResolvedValue([]);
  const findFirst = jest.fn().mockResolvedValue(null);

  const prisma = {
    contentTranslation: { findMany, findFirst },
  } as unknown as PrismaService;

  return { service: new ContentTranslationService(prisma), findMany, findFirst };
}

describe("ContentTranslationService.localize", () => {
  it("queries nothing for the default locale — the rows already hold its values", async () => {
    const { service, findMany } = createService();
    const rows = [{ id: PRODUCT_ID, name: "SN 500" }];

    const result = await service.localize(ContentEntityType.Product, rows, ["name"], EN);

    expect(findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ rows, localeFallback: false });
  });

  it("overlays the requested locale's values", async () => {
    const { service, findMany } = createService();

    findMany.mockResolvedValue([{ entityId: PRODUCT_ID, field: "name", value: "روغن پایه" }]);

    const result = await service.localize(
      ContentEntityType.Product,
      [{ id: PRODUCT_ID, name: "SN 500" }],
      ["name"],
      FA,
    );

    expect(result.rows).toEqual([{ id: PRODUCT_ID, name: "روغن پایه" }]);
    expect(result.localeFallback).toBe(false);
  });

  it("reports a fallback when a populated field has no translation", async () => {
    const { service } = createService();

    const result = await service.localize(
      ContentEntityType.Product,
      [{ id: PRODUCT_ID, name: "SN 500" }],
      ["name"],
      FA,
    );

    expect(result.rows).toEqual([{ id: PRODUCT_ID, name: "SN 500" }]);
    expect(result.localeFallback).toBe(true);
  });

  // A column that is null in the default locale too has nothing to fall back TO. Flagging it
  // would make the frontend offer a "not yet translated" notice for content that exists in no
  // locale at all.
  it("does not report a fallback for a field that is null in the default locale", async () => {
    const { service } = createService();

    const result = await service.localize(
      ContentEntityType.Product,
      [{ id: PRODUCT_ID, description: null }],
      ["description"],
      FA,
    );

    expect(result.localeFallback).toBe(false);
  });

  it("reads every row's translations in one query rather than one per row", async () => {
    const { service, findMany } = createService();
    const second = "22222222-2222-4222-8222-222222222222";

    await service.localize(
      ContentEntityType.Product,
      [
        { id: PRODUCT_ID, name: "SN 500", slug: "sn-500" },
        { id: second, name: "SN 150", slug: "sn-150" },
      ],
      ["name", "slug"],
      FA,
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        entityType: "Product",
        entityId: { in: [PRODUCT_ID, second] },
        locale: "fa",
        field: { in: ["name", "slug"] },
      },
      select: { entityId: true, field: true, value: true },
    });
  });

  it("skips the query when there is nothing to translate", async () => {
    const { service, findMany } = createService();

    await expect(service.localize(ContentEntityType.Product, [], ["name"], FA)).resolves.toEqual({
      rows: [],
      localeFallback: false,
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("leaves the caller's rows untouched", async () => {
    const { service, findMany } = createService();
    const row = { id: PRODUCT_ID, name: "SN 500" };

    findMany.mockResolvedValue([{ entityId: PRODUCT_ID, field: "name", value: "روغن پایه" }]);

    await service.localize(ContentEntityType.Product, [row], ["name"], FA);

    expect(row.name).toBe("SN 500");
  });
});

describe("ContentTranslationService.findEntityIdBySlug", () => {
  it("looks the slug up as a translated `slug` field in the requested locale", async () => {
    const { service, findFirst } = createService();

    findFirst.mockResolvedValue({ entityId: PRODUCT_ID });

    await expect(
      service.findEntityIdBySlug(ContentEntityType.Category, "روغن-پایه", FA),
    ).resolves.toBe(PRODUCT_ID);

    expect(findFirst).toHaveBeenCalledWith({
      where: { entityType: "Category", locale: "fa", field: "slug", value: "روغن-پایه" },
      select: { entityId: true },
    });
  });

  it("returns null when this locale has no such translated slug", async () => {
    const { service } = createService();

    await expect(
      service.findEntityIdBySlug(ContentEntityType.Product, "missing", FA),
    ).resolves.toBeNull();
  });
});

describe("ContentTranslationService.findTranslatedSlugs", () => {
  it("returns one entry per locale that carries a translated slug", async () => {
    const { service, findMany } = createService();

    findMany.mockResolvedValue([
      { locale: "ar", value: "اس-ان-500" },
      { locale: "fa", value: "اس‌ان-۵۰۰" },
    ]);

    await expect(
      service.findTranslatedSlugs(ContentEntityType.Product, PRODUCT_ID),
    ).resolves.toEqual([
      { locale: "ar", slug: "اس-ان-500" },
      { locale: "fa", slug: "اس‌ان-۵۰۰" },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        entityType: "Product",
        entityId: PRODUCT_ID,
        field: "slug",
        localeRef: { isActive: true },
      },
      orderBy: { locale: "asc" },
      select: { locale: true, value: true },
    });
  });

  // An alternate names a distinct crawlable URL. A locale with a translated name but no
  // translated slug resolves to the default-locale path — the same page, not an alternate.
  it("asks for the slug field only, ignoring every other translated field", async () => {
    const { service, findMany } = createService();

    await service.findTranslatedSlugs(ContentEntityType.Category, PRODUCT_ID);

    const call = findMany.mock.calls[0]?.[0] as { where: { field: string } };

    expect(call.where.field).toBe("slug");
  });

  // Deactivating a language must not leave hreflang advertising a path the site no longer
  // serves. The filter rides the relation content_translations already has, so this stays one
  // query rather than a second read of the locale list.
  it("excludes inactive locales through the Locale relation, in the same query", async () => {
    const { service, findMany } = createService();

    await service.findTranslatedSlugs(ContentEntityType.Product, PRODUCT_ID);

    const call = findMany.mock.calls[0]?.[0] as { where: { localeRef: unknown } };

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(call.where.localeRef).toEqual({ isActive: true });
  });

  it("returns an empty list for an entity translated into no locale", async () => {
    const { service } = createService();

    await expect(
      service.findTranslatedSlugs(ContentEntityType.Product, PRODUCT_ID),
    ).resolves.toEqual([]);
  });
});

describe("ContentTranslationService.findEntityIdsByTranslatedValue", () => {
  it("matches case-insensitively across the named fields and de-duplicates", async () => {
    const { service, findMany } = createService();

    findMany.mockResolvedValue([{ entityId: PRODUCT_ID }]);

    await expect(
      service.findEntityIdsByTranslatedValue(
        ContentEntityType.Product,
        ["name", "slug"],
        "sn 500",
        FA,
      ),
    ).resolves.toEqual([PRODUCT_ID]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        entityType: "Product",
        locale: "fa",
        field: { in: ["name", "slug"] },
        value: { contains: "sn 500", mode: "insensitive" },
      },
      select: { entityId: true },
      distinct: ["entityId"],
    });
  });
});
