import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { CategoryImageManager } from "@/features/admin/catalog/categories/category-image-manager";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product Family images · SAM Group Admin" };

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  processImage: { id: string; url: string; altText: string | null } | null;
};
function isCategoryRow(value: unknown): value is CategoryRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.slug === "string" &&
    (row.processImage === null || typeof row.processImage === "object")
  );
}

export default async function CategoryImagesPage(): Promise<ReactNode> {
  const access = await requireAdminAccess("categories");
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="categories"
        title="Product Family images"
        user={access.state === "forbidden" ? access.user : null}
      >
        <p className="ad-notice">
          {access.state === "forbidden"
            ? "Access denied."
            : "Your session could not be checked. Please try again."}
        </p>
      </AdminShell>
    );
  const accessToken = await getAdminAccessToken();
  if (accessToken === null) redirect(SESSION_END_PATH);
  const result = await apiGet<unknown>("/admin/catalog/categories", undefined, { accessToken });
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const rows =
    result.ok && Array.isArray(result.data) && result.data.every(isCategoryRow)
      ? result.data
      : null;

  return (
    <AdminShell current="categories" title="Product Family images" user={access.user}>
      <p className="ad-note">
        The "process" photograph shown on each Product Family page's applications section. A family
        with no image here shows a labelled placeholder on the public site.
      </p>
      {rows === null ? (
        <section className="ad-notice">
          <h2>
            {!result.ok && result.reason === "http" && result.status === 403
              ? "Access denied"
              : "Category list unavailable"}
          </h2>
          <p>No image has been changed.</p>
        </section>
      ) : (
        <div className="ad-category-image-list">
          {rows.map((row) => (
            <section key={row.id} aria-labelledby={`category-${row.id}-heading`}>
              <h2 id={`category-${row.id}-heading`}>{row.name}</h2>
              <p className="ad-note">{row.slug}</p>
              <CategoryImageManager
                categoryId={row.id}
                categoryName={row.name}
                initial={row.processImage}
              />
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
