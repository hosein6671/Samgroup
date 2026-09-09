import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { EditUserForm } from "@/features/admin/users/edit-user-form";
import { apiGet } from "@/lib/api-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Manage user · SAM Group Admin" };
export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess();
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="users"
        title="Manage user"
        user={access.state === "forbidden" ? access.user : null}
      >
        <p>Access denied or session unavailable.</p>
      </AdminShell>
    );
  const { id } = await params;
  const accessToken = await getAdminAccessToken();
  if (!accessToken) redirect(SESSION_END_PATH);
  const result = await apiGet<unknown>(`/admin/users/${encodeURIComponent(id)}`, undefined, {
    accessToken,
  });
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const row =
    result.ok && typeof result.data === "object" && result.data !== null
      ? (result.data as Record<string, unknown>)
      : null;
  const user =
    row &&
    typeof row.id === "string" &&
    typeof row.email === "string" &&
    typeof row.role === "string" &&
    typeof row.status === "string" &&
    typeof row.adminRevision === "number"
      ? {
          id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          adminRevision: row.adminRevision,
        }
      : null;
  return (
    <AdminShell current="users" title="Manage user" user={access.user}>
      <Link href="/admin/users">← All users</Link>
      {user ? (
        <section className="ad-notice">
          <h2>{user.email}</h2>
          <EditUserForm key={user.adminRevision} user={user} self={user.id === access.user.id} />
        </section>
      ) : (
        <p className="ad-notice">
          {!result.ok && result.reason === "http" && result.status === 404
            ? "User not found."
            : "Account unavailable or access denied."}
        </p>
      )}
    </AdminShell>
  );
}
