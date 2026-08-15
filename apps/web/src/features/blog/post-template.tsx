import type { ReactNode } from "react";

import "../home/flagship.css";
import "./insights.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

import { insightsHref } from "./insights-query";
import { PublishedDate } from "./published-date";

import type { BlogPostDetailResponse } from "@sam-group/types";

/**
 * The article template — one component, every post.
 *
 * ── Everything here is API-backed ───────────────────────────────────────────
 *
 * Title, body, category, tags and publication date all come from `GET /blog/posts/:slug`. There is
 * no fixture behind this page and no editorial registry: unlike a Product Family, a post's content
 * lives only in `sam_platform`, which is why the route treats a failed lookup as a server condition
 * rather than rendering something in its place.
 *
 * **Nothing is invented for an absent field.** SITE_STRUCTURE §8's article template describes a
 * byline, a featured image, a table of contents, a key-takeaways box, a related-products block and a
 * related-articles strip. None of them is rendered here, and each is absent for a stated reason
 * rather than for lack of time:
 *
 *   - **byline** — `authorId` is null on every row, and a byline is a claim about a person.
 *   - **featured image** — `BlogPost` has no media relation. There is nothing to show.
 *   - **table of contents** — the body is plain `text` with no heading structure to extract.
 *   - **key takeaways** — no column, and summarising an article on its behalf would be authoring.
 *   - **related products / related articles** — both are a ranking, and no ranking is specified;
 *     inventing one would publish an editorial judgement the platform did not make.
 *
 * The body renders as paragraphs split on blank lines, and that is the whole of the formatting.
 * `BlogPost.content` is plain text — there is no rich-text or Markdown column, and interpreting it
 * as either would render markup the editor never asked for.
 *
 * ── The breadcrumb is logical, not a URL hierarchy ──────────────────────────
 *
 * Insights → post. The category is NOT a crumb: `/{locale}/insights/{slug}` is flat, a category has
 * no page of its own, and a crumb linking to a filtered list would imply an ancestry the URL does
 * not have. The category is shown in the header line instead, where it belongs — as a label.
 *
 * Entirely server-rendered. No state, no JavaScript.
 */
export function PostTemplate({
  post,
  locale,
  localeFallback,
}: {
  readonly post: BlogPostDetailResponse;
  /** The active locale segment, used to compose the breadcrumb's links and to format the date. */
  readonly locale: string;
  /** The API's `meta.localeFallback`, surfaced as a notice. */
  readonly localeFallback: boolean;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <article>
          <header className="in-post-head" data-surface="midnight">
            <div className="fs-blueprint" aria-hidden="true" />

            <div className="fs-wrap in-post-head-inner">
              <nav className="in-crumbs" aria-label="Breadcrumb">
                <ol>
                  <li>
                    <a href={`/${locale}${ROUTES.insights}`}>Insights</a>
                  </li>
                  {/* The current page: marked as such rather than linked to itself. */}
                  <li aria-current="page">{post.title}</li>
                </ol>
              </nav>

              <p className="in-post-meta">
                {/*
                 * The category links to the index filtered by it — the one place `?category=` is
                 * produced by the platform rather than typed by a visitor. It is a label with a
                 * destination, not a crumb; see the module note.
                 */}
                <a
                  className="in-post-category"
                  href={insightsHref(locale, { category: post.category.slug, page: 1 })}
                >
                  {post.category.name}
                </a>
                <PublishedDate iso={post.publishedAt} locale={locale} className="in-post-date" />
              </p>

              <h1 className="fs-d1 in-post-title">{post.title}</h1>

              {localeFallback && (
                <p className="in-fallback-note in-fallback-note--dark">
                  This article is shown in the site&rsquo;s default language because it has not been
                  translated yet.
                </p>
              )}
            </div>
          </header>

          <section className="fs-sec in-post-body" data-surface="light">
            <div className="fs-wrap in-post-body-inner">
              {/*
               * Split on blank lines and rendered as paragraphs. React escapes every value, so the
               * body reaches the page as text and can carry no markup — which is the correct
               * treatment of a plain `text` column whose contents nothing has sanitised.
               *
               * The index is a safe key here and only here: this list is derived from one immutable
               * string and is never reordered, inserted into or filtered.
               */}
              {post.content
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter((paragraph) => paragraph !== "")
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}

              {/*
               * Rendered only when the post actually carries tags — no row exists in `blog_tags`
               * today, so this is unreachable. It is here because the field is on the wire and
               * omitting it would mean the page silently drops real data the day tags land.
               *
               * The tags are labels and not links: no tag-filtered route exists, and a link to a
               * page that does not resolve is worse than a label that does not link.
               */}
              {post.tags.length > 0 && (
                <ul className="in-post-tags" aria-label="Tags">
                  {post.tags.map((tag) => (
                    <li key={tag.slug}>{tag.name}</li>
                  ))}
                </ul>
              )}

              <p className="in-post-back">
                <a href={`/${locale}${ROUTES.insights}`}>All posts</a>
              </p>
            </div>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
