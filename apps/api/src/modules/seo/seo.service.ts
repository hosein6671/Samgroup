import { Injectable } from "@nestjs/common";

import { ContentTranslationService } from "../../common/content/content-translation.service";
import { PrismaService } from "../../prisma/prisma.service";

import type { ContentEntityType } from "../../common/content/content-entity-type";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { SeoAlternate, SeoFields, SeoImage, TwitterCardType } from "@sam-group/types";

/**
 * SEO_ARCHITECTURE.md §2: "Default `summary_large_image`". It lives here rather than in
 * `@sam-group/types` because that package exports types only — see packages/types/src/seo.ts.
 */
const DEFAULT_TWITTER_CARD_TYPE: TwitterCardType = "summary_large_image";

/**
 * The column is a free `text`, so a value written by an admin form, an import, or a future
 * Payload sync can be anything. Anything outside the contracted set normalizes to the
 * default instead of reaching the frontend as an unrenderable card type.
 */
const TWITTER_CARD_TYPES: readonly TwitterCardType[] = ["summary", "summary_large_image"];

/**
 * What a caller must know about its own entity for SEO to be built for it.
 *
 * The shape exists so SeoService never queries `products`, `categories` or any other
 * module's tables — ARCHITECTURE.md §Modules rules that out, and the owning module is
 * already holding every value here by the time it asks.
 */
type SeoEntityRequest = {
  entityType: ContentEntityType;
  entityId: string;

  /**
   * The entity's own `slug` column — the DEFAULT locale's slug, read before localization
   * overlays a translated one. It becomes the default locale's alternate, which is what
   * `hreflang="x-default"` needs.
   */
  defaultSlug: string;

  /**
   * The entity's display name in the REQUESTED locale — SEO_ARCHITECTURE.md §11's second
   * fallback step ("`metaTitle` falls back to `Product.name`"). Localized, not the base
   * column: a Persian page whose meta title fell back to the English name would advertise
   * the wrong language to a crawler.
   */
  fallbackTitle: string;

  /** The requested locale's description, where the entity has one. `Category` has no such column. */
  fallbackDescription: string | null;
};

/** The `seo_meta` columns this module reads, plus the social image resolved through its relation. */
const SEO_META_SELECT = {
  metaTitle: true,
  metaDescription: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  ogImageUrl: true,
  twitterCardType: true,
  twitterTitle: true,
  twitterDescription: true,
  twitterImageUrl: true,
  robotsIndex: true,
  robotsFollow: true,
  keywords: true,
  structuredDataOverride: true,
  // `media` belongs to the Media module, but this is not a read of that module's table: it is
  // this module dereferencing `seo_meta.social_image_id`, a foreign key on a column SEO owns,
  // as part of the same record read. Postgres resolves it in the one query.
  //
  // Routing it through MediaService instead would cost a second round trip per SEO record on
  // every detail endpoint, and would require Media to expose an unfiltered `findById` —
  // `social_image_id` may reference any media row, so such an accessor could not carry the
  // owner allow-list that RAG_IMPLEMENTATION_ARCHITECTURE.md §4 makes mandatory. The boundary
  // is better served by leaving this here.
  //
  // `altText` comes along with the URL because SEO_ARCHITECTURE.md §Image SEO requires descriptive
  // alt text on every image and `SeoFields.socialImage` carries it. There is no width/height to
  // select: Prisma's `Media` has no dimension columns, so this half of the §0 seam serves null for
  // both. Adding them would be a schema migration, not a normalization change.
  socialImage: { select: { url: true, altText: true } },
} as const;

type SeoMetaRecord = {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCardType: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImageUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  keywords: string[];
  structuredDataOverride: unknown;
  socialImage: { url: string; altText: string | null } | null;
};

/**
 * The seam SEO_ARCHITECTURE.md §0 describes: one normalized SEO shape, whichever storage a
 * record came from. Today it reads Prisma's `seo_meta`; the Payload half arrives with the
 * Content module and normalizes into the same `SeoFields`, which is why the contract lives
 * in `@sam-group/types` rather than next to either implementation.
 *
 * It owns `seo_meta` and nothing else. Every entity-specific value it needs is passed in.
 */
@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: ContentTranslationService,
  ) {}

  /**
   * The requested locale's SEO record, normalized and with its alternates attached.
   *
   * A missing record is not an error and not a null response: an entity nobody has written
   * SEO for still needs a title, and §11 forbids shipping an empty one. The whole shape is
   * then built from the fallbacks the caller supplied.
   *
   * API_CONTRACT_FINAL.md §3 is explicit that this reads the REQUESTED locale's record and
   * never the default's — so there is deliberately no second lookup when the row is absent.
   * Field-level fallback happens against the entity's own localized content instead.
   */
  async buildFor(request: SeoEntityRequest, locale: ResolvedLocale): Promise<SeoFields> {
    const [record, alternates] = await Promise.all([
      this.findRecord(request, locale),
      this.buildAlternates(request, locale),
    ]);

    return normalize(record, request, locale, alternates);
  }

  private findRecord(
    request: SeoEntityRequest,
    locale: ResolvedLocale,
  ): Promise<SeoMetaRecord | null> {
    return this.prisma.seoMeta.findUnique({
      // The @@unique([entityType, entityId, locale]) triple — one record per entity per locale.
      where: {
        entityType_entityId_locale: {
          entityType: request.entityType,
          entityId: request.entityId,
          locale: locale.code,
        },
      },
      select: SEO_META_SELECT,
    });
  }

  /**
   * Every ACTIVE locale the entity is genuinely translated into, default locale first.
   *
   * The default locale's alternate comes from the entity's own `slug` column and is always
   * present — it is the `x-default` target, and it is active by construction because a
   * ResolvedLocale is only ever produced from the active list. Every other entry needs a
   * real translated slug row in an active locale: INTERNATIONALIZATION_STRATEGY.md §4 would
   * rather omit a locale than point a crawler at a thin or dead page. Both conditions are
   * applied by the one query ContentTranslationService issues.
   *
   * A `slug` translation row written FOR the default locale is skipped rather than added
   * twice. The base column is authoritative for that locale, and a duplicate hreflang entry
   * is a markup error.
   */
  private async buildAlternates(
    request: SeoEntityRequest,
    locale: ResolvedLocale,
  ): Promise<SeoAlternate[]> {
    const translated = await this.translations.findTranslatedSlugs(
      request.entityType,
      request.entityId,
    );

    const alternates: SeoAlternate[] = [{ locale: locale.defaultCode, slug: request.defaultSlug }];

    for (const row of translated) {
      if (row.locale === locale.defaultCode) {
        continue;
      }

      alternates.push({ locale: row.locale, slug: row.slug });
    }

    return alternates;
  }
}

