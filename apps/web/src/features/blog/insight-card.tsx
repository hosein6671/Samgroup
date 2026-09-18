import Image from "next/image";
import type { ReactNode } from "react";

import { ROUTES } from "@/features/site/site-routes";

import { PublishedDate } from "./published-date";

import type { BlogPostListItemResponse } from "@sam-group/types";

/**
 * One post, as `GET /blog/posts` serves it.
 *
 * Written against the LIST row rather than against a page, so the Insights index and any later
 * post-bearing surface — the homepage's "3 latest posts", when that endpoint exists — render the
 * same card from the same shape. It holds no layout of its own beyond the card; the grid belongs to
 * whatever is listing them.
 *
 * ── It renders three fields, and that is the whole contract ─────────────────
 *
 * `title`, `category.name`, `publishedAt` and the optional featured image. Nothing else is inferred.
 *
 * There is deliberately **no excerpt, no author, no read-time, no tag list and no
 * "featured" marker** anywhere in this component. Not blank — absent. `BlogPost` has no `excerpt`
 * column, so a summary here could only be the body cut at a character count, which publishes a
 * sentence the editor never wrote; `authorId` is null on every row and a byline is a claim about a
 * person; read-time and featured flags have no column at all. A field that does not exist
 * cannot be filled in with a plausible guess — the same rule `product-card.tsx` states.
 *
 * ── It links to the flat article URL ────────────────────────────────────────
 *
 * `/{locale}/insights/{slug}`, composed here rather than passed in, for the reason `ProductCard`
 * gives: a caller passing an `href` could pass a nested one, a caller passing a `locale` cannot. The
 * slug is the REQUESTED locale's slug, resolved server-side, so the link stays inside the locale it
 * was rendered in.
 *
 * ── No demo badge ───────────────────────────────────────────────────────────
 *
 * The current rows are DEMO / PLACEHOLDER data and nothing on the wire says so — `BlogPost` has no
 * demo column, and inventing a badge from a slug prefix would be this component asserting a data
 * classification it cannot see. It does not need to: every seeded title begins "Demo:" and the
 * seeded category is called "Demo Content", both of which this card renders verbatim.
 *
 * A Server Component. No state, no JavaScript.
 */
export function InsightCard({
  post,
  locale,
}: {
  readonly post: BlogPostListItemResponse;
  /** The active locale segment. Half of the article URL; the post's slug is the other half. */
  readonly locale: string;
}): ReactNode {
  return (
    <article className="in-card">
      {post.featuredImage && (
        <Image
          className="in-card-image"
          src={post.featuredImage.url}
          alt={post.featuredImage.altText ?? ""}
          width={640}
          height={360}
          sizes="(max-width: 640px) 100vw, 400px"
        />
      )}
      <p className="in-card-meta">
        <span className="in-card-category">{post.category.name}</span>
        <PublishedDate iso={post.publishedAt} locale={locale} className="in-card-date" />
      </p>

      <h3 className="in-card-title">
        {/*
         * The heading is the link, not the card. A card-sized anchor gives a screen reader one
         * enormous link name; the heading carries the title, which is the accessible name this link
         * should have. `insights.css` spreads the hit area over the card with `::after`.
         */}
        <a className="in-card-link" href={`/${locale}${ROUTES.insights}/${post.slug}`}>
          {post.title}
        </a>
      </h3>
    </article>
  );
}

/**
 * The newest post, given the same larger treatment `BrandedPhoto` gives a marketing photograph —
 * full-bleed image, dark scrim, copy over it — instead of `InsightCard`'s plain frame.
 *
 * "Newest" is a mechanical fact of `GET /blog/posts`' own sort order, not an editorial pick: the
 * index calls this exactly once, on `result.posts[0]`, unfiltered and on page one. There is still no
 * `featured` column and none is implied — see `insights-template.tsx`'s note on why this page has
 * stayed spare. **Same field contract as `InsightCard`, nothing added**: title, category, date and
 * the optional image. No excerpt and no read-time, for the reason `InsightCard`'s own note gives —
 * neither column exists.
 */
export function FeaturedInsightCard({
  post,
  locale,
}: {
  readonly post: BlogPostListItemResponse;
  readonly locale: string;
}): ReactNode {
  return (
    <article className="in-featured">
      <div className="in-featured-media">
        {post.featuredImage ? (
          <Image
            src={post.featuredImage.url}
            alt={post.featuredImage.altText ?? ""}
            width={1400}
            height={600}
            sizes="100vw"
            priority
          />
        ) : (
          // No image: the ink ground and blueprint field alone still carry the copy legibly.
          <div className="fs-blueprint" aria-hidden="true" />
        )}
      </div>

      <div className="in-featured-copy">
        <p className="in-featured-meta">
          <span className="in-featured-category">{post.category.name}</span>
          <PublishedDate iso={post.publishedAt} locale={locale} className="in-featured-date" />
        </p>

        <h2 className="in-featured-title">
          <a className="in-featured-link" href={`/${locale}${ROUTES.insights}/${post.slug}`}>
            {post.title}
          </a>
        </h2>
      </div>
    </article>
  );
}
