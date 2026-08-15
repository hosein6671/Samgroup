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
 * `title`, `category.name` and `publishedAt`. Nothing else is on the wire, and nothing else is
 * inferred from what is.
 *
 * There is deliberately **no excerpt, no author, no read-time, no hero image, no tag list and no
 * "featured" marker** anywhere in this component. Not blank — absent. `BlogPost` has no `excerpt`
 * column, so a summary here could only be the body cut at a character count, which publishes a
 * sentence the editor never wrote; `authorId` is null on every row and a byline is a claim about a
 * person; read-time, imagery and featured flags have no column at all. A field that does not exist
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
