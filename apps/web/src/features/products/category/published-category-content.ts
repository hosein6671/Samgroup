import { apiGet } from "@/lib/api-client";
import { overlayCategoryEditorial } from "./category-editorial";
import type { ProductCategoryContent } from "./category-contract";

export async function publishedCategoryContent(
  content: ProductCategoryContent,
  locale: string,
): Promise<ProductCategoryContent> {
  if (locale !== "en") return content;
  const result = await apiGet<{ available: boolean; fields: Record<string, unknown> }>(
    `/content/product-categories/${encodeURIComponent(content.familyId)}`,
    { locale },
  );
  if (!result.ok) {
    console.warn(
      `[category-content:${content.familyId}] published content unavailable; using existing copy`,
    );
    return content;
  }
  const data = result.data;
  return data?.available &&
    data.fields &&
    typeof data.fields === "object" &&
    !Array.isArray(data.fields)
    ? overlayCategoryEditorial(content, data.fields)
    : content;
}
