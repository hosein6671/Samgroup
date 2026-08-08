import { Injectable } from "@nestjs/common";

import { LocaleDirection } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";

import type { LocaleDirectionValue, LocaleResponse } from "./dto/locale.response";

/**
 * Exhaustive by construction: a new LocaleDirection member added to the schema fails to
 * compile here until it is given a wire value, rather than silently reaching the frontend
 * as an unmapped enum name.
 */
const WIRE_DIRECTION: Record<LocaleDirection, LocaleDirectionValue> = {
  [LocaleDirection.LTR]: "ltr",
  [LocaleDirection.RTL]: "rtl",
};

/**
 * The Localization module's public read of the `Locale` table.
 *
 * Exported from LocalizationModule because the locale list is not only an endpoint: every
 * content-bearing endpoint has to validate `?locale=` against the active rows
 * (API_CONTRACT_FINAL.md §3, §7) and ARCHITECTURE.md requires that to happen through this
 * service rather than by another module querying the table itself.
 */
@Injectable()
export class LocalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active locales in display order — the language switcher's order, and the order
   * `apps/web`'s next-intl config is generated from at build time.
   *
   * An empty table yields `[]` and a 200, not a 404: this is a collection endpoint, and a
   * platform with no active locale is a bootstrap failure rather than a missing resource.
   */
  async findActive(): Promise<LocaleResponse[]> {
    // `where` + `orderBy` match @@index([isActive, sortOrder]) exactly — that index exists
    // for this read. `select` rather than a whole-row read keeps id, isActive and sortOrder
    // from ever entering the process, so no later change can leak them into a response.
    const locales = await this.prisma.locale.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        code: true,
        name: true,
        nativeName: true,
        direction: true,
        isDefault: true,
      },
    });

    return locales.map((locale) => ({
      ...locale,
      direction: WIRE_DIRECTION[locale.direction],
    }));
  }
}
