import "server-only";

import faContent from "./messages/fa.content.json";

import type { Catalog } from "./catalogs";

/**
 * The built-in copy catalogs: English source text → translation, for the fixtures in
 * `features/**` that a page renders when the CMS has nothing published in that locale.
 *
 * Server-only. These are the long strings — page copy, product family descriptions — and none of
 * them may be shipped to the browser as a catalog; a client component receives already-translated
 * props from its server parent instead.
 */
export const CONTENT_CATALOGS: Readonly<Record<string, Catalog>> = {
  fa: faContent,
};

const EMPTY: Catalog = {};

export function contentCatalog(locale: string): Catalog {
  return CONTENT_CATALOGS[locale] ?? EMPTY;
}

/**
 * Whether `locale` has built-in copy of its own — the test a page uses to decide between rendering
 * its translated built-in copy and labelling itself as shown in the default language.
 */
export function hasContentCatalog(locale: string): boolean {
  return Object.keys(contentCatalog(locale)).length > 0;
}
