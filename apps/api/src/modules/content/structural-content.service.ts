import { Injectable } from "@nestjs/common";
import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { projectStructuralLists } from "@sam-group/types/structural-lists";
import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import { PayloadClient } from "./payload.client";
import { normalizeSeo } from "./seo.normalizer";
@Injectable()
export class StructuralContentService {
  constructor(private readonly payload: PayloadClient) {}
  async read(
    scope: keyof typeof STRUCTURAL_DEFAULTS,
    locale: ResolvedLocale,
  ): Promise<ContentGlobalResult<Record<string, unknown>>> {
    const absent = {
      response: { available: false as const, content: null },
      localeFallback: false,
    };
    if (locale.code !== "en") return absent;
    const doc = await this.payload.findGlobal(scope, {
      locale: "en",
      "fallback-locale": "none",
      depth: "0",
    });
    if (doc._status !== "published") return absent;
    const fields: Record<string, unknown> = {};
    for (const [section, blueprint] of Object.entries(STRUCTURAL_DEFAULTS[scope])) {
      const raw = doc[section];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return absent;
      const data = raw as Record<string, unknown>;
      const projected: Record<string, string> = {};
      fields[section] = projected;
      for (const key of Object.keys(blueprint)) {
        if (typeof data[key] !== "string" || !data[key].trim()) return absent;
        projected[key] = data[key];
      }
    }
    const lists = projectStructuralLists(scope, doc.lists);
    if (lists === null) return absent;
    fields.lists = lists;
    return {
      response: {
        available: true,
        content: { fields, ...(doc.seo ? { seo: normalizeSeo(doc.seo, "en", []) } : {}) },
      },
      localeFallback: false,
    };
  }
}
