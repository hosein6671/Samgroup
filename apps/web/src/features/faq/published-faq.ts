import { apiGet } from "@/lib/api-client";
import type { FaqEntry } from "../products/category/category-contract";

export async function publishedFaq(
  locale: string,
  filters: Record<string, string> = {},
): Promise<FaqEntry[] | null> {
  if (locale !== "en") return [];
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
