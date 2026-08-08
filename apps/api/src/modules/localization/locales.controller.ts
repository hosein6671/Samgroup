import { Controller, Get } from "@nestjs/common";

import { LocalesService } from "./locales.service";

import type { LocaleResponse } from "./dto/locale.response";

/**
 * GET /api/v1/locales — the active locale list (API_CONTRACT_FINAL.md §2.1), public and
 * consumed at build time by `apps/web`'s routing config and by Payload's localization config.
 *
 * No query parameters: §3's "every content-bearing endpoint accepts `?locale=`" does not
 * apply to the list of locales itself, so there is no DTO and no INVALID_LOCALE path here.
 *
 * The global envelope interceptor wraps the returned array, so the wire response is
 * {"data":[...],"meta":{}} — the handler never composes the envelope itself, and there is
 * nothing to put in `meta` because a fixed locale set is not paginated.
 */
@Controller("locales")
export class LocalesController {
  constructor(private readonly localesService: LocalesService) {}

  @Get()
  findAll(): Promise<LocaleResponse[]> {
    return this.localesService.findActive();
  }
}
