import { cache } from "react";

import { getAllProductsByCategory, getProductBySlug } from "@/lib/products";

import { familyColumns, familySections, familySpan } from "./family-matrix";

import type { FamilyColumnKey, FamilySection } from "./family-matrix";
import type { ProductDetailResponse } from "@sam-group/types";

export type FamilyCatalog =
  | {
      readonly ok: true;
      readonly total: number;
      /** Products that publish at least one technical value. */
      readonly withData: number;
      readonly columns: readonly FamilyColumnKey[];
      readonly spans: ReadonlyMap<FamilyColumnKey, { low: string; high: string }>;
      readonly sections: readonly FamilySection[];
    }
  | { readonly ok: false };

/** Detail reads in flight at once — enough to be quick, few enough not to flood the API. */
const CONCURRENCY = 6;

async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Everything the redesigned family page lists: every product of the family, grouped by
 * application group (ADR-029), with the headline values of each read from its own detail record.
 *
 * Memoized per request with React's `cache`, so the hero's summary and the catalogue below share
 * one set of reads. A product whose detail cannot be read is still listed, without values: one
 * failed read never removes a product from its family. If the list itself fails, the page shows
 * its catalogue-unavailable state instead (ADR-010 §7 — never a 404).
 */
export const loadFamilyCatalog = cache(
  async (familySlug: string, locale: string): Promise<FamilyCatalog> => {
    const list = await getAllProductsByCategory(familySlug, locale);
    if (!list.ok) return { ok: false };
    const reads = await mapLimited(list.products, CONCURRENCY, (item) =>
      getProductBySlug(item.slug, locale),
    );
    const details = new Map<string, ProductDetailResponse>();
    reads.forEach((read, index) => {
      const item = list.products[index];
      if (read.ok && item) details.set(item.slug, read.record);
    });
    const all = [...details.values()];
    const columns = familyColumns(all);
    const spans = new Map<FamilyColumnKey, { low: string; high: string }>();
    for (const column of columns) {
      const span = familySpan(all, column);
      if (span) spans.set(column, span);
    }
    return {
      ok: true,
      total: list.products.length,
      withData: all.filter((detail) => detail.specifications.length > 0).length,
      columns,
      spans,
      sections: familySections(list.products, details, columns),
    };
  },
);
