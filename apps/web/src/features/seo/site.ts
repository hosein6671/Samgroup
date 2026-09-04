/**
 * The public origin, and every absolute URL derived from it — the one place either is decided.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 *
 * `https://samgp.com` was written as a literal in eleven places across `app/[locale]` before this
 * gate: `metadataBase`, six JSON-LD `@id` values, four `new URL(canonical, "https://samgp.com")`
 * calls, and the Organization node the Contact directory emits. Eleven copies of an origin is
 * eleven places for a canonical URL, a structured-data identifier and a sitemap entry to disagree,
 * and structured data that disagrees with a canonical tag is worse than no structured data at all
 * (SEO_ARCHITECTURE.md §9).
 *
 * ── The domain is frozen; the value is still configurable ───────────────────
 *
 * CLAUDE.md §3 fixes the public domain as `samgp.com` and forbids any other, placeholder or
 * otherwise, so that is the default and no other literal appears anywhere in this application.
 * `SITE_PUBLIC_URL` may override it, because a build has to be able to produce correct absolute
 * URLs for an origin that is not production — and because hard-coding one origin is exactly the
 * defect this module was created to remove. An unset, empty, malformed or non-http(s) value falls
 * back to the frozen domain rather than failing: a canonical URL is not worth failing a build over,
 * and the fallback is the value the platform is going to use anyway.
 *
 * It is deliberately **not** `NEXT_PUBLIC_`. Every consumer is server-side — `generateMetadata`,
 * the JSON-LD builders, `sitemap.ts` and `robots.ts` all run on the server — and the public origin
 * is already visible in the page's own canonical tag, so inlining it into a browser bundle would
 * buy nothing.
 */

/** The frozen public domain (CLAUDE.md §3). The only origin literal in `apps/web`. */
const DEFAULT_SITE_ORIGIN = "https://samgp.com";

/**
 * The public origin, with no trailing slash.
 *
 * Read per call rather than captured at module load, so a spec can set the variable and observe the
 * change without resetting modules — and so a value supplied at container start is honoured rather
 * than whatever happened to be set when the bundle was first imported.
 */
export function siteOrigin(): string {
  const raw = process.env.SITE_PUBLIC_URL?.trim();

  if (raw === undefined || raw === "") return DEFAULT_SITE_ORIGIN;

  try {
    const parsed = new URL(raw);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return DEFAULT_SITE_ORIGIN;

    return parsed.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

/** The origin as a `URL`, which is the shape Next's `metadataBase` takes. */
export function siteUrl(): URL {
  return new URL(siteOrigin());
}

/**
 * One site-relative path as an absolute URL.
 *
 * `path` is expected to start with `/`. An absolute URL passed in is returned resolved against
 * itself — `new URL` already does the right thing — so a caller holding an editor-supplied
 * `canonicalUrl` (which the contract permits to be either form) needs no branch of its own.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, `${siteOrigin()}/`).href;
}

/* --------------------------------------------------- structured-data identity */

/**
 * The two site-wide structured-data identifiers, and the only definitions of them.
 *
 * SEO_ARCHITECTURE.md §8 makes `Organization` and `WebSite` global types emitted on every page.
 * Consumers merge nodes that share an `@id`, which is what lets the layout publish the
 * organization's identity while the Contact page adds its contact channels to the same entity —
 * but only while both agree on the string. They are functions rather than constants because the
 * origin is resolved per call.
 */
export function organizationId(): string {
  return `${siteOrigin()}/#organization`;
}

export function webSiteId(): string {
  return `${siteOrigin()}/#website`;
}

/**
 * The organization's published name.
 *
 * "SAM Group" is the short form CLAUDE.md §3 fixes, and it is the name already rendered in the
 * header, the footer and every existing JSON-LD node. It is a naming constant, not a company fact
 * this module invented — the registered legal entity name is unknown to this repository and is
 * deliberately not asserted anywhere.
 */
export const ORGANIZATION_NAME = "SAM Group";
