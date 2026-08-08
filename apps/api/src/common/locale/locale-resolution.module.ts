import { Module } from "@nestjs/common";

import { LocalizationModule } from "../../modules/localization/localization.module";

import { LocaleResolutionService } from "./locale-resolution.service";

/**
 * Makes locale resolution importable by any module serving content. It imports
 * LocalizationModule for LocalesService rather than reaching for the `Locale` table, so the
 * table keeps exactly one owner.
 *
 * Not @Global: a module that resolves locales says so in its own imports, the same way
 * PrismaModule is imported per module rather than made ambient.
 */
@Module({
  imports: [LocalizationModule],
  providers: [LocaleResolutionService],
  exports: [LocaleResolutionService],
})
export class LocaleResolutionModule {}
