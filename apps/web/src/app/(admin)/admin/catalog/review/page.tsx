import { redirect } from "next/navigation";

import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import {
  ActiveFilterSummary,
  RejectedParams,
  ReviewEmpty,
  ReviewFailed,
  ReviewForbidden,
  ReviewFrame,
  ReviewInvalidQuery,
  ReviewPagination,
  ReviewQueueTable,
  ReviewFilters,
  ReviewUnavailable,
  StatusLegend,
} from "@/features/admin/catalog/review/queue-views";
import { getReviewQueue } from "@/features/admin/catalog/review/review-api";
import {
  activeFilters,
  lastPage,
  readReviewQueueQuery,
} from "@/features/admin/catalog/review/review-query";
import { DESCRIBE_FILTER } from "@/features/admin/catalog/review/review-vocabulary";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { SearchParams } from "@/features/admin/catalog/review/review-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/catalog/review` — the technical-review queue.
 *
 * ## Read-only
 *
 * This route reads one endpoint and renders it. It imports no Server Action, calls no `apiPost`,
 * and has no control that could change a review status. Nothing on the page can approve, reject or
 * return a subject, and no disabled control implies otherwise. `phase-boundary.spec.ts` fails if
 * any of that stops being true.
 *
 * ## Dynamic and never cached, in three independent layers
 *
 * `force-dynamic` and `revalidate = 0` here; `cache: "no-store"` on the fetch in `api-client.ts`;
 * `Cache-Control: no-store` from the API on every review route. Any one of them would be enough on
 * a good day; all three are stated because this page renders unapproved technical data belonging to
 * an authenticated identity, and "cached by accident" has no acceptable version.
 *
 * `force-dynamic` also settles the build: `next build` resolves no `/admin/*` route, so no
 * protected endpoint is called without a session. The page has no `generateStaticParams` and
 * cannot acquire one — there is no dynamic segment.
 *
 * ## The order of the checks
 *
 * Access first, then the query, then the request. `requireAdminAccess` redirects an anonymous
 * reader to `/login` and an expired one to `/admin/session/end` (which clears the cookies and sends
 * them on), so a refused reader never reaches the point where a queue request would be built. A
 * `forbidden` reader gets the frame and a refusal **inside** it, never an empty table — an empty
 * table says "no work", which is a different and wrong answer.
 *
 * ## `no-store` and the shell
 *
 * `metadata` here inherits `robots: noindex, nofollow, nocache, noarchive` from the `(admin)` root
 * layout. Nothing on this route is indexable and nothing about it is public.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Technical review · SAM Group Admin" };

export default async function CatalogReviewQueuePage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("review");

  if (access.state === "unavailable") {
    // The session could not be confirmed because the platform did not answer. Not a sign-out.
    return (
      <ReviewFrame user={null}>
        <ReviewUnavailable />
      </ReviewFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <ReviewFrame user={access.user}>
        <ReviewForbidden />
      </ReviewFrame>
    );
  }

  const { query, rejected } = readReviewQueueQuery(await searchParams);
  const result = await getReviewQueue(query);

  if (result.state === "unauthenticated") {
    // The cookie went away between the session check and this request. Hand it to the one route
    // that can clear cookies and redirect, rather than rendering a half-authenticated page.
    redirect(SESSION_END_PATH);
  }

  const filters = activeFilters(query, DESCRIBE_FILTER);

  return (
    <ReviewFrame user={access.user}>
      <RejectedParams rejected={rejected} />

      {result.state === "forbidden" ? <ReviewForbidden /> : null}
      {result.state === "unavailable" ? <ReviewUnavailable /> : null}
      {result.state === "failed" ? <ReviewFailed /> : null}
      {result.state === "invalid-query" ? <ReviewInvalidQuery field={result.field} /> : null}

      {result.state === "ok" ? (
        <>
          <StatusLegend total={result.value.total} />
          <ReviewFilters query={query} />
          <ActiveFilterSummary query={query} filters={filters} total={result.value.total} />

          {result.value.items.length === 0 ? (
            <ReviewEmpty query={query} filters={filters} />
          ) : (
            <ReviewQueueTable
              items={result.value.items}
              total={result.value.total}
              page={result.value.page}
              pages={lastPage(result.value.total, result.value.limit)}
              query={query}
            />
          )}

          <ReviewPagination
            query={query}
            page={result.value.page}
            pages={lastPage(result.value.total, result.value.limit)}
            total={result.value.total}
          />
        </>
      ) : null}
    </ReviewFrame>
  );
}
