import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { IdentityModule } from "../identity/identity.module";
import { MediaModule } from "../media/media.module";
import { SeoMetaModule } from "../seo/seo-meta.module";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import {
  CatalogReviewQueueController,
  ProductClaimReviewController,
  ProductCopyReviewController,
  SpecificationReviewController,
} from "./review/catalog-review.controller";
import { CatalogReviewService } from "./review/catalog-review.service";

/**
 * The Catalog module — ARCHITECTURE.md §Modules. Owns `Category`, `Product` and
 * `Specification` in sam_platform, and nothing else.
 *
 * `CategoriesService` is exported because SEO genuinely consumes it: `/seo/sitemap-entries`
 * enumerates the category pages, and ARCHITECTURE.md requires that to happen through this
 * module's service rather than by SEO querying `categories` itself.
 *
 * `ProductsService` is now exported for the same reason, and only for it. It stayed unexported
 * while no consumer existed; one exists — the Forms module verifies `Inquiry.relatedProductId`
 * against a real `Product` before writing a lead, and `Product` is this module's entity. The
 * alternative, Forms querying `products` itself, is precisely the direct cross-module access the
 * rule prevents. Only `existsById` was added for it: a boolean, by id, so the export widens the
 * interface as little as the caller needs.
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
    /*
     * Guards, not services. `JwtAuthGuard` and `RolesGuard` are referenced by CLASS on the review
     * controllers, and Nest constructs a class-referenced enhancer in the module that declares the
     * controller — so `AccessTokenVerifier`, which `JwtAuthGuard` injects, has to be resolvable
     * here. Identity exports exactly that one narrow capability rather than its `users` repository,
     * which is what keeps this import from becoming cross-module data access.
     */
    IdentityModule,
  ],
  controllers: [
    CategoriesController,
    ProductsController,
    CatalogReviewQueueController,
    SpecificationReviewController,
    ProductClaimReviewController,
    ProductCopyReviewController,
  ],
  providers: [CategoriesService, ProductsService, CatalogReviewService],
  exports: [CategoriesService, ProductsService],
})
export class CatalogModule {}
