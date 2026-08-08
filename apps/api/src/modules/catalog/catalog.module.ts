import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { MediaModule } from "../media/media.module";
import { SeoModule } from "../seo/seo.module";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

/**
 * The Catalog module — ARCHITECTURE.md §Modules. Owns `Category`, `Product` and
 * `Specification` in sam_platform, and nothing else.
 *
 * Neither service is exported: nothing outside this module reads the catalog today, and
 * exporting ahead of a consumer would invite the direct cross-module access ARCHITECTURE.md
 * rules out.
 *
 * SeoModule and MediaModule are imported for the reverse direction. §2.3 attaches `SeoFields`
 * and product imagery to the product detail response, and this module reads both through the
 * owning module's service rather than querying `seo_meta` or `media` — which SEO and Media own
 * — for itself.
 */
@Module({
  imports: [PrismaModule, LocaleResolutionModule, ContentTranslationModule, SeoModule, MediaModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CategoriesService, ProductsService],
})
export class CatalogModule {}
