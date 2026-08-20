import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { withMeta } from "../../common/http/with-meta";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { LocaleQuery } from "../../common/locale/locale.query";
import { AboutUsService } from "./about-us.service";

import type { ResponseWithMeta } from "../../common/http/with-meta";
import type { AboutUsResponse } from "@sam-group/types";

/** The one Global this gate serves. Every other name 404s rather than reaching the CMS. */
const ABOUT_US = "about-us";

const UNKNOWN_GLOBAL_MESSAGE = "No content global is served under that name.";

/**
 * `GET /content/globals/:name` — the company Globals, one name at a time.
 *
 * ── The path is the frozen one ─────────────────────────────────────────────
 *
 * API_CONTRACT_FINAL.md §Content already specifies this route and lists the eight names it will
 * eventually answer to. Only `about-us` is implemented; the rest are separate gates, and an
 * unimplemented name is a 404 here rather than a request to Payload for a Global that does not
 * exist. No alias, no second path, no generic CMS proxy.
 *
 * ── Why one controller and not one per Global ──────────────────────────────
 *
 * Because the contract is one endpoint. The response *shape* differs per Global — a company page is
 * a bespoke schema, which is the whole reason each is a Global rather than a row in a generic
 * collection — so each name is dispatched to its own service and its own projection. That is the
 * shape a second Global joins: a case here, a service beside `AboutUsService`, nothing structural.
 */
@Controller("content/globals")
export class ContentGlobalsController {
  constructor(
    private readonly aboutUs: AboutUsService,
    private readonly localeResolution: LocaleResolutionService,
  ) {}

  /**
   * ── The one 404 this endpoint may answer ──────────────────────────────────
   *
   * An unrecognised name, and nothing else. A recognised Global with nothing published answers 200
   * with `available: false` — see `AboutUsService`. The two conditions read alike from a distance
   * and are not alike at all: one says the API serves no such resource, the other says an editor
   * has not published one yet, and only the first is a fact about the URL.
   */
  @Get(":name")
  async findOne(
    @Param("name") name: string,
    @Query() query: LocaleQuery,
  ): Promise<ResponseWithMeta<AboutUsResponse>> {
    if (name !== ABOUT_US) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, UNKNOWN_GLOBAL_MESSAGE);
    }

    const locale = await this.localeResolution.resolve(query.locale);
    const { response, localeFallback } = await this.aboutUs.find(locale);

    return withMeta(response, localeFallback ? { localeFallback: true } : {});
  }
}
