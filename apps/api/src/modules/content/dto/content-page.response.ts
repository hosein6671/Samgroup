/**
 * The wire shape of `GET /content/pages/:slug`.
 *
 * ── What it deliberately does not carry ─────────────────────────────────────
 *
 * **No id.** Payload's document id is CMS-internal, and nothing in the platform addresses a page by
 * it — the slug is the identifier the URL, the contract and the editor all use. Serving it would
 * publish an identifier from a database the frontend is not supposed to know exists.
 *
 * **No rich-text AST.** API_CONTRACT_FINAL.md §4 names it explicitly as an internal shape.
 * `bodyHtml` is the transport form, produced by Payload's own converter — see the note on the
 * `bodyHtml` field in `apps/cms/src/collections/pages.ts` for why that and not a hand-written AST
 * walker or a newly invented block vocabulary.
 *
 * **No `_status`.** Only published pages are served, so a status field would have exactly one value
 * and would invite a consumer to branch on something that never varies.
 *
 * **No `seo`.** The `SeoFields` group is not implemented on the `Pages` collection yet — see the
 * same file. A field here with nothing behind it would be a contract this platform cannot honour.
 */
export type ContentPageResponse = {
  /** The URL segment. Identical in every locale (PROJECT_HANDOFF.md §6.12). */
  slug: string;
  /** Localized. Falls back to the default locale, which `meta.localeFallback` reports. */
  title: string;
  /**
   * The body as HTML, localized, with the same fallback behaviour as `title`.
   *
   * **Sanitized before it leaves this process** — `rich-text.sanitizer.ts`, applied in the one
   * function every response is assembled by. It is allow-list HTML: headings, emphasis, lists,
   * links, quotes and tables, with no script host, no event handler, no `style`, no embed and no
   * scheme outside `http`/`https`/`mailto`/`tel`. A consumer may render it as markup.
   */
  bodyHtml: string;
  /**
   * ISO 8601, or null when the editor has not set one.
   *
   * Not localized — a legal page is not revised on different dates in different languages
   * (PAYLOAD_CONTENT_ARCHITECTURE.md §1, "Non-localized fact fields").
   */
  lastUpdatedDate: string | null;
};
