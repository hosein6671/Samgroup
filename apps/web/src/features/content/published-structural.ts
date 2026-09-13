import { cache } from "react";
import type { StructuralFields, StructuralScope, SeoFields } from "@sam-group/types";
import { apiGet } from "@/lib/api-client";
export const publishedStructural = cache(
  async (
    scope: StructuralScope,
    locale: string,
  ): Promise<{ fields: StructuralFields; seo?: SeoFields } | null> => {
    if (locale !== "en") return { fields: {} };
    try {
      const result = await apiGet<{
        available: boolean;
        content: { fields: StructuralFields; seo?: SeoFields } | null;
      }>(`/content/globals/${scope}`, { locale });
      if (!result.ok) return null;
      return result.data.available ? result.data.content : { fields: {} };
    } catch {
      return null;
    }
  },
);
