import type { ReactNode } from "react";

import { localePath } from "@/features/seo/alternates";
import { ROUTES } from "@/features/site/site-routes";

import type { TocEntry } from "./render-markdown";
import type { BlogPostListItemResponse } from "@sam-group/types";

/** One post's site-relative path — the same shape `articlePath` in the route builds. */
function articleHref(locale: string, slug: string): string {
  return `${localePath(locale, ROUTES.insights)}/${slug}`;
}

/**
 * The article page's sidebar — a table of contents, a short list of other posts to read next, and
 * a standing contact prompt.
 *
 * The first two are optional and independently absent-safe: a post with no H2/H3 headings renders
 * no "On this page" block rather than an empty one, and an Insights section with only this one
 * post yet renders no "Recent articles" block — an empty list is not a feature. **The contact
 * prompt is the one part that always renders.** It names no product and no specific request —
 * "Talk to our team" plus the real Contact Us route — so it is never wrong to show, on a post
 * about anything, and it is what keeps the sidebar from disappearing entirely on an article with
 * neither a heading nor a sibling to recommend.
 *
 * The recent-posts list is fetched by the route (`getBlogPosts`, the same call the Insights index
 * already makes) and filtered to exclude the post being read; nothing here calls the API itself.
 */
export function ArticleSidebar({
  toc,
  recentPosts,
  locale,
}: {
  readonly toc: readonly TocEntry[];
  readonly recentPosts: readonly BlogPostListItemResponse[];
  readonly locale: string;
}): ReactNode {
  return (
    <aside className="in-post-sidebar" aria-label="Article navigation">
      {toc.length > 0 && (
        <nav className="in-post-toc" aria-label="On this page">
          <h2 className="in-post-toc-title">On this page</h2>
          <ol>
            {toc.map((entry) => (
              <li key={entry.id} data-depth={entry.depth}>
                <a href={`#${entry.id}`}>{entry.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {recentPosts.length > 0 && (
        <div className="in-post-recent">
          <h2 className="in-post-recent-title">Recent articles</h2>
          <ul>
            {recentPosts.map((recent) => (
              <li key={recent.id}>
                <a href={articleHref(locale, recent.slug)}>{recent.title}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="in-post-contact">
        <h2 className="in-post-contact-title">Have a question?</h2>
        <p className="in-post-contact-body">
          Talk to our team about product selection, specifications or a quote.
        </p>
        <a className="fs-btn fs-btn--outline" href={localePath(locale, ROUTES.contactUs)}>
          Talk to our team
        </a>
      </div>
    </aside>
  );
}
