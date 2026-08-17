import { Controller, Get, Param, Query } from "@nestjs/common";

import { withMeta } from "../../common/http/with-meta";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { LocaleQuery } from "../../common/locale/locale.query";
import { ContentPagesService } from "./content-pages.service";

import type { ContentPageResponse } from "./dto/content-page.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";

/**
 * `GET /content/pages/:slug` — API_CONTRACT_FINAL.md §2.4, public, "Legal pages from the `Pages`
 * collection".
 *
 * The contract's path, unchanged: this endpoint was specified long before Payload existed, and
 * nothing here invents a new one. The other eight §2.4 paths — globals, product-category content,
 * FAQ, certifications, job openings, navigation, settings — remain unbuilt, because the collections
 * and globals behind them are not implemented either.
 *
 * The controller's whole job is request shape → resolved locale → service → envelope. The locale is
 * resolved first, so an unknown `?locale=` answers INVALID_LOCALE without a CMS request ever being
 * issued — and, usefully, without the CMS needing to be up.
 */
@Controller("content/pages")
export class ContentPagesController {
  constructor(
    private readonly contentPages: ContentPagesService,
    private readonly localeResolution: LocaleResolutionService,
  ) {}

  /**
   * `:slug` is the same value in every locale — structural page URLs stay fixed English
   * (PROJECT_HANDOFF.md §6.12), so unlike the catalog and blog detail routes there is no
   * locale-specific slug to resolve.
   */
  @Get(":slug")
  async findOne(
    @Param("slug") slug: string,
    @Query() query: LocaleQuery,
  ): Promise<ResponseWithMeta<ContentPageResponse>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { page, localeFallback } = await this.contentPages.findBySlug(slug, locale);

    return withMeta(page, localeFallback ? { localeFallback: true } : {});
  }
}
