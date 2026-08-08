import { Injectable } from "@nestjs/common";

// Value imports, not `import type`: emitDecoratorMetadata writes constructor parameter types
// into design:paramtypes at runtime, and a type-only import erases to nothing.
import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "../catalog/categories.service";

import type { SitemapEntryResponse } from "./dto/sitemap-entry.response";

/**
 * The site-wide sitemap read — API_CONTRACT_FINAL.md §2.8, §3 ("one entry per entity per
 * translated locale").
 *
 * Separate from SeoService for the same reason RedirectsService is: that service describes one
 * entity's metadata for one request, while this enumerates every indexable entity across every
 * locale and is scoped to no entity at all.
 *
 * WHAT IS NOT HERE, and why:
 *
 * - **Structural pages** (`/about-us`, `/faq`, the legal pages, …). Their URLs are fixed
 *   English segments in `apps/web`'s route tree (FRONTEND_ARCHITECTURE.md §2) and exist in no
 *   table. Listing them here would mean hardcoding the frontend's routes into the API, and a
 *   page added to `apps/web` would then be silently missing from the sitemap.
 * - **Products.** FRONTEND_ARCHITECTURE.md §1, confirmed against SITE_STRUCTURE.md's sitemap
 *   sheet, settles that product category pages are single-level: there is no `[productSlug]`
 *   route, and grades are sections within a category page. A product entry would name a URL
 *   that returns 404. `GET /products/:slug` still exists for the Product Finder and the future
 *   admin surface — an API resource is not automatically an indexable page.
 * - **Blog posts and Payload pages.** Both are indexable and both belong here eventually, but
 *   `blog_posts` has no owning module yet and ARCHITECTURE.md §Modules forbids this one from
 *   reading it, while the Payload half arrives with the Content module. Adding either is
 *   additive: `ContentEntityType` already carries `BlogPost`, and the response shape does not
 *   change.
 */
@Injectable()
export class SitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly translations: ContentTranslationService,
    private readonly localeResolution: LocaleResolutionService,
  ) {}

  /**
   * Every indexable entity, once per locale it is genuinely translated into.
   *
   * Unparameterized, like `/seo/redirects` and unlike every content-bearing endpoint: the
   * consumer is `app/sitemap.ts`, which sits outside `[locale]` and produces one document
   * covering every language. A `?locale=` filter would hand it a partial sitemap.
   */
  async findEntries(): Promise<SitemapEntryResponse[]> {
    const [candidates, locale] = await Promise.all([
      // Read through CategoriesService, not `prisma.category`: `categories` belongs to the
      // Catalog module and ARCHITECTURE.md §Modules routes cross-module access through the
      // owning module's service interface.
      this.categories.findSitemapCandidates(),
      // The platform default's code, resolved from the `Locale` table rather than assumed to
      // be "en". `resolve()` with no argument is precisely this endpoint's case — a request
      // that named no locale — and it already raises the bootstrap failure when no ACTIVE
      // locale carries `isDefault`. The `Locale` table is not queried here: LocaleResolution
      // reads it through LocalesService, which LocalizationModule owns.
      this.localeResolution.resolve(),
    ]);

    if (candidates.length === 0) {
      return [];
    }

    const entityIds = candidates.map((candidate) => candidate.id);

    const [translated, excluded] = await Promise.all([
      this.translations.findTranslatedSlugsForEntities(ContentEntityType.Category, entityIds),
      this.findExcludedPairs(ContentEntityType.Category, entityIds),
    ]);

    const slugsByEntity = new Map<string, { locale: string; slug: string }[]>();

    for (const row of translated) {
      const rows = slugsByEntity.get(row.entityId) ?? [];

      rows.push({ locale: row.locale, slug: row.slug });
      slugsByEntity.set(row.entityId, rows);
    }

    const entries: SitemapEntryResponse[] = [];

    for (const candidate of candidates) {
      // The default locale's slug is the entity's own column, always present, and emitted
      // first — the same ordering SeoService.buildAlternates produces, so an entity's sitemap
      // entries and its hreflang alternates cannot disagree about which locale is x-default.
      entries.push({
        entityType: ContentEntityType.Category,
        entityId: candidate.id,
        locale: locale.defaultCode,
        slug: candidate.slug,
      });

      for (const row of slugsByEntity.get(candidate.id) ?? []) {
        // A `slug` translation row written FOR the default locale is skipped rather than
        // emitted twice: the base column is authoritative for that locale, and a duplicate
        // <url> is a sitemap error. Same guard as buildAlternates.
        if (row.locale === locale.defaultCode) {
          continue;
        }

        entries.push({
          entityType: ContentEntityType.Category,
          entityId: candidate.id,
          locale: row.locale,
          slug: row.slug,
        });
      }
    }

    // Both source queries are ordered, so the result is already deterministic without a sort:
    // entities by id, and within an entity the default locale followed by the rest by code.
    return entries.filter((entry) => !excluded.has(pairKey(entry.entityId, entry.locale)));
  }

  /**
   * The (entity, locale) pairs an editor has explicitly marked `noindex`.
   *
   * A `noindex` page listed in a sitemap sends a crawler two contradictory instructions, so
   * SEO_ARCHITECTURE.md §2/§7's `robotsIndex: false` has to be honored here and not only in
   * the `<meta name="robots">` tag.
   *
   * Deliberately an EXCLUSION set built from `robotsIndex = false`, never an inclusion set
   * built from `= true`: an entity with no `seo_meta` row at all is indexable, which is what
   * `SeoService` already assumes when it normalizes a missing record to `robotsIndex: true`.
   * Inverting the query would drop every entity nobody has written SEO for — most of them.
   * (`robots_index` is NOT NULL with a `true` default in schema.prisma, so a stored NULL is
   * not reachable; only a deliberate `false` matches.)
   *
   * `seo_meta` is read directly because this module owns that table — the same read
   * RedirectsService makes of `redirects`.
   */
  private async findExcludedPairs(
    entityType: ContentEntityType,
    entityIds: string[],
  ): Promise<Set<string>> {
    const rows = await this.prisma.seoMeta.findMany({
      // Matches @@index([entityType, entityId]); `robotsIndex` narrows in memory over a set
      // that is already one row per entity per locale.
      where: { entityType, entityId: { in: entityIds }, robotsIndex: false },
      select: { entityId: true, locale: true },
    });

    return new Set(rows.map((row) => pairKey(row.entityId, row.locale)));
  }
}

/**
 * `seo_meta` is unique on (entityType, entityId, locale) and this set is already scoped to one
 * entityType, so the remaining two identify a row. A uuid contains no colon, so no two pairs
 * can collide on the joined key.
 */
function pairKey(entityId: string, locale: string): string {
  return `${entityId}:${locale}`;
}
