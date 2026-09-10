import type { SeoFields } from "@sam-group/types";
import { normalizeSeo } from "./seo.normalizer";
import { BadRequestException, Controller, Get, Injectable, Param, Query } from "@nestjs/common";
import { LocaleQuery } from "../../common/locale/locale.query";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { withMeta } from "../../common/http/with-meta";
import { PayloadClient } from "./payload.client";

export const CATEGORY_CONTENT_KEYS = [
  "base-oils",
  "engine-oils-automotive-lubricants",
  "industrial-oils-lubricants",
  "lubricant-additives",
  "marine-oils-lubricants",
  "antifreeze-coolants",
];
const FIELDS = [
  "heroTitle",
  "heroSupportingText",
  "overviewHeading",
  "overviewText",
  "qualityHeading",
  "qualityIntro",
  "supplyHeading",
  "packagingSupplyText",
  "supplyTerms",
  "documentationHeading",
  "documentationIntro",
  "documentationNote",
];

@Injectable()
export class CategoryContentService {
  constructor(private readonly payload: PayloadClient) {}
  async read(
    key: string,
    locale: string,
  ): Promise<{ available: boolean; fields: Record<string, string>; seo?: SeoFields }> {
    if (!CATEGORY_CONTENT_KEYS.includes(key)) throw new BadRequestException("Unknown category.");
    if (locale !== "en") return { available: false, fields: {} };
    const result = await this.payload.find("product-category-content", {
      "where[categoryKey][equals]": key,
      "where[_status][equals]": "published",
      locale: "en",
      "fallback-locale": "none",
      depth: "0",
      limit: "1",
    });
    const doc = result.docs[0];
    if (!doc || doc._status !== "published" || doc.categoryKey !== key)
      return { available: false, fields: {} };
    const fields: Record<string, string> = {};
    for (const field of FIELDS) {
      const value = doc[field];
      if (typeof value === "string" && value.trim()) fields[field] = value;
    }
    return {
      available: true,
      fields,
      ...(doc.seo ? { seo: normalizeSeo(doc.seo, "en", []) } : {}),
    };
  }
  async sitemapPolicies(): Promise<Map<string, SeoFields>> {
    const result = await this.payload.find("product-category-content", {
      "where[_status][equals]": "published",
      locale: "en",
      "fallback-locale": "none",
      depth: "0",
      limit: "100",
    });
    const policies = new Map<string, SeoFields>();
    for (const doc of result.docs) {
      if (
        doc._status === "published" &&
        typeof doc.categoryKey === "string" &&
        CATEGORY_CONTENT_KEYS.includes(doc.categoryKey) &&
        doc.seo
      )
        policies.set(doc.categoryKey, normalizeSeo(doc.seo, "en", []));
    }
    return policies;
  }
}

@Controller("content/product-categories")
export class CategoryContentController {
  constructor(
    private readonly content: CategoryContentService,
    private readonly locales: LocaleResolutionService,
  ) {}
  @Get(":key")
  async read(
    @Param("key") key: string,
    @Query() query: LocaleQuery,
  ): Promise<ReturnType<typeof withMeta>> {
    const locale = await this.locales.resolve(query.locale);
    return withMeta(await this.content.read(key, locale.code), {});
  }
}
