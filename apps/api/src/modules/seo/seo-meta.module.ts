import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { SeoService } from "./seo.service";

/**
 * The per-entity half of the SEO module: `SeoService` and the `seo_meta` reads behind it.
 *
 * Split out of SeoModule because the two halves answer different questions and have opposite
 * dependency directions — a distinction RedirectsService already documents. `SeoService`
 * describes ONE entity's metadata and is consumed BY Catalog; SeoModule's endpoints describe
 * the whole site's routing and sitemap, and consume Catalog. Leaving both in one module makes
 * `Catalog ↔ Seo` a cycle that only `forwardRef()` can resolve; separating them removes the
 * cycle outright, and keeps `forwardRef` from becoming a permanent fixture of the graph.
 *
 * `seo_meta` still has exactly one owner. This module and SeoModule are two Nest modules over
 * one module boundary in the ARCHITECTURE.md §Modules sense — the `modules/seo/` folder — not
 * two owners of the table.
 */
@Module({
  imports: [PrismaModule, ContentTranslationModule],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoMetaModule {}
