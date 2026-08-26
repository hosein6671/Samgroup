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
import { ProductClaimDetail } from "@/features/admin/catalog/review/product-claim-detail";
import { getProductClaimReview } from "@/features/admin/catalog/review/review-api";
import { readReviewQueueQuery } from "@/features/admin/catalog/review/review-query";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { SearchParams } from "@/features/admin/catalog/review/review-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/catalog/review/product-claims/[id]` — one ProductClaim's full review context.
 *
 * The sibling of the Specification detail route, and deliberately its own file rather than a shared
 * `[subject]/[id]`. The API declares two controllers; a generic route would turn the subject type
 * into a caller-supplied path segment that something downstream would have to validate, and would
 * make the two screens' futures a single conditional.
 *
 * Everything the Specification route documents applies here unchanged: read-only by construction,
 * `force-dynamic` with `revalidate = 0`, no `generateStaticParams`, access checked before the
 * request is built, five distinct failure states that are never collapsed, and a Back link rebuilt
 * from the constant queue path after the queue parameters are re-validated.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Product claim review · SAM Group Admin" };

export default async function ProductClaimReviewPage({
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
      <ReviewDetailFrame title="Product claim review" user={null}>
        <DetailUnavailable />
      </ReviewDetailFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <ReviewDetailFrame title="Product claim review" user={access.user}>
        <BackToQueue query={query} />
        <DetailForbidden />
      </ReviewDetailFrame>
    );
  }

  const { id } = await params;
  const result = await getProductClaimReview(id);

  if (result.state === "unauthenticated") {
    redirect(SESSION_END_PATH);
  }

  return (
    <ReviewDetailFrame title="Product claim review" user={access.user}>
      <BackToQueue query={query} />

      {result.state === "ok" ? <ProductClaimDetail subject={result.value} /> : null}
      {result.state === "forbidden" ? <DetailForbidden /> : null}
      {result.state === "not-found" ? <DetailNotFound /> : null}
      {result.state === "invalid-id" ? <DetailInvalidId /> : null}
      {result.state === "unavailable" ? <DetailUnavailable /> : null}
      {result.state === "failed" ? <DetailFailed /> : null}
    </ReviewDetailFrame>
  );
}
