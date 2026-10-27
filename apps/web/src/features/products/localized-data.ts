import "server-only";

import { localizeContent } from "@/i18n/localize-content";

import { getCategoryContent } from "./category/data";
import { FAMILIES, type ProductFamily } from "./products-data";

import type { ProductCategoryContent } from "./category/category-contract";

/**
 * The product fixtures in the reader's language.
 *
 * `FAMILIES` and the six category contents are the built-in copy the Products pages render; the
 * English is the source and every other locale reads it through the content catalog. Identifiers,
 * hrefs, codes and specification values are never translated (see `localizeContent`).
 */
export function familiesFor(locale: string): readonly ProductFamily[] {
  return localizeContent(locale, FAMILIES);
}

export function categoryContentFor(slug: string, locale: string): ProductCategoryContent | null {
  const content = getCategoryContent(slug);
  return content ? localizeContent(locale, content) : null;
}
