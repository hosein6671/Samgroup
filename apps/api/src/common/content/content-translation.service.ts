import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

import type { ContentEntityType } from "./content-entity-type";
import type { ResolvedLocale } from "../locale/resolved-locale";

/**
 * Rows with the requested locale overlaid, plus whether anything was left untranslated.
 *
 * API_CONTRACT_FINAL.md §3 requires `meta.localeFallback` on the response, and composing the
 * envelope is the controller's job — so the flag travels beside the data rather than inside it.
 */
type LocalizedRows<T> = {
  rows: T[];
  localeFallback: boolean;
};

/**
 * The one implementation of `content_translations` reads, shared by every module that serves
 * Prisma-owned localized content (Category, Product, BlogPost).
 *
 * It lives in `common/` rather than in a feature module because it is request-handling policy
 * — the §3 fallback contract — not ownership of an entity. It reads `content_translations`
 * directly and no other table: that table has no owning module, it is a generic sidecar to
 * whichever entity a caller names through `ContentEntityType`.
 *
 * What it deliberately does NOT do is decide which fields are translatable. The caller passes
 * them, because `content_translations.field` is an unconstrained string and only the module
 * that owns an entity knows which of its columns have translation rows.
 */
@Injectable()
export class ContentTranslationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Overlays the requested locale's translations onto default-locale rows.
   *
   * One query for the whole page, never one per row: the N+1 this avoids is six queries for a
   * category list and up to `limit` queries for a product page.
   *
   * A field with no translation row keeps the base row's value and raises `localeFallback` —
   * but only when the base actually holds something. A column that is null in the default
   * locale too (`Product.description`) has nothing to fall back TO, and reporting it as a
   * fallback would make the frontend offer a "not yet translated" notice for content that
   * does not exist in any locale.
   */
  async localize<T extends { id: string }>(
    entityType: ContentEntityType,
    rows: T[],
    fields: readonly (keyof T & string)[],
    locale: ResolvedLocale,
  ): Promise<LocalizedRows<T>> {
    // The default locale's values are the rows themselves, so there is nothing to look up and
    // nothing that can fall back.
    if (locale.isDefault || rows.length === 0 || fields.length === 0) {
      return { rows, localeFallback: false };
    }

    const translations = await this.prisma.contentTranslation.findMany({
      where: {
        entityType,
        entityId: { in: rows.map((row) => row.id) },
        locale: locale.code,
        field: { in: [...fields] },
      },
      select: { entityId: true, field: true, value: true },
    });

    const byEntity = new Map<string, Map<string, string>>();

    for (const translation of translations) {
      const values = byEntity.get(translation.entityId) ?? new Map<string, string>();

      values.set(translation.field, translation.value);
      byEntity.set(translation.entityId, values);
    }

    let localeFallback = false;

    const localized = rows.map((row) => {
      const values = byEntity.get(row.id);
      const translated = { ...row };

      for (const field of fields) {
        const value = values?.get(field);

        if (value === undefined) {
          if (row[field] !== null && row[field] !== undefined) {
            localeFallback = true;
          }

          continue;
        }

        // `keyof T & string` keeps callers honest about which fields they name, but TypeScript
        // cannot prove a generic indexed property accepts a string, so the write goes through
        // a plain record view of the same object.
        (translated as Record<string, unknown>)[field] = value;
      }

      return translated;
    });

    return { rows: localized, localeFallback };
  }

  /**
   * The entity a locale-specific slug names — API_CONTRACT_FINAL.md §2.3, where `:slug` is
   * "the locale-specific slug resolved via ContentTranslation".
   *
   * Null means this locale has no such translated slug; the caller decides whether to fall
   * back to the base row's own slug, because a translated slug and a default-locale slug are
   * looked up in different tables and only the owning module knows the second one.
   */
  async findEntityIdBySlug(
    entityType: ContentEntityType,
    slug: string,
    locale: ResolvedLocale,
  ): Promise<string | null> {
    const translation = await this.prisma.contentTranslation.findFirst({
      where: { entityType, locale: locale.code, field: "slug", value: slug },
      select: { entityId: true },
    });

    return translation?.entityId ?? null;
  }

  /**
   * Entities whose translated text contains `query` — the localized half of `GET /products?q=`
   * (§2.7). Without it, a Persian search term could only ever match the English base row.
   *
   * Case-insensitive `contains`, matching the base-row search the caller pairs this with.
   * Never called for the default locale: those values live on the entity's own columns and
   * `content_translations` holds no rows for them.
   */
  async findEntityIdsByTranslatedValue(
    entityType: ContentEntityType,
    fields: readonly string[],
    query: string,
    locale: ResolvedLocale,
  ): Promise<string[]> {
    const matches = await this.prisma.contentTranslation.findMany({
      where: {
        entityType,
        locale: locale.code,
        field: { in: [...fields] },
        value: { contains: query, mode: "insensitive" },
      },
      select: { entityId: true },
      distinct: ["entityId"],
    });

    return matches.map((match) => match.entityId);
  }
}

export type { LocalizedRows };
