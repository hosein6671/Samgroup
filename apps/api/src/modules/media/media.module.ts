import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { MediaService } from "./media.service";

/**
 * The Media module — ARCHITECTURE.md §Modules ("Media — images, files, videos"). Owns the
 * `media` table in sam_platform and nothing else.
 *
 * `MediaService` is exported because Catalog genuinely consumes it: §2.3 attaches product
 * imagery to the product detail response, and ARCHITECTURE.md requires that to happen through
 * this module's service rather than by Catalog querying `media` itself.
 *
 * No controller. `POST /media/upload` (API_CONTRACT_FINAL.md §2.6) belongs to this module but
 * is not built yet, and a route added ahead of its module is a route nobody owns.
 *
 * A leaf module by construction: it imports PrismaModule and nothing else. `media` is
 * polymorphic — the owner is passed in as an `ownerType`/`ownerId` pair — so this module never
 * needs to resolve an owning entity and therefore never imports the module that holds one.
 * That is what keeps the dependency graph acyclic as more consumers arrive.
 */
@Module({
  imports: [PrismaModule],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
