import { hasContentCatalog } from "@/i18n/content-catalogs";
import { localizeContent } from "@/i18n/localize-content";
import { apiGet } from "@/lib/api-client";
import { defaultLocale } from "@/lib/locale-contract";
import { getActiveLocales } from "@/lib/locales";
import type { FaqEntry } from "../products/category/category-contract";

export async function publishedFaq(
  locale: string,
  filters: Record<string, string> = {},
): Promise<FaqEntry[] | null> {
  const entries = await readFaq(locale, filters);
  // No entry has been written in this language yet. Where the site ships a reviewed catalog for
  // it, the default-language entries are shown translated instead of leaving the list empty; an
  // entry an editor translates in the CMS replaces this the moment it exists.
  if (entries !== null && entries.length === 0 && hasContentCatalog(locale)) {
    const fallback = defaultLocale(await getActiveLocales());
    if (fallback.code === locale) return entries;
    const source = await readFaq(fallback.code, filters);
    return source === null ? null : localizeContent(locale, source);
  }
  return entries;
}

async function readFaq(
  locale: string,
  filters: Record<string, string>,
): Promise<FaqEntry[] | null> {
  const entries: FaqEntry[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await apiGet<unknown>("/content/faq", {
      locale,
      ...filters,
      page: String(page),
      limit: "100",
    });
    if (!result.ok || !Array.isArray(result.data) || typeof result.meta.total !== "number")
      return null;
    for (const row of result.data) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.entryKey !== "string" ||
        typeof row.question !== "string" ||
        typeof row.answer !== "string"
      )
        return null;
      entries.push({ id: row.entryKey, question: row.question, answer: row.answer });
    }
    if (page * 100 >= result.meta.total) return entries;
    if (!result.data.length) return null;
  }
  return null;
}
