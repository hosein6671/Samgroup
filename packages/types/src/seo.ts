/**
 * The canonical SEO contract — SEO_ARCHITECTURE.md §0/§2.
 *
 * It lives here rather than in `apps/api` because ADR-002 splits content across two
 * databases: Prisma's `SeoMeta` table owns SEO for `sam_platform` content and Payload's
 * `seoFields()` group owns it for `sam_cms` content. One shared TABLE is impossible; one
 * shared SHAPE is the whole point of §0. `apps/api`, `apps/web` and `apps/cms` all read
 * these declarations, so none of the three can drift from the other two.
 *
 * TYPES ONLY, deliberately. `apps/api/tsconfig.json` compiles with `rootDir: "src"`, and
 * this package publishes raw `.ts` source (`exports: "./src/index.ts"`). A type-only import
 * is erased before emit, so nothing here enters the API's program output; a runtime value
 * exported from this file would, and `tsc` would then reject it as a file outside `rootDir`.
 * Constants — such as the `twitterCardType` default — therefore belong to whichever runtime
 * normalizes the data, not to the contract.
 */

/**
 * The two card types SEO_ARCHITECTURE.md §2 defines. Postgres stores the value as a free
 * string (`seo_meta.twitter_card_type`), so the closed set is enforced where the record is
 * normalized rather than by the column.
 */
export type TwitterCardType = "summary" | "summary_large_image";

/**
 * One locale an entity has a REAL translation for — the raw material for `hreflang`
 * (INTERNATIONALIZATION_STRATEGY.md §4). Locales with no translation are omitted, never
 * emitted pointing at a fallback page.
 *
 * `slug`, not a URL: the API does not compose frontend URLs. Route structure, locale
 * prefixes and the public origin all belong to `apps/web`, which pairs this slug with the
 * route it is already rendering.
 */
export type SeoAlternate = {
  /** An active locale code, e.g. `en`, `fa`, `ar`. */
  locale: string;
  /** That locale's own slug for the entity — the translated one, or the entity's own for the default locale. */
  slug: string;
};

/**
 * The normalized SEO record for one entity in one locale, after fallbacks are applied.
 *
 * Null means "no value available from any source the API can reach", not "not looked up".
 * The fallback chain runs entity-specific value → value derived from the entity's own
 * content (SEO_ARCHITECTURE.md §11); the chain's third step, site-wide defaults from the
 * Payload `Settings` global, is not represented here because a consumer that wants it
 * applies it itself.
 */
export type SeoFields = {
  /** The locale this record describes — the REQUESTED locale, never the default's record (API_CONTRACT_FINAL.md §3). */
  locale: string;
  metaTitle: string | null;
  metaDescription: string | null;
  /**
   * Null unless an editor set an explicit override. The §2 fallback ("the entity's own
   * resolved URL") is a URL-composition step, and composing URLs is the frontend's job.
   */
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCardType: TwitterCardType;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImageUrl: string | null;
  /** Default true. False marks this one entity `noindex`. */
  robotsIndex: boolean;
  /** Default true. False marks this one entity `nofollow`. */
  robotsFollow: boolean;
  /** Empty when unset. Low ranking weight — kept for internal content planning (§2). */
  keywords: string[];
  /**
   * A manual JSON-LD document replacing the automatic per-type generation (§2). An object
   * or null: JSON-LD is always an object, so a scalar or array stored in the column is not
   * a usable override and normalizes to null rather than reaching a `<script>` tag.
   */
  structuredDataOverride: Record<string, unknown> | null;
  /** Every locale the entity is genuinely translated into, including the default locale. */
  alternates: SeoAlternate[];
};
