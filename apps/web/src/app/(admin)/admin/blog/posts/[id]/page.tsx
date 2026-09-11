import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { blogEditorSchema } from "@/features/admin/blog/blog-editor-schema";
import { BlogMediaManager } from "@/features/admin/blog/blog-media-manager";
import type { BlogMediaItem } from "@/features/admin/blog/media-actions";
import { ContentForm } from "@/features/admin/content/content-form";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
type Reference = { id: string; name: string };
export default async function BlogPostEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell title="Edit article" user={access.state === "forbidden" ? access.user : null}>
        <p>Article editing is unavailable for this session.</p>
      </AdminShell>
    );
  const { id } = await params;
  const token = await getAdminAccessToken();
  if (!token) redirect(SESSION_END_PATH);
  const [post, categories, tags, images] = await Promise.all([
    apiGet<{ revision: string; publishedAt: string | null; fields: Record<string, unknown> }>(
      `/admin/blog/posts/${encodeURIComponent(id)}`,
      {},
      { accessToken: token },
    ),
    apiGet<Reference[]>("/admin/blog/categories", {}, { accessToken: token }),
    apiGet<Reference[]>("/admin/blog/tags", {}, { accessToken: token }),
    apiGet<BlogMediaItem[]>(
      `/admin/blog/posts/${encodeURIComponent(id)}/images`,
      {},
      { accessToken: token },
    ),
  ]);
  return (
    <AdminShell title="Edit article" user={access.user} current="blog">
      <Link href="/admin/blog/posts">All articles</Link>
      {post.ok && categories.ok && tags.ok ? (
        <>
          <p className="ad-note">
            {post.data.publishedAt
              ? "This article is published. Your edits stay private until you publish again."
              : "This is a private draft."}
          </p>
          <BlogMediaManager postId={id} initial={images.ok ? images.data : []} />
          <ContentForm
            pageKey={id}
            resource="blog"
            revision={post.data.revision}
            operationId={randomUUID()}
            schema={blogEditorSchema(categories.data, tags.data)}
            initial={post.data.fields}
          />
        </>
      ) : (
        <p className="ad-notice">The article could not be loaded.</p>
      )}
    </AdminShell>
  );
}
