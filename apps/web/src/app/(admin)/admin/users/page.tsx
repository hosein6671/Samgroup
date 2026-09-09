import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";
import { CreateUserForm } from "@/features/admin/users/create-user-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · SAM Group Admin" };

type UserRow = { id: string; email: string; role: string; status: string };
function isUser(value: unknown): value is UserRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return ["id", "email", "role", "status"].every((key) => typeof row[key] === "string");
}

export default async function UsersPage(): Promise<ReactNode> {
  const access = await requireAdminAccess();
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="users"
        title="Users"
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
  const result = await apiGet<unknown>("/admin/users", undefined, { accessToken });
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const rows =
    result.ok && Array.isArray(result.data) && result.data.every(isUser) ? result.data : null;
  return (
    <AdminShell current="users" title="Users" user={access.user}>
      <p className="ad-note">Platform accounts · current roles and account status</p>
      <CreateUserForm />
      {rows === null ? (
        <section className="ad-notice">
          <h2>
            {!result.ok && result.reason === "http" && result.status === 403
              ? "Access denied"
              : "User list unavailable"}
          </h2>
          <p>No accounts have been changed.</p>
          <Link href="/admin/users">Try again</Link>
        </section>
      ) : (
        <>
          <p>{rows.length} accounts</p>
          <div className="ad-table-scroll" role="region" aria-label="Platform users" tabIndex={0}>
            <table className="ad-table">
              <caption>Current platform accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/users/${encodeURIComponent(row.id)}`}>{row.email}</Link>
                    </td>
                    <td>{row.role}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="ad-notice">No accounts returned.</p>}
        </>
      )}
      <p className="ad-note">
        Open an account to manage its role and status. Account changes record activity events.
      </p>
    </AdminShell>
  );
}
