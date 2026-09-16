import type { ReactNode } from "react";

import "../home/flagship.css";
import "./insights.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";
import { ROUTES } from "@/features/site/site-routes";

import { ArticleSidebar } from "./article-sidebar";
import { insightsHref } from "./insights-query";
import { PublishedDate } from "./published-date";
import { renderMarkdown } from "./render-markdown";

import type { BlogPostDetailResponse, BlogPostListItemResponse } from "@sam-group/types";

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
 * byline, a table of contents, a key-takeaways box, a related-products block and a
 * related-articles strip. Two are rendered now, and the rest stay absent for a stated reason:
 *
 *   - **byline** — `authorId` is null on every row, and a byline is a claim about a person.
 *   - **table of contents** — now rendered, from the same heading pass that renders the body
 *     (`renderMarkdown`), so a TOC link and its target can never name different headings.
 *   - **key takeaways** — no column, and summarising an article on its behalf would be authoring.
 *   - **related articles** — rendered as "Recent articles" in the sidebar, deliberately NOT a
 *     ranking: it is the same ordered list `GET /blog/posts` already serves the index, so there
 *     is no separate editorial judgement being invented here.
 *   - **related products** — still absent; no product/article association exists to read.
 *
 * The body is Markdown, rendered and sanitized by `renderMarkdown` (`features/blog/render-markdown`)
 * — never `dangerouslySetInnerHTML` on the raw column. `BlogPost.content` is plain `text` in
 * `sam_platform`; the Markdown convention lives entirely in this render path, not in the schema.
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
  locales,
  localeFallback,
  recentPosts,
}: {
  readonly post: BlogPostDetailResponse;
  /** The active locale segment, used to compose the breadcrumb's links and to format the date. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /** The API's `meta.localeFallback`, surfaced as a notice. */
  readonly localeFallback: boolean;
  /**
   * Other published posts, for the sidebar's "Recent articles" — fetched by the route with the
   * same `getBlogPosts` call the Insights index makes, and already filtered to exclude this post.
   * Empty when this is the only published post, which the sidebar renders as no block at all.
   */
  readonly recentPosts: readonly BlogPostListItemResponse[];
}): ReactNode {
  const { html, toc } = renderMarkdown(post.content);

  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

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
              <div className="in-post-main">
                {post.featuredImage && (
                  <img
                    className="in-post-image"
                    src={post.featuredImage.url}
                    alt={post.featuredImage.altText ?? ""}
                    width={1200}
                    height={675}
                  />
                )}

                {/*
                 * `html` is `renderMarkdown`'s output: Markdown parsed, then passed through
                 * `sanitize-html`'s explicit allow-list. This is the ONE place in the codebase
                 * that renders a `BlogPost.content` value as markup rather than text, and it does
                 * so only after that sanitization boundary — never on the raw column.
                 */}
                <div className="in-post-content" dangerouslySetInnerHTML={{ __html: html }} />

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

              <ArticleSidebar toc={toc} recentPosts={recentPosts} locale={locale} />
            </div>
          </section>
        </article>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
