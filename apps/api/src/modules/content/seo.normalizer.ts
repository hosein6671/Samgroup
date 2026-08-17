import type { SeoAlternate, SeoFields, SeoImage, TwitterCardType } from "@sam-group/types";

/**
 * Payload's `seo` field group → the platform's one normalized `SeoFields` shape.
 *
 * ── Why a normalizer and not a pass-through ────────────────────────────────
 *
 * SEO_ARCHITECTURE.md §0: one SEO *contract*, implemented twice because ADR-002 splits content
 * across two databases, unified at the seam ADR-003 already unifies everything else. This file is
 * the Payload half of that seam. Prisma's `SeoMeta` table will need its own, producing the identical
 * shape from a different source — which is the entire point, because `apps/web` must not be able to
 * tell which database a page's SEO came from.
 *
 * The shape it produces is `packages/types/src/seo.ts`, and that file is the authority. Nothing here
 * adds a field to it.
 *
 * ── What is deliberately NOT forwarded ─────────────────────────────────────
 *
 * Payload expands an upload relationship into the whole media document: `id`, `filename`, `prefix`,
 * `mimeType`, `filesize`, `focalX`/`focalY`, `thumbnailURL`, `createdAt`, `updatedAt`. Four of those
 * are public facts a consumer acts on — `url`, `alt`, `width`, `height` — and the rest describe how
 * the CMS stores the object. `prefix` and `filename` in particular are storage-layout details, and
 * the internal ids are the kind of thing that later turns into a client guessing an admin route. So
 * the image is reduced to `SeoImage` by allow-list, the same discipline `toResponse` applies to the
 * page itself.
 *
 * `alt` and the dimensions are carried rather than dropped because SEO_ARCHITECTURE.md requires
 * them: §Image SEO for the alt text behind `og:image:alt`, §6 for the intrinsic width/height that
 * keep `next/image` from causing layout shift. Both are read from the media record Payload already
 * returned — no extra request, and no new field on the `Media` collection, because Payload's upload
 * handling produces `width`/`height` itself.
 */

/** SEO_ARCHITECTURE.md §2's default, applied where the stored value is absent or unrecognised. */
const DEFAULT_TWITTER_CARD: TwitterCardType = "summary_large_image";

const TWITTER_CARD_TYPES: ReadonlySet<string> = new Set<TwitterCardType>([
  "summary",
  "summary_large_image",
]);

/**
 * A localized text value, or null.
 *
 * Empty string collapses to null on purpose. §2's fallback chain is written in terms of "if empty",
 * and a consumer that has to test both `null` and `""` before every fallback will eventually forget
 * one and render an empty `<title>`.
 */