/**
 * The fallback chain of SEO_ARCHITECTURE.md §11, as far as this API can reach it: the
 * entity's own SEO record, then a value derived from the entity's content. The third step —
 * site-wide defaults from the Payload `Settings` global — is not applied here; the Content
 * module that would read `Settings` does not exist yet, and inventing a placeholder default
 * would put a value on the wire that no editor chose.
 */
function normalize(
  record: SeoMetaRecord | null,
  request: SeoEntityRequest,
  locale: ResolvedLocale,
  alternates: SeoAlternate[],
): SeoFields {
  const metaTitle = blankToNull(record?.metaTitle) ?? blankToNull(request.fallbackTitle);
  const metaDescription =
    blankToNull(record?.metaDescription) ?? blankToNull(request.fallbackDescription);

  /*
   * §2 keeps the social image as its own field precisely so an OG preview does not break when a
   * hero image changes; `social_image_id` is therefore the source of truth and the free-text
   * `og_image_url` column is what an editor falls back on when no Media row fits.
   *
   * Only the Media row can carry alt text — `og_image_url` is a bare URL column with nowhere to
   * put one — so the free-text fallback yields an image with a null `alt`. Neither source has
   * dimensions: Prisma's `Media` has no width/height columns, which is why `SeoImage` makes both
   * nullable rather than this half inventing numbers §6 would then rely on.
   */
  const socialImage =
    toSeoImage(record?.socialImage?.url, record?.socialImage?.altText) ??
    toSeoImage(record?.ogImageUrl, null);

  const ogTitle = blankToNull(record?.ogTitle) ?? metaTitle;
  const ogDescription = blankToNull(record?.ogDescription) ?? metaDescription;

  return {
    locale: locale.code,
    metaTitle,
    metaDescription,
    canonicalUrl: blankToNull(record?.canonicalUrl),
    ogTitle,
    ogDescription,
    socialImage,
    twitterCardType: toTwitterCardType(record?.twitterCardType),
    twitterTitle: blankToNull(record?.twitterTitle) ?? ogTitle,
    twitterDescription: blankToNull(record?.twitterDescription) ?? ogDescription,
    // §2: falls back to the OG equivalent when empty. The stored Twitter URL is free text with no
    // alt text of its own, so it falls back as a whole image rather than borrowing the OG alt.
    twitterImage: toSeoImage(record?.twitterImageUrl, null) ?? socialImage,
    // Both columns are NOT NULL with a `true` default, so a false only ever comes from an
    // editor deliberately setting it. No record at all means indexable and followable.
    robotsIndex: record?.robotsIndex ?? true,
    robotsFollow: record?.robotsFollow ?? true,
    keywords: record?.keywords ?? [],
    structuredDataOverride: toJsonObject(record?.structuredDataOverride),
    alternates,
  };
}

/**
 * §2 words every fallback as applying "if empty", and an admin form that submits a cleared
 * text input writes `""`, not NULL. Treating the two differently would mean a blank meta
 * title reaching a `<title>` tag while a null one falls back correctly.
 */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

/**
 * A URL and its alt text as the shared `SeoImage`, or null when there is no usable URL.
 *
 * An image a consumer cannot load is not an image, so a blank URL yields null however much other
 * metadata came with it — the same rule the Payload half applies in `seo.normalizer.ts`, stated in
 * both places because the two normalizers must agree for §0's seam to hold.
 *
 * `width`/`height` are always null on this side: `sam_platform`'s `media` table has no dimension
 * columns. Filling them with guesses would defeat §6, whose whole purpose is that the number is
 * real.
 */
function toSeoImage(
  url: string | null | undefined,
  altText: string | null | undefined,
): SeoImage | null {
  const resolved = blankToNull(url);

  if (resolved === null) {
    return null;
  }

  return { url: resolved, alt: blankToNull(altText), width: null, height: null };
}

function toTwitterCardType(value: string | null | undefined): TwitterCardType {
  const match = TWITTER_CARD_TYPES.find((cardType) => cardType === value);

  return match ?? DEFAULT_TWITTER_CARD_TYPE;
}

/**
 * `structured_data_override` is `jsonb`, so the column can hold a scalar or an array as
 * easily as an object. JSON-LD is always an object, and anything else is not an override a
 * consumer could render — it normalizes to null, which means "use the automatic generation"
 * (§2), rather than being handed on for the frontend to choke on.
 */
function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export type { SeoEntityRequest };
