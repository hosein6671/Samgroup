/**
 * The pre-launch indexing gate — one switch, read by everything that tells a crawler what to do.
 *
 * ── The problem this closes ─────────────────────────────────────────────────
 *
 * `app/[locale]/layout.tsx` has declared `robots: { index: false, follow: false }` for the whole
 * canonical tree since locale routing shipped, because P1 is a routing milestone and not the SEO
 * launch: most canonical pages did not exist, the header and footer linked to routes that 404'd,
 * and `fa`/`ar` typography is still unresolved (ROADMAP.md).
 *
 * A `robots.txt` is the second thing that answers the same question, and the two must never
 * disagree — a `robots.txt` that invites a crawl while every page carries `noindex` wastes crawl
 * budget on pages that then refuse to be indexed, and the reverse silently hides a launched site.
 * So both read this, and the launch gate flips one value rather than two files.
 *
 * ── The default is `false`, and that is not a placeholder ───────────────────
 *
 * With `SITE_SEO_INDEXING` unset the platform behaves exactly as it did before this module
 * existed: `noindex, nofollow` on every canonical page, and a `robots.txt` that disallows
 * everything while still naming the sitemap. Nothing about the current deployment changes.
 *
 * Opening the site to crawlers stays a deliberate act — setting `SITE_SEO_INDEXING=true` in the
 * deployed environment — and it is deliberately an environment value rather than a code constant:
 * the same build must be able to run un-indexed while content is being finished and indexed once it
 * is, without a rebuild. Only the exact string `true` enables it; anything else, including `1` and
 * `TRUE`, leaves the site closed, because the failure that matters is opening it by accident.
 *
 * ── What this switch is not ─────────────────────────────────────────────────
 *
 * It is not a per-page override. An editor's `robotsIndex: false` on a single entity is a separate
 * mechanism and is still deliberately unmapped in the route metadata — see the note in
 * `app/[locale]/privacy-policy/page.tsx`, which explains why mapping it while a blanket directive
 * is in force would let one CMS field escape the gate.
 */

/** True only when the deployed environment has explicitly opened the site to search engines. */
export function isIndexingEnabled(): boolean {
  return process.env.SITE_SEO_INDEXING?.trim() === "true";
}

/**
 * The `robots` metadata value for the canonical tree, derived from the gate.
 *
 * Returned as an object rather than a string so Next renders `<meta name="robots">` from the same
 * shape it always did; the layout spreads it and nothing else about that file changes.
 */
export function robotsMetadata(): { readonly index: boolean; readonly follow: boolean } {
  const enabled = isIndexingEnabled();

  return { index: enabled, follow: enabled };
}
