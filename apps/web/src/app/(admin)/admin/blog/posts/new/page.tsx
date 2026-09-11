import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { NewBlogForm } from "@/features/admin/blog/new-blog-form";
import { BlogReferenceForm } from "@/features/admin/blog/blog-reference-form";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
type Reference = { id: string; name: string };
export default async function NewBlogPostPage(): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell title="New article" user={access.state === "forbidden" ? access.user : null}>
        <p>Article editing is unavailable for this session.</p>
      </AdminShell>
    );
  const token = await getAdminAccessToken();
  if (!token) redirect(SESSION_END_PATH);
  const [categories, tags] = await Promise.all([
    apiGet<Reference[]>("/admin/blog/categories", {}, { accessToken: token }),
    apiGet<Reference[]>("/admin/blog/tags", {}, { accessToken: token }),
  ]);
  return (
    <AdminShell title="New article" user={access.user} current="blog">
      <Link href="/admin/blog/posts">All articles</Link>
      <p className="ad-note">
        This creates a private draft. It will not appear on the website until you publish it.
      </p>
      {categories.ok && tags.ok ? (
        <>
          {categories.data.length === 0 && (
            <>
              <p>Create the first category before writing an article.</p>
              <BlogReferenceForm kind="categories" />
            </>
          )}
          <BlogReferenceForm kind="tags" />
          {categories.data.length > 0 && (
            <NewBlogForm categories={categories.data} tags={tags.data} />
          )}
        </>
      ) : (
        <p className="ad-notice">Categories or tags could not be loaded.</p>
      )}
    </AdminShell>
  );
}
