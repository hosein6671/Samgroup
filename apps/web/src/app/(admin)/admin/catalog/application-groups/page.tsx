import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import {
  ApplicationGroupRow,
  CreateApplicationGroupForm,
} from "@/features/admin/catalog/application-groups/group-forms";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";
import { getActiveLocales } from "@/lib/locales";

import type { GroupRowData } from "@/features/admin/catalog/application-groups/group-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application groups · SAM Group Admin" };

type GroupRow = GroupRowData & { readonly categoryId: string };
type Family = { id: string; name: string; slug: string };

function isGroup(value: unknown): value is GroupRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.categoryId === "string" &&
    typeof row.name === "string" &&
    typeof row.slug === "string" &&
    typeof row.sortOrder === "number" &&
    typeof row.productCount === "number" &&
    typeof row.translations === "object" &&
    row.translations !== null
  );
}

function isFamily(value: unknown): value is Family {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.slug === "string";
}

/**
 * ADR-029: the machine or application groups each Product Family page lists its products under.
 * Admin-only to create, rename, reorder and delete; products are placed in a group from the product
 * editor.
 */
export default async function ApplicationGroupsPage(): Promise<ReactNode> {
  const access = await requireAdminAccess("segments");
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="application-groups"
        title="Application groups"
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

  const [groupsResult, familiesResult, locales] = await Promise.all([
    apiGet<unknown>("/admin/catalog/application-groups", undefined, { accessToken }),
    apiGet<unknown>("/categories"),
    getActiveLocales().catch(() => []),
  ]);
  if (!groupsResult.ok && groupsResult.reason === "http" && groupsResult.status === 401)
    redirect(SESSION_END_PATH);

  const groups =
    groupsResult.ok && Array.isArray(groupsResult.data) && groupsResult.data.every(isGroup)
      ? groupsResult.data
      : null;
  const families =
    familiesResult.ok && Array.isArray(familiesResult.data)
      ? familiesResult.data.filter(isFamily)
      : [];
  const otherLocales = locales
    .filter((locale) => !locale.isDefault)
    .map((locale) => ({ code: locale.code, name: locale.name }));

  return (
    <AdminShell current="application-groups" title="Application groups" user={access.user}>
      <p className="ad-note">
        The groups each Product Family page lists its products under — for example Compressors or
        Turbines. Place a product in a group from its product editor.
      </p>
      <CreateApplicationGroupForm families={families} />
      {groups === null ? (
        <section className="ad-notice">
          <h2>Group list unavailable</h2>
          <p>No group has been changed.</p>
          <Link className="ad-link" href="/admin/catalog/application-groups">
            Try again
          </Link>
        </section>
      ) : (
        families.map((family) => {
          const rows = groups.filter((group) => group.categoryId === family.id);
          return (
            <section key={family.id} aria-labelledby={`family-${family.id}`}>
              <h2 id={`family-${family.id}`}>{family.name}</h2>
              {rows.length === 0 ? (
                <p className="ad-note">No groups yet — its products are listed without groups.</p>
              ) : (
                <div
                  className="ad-table-scroll"
                  role="region"
                  aria-label={`${family.name} groups`}
                  tabIndex={0}
                >
                  <table className="ad-table">
                    <caption className="ad-sr-only">
                      Application groups of {family.name}, in display order.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        {otherLocales.map((locale) => (
                          <th scope="col" key={locale.code}>
                            {locale.name}
                          </th>
                        ))}
                        <th scope="col">Order</th>
                        <th scope="col">Products</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((group) => (
                        <ApplicationGroupRow key={group.id} group={group} locales={otherLocales} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </AdminShell>
  );
}
