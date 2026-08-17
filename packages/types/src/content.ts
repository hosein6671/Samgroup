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

import type { SeoFields } from "./seo";

/**
 * One page from `GET /content/pages/:slug` — the Payload `Pages` collection, which holds legal
 * pages and nothing else (PAYLOAD_CONTENT_ARCHITECTURE.md §1).
 *
 * `title` and `bodyHtml` carry the requested locale's values; an untranslated page is served in the
 * default locale and the response's `meta.localeFallback` says so (API_CONTRACT_FINAL.md §3).
 *
 * `seo` carries the shared `SeoFields` contract — the same shape Prisma-owned content will serve
 * from its own `SeoMeta` table, normalized by NestJS so `apps/web` cannot tell the two apart
 * (SEO_ARCHITECTURE.md §0).
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
  /**
   * The page's SEO record for the requested locale, after the API's fallbacks.
   *
   * Always present — a page with no SEO values yields nulls and documented defaults rather than a
   * missing object, so `generateMetadata` reads one shape.
   *
   * `socialImage` and `twitterImage` carry a URL, alt text and intrinsic dimensions. Their URLs are
   * **origin-relative** (`/media/cms/<file>`), served from this site's own origin by nginx. Open
   * Graph requires absolute URLs, so absolutising them is the frontend's job — Next's Metadata API
   * does it against `metadataBase`.
   */
  seo: SeoFields;
};
