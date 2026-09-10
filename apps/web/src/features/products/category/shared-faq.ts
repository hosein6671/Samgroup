import { publishedFaq } from "@/features/faq/published-faq";
import type { FaqEntry } from "./category-contract";
export function sharedCategoryFaq(key: string, locale: string): Promise<FaqEntry[] | null> {
  return publishedFaq(locale, { relatedCategory: key });
}
