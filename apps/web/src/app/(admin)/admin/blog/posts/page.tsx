import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Articles · SAM Group Admin" };
type Article = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  category: { name: string };
  editorialDraft: { revision: number; updatedAt: string } | null;
};
type Reference = { id: string; name: string };

export default async function BlogPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; categoryId?: string; status?: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell title="Articles" user={access.state === "forbidden" ? access.user : null}>
        <p>Article editing is unavailable for this session.</p>
      </AdminShell>
    );
  const query = await searchParams;
  const page = Number(query.page ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return (
      <AdminShell title="Articles" user={access.user}>
        <p>Invalid page.</p>
      </AdminShell>
    );
  const token = await getAdminAccessToken();
  if (!token) redirect(SESSION_END_PATH);
  const filters = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status === "draft" || query.status === "published" ? { status: query.status } : {}),
  };
  const [result, categories] = await Promise.all([
    apiGet<Article[]>(
      "/admin/blog/posts",
      { ...filters, page: String(page) },
      { accessToken: token },
    ),
    apiGet<Reference[]>("/admin/blog/categories", {}, { accessToken: token }),
  ]);
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const href = (next: number): string =>
    `/admin/blog/posts?${new URLSearchParams({ ...filters, page: String(next) })}`;
  return (
    <AdminShell title="Articles" user={access.user} current="blog">
      <p className="ad-note">Write privately and publish only when the article is ready.</p>
      <p>
        <Link href="/admin/blog/posts/new">Create article</Link>
      </p>
      <form method="get" className="ad-user-form" aria-label="Find articles">
        <label>
          Search articles
          <input type="search" name="q" defaultValue={query.q} maxLength={100} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={query.status ?? ""}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          Category
          <select name="categoryId" defaultValue={query.categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.ok &&
              categories.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit">Search</button>
        <Link href="/admin/blog/posts">Reset</Link>
      </form>
      {result.ok ? (
        <>
          <p>{result.meta.total ?? result.data.length} articles</p>
          <div className="ad-table-scroll" role="region" aria-label="Articles" tabIndex={0}>
            <table className="ad-table">
              <caption>Articles · page {page}</caption>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((article) => (
                  <tr key={article.id}>
                    <td>{article.title}</td>
                    <td>{article.category.name}</td>
                    <td>{article.publishedAt ? "Published" : "Draft"}</td>
                    <td>
                      <Link href={`/admin/blog/posts/${article.id}`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.data.length === 0 && <p>No articles match these filters.</p>}
          <nav className="ad-pager" aria-label="Article pages">
            {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
            {typeof result.meta.total === "number" && page * 20 < result.meta.total && (
              <Link href={href(page + 1)}>Next</Link>
            )}
          </nav>
        </>
      ) : (
        <p className="ad-notice">Articles could not be loaded. Please try again.</p>
      )}
    </AdminShell>
  );
}
