import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { withMeta } from "../../common/http/with-meta";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { LocaleQuery } from "../../common/locale/locale.query";
import { AboutUsService } from "./about-us.service";
import { CustomizedSolutionsService } from "./customized-solutions.service";
import { QualityCertificationsService } from "./quality-certifications.service";

import type { ContentGlobalResult } from "./content-global.reader";
import type { ResponseWithMeta } from "../../common/http/with-meta";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type {
  AboutUsContent,
  ContentGlobalResponse,
  CustomizedSolutionsContent,
  QualityCertificationsContent,
} from "@sam-group/types";

const UNKNOWN_GLOBAL_MESSAGE = "No content global is served under that name.";

/** Everything a company Global's service has to offer this controller. */
type ContentGlobalReader<T> = {
  find(locale: ResolvedLocale): Promise<ContentGlobalResult<T>>;
};

/** What any recognised Global can answer with. */
type ServedGlobal = ContentGlobalResponse<
  AboutUsContent | CustomizedSolutionsContent | QualityCertificationsContent
>;

/**
 * `GET /content/globals/:name` — the company Globals, one name at a time.
 *
 * ── The path is the frozen one ─────────────────────────────────────────────
 *
 * API_CONTRACT_FINAL.md §Content already specifies this route and lists the eight names it will
 * eventually answer to. Three are implemented — `about-us`, `customized-solutions` and
 * `quality-certifications` — and the rest are separate gates. An unimplemented name is a 404
 * **here**, before any request reaches Payload: the CMS is not a routing table, and a typo must not
 * become an upstream error.
 *
 * ── Why one controller and not one per Global ──────────────────────────────
 *
 * Because the contract is one endpoint. The response *shape* differs per Global — a company page is
 * a bespoke schema, which is the whole reason each is a Global rather than a row in a generic
 * collection — so each name is dispatched to its own service and its own projection, while the
 * envelope, the locale handling and the failure semantics stay identical. A third Global is a line
 * in the table below and a service beside the two existing ones; nothing structural.
 */
@Controller("content/globals")
export class ContentGlobalsController {
  private readonly readers: Readonly<Record<string, ContentGlobalReader<unknown>>>;

  constructor(
    aboutUs: AboutUsService,
    customizedSolutions: CustomizedSolutionsService,
    qualityCertifications: QualityCertificationsService,
    private readonly localeResolution: LocaleResolutionService,
  ) {
    this.readers = {
      "about-us": aboutUs,
      "customized-solutions": customizedSolutions,
      "quality-certifications": qualityCertifications,
    };
  }

  /**
   * ── The one 404 this endpoint may answer ──────────────────────────────────
   *
   * An unrecognised name, and nothing else. A recognised Global with nothing published answers 200
   * with `available: false`. The two conditions read alike from a distance and are not alike at
   * all: one says the API serves no such resource, the other says an editor has not published one
   * yet, and only the first is a fact about the URL.
   */
  @Get(":name")
  async findOne(
    @Param("name") name: string,
    @Query() query: LocaleQuery,
  ): Promise<ResponseWithMeta<ServedGlobal>> {
    const reader = Object.prototype.hasOwnProperty.call(this.readers, name)
      ? this.readers[name]
      : undefined;

    if (reader === undefined) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, UNKNOWN_GLOBAL_MESSAGE);
    }

    const locale = await this.localeResolution.resolve(query.locale);
    const { response, localeFallback } = await reader.find(locale);

    return withMeta(response as ServedGlobal, localeFallback ? { localeFallback: true } : {});
  }
}
