import { Controller, Get, Param, Query } from "@nestjs/common";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { LocaleQuery } from "../../common/locale/locale.query";
import { withMeta } from "../../common/http/with-meta";

import { CategoriesService } from "./categories.service";
import { CategoryListQuery } from "./dto/category-list.query";

import type { CategoryResponse } from "./dto/category.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";

/**
 * Category discovery — API_CONTRACT_FINAL.md §2.3. Both endpoints are public: no token, no
 * published-state filter (a category has no draft state in `sam_platform`).
 *
 * The controller's whole job is request shape → resolved locale → service → envelope. Both
 * handlers resolve the locale before touching the catalog, so an unknown `?locale=` answers
 * INVALID_LOCALE without a category query ever running.
 */
@Controller("categories")
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly localeResolution: LocaleResolutionService,
  ) {}

  @Get()
  async findAll(@Query() query: CategoryListQuery): Promise<ResponseWithMeta<CategoryResponse[]>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { categories, localeFallback } = await this.categoriesService.findAll(
      locale,
      query.parentId,
    );

    return withMeta(categories, localeFallback ? { localeFallback: true } : {});
  }

  /**
   * `:slug` is the locale-specific slug, so the same category answers to a different path per
   * locale. A slug that exists in no locale is a 404 — the service throws it; there is no
   * "closest match" behavior.
   */
  @Get(":slug")
  async findOne(
    @Param("slug") slug: string,
    @Query() query: LocaleQuery,
  ): Promise<ResponseWithMeta<CategoryResponse>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { category, localeFallback } = await this.categoriesService.findBySlug(slug, locale);

    return withMeta(category, localeFallback ? { localeFallback: true } : {});
  }
}
