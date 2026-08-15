import type { ReactNode } from "react";

import { InsightCard } from "../insight-card";
import { insightsHref, FIRST_PAGE } from "../insights-query";

import type { InsightsQuery } from "../insights-query";
import type { BlogPostListResult } from "@/lib/blog";

/**
 * The Insights index's post list — the only thing on this page that depends on the blog service.
 *
 * ── Six states, and they are six because they mean six different things ─────
 *
 * loading · posts · nothing published · nothing in this category · that category is not recognised ·
 * the list is unavailable. Collapsing any pair of them would misreport the platform to a visitor:
 * "no posts published" is a fact about the blog and "the service did not answer" is a fact about the
 * infrastructure, and the principle ADR-010 §7 fixes for the catalog — infrastructure failure is
 * never presented as absence — applies here unchanged. The unfiltered empty state is kept apart from
 * the filtered one for the same reason at a smaller scale.
 *
 * **No branch invents a post.** There is no fallback fixture, no sample article and no placeholder
 * card anywhere below. An index that showed plausible articles while the API was down would be
 * publishing editorial content that does not exist.
 *
 * ── The count is the API's, not this component's ────────────────────────────
 *
 * `meta.total` is the size of the real filtered set. `posts.length` is how much of it this page
 * holds — the difference is exactly what the pager below exists for.
 *
 * A Server Component. The only reason it is `async` is that it awaits a promise the ROUTE created;
 * it issues no request of its own, which keeps data access at the route (FRONTEND_ARCHITECTURE §7)
 * while still letting the page stream around it.
 */

/**
 * Server-side only, and never rendered — the same arrangement the catalog list uses.
 *
 * An index that silently showed nothing when the API refused the request would hide exactly the
 * drift this integration exists to surface. Nothing from the API's own `message` is echoed; the line
 * names a cause instead.
 */
function report(query: InsightsQuery, result: BlogPostListResult): void {
  if (result.ok) return;

  const detail =
    result.reason === "unreachable"
      ? "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
      : result.reason === "unknown-filter"
        ? `the API rejected the '${result.field}' filter as an unknown slug`
        : `the API answered, but not with a post list (HTTP ${String(result.status)})`;

  console.warn(
    `[insights:category=${query.category ?? "-"},page=${String(query.page)}] ` +
      `post list unavailable — ${detail}`,
  );
}

/**
 * What is said when a state is not a list — one construction, several messages, so they read as the
 * same kind of statement about the index rather than as several different page states.
 */
function ListNotice({
  heading,
  body,
  reset,
  resetLabel,
}: {
  readonly heading: string;
  readonly body: string;
  /** Where the visitor can get back to a working view, when there is such a place. */
  readonly reset?: string;
  readonly resetLabel?: string;
}): ReactNode {
  return (
    <div className="in-notice reveal-fade-rise">
      <p className="in-notice-heading">{heading}</p>
      <p className="in-notice-body">{body}</p>
      {reset !== undefined && resetLabel !== undefined && (
        <a className="in-notice-reset" href={reset}>
          {resetLabel}
        </a>
      )}
    </div>
  );
}

/**
 * Previous / next, and nothing more.
 *
 * No numbered page list: the number of pages is `ceil(total / limit)`, and rendering every one of
 * them turns a long archive into a wall of links. Neither control is drawn when there is nowhere to
 * go, so a single-page index shows no pager at all rather than two disabled buttons.
 *
 * The current position is stated as a sentence rather than only as a highlighted number, because it
 * is the part a screen reader needs and the part that survives with no styling.
 */
function Pager({
  locale,
  query,
  total,
  limit,
}: {
  readonly locale: string;
  readonly query: InsightsQuery;
  readonly total: number;
  readonly limit: number;
}): ReactNode {
  // `limit` comes from the response and is defended anyway: a zero would divide to Infinity.
  const pages = limit > 0 ? Math.ceil(total / limit) : FIRST_PAGE;

  if (pages <= FIRST_PAGE) return null;

  const hasPrevious = query.page > FIRST_PAGE;
  const hasNext = query.page < pages;

  return (
    <nav className="in-pager" aria-label="Pagination">
      {hasPrevious && (
        <a
          className="in-pager-link"
          href={insightsHref(locale, { ...query, page: query.page - 1 })}
        >
          Newer posts
        </a>
      )}

      <p className="in-pager-position">
        Page {String(query.page)} of {String(pages)}
      </p>

      {hasNext && (
        <a
          className="in-pager-link"
          href={insightsHref(locale, { ...query, page: query.page + 1 })}
        >
          Older posts
        </a>
      )}
    </nav>
  );
}

