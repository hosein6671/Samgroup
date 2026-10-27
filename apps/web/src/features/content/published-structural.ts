import { cache } from "react";
import type { StructuralFields, StructuralScope, SeoFields } from "@sam-group/types";
import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { structuralLists } from "@sam-group/types/structural-lists";
import { localizeContent } from "@/i18n/localize-content";
import { STRUCTURAL_FIXTURES, fixtureRow } from "./structural-fixtures";
import { apiGet } from "@/lib/api-client";

/**
 * A layout's built-in copy, translated into `locale` from the content catalog, in the same shape
 * the CMS answers with — so `structuralSection` and `structuralList` read it exactly as they read
 * published content, and no section needs to know which of the two it was given.
 *
 * Used for a non-default locale when the CMS has nothing complete published in that locale. For
 * English the built-in copy is already the source text and the existing `{ fields: {} }` keeps
 * every section on its own defaults, unchanged.
 */
export function builtInCopy(scope: StructuralScope, locale: string): StructuralFields {
  const fixtures = STRUCTURAL_FIXTURES[scope] ?? {};
  const lists = {
    ...structuralLists(scope),
    ...Object.fromEntries(
      Object.entries(fixtures).map(([key, rows]) => [key, rows.map(fixtureRow)]),
    ),
  };
  return localizeContent(locale, {
    ...(STRUCTURAL_DEFAULTS[scope] as Record<string, Record<string, string>>),
    lists,
  });
}

export const publishedStructural = cache(
  async (
    scope: StructuralScope,
    locale: string,
  ): Promise<{ fields: StructuralFields; seo?: SeoFields } | null> => {
    try {
      const result = await apiGet<{
        available: boolean;
        content: { fields: StructuralFields; seo?: SeoFields } | null;
      }>(`/content/globals/${scope}`, { locale });
      if (!result.ok) return locale === "en" ? null : { fields: builtInCopy(scope, locale) };
      if (result.data.available && result.data.content) return result.data.content;
      return { fields: locale === "en" ? {} : builtInCopy(scope, locale) };
    } catch {
      return locale === "en" ? null : { fields: builtInCopy(scope, locale) };
    }
  },
);
