import { HttpStatus, Injectable } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { SeoService } from "../seo/seo.service";

import type { CategoryDetailResponse, CategoryResponse } from "./dto/category.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const NOT_FOUND_MESSAGE = "Category not found.";

/**
 * The `content_translations.field` values this module translates. `description` exists on
 * other entities but not on `Category`, so asking for it would return nothing.
 *
 * Exported because a product carries its category, and the product detail response has to
 * localize it against the same field list rather than a second, drifting one.
 */
export const CATEGORY_TRANSLATED_FIELDS = ["name", "slug"] as const;

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
  category: CategoryDetailResponse;
  localeFallback: boolean;
};

/** Exported alongside the field list, so a product's nested category selects the same columns. */
export const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: ContentTranslationService,
    private readonly seo: SeoService,
  ) {}

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
   *
   * This endpoint — and only this one — carries `SeoFields` (§2.3). The record is built
   * AFTER localization because §11 falls `metaTitle` back to the entity's name, and that
   * fallback has to be the requested locale's name rather than the base row's.
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
    const localized = categories[0] ?? category;

    const seo = await this.seo.buildFor(
      {
        entityType: ContentEntityType.Category,
        entityId: category.id,
        // `category.slug`, not `localized.slug`: the default locale's alternate is the base
        // column, and localization may already have overlaid a translated slug onto the copy.
        defaultSlug: category.slug,
        fallbackTitle: localized.name,
        // `Category` has no description column, so §11's derived-description step has no
        // source here. Inventing one from the name would be a title repeated as a summary.
        fallbackDescription: null,
      },
      locale,
    );

    return { category: { ...localized, seo }, localeFallback };
  }

  private findByDefaultSlug(slug: string): Promise<CategoryRow | null> {
    return this.prisma.category.findUnique({ where: { slug }, select: CATEGORY_SELECT });
  }

  private async findByTranslatedSlug(
    slug: string,
    locale: ResolvedLocale,
  ): Promise<CategoryRow | null> {
    const entityId = await this.translations.findEntityIdBySlug(
      ContentEntityType.Category,
      slug,
      locale,
    );

    if (entityId === null) {
      return this.findByDefaultSlug(slug);
    }

    return this.prisma.category.findUnique({
      where: { id: entityId },
      select: CATEGORY_SELECT,
    });
  }

  /**
   * Thin adapter over the shared overlay: the translation mechanics are identical for every
   * localized entity and live in ContentTranslationService; what belongs to this module is
   * only which entity type and which fields to ask for.
   */
  private async localize(
    categories: CategoryRow[],
    locale: ResolvedLocale,
  ): Promise<LocalizedCategories> {
    const { rows, localeFallback } = await this.translations.localize(
      ContentEntityType.Category,
      categories,
      CATEGORY_TRANSLATED_FIELDS,
      locale,
    );

    return { categories: rows, localeFallback };
  }
}

export type { LocalizedCategories, LocalizedCategory };
