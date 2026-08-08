import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { PrismaService } from "../../prisma/prisma.service";

import { SeoService } from "./seo.service";

import type { SeoEntityRequest } from "./seo.service";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

const REQUEST: SeoEntityRequest = {
  entityType: ContentEntityType.Product,
  entityId: PRODUCT_ID,
  defaultSlug: "sn-500",
  fallbackTitle: "SN 500",
  fallbackDescription: "A Group I base oil.",
};

/** Every column populated, so a test can assert that the stored value wins over its fallback. */
const FULL_RECORD = {
  metaTitle: "SN 500 Base Oil | Sam Group",
  metaDescription: "Group I solvent-neutral base oil.",
  canonicalUrl: "https://samgp.com/en/products/sn-500",
  ogTitle: "SN 500",
  ogDescription: "Group I base oil for blending.",
  ogImageUrl: "https://cdn.example.test/og-fallback.png",
  twitterCardType: "summary",
  twitterTitle: "SN 500 on Twitter",
  twitterDescription: "Twitter-specific summary.",
  twitterImageUrl: "https://cdn.example.test/twitter.png",
  robotsIndex: false,
  robotsFollow: false,
  keywords: ["base oil", "sn 500"],
  structuredDataOverride: { "@type": "Product" },
  socialImage: { url: "https://cdn.example.test/social.png" },
};

type Stubs = {
  service: SeoService;
  seoFindUnique: jest.Mock;
  translationFindMany: jest.Mock;
};

/** No database is reached — only the two delegates this service and its collaborator call. */
function createService(): Stubs {
  const seoFindUnique = jest.fn().mockResolvedValue(null);
  const translationFindMany = jest.fn().mockResolvedValue([]);

  const prisma = {
    seoMeta: { findUnique: seoFindUnique },
    contentTranslation: { findMany: translationFindMany },
  } as unknown as PrismaService;

  // The real ContentTranslationService, not a stub: it owns the alternates query these
  // tests assert on, and stubbing it would leave those assertions checking nothing.
  return {
    service: new SeoService(prisma, new ContentTranslationService(prisma)),
    seoFindUnique,
    translationFindMany,
  };
}

describe("SeoService.buildFor — record lookup", () => {
  // API_CONTRACT_FINAL.md §3: "SeoFields returns the requested locale's SEO record, never
  // the default's."
  it("reads the requested locale's record, with no second lookup against the default", async () => {
    const { service, seoFindUnique } = createService();

    await service.buildFor(REQUEST, FA);

    expect(seoFindUnique).toHaveBeenCalledTimes(1);
    expect(seoFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType_entityId_locale: {
            entityType: "Product",
            entityId: PRODUCT_ID,
            locale: "fa",
          },
        },
      }),
    );
  });

  it("resolves the social image through the SeoMeta relation rather than a second query", async () => {
    const { service, seoFindUnique } = createService();

    await service.buildFor(REQUEST, EN);

    const call = seoFindUnique.mock.calls[0]?.[0] as { select: Record<string, unknown> };

    expect(call.select.socialImage).toEqual({ select: { url: true } });
  });

  it("returns every stored value verbatim when the record is complete", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue(FULL_RECORD);

    const seo = await service.buildFor(REQUEST, EN);

    expect(seo.metaTitle).toBe(FULL_RECORD.metaTitle);
    expect(seo.metaDescription).toBe(FULL_RECORD.metaDescription);
    expect(seo.canonicalUrl).toBe(FULL_RECORD.canonicalUrl);
    expect(seo.twitterTitle).toBe(FULL_RECORD.twitterTitle);
    expect(seo.keywords).toEqual(FULL_RECORD.keywords);
    expect(seo.structuredDataOverride).toEqual({ "@type": "Product" });
  });

  it("reports the requested locale on the record it returns", async () => {
    const { service } = createService();

    await expect(service.buildFor(REQUEST, FA)).resolves.toMatchObject({ locale: "fa" });
  });
});

describe("SeoService.buildFor — fallbacks", () => {
  // SEO_ARCHITECTURE.md §11 forbids an empty title, so an entity nobody has written SEO for
  // still has to produce a usable record rather than a null one.
  it("builds a complete record from the caller's fallbacks when no row exists", async () => {
    const { service } = createService();

    const seo = await service.buildFor(REQUEST, EN);

    expect(seo.metaTitle).toBe("SN 500");
    expect(seo.metaDescription).toBe("A Group I base oil.");
    expect(seo.ogTitle).toBe("SN 500");
    expect(seo.ogDescription).toBe("A Group I base oil.");
    expect(seo.twitterTitle).toBe("SN 500");
    expect(seo.robotsIndex).toBe(true);
    expect(seo.robotsFollow).toBe(true);
    expect(seo.keywords).toEqual([]);
    expect(seo.structuredDataOverride).toBeNull();
  });

  it("chains OG onto meta and Twitter onto OG", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue({
      ...FULL_RECORD,
      ogTitle: null,
      ogDescription: null,
      twitterTitle: null,
      twitterDescription: null,
      twitterImageUrl: null,
    });

    const seo = await service.buildFor(REQUEST, EN);

    expect(seo.ogTitle).toBe(FULL_RECORD.metaTitle);
    expect(seo.twitterTitle).toBe(FULL_RECORD.metaTitle);
    expect(seo.ogDescription).toBe(FULL_RECORD.metaDescription);
    expect(seo.twitterDescription).toBe(FULL_RECORD.metaDescription);
    expect(seo.twitterImageUrl).toBe(FULL_RECORD.socialImage.url);
  });

  // An admin form that submits a cleared input writes "", not NULL. Treating the two the
  // same is what keeps a blank string out of a <title>.
  it("treats a blank stored value as absent", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue({ ...FULL_RECORD, metaTitle: "   " });

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({ metaTitle: "SN 500" });
  });

  // The API composes no frontend URLs, so §2's "falls back to the entity's own resolved URL"
  // is the frontend's step, not this one.
  it("leaves canonicalUrl null when no override is stored", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue({ ...FULL_RECORD, canonicalUrl: null });

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({ canonicalUrl: null });
  });

  it("leaves the description null for an entity that has none in any locale", async () => {
    const { service } = createService();

    const seo = await service.buildFor({ ...REQUEST, fallbackDescription: null }, EN);

    expect(seo.metaDescription).toBeNull();
    expect(seo.ogDescription).toBeNull();
    expect(seo.twitterDescription).toBeNull();
  });
});

