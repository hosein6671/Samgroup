import { Injectable } from "@nestjs/common";
import type { SeoFields } from "@sam-group/types";
import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import { PayloadClient } from "./payload.client";
import { normalizeSeo } from "./seo.normalizer";
export type FaqPageContent = { fields: Record<string, string>; seo?: SeoFields };
@Injectable()
export class FaqPageService {
  constructor(private readonly payload: PayloadClient) {}
  async find(locale: ResolvedLocale): Promise<ContentGlobalResult<FaqPageContent>> {
    const absent = {
      response: { available: false as const, content: null },
      localeFallback: false,
    };
    if (locale.code !== "en") return absent;
    const doc = await this.payload.findGlobal("faq-page", {
      locale: "en",
      "fallback-locale": "none",
      depth: "0",
    });
    if (doc._status !== "published") return absent;
    const fields: Record<string, string> = {};
    for (const key of [
      "eyebrow",
      "title",
      "introduction",
      "questionsHeading",
      "contactHeading",
      "contactText",
      "contactLabel",
    ]) {
      if (typeof doc[key] !== "string" || !doc[key].trim()) return absent;
      fields[key] = doc[key];
    }
    return {
      response: {
        available: true,
        content: { fields, ...(doc.seo ? { seo: normalizeSeo(doc.seo, "en", []) } : {}) },
      },
      localeFallback: false,
    };
  }
}
