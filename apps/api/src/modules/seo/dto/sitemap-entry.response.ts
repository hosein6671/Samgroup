import type { ContentEntityType } from "../../../common/content/content-entity-type";

/**
 * One indexable entity in one locale — the wire shape of `GET /seo/sitemap-entries`
 * (API_CONTRACT_FINAL.md §2.8), consumed by `apps/web`'s `app/sitemap.ts`.
 *
 * `slug`, never `path` and never an absolute URL. Route structure, the locale prefix and the
 * public origin all belong to `apps/web`; the API knows only which entity a page is backed by
 * and what that entity is called in a given locale. This is the same boundary `SeoAlternate`
 * draws in `@sam-group/types` and the same one `RedirectResponse` states for its paths.
 *
 * `entityId` travels so the consumer can group an entity's locales into one `<url>` with its
 * `xhtml:link` alternates without a second request and without matching on slug text.
 *
 * There is deliberately no `lastModified`: `categories` carries no timestamp column at all
 * (schema.prisma), and `<lastmod>` is optional in the sitemap protocol. Emitting `now()` for
 * a row that has not changed in a year would be a false signal to a crawler, which is worse
 * than omitting the field.
 *
 * Lives beside the module that produces it rather than in `packages/types`, exactly as
 * `RedirectResponse` and `LocaleResponse` do — nothing in `apps/cms` implements this shape,
 * so it is not a cross-runtime contract.
 */
export type SitemapEntryResponse = {
  entityType: ContentEntityType;
  entityId: string;
  /** An active locale code the entity is genuinely reachable in — the default, or a translated one. */
  locale: string;
  /** That locale's slug: the entity's own column for the default locale, a translation row otherwise. */
  slug: string;
};
