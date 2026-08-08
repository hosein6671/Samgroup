import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { LocalesController } from "./locales.controller";
import { LocalesService } from "./locales.service";

/**
 * Owns the `Locale` table. ARCHITECTURE.md's module list names no owner for it, and it does
 * not belong to SystemModule: /health is a database-free liveness probe, whereas locales are
 * a cross-cutting dependency — locale validation on every content endpoint,
 * ContentTranslation resolution, SEO alternates — which needs a service other modules can
 * import (ARCHITECTURE.md §Modules: cross-module access goes through a service interface).
 *
 * PrismaModule is imported explicitly rather than relied on as ambient, which is what keeps
 * database access visible per module.
 */
@Module({
  imports: [PrismaModule],
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalizationModule {}
