/**
 * The Blog / Insights resources' wire shapes.
 *
 * Shared rather than declared inside `apps/web` so the frontend client and any later consumer read
 * one declaration, on the same arrangement `catalog.ts` already uses: `apps/api` keeps its own DTOs
 * and this is a transcription of them, not `tsc`-enforced agreement with the backend.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 *
 * No `author`, no `excerpt`, no `readingTime`, no hero image, no related posts and no `featured`
 * flag. `BlogPost` in `sam_platform` is `title`, `slug`, `content`, `categoryId`, `authorId` and
 * `publishedAt` — nothing else exists to serve, and a field declared here that no column backs
 * would be an invitation to render a value the platform would then have to invent.
 *
 * `authorId` is the one column that DOES exist and is still not on the wire. A byline is a
 * statement about who wrote a piece; `users` holds no rows, the demo content has no author, and
 * publishing an attributed name is exactly the unapproved claim CLAUDE.md §4 rules out.
 */

/**
 * The category a post belongs to. `BlogPost.categoryId` is NOT NULL, so every post has exactly one.
 *
 * Two fields, matching `ProductSegmentResponse`'s reasoning: a blog category is a navigation facet,
 * and nothing addresses one by id.
 *
 * **Not localized.** `BlogCategory` is not one of the entity types `content_translations` covers
 * (see `apps/api`'s `common/content/content-entity-type.ts`), so these are the row's own values in
 * every locale — see the note in `apps/api`'s `blog-posts.service.ts`.
 */
export type BlogCategoryResponse = {
  name: string;
  slug: string;
};

/** One tag on a post. Same two fields, not localized, for the same reason. */
export type BlogTagResponse = {
  name: string;
  slug: string;
};

/**
 * One row of `GET /blog/posts`.
 *
 * `title` and `slug` carry the REQUESTED locale's values, resolved server-side from
 * `content_translations`; the row's own columns hold the default locale
 * (INTERNATIONALIZATION_STRATEGY.md §3).
 *
 * `content` is **not** on the list row. A blog body is the longest text the platform stores and a
 * page of twenty of them would be a payload measured in hundreds of kilobytes for text no list
 * layout renders. There is no `excerpt` column to serve in its place, and deriving one by cutting
 * the body at a character count would publish a sentence the editor did not write.
 */
export type BlogPostListItemResponse = {
  id: string;
  title: string;
  slug: string;
  /**
   * ISO 8601, and never null: both endpoints serve published posts only, and "published" is
   * `publishedAt` set and in the past (API_CONTRACT_FINAL.md §6).
   */
  publishedAt: string;
  category: BlogCategoryResponse;
};

/** One post, as `GET /blog/posts/:slug` serves it. */
export type BlogPostDetailResponse = {
  id: string;
  title: string;
  slug: string;
  /** The body, verbatim. Plain text in `sam_platform` — there is no rich-text column. */
  content: string;
  /** ISO 8601, never null. See the list row. */
  publishedAt: string;
  category: BlogCategoryResponse;
  /** Empty when the post carries no tags — which is every post while no tag vocabulary exists. */
  tags: BlogTagResponse[];
};
