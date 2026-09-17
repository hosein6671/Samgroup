import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { RedirectsTable, type RedirectRow } from "@/features/admin/redirects/redirects-table";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redirects · SAM Group Admin" };

function isRedirectRow(value: unknown): value is RedirectRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.fromPath === "string" &&
    typeof row.toPath === "string" &&
    typeof row.statusCode === "number" &&
    (row.locale === null || typeof row.locale === "string") &&
    typeof row.isActive === "boolean"
  );
}

export default async function RedirectsPage(): Promise<ReactNode> {
  const access = await requireAdminAccess("redirects");
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="redirects"
        title="Redirects"
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
  const result = await apiGet<unknown>("/admin/redirects", undefined, { accessToken });
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const rows =
    result.ok && Array.isArray(result.data) && result.data.every(isRedirectRow)
      ? result.data
      : null;
  return (
    <AdminShell current="redirects" title="Redirects" user={access.user}>
      <p className="ad-note">
        Legacy URLs that now point elsewhere. Checked against the incoming path before a page
        renders — a disabled rule is kept but has no effect.
      </p>
      {rows === null && (
        <section className="ad-notice">
          <h2>
            {!result.ok && result.reason === "http" && result.status === 403
              ? "Access denied"
              : "Redirect list unavailable"}
          </h2>
          <p>The existing list could not be loaded. A new redirect can still be created below.</p>
          <Link className="ad-link" href="/admin/redirects">
            Try again
          </Link>
        </section>
      )}
      <RedirectsTable initial={rows ?? []} />
    </AdminShell>
  );
}
