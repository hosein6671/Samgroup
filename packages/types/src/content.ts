/**
 * The Payload-backed Content resources' wire shapes.
 *
 * Shared rather than declared inside `apps/web`, on the same arrangement `catalog.ts` and `blog.ts`
 * already use: `apps/api` keeps its own DTOs and this is a transcription of them, not
 * `tsc`-enforced agreement with the backend.
 *
 * ── Nothing here is Payload-shaped ──────────────────────────────────────────
 *
 * `apps/web` never calls Payload (ADR-003) and has no awareness it exists. These types describe
 * what NestJS serves; the CMS's own document shape — its ids, its rich-text AST, its `docs[]`
 * wrapper, its draft status — stops at the Content module and is never transcribed here.
 */

/**
 * One page from `GET /content/pages/:slug` — the Payload `Pages` collection, which holds legal
 * pages and nothing else (PAYLOAD_CONTENT_ARCHITECTURE.md §1).
 *
 * `title` and `bodyHtml` carry the requested locale's values; an untranslated page is served in the
 * default locale and the response's `meta.localeFallback` says so (API_CONTRACT_FINAL.md §3).
 *
 * **No `seo` field.** The `SeoFields` group is not implemented on the collection yet, so there is
 * nothing behind one — see `apps/cms/src/collections/pages.ts`.
 */
export type ContentPageResponse = {
  /** The URL segment, identical in every locale (PROJECT_HANDOFF.md §6.12). */
  slug: string;
  title: string;
  /**
   * The page body as HTML, **sanitized server-side by NestJS before it is served**.
   *
   * Allow-list markup — headings, emphasis, lists, links, quotes, tables — with no script host, no
   * event-handler attribute, no `style`, no embed, and no URL scheme outside
   * `http`/`https`/`mailto`/`tel`. Safe to render as markup; that is the point of the boundary
   * being in the API rather than in each consumer.
   */
  bodyHtml: string;
  /** ISO 8601, or null when the editor has not set one. Not localized. */
  lastUpdatedDate: string | null;
};
