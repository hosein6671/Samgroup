import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products · SAM Group Admin" };
type Product = { id: string; name: string; slug: string; category: { name: string } };
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; categoryId?: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell title="Products" user={access.state === "forbidden" ? access.user : null}>
        <p>Product editing is unavailable for this session.</p>
      </AdminShell>
    );
  const query = await searchParams;
  const page = Number(query.page ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return (
      <AdminShell title="Products" user={access.user}>
        <p>Invalid page.</p>
        <Link href="/admin/catalog/products">Return to products</Link>
      </AdminShell>
    );
  const token = await getAdminAccessToken();
  if (!token) redirect(SESSION_END_PATH);
  const filters = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  };
  const [result, categories] = await Promise.all([
    apiGet<Product[]>(
      "/admin/products",
      { ...filters, page: String(page) },
      { accessToken: token },
    ),
    apiGet<{ id: string; name: string }[]>("/categories", { locale: "en" }),
  ]);
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const href = (next: number): string =>
    `/admin/catalog/products?${new URLSearchParams({ ...filters, page: String(next) })}`;
  return (
    <AdminShell title="Products" user={access.user} current="products">
      <p className="ad-note">
        Manage product descriptions and search appearance. Save privately, then publish when ready.
      </p>
      <form method="get" className="ad-user-form" aria-label="Find products">
        <label>
          Search products
          <input type="search" name="q" defaultValue={query.q} maxLength={100} />
        </label>
        <label>
          Category
          <select name="categoryId" defaultValue={query.categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.ok &&
              Array.isArray(categories.data) &&
              categories.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit">Search</button>
        <Link href="/admin/catalog/products">Reset</Link>
      </form>
      {result.ok && Array.isArray(result.data) ? (
        <>
          <p>{result.meta.total ?? result.data.length} products</p>
          <div className="ad-table-scroll" role="region" aria-label="Products" tabIndex={0}>
            <table className="ad-table">
              <caption>Catalogue · page {page}</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category.name}</td>
                    <td>
                      <Link href={`/admin/catalog/products/${product.id}`}>
                        Edit {product.name}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.data.length === 0 && <p>No products match these filters.</p>}
          <nav className="ad-pager" aria-label="Product pages">
            {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
            {typeof result.meta.total === "number" && page * 20 < result.meta.total && (
              <Link href={href(page + 1)}>Next</Link>
            )}
          </nav>
        </>
      ) : (
        <p className="ad-notice">
          Products could not be loaded. Please check the filters or try again.
        </p>
      )}
    </AdminShell>
  );
}
