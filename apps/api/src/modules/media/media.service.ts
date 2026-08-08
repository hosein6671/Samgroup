import { Injectable } from "@nestjs/common";

import { MediaType } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";

import type { MediaImageResponse } from "./dto/media.response";
import type { ContentEntityType } from "../../common/content/content-entity-type";

/**
 * Owns the `media` table in sam_platform — ARCHITECTURE.md §Modules names Media as a module
 * boundary, and RAG_ARCHITECTURE.md §Sources already names "the NestJS Media module API" as
 * the way `Media` records are reached. Every other module goes through this service rather
 * than through `prisma.media`.
 *
 * Read-only, and deliberately narrow. `POST /media/upload` (API_CONTRACT_FINAL.md §2.6) and
 * the admin surface are not built here.
 *
 * **There is no generic accessor, and that is the point.** `media` is polymorphic — one table
 * holding product imagery next to customer-uploaded formulation specifications
 * (`CustomFormulationRequest.attachmentMediaId`) and CVs (`JobApplication.cvMediaId`).
 * RAG_IMPLEMENTATION_ARCHITECTURE.md §4 calls an unfiltered read of this table "the trap" and
 * "the most likely way this system gets built wrong", and requires the owner filter to be an
 * allow-list rather than a deny-list. A `findAll`, a `findById`, or an owner-agnostic
 * `findByOwner` would each be the accessor that makes that mistake reachable, so none exists.
 */
@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The public images owned by one entity.
   *
   * `ownerType` is required and has no default: a defaulted owner type is exactly how a caller
   * ends up reading rows it never named. Both halves of the polymorphic key must be stated by
   * the caller, which is what makes the allow-list above hold at every call site.
   *
   * The `type` filter is applied here and cannot be overridden by a caller, so nothing can be
   * widened by adding a media row — a new document type is excluded by default.
   *
   * Ordered by id because `media` carries no sort or timestamp column; the value is arbitrary
   * but the ORDER is stable, which is what a gallery needs.
   */
  findImagesForOwner(ownerType: ContentEntityType, ownerId: string): Promise<MediaImageResponse[]> {
    return this.prisma.media.findMany({
      // Matches @@index([ownerType, ownerId]).
      where: { ownerType, ownerId, type: MediaType.IMAGE },
      orderBy: { id: "asc" },
      select: { id: true, url: true, altText: true },
    });
  }
}