describe("SeoService.buildFor — social image", () => {
  // §2 keeps the social image separate from the hero image precisely so OG previews do not
  // break when content imagery changes, which makes social_image_id the source of truth.
  it("prefers the resolved Media URL over the stored ogImageUrl", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue(FULL_RECORD);

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({
      ogImageUrl: "https://cdn.example.test/social.png",
    });
  });

  it("falls back to ogImageUrl when no social image is attached", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue({ ...FULL_RECORD, socialImage: null });

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({
      ogImageUrl: "https://cdn.example.test/og-fallback.png",
    });
  });

  it("leaves the image null when no source has one", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue({
      ...FULL_RECORD,
      socialImage: null,
      ogImageUrl: null,
      twitterImageUrl: null,
    });

    const seo = await service.buildFor(REQUEST, EN);

    expect(seo.ogImageUrl).toBeNull();
    expect(seo.twitterImageUrl).toBeNull();
  });

  // The Twitter chain only falls back to OG; a card image an editor set explicitly is not
  // overwritten just because the OG image resolved from a different source.
  it("keeps an explicit Twitter image even when the OG image comes from Media", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue(FULL_RECORD);

    const seo = await service.buildFor(REQUEST, EN);

    expect(seo.ogImageUrl).toBe("https://cdn.example.test/social.png");
    expect(seo.twitterImageUrl).toBe("https://cdn.example.test/twitter.png");
  });
});

describe("SeoService.buildFor — twitterCardType", () => {
  it("defaults to summary_large_image when the column is null", async () => {
    const { service } = createService();

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({
      twitterCardType: "summary_large_image",
    });
  });

  it("keeps a stored value that is in the contracted set", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue(FULL_RECORD);

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({
      twitterCardType: "summary",
    });
  });

  // The column is free text, so an import or a future Payload sync can write anything.
  it("falls back to the default for a value outside the contracted set", async () => {
    const { service, seoFindUnique } = createService();

    seoFindUnique.mockResolvedValue({ ...FULL_RECORD, twitterCardType: "player" });

    await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({
      twitterCardType: "summary_large_image",
    });
  });
});

describe("SeoService.buildFor — structuredDataOverride", () => {
  // JSON-LD is always an object; jsonb will happily hold anything else, and a scalar reaching
  // a <script type="application/ld+json"> is worse than no structured data at all.
  it.each([["a string"], [42], [true], [[{ "@type": "Product" }]]])(
    "normalizes a non-object override (%p) to null",
    async (stored) => {
      const { service, seoFindUnique } = createService();

      seoFindUnique.mockResolvedValue({ ...FULL_RECORD, structuredDataOverride: stored });

      await expect(service.buildFor(REQUEST, EN)).resolves.toMatchObject({
        structuredDataOverride: null,
      });
    },
  );
});

describe("SeoService.buildFor — alternates", () => {
  it("always includes the default locale, from the entity's own slug", async () => {
    const { service } = createService();

    const seo = await service.buildFor(REQUEST, FA);

    expect(seo.alternates).toEqual([{ locale: "en", slug: "sn-500" }]);
  });

  // INTERNATIONALIZATION_STRATEGY.md §4: only a locale with a real translation is advertised.
  it("adds one alternate per locale with a real translated slug", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([
      { locale: "ar", value: "اس-ان-500" },
      { locale: "fa", value: "اس‌ان-۵۰۰" },
    ]);

    const seo = await service.buildFor(REQUEST, FA);

    expect(seo.alternates).toEqual([
      { locale: "en", slug: "sn-500" },
      { locale: "ar", slug: "اس-ان-500" },
      { locale: "fa", slug: "اس‌ان-۵۰۰" },
    ]);
  });

  // One query for every active locale at once — and `localeRef` is what keeps a deactivated
  // language from being advertised as an alternate.
  it("looks up slug translations for active locales only, in one query", async () => {
    const { service, translationFindMany } = createService();

    await service.buildFor(REQUEST, FA);

    expect(translationFindMany).toHaveBeenCalledTimes(1);
    expect(translationFindMany).toHaveBeenCalledWith({
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

  // The base column is authoritative for the default locale; a duplicate hreflang entry for
  // the same language is a markup error.
  it("does not emit the default locale twice when a row exists for it", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([{ locale: "en", value: "sn-500-alt" }]);

    const seo = await service.buildFor(REQUEST, FA);

    expect(seo.alternates).toEqual([{ locale: "en", slug: "sn-500" }]);
  });

  it("carries the alternates on a default-locale request too", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([{ locale: "fa", value: "اس‌ان-۵۰۰" }]);

    const seo = await service.buildFor(REQUEST, EN);

    expect(seo.alternates).toEqual([
      { locale: "en", slug: "sn-500" },
      { locale: "fa", slug: "اس‌ان-۵۰۰" },
    ]);
  });
});
