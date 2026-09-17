import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { CreateSegmentForm } from "@/features/admin/catalog/segments/create-segment-form";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Segments · SAM Group Admin" };

type SegmentRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
};
function isSegment(value: unknown): value is SegmentRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.slug === "string" &&
    typeof row.sortOrder === "number" &&
    typeof row.productCount === "number"
  );
}

export default async function SegmentsPage(): Promise<ReactNode> {
  const access = await requireAdminAccess("segments");
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="segments"
        title="Segments"
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
  const result = await apiGet<unknown>("/admin/catalog/segments", undefined, { accessToken });
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const rows =
    result.ok && Array.isArray(result.data) && result.data.every(isSegment) ? result.data : null;
  return (
    <AdminShell current="segments" title="Segments" user={access.user}>
      <p className="ad-note">
        The buyer-segment filter shown on the public Product Finder · sorted by display order
      </p>
      <CreateSegmentForm />
      {rows === null ? (
        <section className="ad-notice">
          <h2>
            {!result.ok && result.reason === "http" && result.status === 403
              ? "Access denied"
              : "Segment list unavailable"}
          </h2>
          <p>No Segment has been changed.</p>
          <Link className="ad-link" href="/admin/catalog/segments">
            Try again
          </Link>
        </section>
      ) : (
        <>
          <p className="ad-note">{rows.length} Segments</p>
          <div className="ad-table-scroll" role="region" aria-label="Segments" tabIndex={0}>
            <table className="ad-table">
              <caption className="ad-sr-only">Current Segments. {rows.length} shown.</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Products</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="ad-cell-name">
                      {row.name}
                    </th>
                    <td>{row.slug}</td>
                    <td>{row.productCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="ad-notice">No Segments exist yet.</p>}
        </>
      )}
      <p className="ad-note">
        A Segment with zero products still appears as a public filter option; it simply matches
        nothing until a product is assigned to it.
      </p>
    </AdminShell>
  );
}
