import { HttpStatus, Injectable } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";

import type { CategoryResponse } from "./dto/category.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const NOT_FOUND_MESSAGE = "Category not found.";

/**
 * The `content_translations.field` values this module translates. `description` exists on
 * other entities but not on `Category`, so asking for it would return nothing.
 */
const TRANSLATED_FIELDS = ["name", "slug"] as const;

/** A category row exactly as selected from the database — default-locale values. */
type CategoryRow = CategoryResponse;

/**
 * Localized categories plus whether any field fell back to the default locale.
 * API_CONTRACT_FINAL.md §3 requires `meta.localeFallback` on the response; composing the
 * envelope is the controller's job, so the flag travels beside the data rather than inside it.
 */
type LocalizedCategories = {
  categories: CategoryResponse[];
  localeFallback: boolean;
};

/** The single-resource counterpart, so `findBySlug` never hands back a one-element array. */
type LocalizedCategory = {
  category: CategoryResponse;
  localeFallback: boolean;
};

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * With no `parentId`, this returns TOP-LEVEL categories only — §2.3 describes the endpoint
   * as "the six product categories", which are the roots; children are reached by passing
   * their parent's id. A flat list of every category at every depth is deliberately not a
   * shape this endpoint offers.
   *
   * Ordered by the default locale's name, not the requested locale's: translated names live
   * in another table and sorting by them would mean ordering in memory after the fact. The
   * order is therefore stable across locales rather than alphabetical within each one.
   */
  async findAll(locale: ResolvedLocale, parentId?: string): Promise<LocalizedCategories> {
    const categories = await this.prisma.category.findMany({
      // `parentId: null` becomes `parent_id IS NULL`, and both branches use
      // @@index([parentId]).
      where: { parentId: parentId ?? null },
      orderBy: { name: "asc" },
      select: CATEGORY_SELECT,
    });

    return this.localize(categories, locale);
  }

  /**
   * Resolves a locale-specific slug (API_CONTRACT_FINAL.md §2.3) — `/categories/روغن-پایه`
   * and `/categories/base-oils` can name the same category in different locales.
   *
   * For a non-default locale the translated slug is tried first and the row's own slug second,
   * because §3 has untranslated fields fall back: a category with no `fa` slug is still
   * reachable in `fa`, at its default-locale path. A translated slug therefore wins over a
   * different category's default slug if the two ever collide — the more specific match.
   */
  async findBySlug(slug: string, locale: ResolvedLocale): Promise<LocalizedCategory> {
    const category = locale.isDefault
      ? await this.findByDefaultSlug(slug)
      : await this.findByTranslatedSlug(slug, locale);

    if (category === null) {
      // Not echoing the slug back: §8 contracts `message` as safe to display, and the slug
      // is caller-supplied text.
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    const { categories, localeFallback } = await this.localize([category], locale);

    // `?? category` is the untranslated row, not a placeholder: localize returns its input
    // one-for-one, so this only satisfies noUncheckedIndexedAccess without a cast.
    return { category: categories[0] ?? category, localeFallback };
  }

  private findByDefaultSlug(slug: string): Promise<CategoryRow | null> {
    return this.prisma.category.findUnique({ where: { slug }, select: CATEGORY_SELECT });
  }

  private async findByTranslatedSlug(
    slug: string,
    locale: ResolvedLocale,
  ): Promise<CategoryRow | null> {
    const translation = await this.prisma.contentTranslation.findFirst({
      where: {
        entityType: ContentEntityType.Category,
        locale: locale.code,
        field: "slug",
        value: slug,
      },
      select: { entityId: true },
    });

    if (translation === null) {
      return this.findByDefaultSlug(slug);
    }

    return this.prisma.category.findUnique({
      where: { id: translation.entityId },
      select: CATEGORY_SELECT,
    });
  }

  /**
   * Overlays the requested locale's translations onto default-locale rows, reporting whether
   * anything was left untranslated.
   *
   * One query for the whole page rather than one per category — the N+1 this replaces would
   * be six queries for the category list today and considerably more for products later.
   */
  private async localize(
    categories: CategoryRow[],
    locale: ResolvedLocale,
  ): Promise<LocalizedCategories> {
    // The default locale's values are the rows themselves, so there is nothing to look up
    // and nothing that can fall back.
    if (locale.isDefault || categories.length === 0) {
      return { categories, localeFallback: false };
    }

    const translations = await this.prisma.contentTranslation.findMany({
      where: {
        entityType: ContentEntityType.Category,
        entityId: { in: categories.map((category) => category.id) },
        locale: locale.code,
        field: { in: [...TRANSLATED_FIELDS] },
      },
      select: { entityId: true, field: true, value: true },
    });

    const byEntity = new Map<string, Map<string, string>>();

    for (const translation of translations) {
      const fields = byEntity.get(translation.entityId) ?? new Map<string, string>();

      fields.set(translation.field, translation.value);
      byEntity.set(translation.entityId, fields);
    }

    let localeFallback = false;

    const localized = categories.map((category) => {
      const fields = byEntity.get(category.id);
      const translated = { ...category };

      for (const field of TRANSLATED_FIELDS) {
        const value = fields?.get(field);

        if (value === undefined) {
          // Missing row — the default-locale value already sitting in `translated` stands,
          // and the response has to say so.
          localeFallback = true;
          continue;
        }

        translated[field] = value;
      }

      return translated;
    });

    return { categories: localized, localeFallback };
  }
}

export type { LocalizedCategories, LocalizedCategory };
