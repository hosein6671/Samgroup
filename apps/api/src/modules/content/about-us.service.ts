import { Injectable } from "@nestjs/common";

import { toAboutUsContent } from "./about-us.projection";
import { readContentGlobal } from "./content-global.reader";
import { PayloadClient } from "./payload.client";

import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { AboutUsContent } from "@sam-group/types";

/** Payload's slug for the Global. */
const ABOUT_US_GLOBAL = "about-us";

export type AboutUsContentResult = ContentGlobalResult<AboutUsContent>;

/**
 * The About Us Global, read through the CMS boundary and served as a curated projection.
 *
 * The reading itself — never asking for a draft, turning Payload's empty document into
 * `available: false`, and measuring the locale fallback with a second cheap read — is
 * `readContentGlobal`, shared with every other company Global so that behaviour cannot drift
 * between pages. What is specific to About Us is only its slug and its projection.
 *
 * ── Unpublished is a 200, and never a NOT_FOUND ─────────────────────────────
 *
 * `about-us` is a Global the API recognises and a route the site has; only an editor's publish is
 * outstanding. NOT_FOUND is reserved for a Global name the API does not serve at all, decided in
 * the controller before any CMS call. The third condition, UPSTREAM_UNAVAILABLE, is raised by the
 * client and passes through untouched.
 *
 * All three stay distinguishable end to end, which is what lets `apps/web` render a page that says
 * the right thing — and never `notFound()`, because a CMS that is empty or down must not tell a
 * crawler the company has no About page (the rule ADR-010 §7 fixes for Product Detail).
 */
@Injectable()
export class AboutUsService {
  constructor(private readonly payload: PayloadClient) {}

  async find(locale: ResolvedLocale): Promise<AboutUsContentResult> {
    return readContentGlobal(this.payload, ABOUT_US_GLOBAL, locale, toAboutUsContent);
  }
}
