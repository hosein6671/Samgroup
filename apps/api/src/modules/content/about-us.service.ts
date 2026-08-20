import { Injectable } from "@nestjs/common";

import { toAboutUsContent } from "./about-us.projection";
import { PayloadClient } from "./payload.client";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { AboutUsResponse } from "@sam-group/types";

/** Payload's slug for the Global, and the only Global this gate serves. */
const ABOUT_US_GLOBAL = "about-us";

export type AboutUsContentResult = {
  readonly response: AboutUsResponse;
  readonly localeFallback: boolean;
};

/**
 * The About Us Global, read through the CMS boundary and served as a curated projection.
 *
 * ── Two reads, and why not one ──────────────────────────────────────────────
 *
 * `ContentPagesService` reads strictly first and falls back only if the strict read came back
 * untranslated. That works for a two-field document; it is wrong for a thirty-field one. A page
 * translated into `fa` in its hero but not yet in its quality section would pass the strict test and
 * then be served with every untranslated field **empty**, silently dropping content that exists in
 * the default locale.
 *
 * So the content read always has Payload's fallback on, and a second, cheap `depth=0` read with
 * `fallback-locale=none` answers the only question fallback state is needed for: did the requested
 * locale supply its own heading? That is what `meta.localeFallback` reports
 * (API_CONTRACT_FINAL.md §3), and it costs one read rather than a per-field audit.
 *
 * ── Unpublished is a 200, and never a NOT_FOUND ─────────────────────────────
 *
 * Payload answers `200 {}` for a Global that was never published and for one the published-only
 * access constraint excludes. Both mean the same thing — there is no published About page — and
 * that is **not** the same fact as "no such resource". `about-us` is a Global the API recognises
 * and a route the site has; only an editor's publish is outstanding.
 *
 * So this service answers `{ available: false, content: null }` with a 200, and NOT_FOUND is
 * reserved for a Global name the API does not serve at all — decided in the controller, before any
 * CMS call. Payload's raw `{}` never leaves this module: `available: false` is this application's
 * statement about the resource rather than the CMS's answer passed through.
 *
 * The third condition, UPSTREAM_UNAVAILABLE, is raised by the client and passes through untouched.
 * All three stay distinguishable end to end, which is what lets `apps/web` render a page that says
 * the right thing — and never `notFound()`, because a CMS that is empty or down must not tell a
 * crawler the company has no About page (the rule ADR-010 §7 fixes for Product Detail).
 */
@Injectable()
export class AboutUsService {
  constructor(private readonly payload: PayloadClient) {}

  async find(locale: ResolvedLocale): Promise<AboutUsContentResult> {
    /*
     * `depth: 1` expands the three optional section uploads and the SEO group's images into media
     * records. The projection then reduces each to a URL, alt text and dimensions — Payload's own
     * record never leaves this module.
     */
    const doc = await this.payload.findGlobal(ABOUT_US_GLOBAL, {
      locale: locale.code,
      depth: "1",
    });

    const content = toAboutUsContent(doc, locale.code);

    if (content === null) {
      /*
       * No second read: `meta.localeFallback` describes content that was served, and nothing was.
       * Reporting a fallback for an unpublished page would be describing a translation state that
       * does not exist.
       */
      return { response: { available: false, content: null }, localeFallback: false };
    }

    return {
      response: { available: true, content },
      localeFallback: await this.isFallback(locale),
    };
  }

  /**
   * Whether the served heading came from the default locale rather than the requested one.
   *
   * Skipped entirely for the default locale, where the question cannot arise and the read would be
   * a second request for a known answer.
   */
  private async isFallback(locale: ResolvedLocale): Promise<boolean> {
    if (locale.isDefault) {
      return false;
    }

    const strict = await this.payload.findGlobal(ABOUT_US_GLOBAL, {
      locale: locale.code,
      depth: "0",
      "fallback-locale": "none",
    });

    const hero: unknown = strict.hero;
    const title: unknown =
      typeof hero === "object" && hero !== null ? (hero as Record<string, unknown>).title : null;

    return typeof title !== "string" || title.trim() === "";
  }
}
