import { redirect } from "next/navigation";

import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import {
  BackToQueue,
  DetailFailed,
  DetailForbidden,
  DetailInvalidId,
  DetailNotFound,
  DetailUnavailable,
  ReviewDetailFrame,
} from "@/features/admin/catalog/review/detail-shell";
import { getSpecificationReview } from "@/features/admin/catalog/review/review-api";
import { readReviewQueueQuery } from "@/features/admin/catalog/review/review-query";
import { SpecificationDetail } from "@/features/admin/catalog/review/specification-detail";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { SearchParams } from "@/features/admin/catalog/review/review-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/catalog/review/specifications/[id]` — one Specification's full review context.
 *
 * ## Read-only, structurally
 *
 * This route reads one endpoint and renders it. It imports no Server Action, issues no `POST`,
 * names no decision endpoint, and contains no control that could change a review status — not even
 * a disabled one. `phase-boundary.spec.ts` fails the build if that stops being true.
 *
 * ## Dynamic and never cached, in three independent layers
 *
 * `force-dynamic` and `revalidate = 0` here; `cache: "no-store"` on the fetch in `api-client.ts`;
 * `Cache-Control: no-store` from the API on every review route. This page renders unapproved
 * technical data, supplier provenance and an internal import identity belonging to an authenticated
 * operator, and "cached by accident" has no acceptable version.
 *
 * There is no `generateStaticParams` and there will not be one: `next build` must resolve no
 * `/admin/*` route, so no protected endpoint is ever called without a session.
 *
 * ## The order of the checks
 *
 * Access first, then the id, then the request. `requireAdminAccess("review")` redirects an
 * anonymous reader to `/login` and an expired one to `/admin/session/end` — the one route that can
 * clear cookies — so a refused reader never reaches the point where a subject request would be
 * built. `forbidden` and `unavailable` are rendered **inside** the frame rather than redirected: a
 * refusal is not a sign-out, and an outage is not one either.
 *
 * ## Five failure states, and they stay five
 *
 * `not-found`, `invalid-id`, `forbidden`, `unavailable` and `failed` each render their own
 * sentence. Collapsing any pair would be a lie to an operator: "this subject does not exist" and
 * "the platform did not answer" lead to different next actions, and only one of them is a reason to
 * stop looking.
 *
 * ## Queue context
 *
 * The queue's filters and page arrive as search parameters and are re-validated here by
 * `readReviewQueueQuery`, the same parser the queue itself uses. The Back link is then rebuilt from
 * the constant queue path. Nothing in the URL can point that link anywhere else, and there is no
 * `returnTo` parameter to try.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The title names the screen, not the subject — WCAG 2.2 §2.4.2, and the subject is not public. */
export const metadata: Metadata = { title: "Specification review · SAM Group Admin" };

export default async function SpecificationReviewPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("review");
  const { query } = readReviewQueueQuery(await searchParams);

  if (access.state === "unavailable") {
    return (
      <ReviewDetailFrame title="Specification review" user={null}>
        <DetailUnavailable />
      </ReviewDetailFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <ReviewDetailFrame title="Specification review" user={access.user}>
        <BackToQueue query={query} />
        <DetailForbidden />
      </ReviewDetailFrame>
    );
  }

  const { id } = await params;
  const result = await getSpecificationReview(id);

  if (result.state === "unauthenticated") {
    // The cookie went away between the session check and this request. Hand it to the one route
    // that can clear cookies and redirect, rather than rendering a half-authenticated page.
    redirect(SESSION_END_PATH);
  }

  return (
    <ReviewDetailFrame title="Specification review" user={access.user}>
      <BackToQueue query={query} />

      {result.state === "ok" ? <SpecificationDetail subject={result.value} /> : null}
      {result.state === "forbidden" ? <DetailForbidden /> : null}
      {result.state === "not-found" ? <DetailNotFound /> : null}
      {result.state === "invalid-id" ? <DetailInvalidId /> : null}
      {result.state === "unavailable" ? <DetailUnavailable /> : null}
      {result.state === "failed" ? <DetailFailed /> : null}
    </ReviewDetailFrame>
  );
}
