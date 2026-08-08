import { Controller, Get } from "@nestjs/common";

import { RedirectsService } from "./redirects.service";
import { SitemapService } from "./sitemap.service";

import type { RedirectResponse } from "./dto/redirect.response";
import type { SitemapEntryResponse } from "./dto/sitemap-entry.response";

/**
 * The SEO module's HTTP surface — both endpoints of API_CONTRACT_FINAL.md §2.8.
 *
 * Neither takes a `?locale=`, unlike every content-bearing endpoint (§3). Both consumers sit
 * outside the localized route tree — `middleware.ts` and `app/sitemap.ts` — and a locale-scoped
 * response would leave each with a partial picture of a site-wide concern.
 *
 * `SeoFields` itself has no endpoint. §2.3 attaches it to the entity it describes, so
 * `GET /categories/:slug` and `GET /products/:slug` carry it and the frontend never makes a
 * second round trip for a page's metadata.
 */
@Controller("seo")
export class SeoController {
  constructor(
    private readonly redirects: RedirectsService,
    private readonly sitemap: SitemapService,
  ) {}

  /**
   * Public and unparameterized. The handler returns a bare array, so the global interceptor
   * supplies `meta: {}` — there is nothing locale-dependent to report.
   */
  @Get("redirects")
  findRedirects(): Promise<RedirectResponse[]> {
    return this.redirects.findActive();
  }

  /**
   * Every indexable entity, one entry per locale it is translated into (§2.8, §3).
   *
   * Entries carry a slug, never a path: composing `/{locale}/products/{slug}` needs the route
   * tree and the public origin, both of which belong to `apps/web`. Which entities appear at
   * all — and why products do not — is documented on SitemapService.
   */
  @Get("sitemap-entries")
  findSitemapEntries(): Promise<SitemapEntryResponse[]> {
    return this.sitemap.findEntries();
  }
}
