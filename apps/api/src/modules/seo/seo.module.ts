import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { RedirectsService } from "./redirects.service";
import { SeoController } from "./seo.controller";
import { SeoService } from "./seo.service";

/**
 * The SEO module — named in ARCHITECTURE.md §Modules and built here for the first time.
 * Owns `seo_meta` and `redirects` in sam_platform, and nothing else.
 *
 * `SeoService` is exported because Catalog genuinely consumes it: §2.3 attaches `SeoFields`
 * to the category and product detail responses, and ARCHITECTURE.md requires that to happen
 * through this module's service rather than by Catalog querying `seo_meta` itself.
 * `RedirectsService` is not exported — its only consumer is this module's own controller.
 */
@Module({
  imports: [PrismaModule, ContentTranslationModule],
  controllers: [SeoController],
  providers: [SeoService, RedirectsService],
  exports: [SeoService],
})
export class SeoModule {}
