import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

/**
 * The Catalog module — ARCHITECTURE.md §Modules. Owns `Category`, `Product` and
 * `Specification` in sam_platform, and reads the product-owned rows of `Media` through the
 * polymorphic ownerType/ownerId pair.
 *
 * Neither service is exported: nothing outside this module reads the catalog today, and
 * exporting ahead of a consumer would invite the direct cross-module access ARCHITECTURE.md
 * rules out.
 */
@Module({
  imports: [PrismaModule, LocaleResolutionModule, ContentTranslationModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CategoriesService, ProductsService],
})
export class CatalogModule {}
