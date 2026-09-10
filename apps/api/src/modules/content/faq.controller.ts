import { ServiceUnavailableException, Controller, Get, Injectable, Query } from "@nestjs/common";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { LocaleQuery } from "../../common/locale/locale.query";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { withMeta } from "../../common/http/with-meta";
import { PayloadClient } from "./payload.client";
import { CATEGORY_CONTENT_KEYS } from "./category-content.controller";

export class FaqQuery extends LocaleQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
  @IsOptional()
  @IsIn(["company", "products", "ordering", "export", "customization"])
  category?: string;
  @IsOptional() @IsIn(CATEGORY_CONTENT_KEYS) relatedCategory?: string;
  @IsOptional() @IsIn(["true", "false"]) contact?: string;
}
export type FaqItem = { entryKey: string; question: string; answer: string };

@Injectable()
export class FaqService {
  constructor(private readonly payload: PayloadClient) {}
  async list(query: FaqQuery, locale: string): Promise<{ items: FaqItem[]; total: number }> {
    if (locale !== "en") return { items: [], total: 0 };
    const filters: Record<string, string> = {
      "where[_status][equals]": "published",
      locale: "en",
      "fallback-locale": "none",
      depth: "0",
      sort: "sortOrder,entryKey",
      page: String(query.page),
      limit: String(query.limit),
    };
    if (query.category) filters["where[topic][equals]"] = query.category;
    if (query.relatedCategory)
      filters["where[relatedCategoryKeys][contains]"] = query.relatedCategory;
    if (query.contact) filters["where[showOnContactPage][equals]"] = query.contact;
    const result = await this.payload.findPage("faq-entries", filters);
    const items = result.docs.map((doc) => {
      if (
        doc._status !== "published" ||
        typeof doc.entryKey !== "string" ||
        typeof doc.question !== "string" ||
        typeof doc.answer !== "string"
      )
        throw new ServiceUnavailableException("Invalid FAQ content.");
      return { entryKey: doc.entryKey, question: doc.question, answer: doc.answer };
    });
    return { items, total: result.total };
  }
}

@Controller("content/faq")
export class FaqController {
  constructor(
    private readonly faq: FaqService,
    private readonly locales: LocaleResolutionService,
  ) {}
  @Get()
  async list(@Query() query: FaqQuery): Promise<ReturnType<typeof withMeta>> {
    const locale = await this.locales.resolve(query.locale);
    const result = await this.faq.list(query, locale.code);
    return withMeta(result.items, { total: result.total, page: query.page, limit: query.limit });
  }
}
