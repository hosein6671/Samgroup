/**
 * The wire shapes of the blog endpoints.
 *
 * `title`, `slug` and `content` carry the requested locale's values, resolved from
 * `content_translations`; the row's own columns hold the default locale
 * (INTERNATIONALIZATION_STRATEGY.md §3).
 *
 * ── No `seo`, unlike the product and category detail endpoints ──────────────
 *
 * `SeoMeta` is polymorphic and SEO_ARCHITECTURE.md §5 does name Prisma as the SEO home for blog
 * posts, so attaching `SeoFields` here would work. It is deliberately not done in this slice:
 * nothing consumes it, no document contracts the shape of a blog SEO response, and a field on the
 * wire that no page reads is surface that drifts unnoticed. It arrives with the gate that renders
 * it, exactly as `catalog.ts` in `@sam-group/types` says of the category's own `seo`.
 *
 * ── No `author` ─────────────────────────────────────────────────────────────
 *
 * `BlogPost.authorId` exists and is nullable. A byline is a statement about who wrote a piece;
 * `users` holds no rows and the demo content has no author, so serving one would mean publishing an
 * attribution the platform cannot support.
 */

/**
 * The category a post belongs to — `BlogPost.categoryId` is NOT NULL, so every post has one.
 *
 * `name` and `slug` only. The id is absent for the same reason it is absent from
 * `ProductSegmentResponse`: a blog category is a navigation facet, and nothing addresses one by id.
 *
 * **Returned verbatim, not localized.** `BlogCategory` is not a `ContentEntityType` member, so it
 * has no translation rows to resolve — see the note on BLOG_POST_TRANSLATED_FIELDS in the service.
 */
export type BlogCategoryResponse = {
  name: string;
  slug: string;
};

/** One tag. The same two fields, returned verbatim for the same reason. */
export type BlogTagResponse = {
  name: string;
  slug: string;
};

/**
 * One row of `GET /blog/posts`.
 *
 * `content` is absent by decision. A blog body is the longest text `sam_platform` stores, and a
 * page of twenty would be a payload measured in hundreds of kilobytes for text no list renders.
 * There is no `excerpt` column to serve instead, and cutting the body at a character count would
 * publish a sentence the editor never wrote.
 */
export type BlogPostListItemResponse = {
  id: string;
  title: string;
  slug: string;
  /**
   * ISO 8601, and never null: both endpoints serve published posts only. Serialized here rather
   * than left as a `Date`, so the wire shape does not depend on the JSON serializer in front of it.
   */
  publishedAt: string;
  category: BlogCategoryResponse;
};

export type BlogPostDetailResponse = {
  id: string;
  title: string;
  slug: string;
  /** The body, verbatim. `BlogPost.content` is plain `text` — there is no rich-text column. */
  content: string;
  publishedAt: string;
  category: BlogCategoryResponse;
  /** Empty when the post carries no tags, which is every post while no tag vocabulary exists. */
  tags: BlogTagResponse[];
};
