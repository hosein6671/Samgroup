import { Controller, Get } from "@nestjs/common";

import { RedirectsService } from "./redirects.service";

import type { RedirectResponse } from "./dto/redirect.response";

/**
 * The SEO module's only HTTP surface for now — API_CONTRACT_FINAL.md §2.8.
 *
 * `/seo/sitemap-entries`, the section's other endpoint, is deliberately absent: it is a
 * separate approved step, and it depends on decisions (product sitemap scope, path
 * composition) that are still open.
 *
 * SeoFields itself has no endpoint. §2.3 attaches it to the entity it describes, so
 * `GET /categories/:slug` and `GET /products/:slug` carry it and the frontend never makes a
 * second round trip for a page's metadata.
 */
@Controller("seo")
export class SeoController {
  constructor(private readonly redirects: RedirectsService) {}

  /**
   * Public and unparameterized. The handler returns a bare array, so the global interceptor
   * supplies `meta: {}` — there is nothing locale-dependent to report.
   */
  @Get("redirects")
  findRedirects(): Promise<RedirectResponse[]> {
    return this.redirects.findActive();
  }
}
