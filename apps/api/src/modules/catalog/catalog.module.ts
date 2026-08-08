import { Module } from "@nestjs/common";

import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

/**
 * The Catalog module — ARCHITECTURE.md §Modules. Owns `Category`, `Product` and
 * `Specification` in sam_platform; this step implements the category reads only
 * (API_CONTRACT_FINAL.md §2.3), so products and specifications have no provider here yet.
 *
 * CategoriesService is not exported: nothing outside this module reads the catalog today, and
 * exporting ahead of a consumer would invite the direct cross-module access ARCHITECTURE.md
 * rules out.
 */
@Module({
  imports: [PrismaModule, LocaleResolutionModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CatalogModule {}
