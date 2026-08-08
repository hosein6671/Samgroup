import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CatalogModule } from "../catalog/catalog.module";

import { RedirectsService } from "./redirects.service";
import { SeoController } from "./seo.controller";
import { SitemapService } from "./sitemap.service";

/**
 * The SEO module's site-wide half — named in ARCHITECTURE.md §Modules. Owns `seo_meta` and
 * `redirects` in sam_platform, and nothing else; `SeoService` and the per-entity reads live in
 * SeoMetaModule beside it, for the dependency-direction reason documented there.
 *
 * CatalogModule is imported for `CategoriesService`: the sitemap enumerates category pages, and
 * ARCHITECTURE.md requires that to go through the module that owns `categories` rather than a
 * query issued here. LocaleResolutionModule supplies the platform default locale, which reaches
 * the `Locale` table through its owner, LocalizationModule.
 *
 * Nothing is exported. Catalog consumes SeoMetaModule directly, and no module consumes this one.
 */
@Module({
  imports: [PrismaModule, ContentTranslationModule, LocaleResolutionModule, CatalogModule],
  controllers: [SeoController],
  providers: [RedirectsService, SitemapService],
})
export class SeoModule {}
