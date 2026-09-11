import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { apiGet } from "@/lib/api-client";
import { ContentForm } from "@/features/admin/content/content-form";
import { PRODUCT_EDITOR_SCHEMA } from "@/features/admin/catalog/products/product-editor-schema";
import { ProductMediaManager } from "@/features/admin/catalog/products/product-media-manager";
import type { ProductMediaItem } from "@/features/admin/catalog/products/media-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit product · SAM Group Admin" };
export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell title="Edit product" user={access.state === "forbidden" ? access.user : null}>
        <p>Product editing is unavailable for this session.</p>
      </AdminShell>
    );
  const { id } = await params;
  const token = await getAdminAccessToken();
  if (!token) redirect(SESSION_END_PATH);
  const result = await apiGet<{
    revision: string;
    slug: string;
    category: string;
    fields: Record<string, unknown>;
  }>(`/admin/products/${encodeURIComponent(id)}`, {}, { accessToken: token });
  const images = await apiGet<ProductMediaItem[]>(
    `/admin/products/${encodeURIComponent(id)}/images`,
    {},
    { accessToken: token },
  );
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  return (
    <AdminShell title="Edit product" user={access.user} current="products">
      <Link href="/admin/catalog/products">All products</Link>
      {result.ok && typeof result.data.revision === "string" && result.data.fields ? (
        <>
          <p className="ad-note">
            {result.data.category} · English content. Drafts stay private until published. Product
            URLs and technical approvals are unchanged by this editor.
          </p>
          <Link href={`/en/products/${result.data.slug}`}>View published product</Link>
          <ProductMediaManager productId={id} initial={images.ok ? images.data : []} />
          <ContentForm
            pageKey={id}
            resource="product"
            revision={result.data.revision}
            operationId={randomUUID()}
            schema={PRODUCT_EDITOR_SCHEMA}
            initial={result.data.fields}
          />
        </>
      ) : (
        <p className="ad-notice">The product could not be loaded. Please try again.</p>
      )}
    </AdminShell>
  );
}