type InsightsListProps = {
  readonly posts: Promise<BlogPostListResult>;
  /** The active locale segment — half of every link this section emits. */
  readonly locale: string;
  /** The normalized view state, exactly as the route read it off the URL. */
  readonly query: InsightsQuery;
};

export async function InsightsList({
  posts,
  locale,
  query,
}: InsightsListProps): Promise<ReactNode> {
  const result = await posts;

  report(query, result);

  const unfilteredHref = insightsHref(locale, { category: null, page: FIRST_PAGE });
  const listed = result.ok ? result.posts.length : 0;
  const filtered = query.category !== null;

  return (
    <section className="fs-sec in-list" data-surface="light">
      <div className="fs-wrap">
        {result.ok && listed > 0 && (
          <>
            <p className="in-count">
              <span>{String(result.total).padStart(2, "0")}</span>
              {result.total === 1 ? "post" : "posts"}
              {result.total > listed && <small>showing {listed} on this page</small>}
            </p>

            {/*
             * The API's own `meta.localeFallback`, surfaced rather than hidden. It states a fact
             * about this response — part of it was served in the default locale because the
             * requested one has no translation — and an index that quietly showed English under
             * `/fa` without saying so would be misrepresenting the content. Never shown in the
             * default locale, where there is nothing to fall back from.
             */}
            {result.localeFallback && (
              <p className="in-fallback-note">
                Some entries are shown in the site&rsquo;s default language because they have not
                been translated yet.
              </p>
            )}

            <div className="in-grid reveal-stagger">
              {result.posts.map((post) => (
                <InsightCard key={post.id} post={post} locale={locale} />
              ))}
            </div>

            <Pager locale={locale} query={query} total={result.total} limit={result.limit} />
          </>
        )}

        {/*
         * An empty page beyond the end of a non-empty list. Separated from a genuinely empty index
         * because the remedy is different and there IS one: go back to the first page.
         */}
        {result.ok && listed === 0 && query.page > FIRST_PAGE && (
          <ListNotice
            heading="No posts on this page"
            body="This page is past the end of the list."
            reset={insightsHref(locale, { ...query, page: FIRST_PAGE })}
            resetLabel="Back to the first page"
          />
        )}

        {result.ok && listed === 0 && query.page === FIRST_PAGE && filtered && (
          <ListNotice
            heading="No posts in this category"
            body="The blog holds no published post in the requested category."
            reset={unfilteredHref}
            resetLabel="Show all posts"
          />
        )}

        {result.ok && listed === 0 && query.page === FIRST_PAGE && !filtered && (
          <ListNotice
            heading="No posts published yet"
            body="Nothing has been published here yet. This page will list articles as they are published."
          />
        )}

        {/*
         * The visitor-caused failure, and the only one with a remedy.
         */}
        {!result.ok && result.reason === "unknown-filter" && result.field === "category" && (
          <ListNotice
            heading="That category is not recognised"
            body="The requested category does not match a published category, so no posts were returned."
            reset={unfilteredHref}
            resetLabel="Show all posts"
          />
        )}

        {/*
         * Everything else — service down, refused, timed out, 5xx, a malformed payload, or a
         * `VALIDATION_ERROR` naming a field this page does not send. No reset is offered, because
         * nothing the visitor can do would change the outcome. **It does not say the blog is
         * empty**, because that is not what is known.
         */}
        {!result.ok && (result.reason !== "unknown-filter" || result.field !== "category") && (
          <ListNotice
            heading="Posts unavailable"
            body="The service that holds these articles did not answer this request. This is a temporary service condition, not a statement that nothing has been published — please try again shortly."
          />
        )}
      </div>
    </section>
  );
}

/**
 * What stands in while the list is in flight.
 *
 * The route hands this section a promise it does not await, so React streams the hero first and this
 * block occupies the list's place until the blog answers. That matters more than it looks:
 * `api-client` allows a request ten seconds before it times out, and without a boundary here a hung
 * service would hold back the whole page.
 *
 * Deliberately **no titles, no dates, no count and no fabricated rows**: a skeleton that guessed at
 * content would be inventing editorial data for the duration of a request.
 */
export function InsightsListSkeleton(): ReactNode {
  return (
    <section className="fs-sec in-list" data-surface="light" aria-busy="true">
      <div className="fs-wrap">
        <p className="in-count in-count--pending">Loading posts…</p>

        <div className="in-grid" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div className="in-card in-card--pending" key={index}>
              <span className="in-skeleton in-skeleton--meta" />
              <span className="in-skeleton in-skeleton--title" />
              <span className="in-skeleton in-skeleton--title in-skeleton--short" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
