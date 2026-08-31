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
import { ProductCopyDetail } from "@/features/admin/catalog/review/product-copy-detail";
import { getProductCopyReview } from "@/features/admin/catalog/review/review-api";
import { readReviewQueueQuery } from "@/features/admin/catalog/review/review-query";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { SearchParams } from "@/features/admin/catalog/review/review-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/catalog/review/product-copy/[id]` — one ProductCopy's full review context (ADR-019).
 *
 * The third sibling, and deliberately its own file rather than a shared `[subject]/[id]`. The API
 * declares three controllers; a generic route would turn the subject type into a caller-supplied
 * path segment that something downstream would have to validate, and would make three screens'
 * futures a single conditional.
 *
 * Everything the other two routes document applies here unchanged: read-only by construction,
 * `force-dynamic` with `revalidate = 0`, no `generateStaticParams`, access checked before the
 * request is built, six distinct result states that are never collapsed, and a Back link rebuilt
 * from the constant queue path after the queue parameters are re-validated.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Product copy review · SAM Group Admin" };

export default async function ProductCopyReviewPage({
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
      <ReviewDetailFrame title="Product copy review" user={null}>
        <DetailUnavailable />
      </ReviewDetailFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <ReviewDetailFrame title="Product copy review" user={access.user}>
        <BackToQueue query={query} />
        <DetailForbidden />
      </ReviewDetailFrame>
    );
  }

  const { id } = await params;
  const result = await getProductCopyReview(id);

  if (result.state === "unauthenticated") {
    redirect(SESSION_END_PATH);
  }

  return (
    <ReviewDetailFrame title="Product copy review" user={access.user}>
      <BackToQueue query={query} />

      {result.state === "ok" ? <ProductCopyDetail subject={result.value} /> : null}
      {result.state === "forbidden" ? <DetailForbidden /> : null}
      {result.state === "not-found" ? <DetailNotFound /> : null}
      {result.state === "invalid-id" ? <DetailInvalidId /> : null}
      {result.state === "unavailable" ? <DetailUnavailable /> : null}
      {result.state === "failed" ? <DetailFailed /> : null}
    </ReviewDetailFrame>
  );
}
