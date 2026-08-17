import { Module } from "@nestjs/common";

import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { ContentPagesController } from "./content-pages.controller";
import { ContentPagesService } from "./content-pages.service";
import { PayloadClient } from "./payload.client";

/**
 * The Content module — ARCHITECTURE.md §Modules, "proxies/aggregates Payload CMS data".
 *
 * It imports no database module, and that is the point rather than an omission: Payload's content
 * lives in `sam_cms`, which `apps/api` may never open (ADR-002), so every read here is an HTTP call
 * to the CMS on the internal network. Nothing in this module touches Prisma, and nothing outside it
 * knows the CMS is reached over HTTP at all.
 *
 * `PayloadClient` is deliberately not exported. A future module that needs CMS content should
 * depend on a Content *service* interface, not on the transport — ARCHITECTURE.md §Modules again:
 * cross-module access goes through the other module's service interface.
 */
@Module({
  imports: [LocaleResolutionModule],
  controllers: [ContentPagesController],
  providers: [ContentPagesService, PayloadClient],
})
export class ContentModule {}
