import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { ContentTranslationService } from "./content-translation.service";

/**
 * Makes translation overlay and locale-specific slug resolution importable by any module
 * serving Prisma-owned localized content.
 *
 * Not @Global, for the same reason LocaleResolutionModule is not: a module that localizes
 * content says so in its own imports.
 */
@Module({
  imports: [PrismaModule],
  providers: [ContentTranslationService],
  exports: [ContentTranslationService],
})
export class ContentTranslationModule {}
