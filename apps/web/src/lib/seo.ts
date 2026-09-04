import { apiGet } from "./api-client";

/**
 * The SEO resource client — `GET /api/v1/seo/sitemap-entries`.
 *
 * One consumer, `app/sitemap.ts`. Like every other module in `lib/`, it calls NestJS and only
 * NestJS, and it reports every API condition as a value rather than throwing: a sitemap that 500s
 * because a database was briefly slow is worse than a sitemap that is briefly shorter, and a
 * crawler treats the two very differently.
 */

/**
 * One indexable entity in one locale, exactly as `SitemapEntryResponse` defines it.
 *
 * Restated here rather than imported: the API keeps this type beside the module that produces it
 * (it is not a cross-runtime contract in `packages/types`), so `apps/web` describes the wire shape
 * it validates, which is the same arrangement `lib/content.ts` uses for the Content responses.
 *
 * `entityType` is intentionally a plain `string`. The API's enum is its own, this client switches
 * on the one value it can render, and an entity type this build does not know about must be ignored
 * rather than crash the sitemap — a new API entity type should not be able to take the file down.
 */
export type SitemapEntry = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly slug: string;
};

/** The `Category` entity type as the API spells it. Compared case-insensitively by the consumer. */
export const CATEGORY_ENTITY_TYPE = "Category";

function isSitemapEntry(value: unknown): value is SitemapEntry {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;

  return (
    typeof record.entityType === "string" &&
    typeof record.entityId === "string" &&
    typeof record.locale === "string" &&
    record.locale !== "" &&
    typeof record.slug === "string" &&
    record.slug !== ""
  );
}

/**
 * Every indexable entity the API enumerates, one entry per locale it is genuinely translated into.
 *
 * Returns `null` — never throws, and never a partial list presented as complete — when the API did
 * not answer or answered with something that is not this shape. The caller renders the routes it
 * owns itself and omits the entity-backed ones, which is the honest degradation: a sitemap is a
 * hint, and an entry omitted for one crawl costs nothing, while a fabricated one costs a 404 in a
 * search index.
 *
 * Entries that individually fail validation are dropped rather than failing the whole read, so one
 * malformed row cannot empty the sitemap.
 */
export async function getSitemapEntries(): Promise<readonly SitemapEntry[] | null> {
  const result = await apiGet<unknown>("/seo/sitemap-entries");

  if (!result.ok || !Array.isArray(result.data)) return null;

  return result.data.filter(isSitemapEntry);
}
