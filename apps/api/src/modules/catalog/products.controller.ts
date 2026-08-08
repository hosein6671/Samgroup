import { Controller, Get, Param, Query } from "@nestjs/common";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { LocaleQuery } from "../../common/locale/locale.query";
import { withMeta } from "../../common/http/with-meta";

import { ProductsService } from "./products.service";
import { ProductListQuery } from "./dto/product-list.query";

import type {
  ProductDetailResponse,
  ProductListItemResponse,
  ProductSpecificationResponse,
} from "./dto/product.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";

/**
 * Product reads — API_CONTRACT_FINAL.md §2.3 and §2.7. All three endpoints are public: no
 * token, and no published-state filter, because a product has no draft state in
 * `sam_platform` (published-state filtering is a Payload concern — §4).
 *
 * The controller's whole job is request shape → resolved locale → service → envelope. Every
 * handler resolves the locale first, so an unknown `?locale=` answers INVALID_LOCALE without a
 * catalog query ever running.
 */
@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly localeResolution: LocaleResolutionService,
  ) {}

  /**
   * `meta.total/page/limit` are always present on this response, per API_DESIGN.md
   * §Pagination & Filtering ("list responses always include..."), while `localeFallback`
   * appears only when something actually fell back (§3).
   */
  @Get()
  async findAll(
    @Query() query: ProductListQuery,
  ): Promise<ResponseWithMeta<ProductListItemResponse[]>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { products, total, page, limit, localeFallback } = await this.productsService.findAll(
      locale,
      query,
    );

    return withMeta(
      products,
      localeFallback ? { total, page, limit, localeFallback: true } : { total, page, limit },
    );
  }

  /** `:slug` is the locale-specific slug, so the same product answers to a different path per locale. */
  @Get(":slug")
  async findOne(
    @Param("slug") slug: string,
    @Query() query: LocaleQuery,
  ): Promise<ResponseWithMeta<ProductDetailResponse>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { product, localeFallback } = await this.productsService.findBySlug(slug, locale);

    return withMeta(product, localeFallback ? { localeFallback: true } : {});
  }

  /**
   * No `localeFallback` here even for a non-default locale: `Specification` is not a
   * translated entity, so nothing on this response can fall back and claiming otherwise would
   * make the frontend offer a "not yet translated" notice for content that has one form only.
   */
  @Get(":slug/specifications")
  async findSpecifications(
    @Param("slug") slug: string,
    @Query() query: LocaleQuery,
  ): Promise<ProductSpecificationResponse[]> {
    const locale = await this.localeResolution.resolve(query.locale);

    return this.productsService.findSpecificationsBySlug(slug, locale);
  }
}
