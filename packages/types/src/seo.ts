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
 * A social/OG image, resolved to the four facts a consumer can actually act on.
 *
 * ── Why this is an object and not a URL string ─────────────────────────────
 *
 * §2's contract table names `ogImageUrl`/`twitterImageUrl`, but two other rules in the same
 * document need more than a URL, and neither can be satisfied by a string:
 *
 * - **§Image SEO** requires descriptive alt text on every image. `og:image:alt` is part of the
 *   Open Graph protocol and Next's Metadata API accepts it, so dropping the alt text at this
 *   boundary would make the requirement unimplementable for CMS-owned images.
 * - **§6** requires "real width/height to avoid layout shift". `next/image` needs intrinsic
 *   dimensions, and a consumer that has only a URL must either guess them or fetch the image.
 *
 * Both facts are already stored beside the URL — Payload's upload metadata for `sam_cms` content,
 * Prisma's `Media` row for `sam_platform` content — so this widens the contract to carry what both
 * halves of the §0 seam already hold. It is the resolved image, never the storage record: no id,
 * no filename, no prefix, no MIME type, no focal point.
 */
export type SeoImage = {
  /**
   * Where the image is served from.
   *
   * **Origin-relative** for CMS media (`/media/cms/<file>`, proxied by nginx from the public
   * bucket). The API does not compose absolute URLs — it does not know the public origin, and the
   * production object store is undecided — so absolutising it for Open Graph, which requires an
   * absolute URL, is the frontend's job. Next resolves a relative image against `metadataBase`.
   */
  url: string;
  /**
   * Descriptive alt text (§Image SEO), in the requested locale with the same fallback behaviour as
   * every other localized value on the record.
   *
   * Nullable despite the CMS marking it required: the contract is shared with the Prisma half,
   * and a normalizer that cannot represent "the upstream did not give me one" would have to invent
   * a string instead. **Plain text, never markup** — a consumer puts it in an attribute.
   */
  alt: string | null;
  /** Intrinsic pixel width (§6). Null when the source has no usable dimension, as for some SVGs. */
  width: number | null;
  /** Intrinsic pixel height (§6). Null when the source has no usable dimension, as for some SVGs. */
  height: number | null;
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
  /**
   * §2's `socialImageId`, resolved. Null when no image is set — the entity's own hero image is
   * deliberately NOT substituted (§Image SEO keeps the two separate so an OG preview does not
   * break when a hero image changes).
   */
  socialImage: SeoImage | null;
  twitterCardType: TwitterCardType;
  twitterTitle: string | null;
  twitterDescription: string | null;
  /**
   * The Twitter card's image. §2 keeps this separate from the OG image and falls it back to the OG
   * equivalent when empty; that fallback is a contract rule, so the API applies it and this is
   * null only when neither image is set.
   */
  twitterImage: SeoImage | null;
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
