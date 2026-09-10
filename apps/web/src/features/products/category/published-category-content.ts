import { sharedCategoryFaq } from "./shared-faq";
import { cache } from "react";
import type { SeoFields } from "@sam-group/types";
import { apiGet } from "@/lib/api-client";
import { overlayCategoryEditorial } from "./category-editorial";
import type { ProductCategoryContent } from "./category-contract";

type PublishedCategoryData = {
  available: boolean;
  fields: Record<string, unknown>;
  seo?: SeoFields;
};
export const getPublishedCategoryData = cache(
  async (key: string, locale: string): Promise<PublishedCategoryData | null> => {
    if (locale !== "en") return { available: false, fields: {} };
    const result = await apiGet<PublishedCategoryData>(
      `/content/product-categories/${encodeURIComponent(key)}`,
      { locale },
    );
    if (!result.ok) {
      console.warn(`[category-content:${key}] published content unavailable; using existing copy`);
      return null;
    }
    const data = result.data;
    return data &&
      typeof data.available === "boolean" &&
      data.fields &&
      typeof data.fields === "object" &&
      !Array.isArray(data.fields)
      ? data
      : null;
  },
);

export async function publishedCategoryContent(
  content: ProductCategoryContent,
  locale: string,
): Promise<ProductCategoryContent> {
  const data = await getPublishedCategoryData(content.familyId, locale);
  if (!data?.available) return content;
  const result = overlayCategoryEditorial(content, data.fields);
  if (data.fields.useSharedFaq === true) {
    const faq = await sharedCategoryFaq(content.familyId, locale);
    if (faq !== null) return { ...result, faq };
    console.warn(`[category-faq:${content.familyId}] FAQ unavailable; keeping existing answers`);
  }
  return result;
}
