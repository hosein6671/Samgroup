import { Injectable } from "@nestjs/common";
import { STRUCTURAL_DEFAULTS, structuralImageSlots } from "@sam-group/types/structural-content";
import { projectStructuralLists } from "@sam-group/types/structural-lists";
import type { ContentImage } from "@sam-group/types";
import type { ContentGlobalResult } from "./content-global.reader";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import { PayloadClient } from "./payload.client";
import { normalizeSeo } from "./seo.normalizer";
/**
 * An expanded upload, reduced to the four facts a consumer can act on (the same allow-list as
 * the About Us and Quality projections). Anything else, an unexpanded id included, is `null`,
 * and the layout falls back to its built-in photograph.
 */
function image(value: unknown): ContentImage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const media = value as Record<string, unknown>;
  const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const size = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const url = text(media.url);
  return url === null
    ? null
    : { url, alt: text(media.alt), width: size(media.width), height: size(media.height) };
}

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
    const slots = Object.keys(structuralImageSlots(scope));
    const doc = await this.payload.findGlobal(scope, {
      locale: "en",
      "fallback-locale": "none",
      // Uploads arrive as bare ids at depth 0; only a scope with photographs pays for expansion.
      depth: slots.length > 0 ? "1" : "0",
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
    if (slots.length > 0) {
      const raw =
        doc.images && typeof doc.images === "object" ? (doc.images as Record<string, unknown>) : {};
      fields.images = Object.fromEntries(slots.map((slot) => [slot, image(raw[slot])]));
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