function text(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * A boolean stored field, defaulting when absent.
 *
 * `robotsIndex`/`robotsFollow` default to **true**, per §2. Defaulting to false on a malformed value
 * would silently deindex a page — a failure that looks like nothing at all until traffic disappears
 * — so only a literal `false` means false.
 */
function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * A positive, finite pixel dimension, or null.
 *
 * Payload stores `width`/`height` as numbers it measured while processing the upload, but the field
 * is absent for formats it cannot measure — some SVGs — and `null` is the honest answer there. Zero
 * and negatives are rejected rather than passed through: `next/image` treats them as a broken
 * `width` attribute, and a wrong dimension causes exactly the layout shift §6 asks us to avoid.
 */
function dimension(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

/**
 * An upload relationship reduced to the four public facts, or null.
 *
 * Handles all three shapes Payload can return for the field: an expanded document (`depth >= 1`), a
 * bare id (`depth: 0`, which this module never requests but which a future caller might), and null.
 * A bare id yields null rather than an id on the wire — an unresolvable reference is not an image,
 * and emitting the id would leak a CMS primary key for a consumer that could do nothing with it.
 *
 * **A record with no usable `url` is null, whatever else it carries.** An image a consumer cannot
 * load is not an image, and returning `{ url: "", alt, width, height }` would push the decision onto
 * every consumer instead of settling it once here.
 *
 * The URL is passed through untouched and is already origin-relative — `/media/cms/<file>`, produced
 * by `apps/cms` and served by nginx from the public bucket. `apps/api` composing an absolute URL
 * here would need to know the public origin, which is `apps/web`'s knowledge, and would bake the
 * still-undecided production object store into API responses.
 *
 * `alt` is plain text and is neither escaped nor sanitized here, deliberately: it is a value, not
 * markup, and it lands in an HTML *attribute* (`og:image:alt`, `<img alt>`) where escaping is the
 * renderer's job and belongs to the renderer's context. React and Next's Metadata API both escape
 * attribute values, so a stored `"><script>` is rendered as text rather than markup. Sanitizing it
 * here would instead corrupt legitimate copy — an alt text containing `<` or `&` is ordinary.
 * `bodyHtml` is different and IS sanitized, because that one really is markup.
 */
function mediaImage(value: unknown): SeoImage | null {
  if (value === null || value === undefined || typeof value !== "object") {
    return null;
  }

  const media = value as Record<string, unknown>;
  const url = text(media.url);

  if (url === null) {
    return null;
  }

  return {
    url,
    alt: text(media.alt),
    width: dimension(media.width),
    height: dimension(media.height),
  };
}

/**
 * A JSON-LD override, or null.
 *
 * JSON-LD is always an object, so a scalar, an array or a parse failure is not a usable override and
 * normalizes to null — the wording `packages/types` already uses. Passing a malformed value through
 * would put it on a path toward a `<script type="application/ld+json">` tag, where the consequence
 * of a wrong shape is a rendering bug rather than a validation error.
 *
 * **This is a shape check, not an escaping one.** Whatever renders this into a `<script>` tag is
 * responsible for escaping it there — a `</script>` sequence inside a string value terminates the
 * element early, and that is a property of the rendering context, not of the data. No such renderer
 * exists yet; the gate that adds one owns that escaping.
 */
function jsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function twitterCard(value: unknown): TwitterCardType {
  return typeof value === "string" && TWITTER_CARD_TYPES.has(value)
    ? (value as TwitterCardType)
    : DEFAULT_TWITTER_CARD;
}

/**
 * Keywords, as a clean array of non-empty strings.
 *
 * Payload's `hasMany` text field yields an array; anything else — including the `null` an untouched
 * field can carry — becomes `[]`, which is what `packages/types` documents for "unset".
 */
function keywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(text).filter((entry): entry is string => entry !== null);
}

/**
 * Normalize one page's SEO group.
 *
 * Total: a page whose editor never opened the SEO tab has no `seo` object at all, and that is an
 * ordinary state rather than an error. It produces a record of nulls with the documented defaults,
 * so `apps/web` always receives the same shape and applies §11's fallback chain against the page's
 * own content — never a missing key it has to test for first.
 *
 * @param raw the `seo` group exactly as Payload returned it, at `depth: 1` so uploads are expanded.
 * @param locale the REQUESTED locale, not the one the values may have fallen back to
 *   (API_CONTRACT_FINAL.md §3, and `SeoFields.locale`'s own contract).
 * @param alternates every locale this entity is genuinely translated into.
 */
export function normalizeSeo(
  raw: unknown,
  locale: string,
  alternates: readonly SeoAlternate[],
): SeoFields {
  const seo: Record<string, unknown> =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    locale,
    metaTitle: text(seo.metaTitle),
    metaDescription: text(seo.metaDescription),
    canonicalUrl: text(seo.canonicalUrl),
    ogTitle: text(seo.ogTitle),
    ogDescription: text(seo.ogDescription),
    // §2's `socialImageId`, resolved to the image itself — URL plus the alt text §Image SEO
    // requires and the dimensions §6 requires.
    socialImage: mediaImage(seo.socialImage),
    twitterCardType: twitterCard(seo.twitterCardType),
    twitterTitle: text(seo.twitterTitle),
    twitterDescription: text(seo.twitterDescription),
    // Falls back to the social image, per §2's "falls back to the OG equivalents if empty". Applied
    // here rather than left to the consumer because it is a contract rule, not a rendering choice.
    // The whole image falls back together: a Twitter image carrying the OG image's alt text would
    // describe the wrong picture.
    twitterImage: mediaImage(seo.twitterImage) ?? mediaImage(seo.socialImage),
    robotsIndex: flag(seo.robotsIndex, true),
    robotsFollow: flag(seo.robotsFollow, true),
    keywords: keywords(seo.keywords),
    structuredDataOverride: jsonObject(seo.structuredDataOverride),
    alternates: [...alternates],
  };
}
