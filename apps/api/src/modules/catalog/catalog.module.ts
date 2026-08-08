import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { MediaModule } from "../media/media.module";
import { SeoMetaModule } from "../seo/seo-meta.module";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

/**
 * The Catalog module — ARCHITECTURE.md §Modules. Owns `Category`, `Product` and
 * `Specification` in sam_platform, and nothing else.
 *
 * `CategoriesService` is exported because SEO genuinely consumes it: `/seo/sitemap-entries`
 * enumerates the category pages, and ARCHITECTURE.md requires that to happen through this
 * module's service rather than by SEO querying `categories` itself. `ProductsService` stays
 * unexported — no consumer exists, and exporting ahead of one would invite exactly the direct
 * cross-module access that rule prevents.
 *
 * SeoMetaModule and MediaModule are imported for the reverse direction. §2.3 attaches
 * `SeoFields` and product imagery to the product detail response, and this module reads both
 * through the owning module's service rather than querying `seo_meta` or `media` — which SEO
 * and Media own — for itself. The dependency is on SeoMetaModule specifically, not on
 * SeoModule, which imports this one: see the note in seo-meta.module.ts.
 */
@Module({
  imports: [
    PrismaModule,
    LocaleResolutionModule,
    ContentTranslationModule,
    SeoMetaModule,
    MediaModule,
  ],
  controllers: [CategoriesController, ProductsController],
  providers: [CategoriesService, ProductsService],
  exports: [CategoriesService],
})
export class CatalogModule {}
