"use server";
import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";

import { requireAdminAccess } from "../../session/require-admin";
import { getAdminAccessToken } from "../../session/session";

/**
 * ADR-029 §3. Creating, renaming, reordering and deleting application groups is Admin-only, so
 * these actions are gated by the `segments` area exactly like Segment creation (ADR-026).
 */
const PAGE = "/admin/catalog/application-groups";

async function token(): Promise<string | null> {
  const access = await requireAdminAccess("segments");
  if (access.state !== "authorized") return null;
  return getAdminAccessToken();
}

function refresh(): void {
  revalidatePath(PAGE);
  // Every family page lists its groups; a rename or reorder shows there on the next request.
  revalidatePath("/[locale]/products/[slug]", "page");
}

export async function createApplicationGroup(_previous: string, form: FormData): Promise<string> {
  const accessToken = await token();
  if (!accessToken) return "Access denied or session unavailable.";
  const categoryId = form.get("categoryId");
  const name = form.get("name");
  if (typeof categoryId !== "string" || !categoryId) return "Choose a Product Family.";
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80)
    return "Enter a name (1–80 characters).";
  const result = await apiPost(
    "/admin/catalog/application-groups",
    { categoryId, name: name.trim() },
    { accessToken },
  );
  if (result.ok) {
    refresh();
    return "Group created.";
  }
  if (result.reason === "http" && result.status === 409)
    return "This family already has a group with that name.";
  return "The group could not be created.";
}

export type GroupSaveResult = { ok: boolean; message: string };

export async function updateApplicationGroup(
  id: string,
  input: { name: string; sortOrder: number; translations: Record<string, string> },
): Promise<GroupSaveResult> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Access denied or session unavailable." };
  const name = input.name.trim();
  if (!name || name.length > 80) return { ok: false, message: "Enter a name (1–80 characters)." };
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 10000)
    return { ok: false, message: "Order must be a whole number from 0 to 10000." };
  const path = `/admin/catalog/application-groups/${encodeURIComponent(id)}`;
  const base = await apiPatch(path, { name, sortOrder: input.sortOrder }, { accessToken });
  if (!base.ok) return { ok: false, message: "The group could not be saved." };
  for (const [locale, value] of Object.entries(input.translations)) {
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(locale)) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const localized = await apiPatch(
      `${path}?locale=${encodeURIComponent(locale)}`,
      { name: trimmed.slice(0, 80) },
      { accessToken },
    );
    if (!localized.ok)
      return { ok: false, message: `Saved, but the ${locale.toUpperCase()} name was not.` };
  }
  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteApplicationGroup(id: string): Promise<GroupSaveResult> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Access denied or session unavailable." };
  const result = await apiDelete(`/admin/catalog/application-groups/${encodeURIComponent(id)}`, {
    accessToken,
  });
  if (result.ok) {
    refresh();
    return { ok: true, message: "Deleted." };
  }
  if (result.reason === "http" && result.status === 409)
    return { ok: false, message: "Move this group's products to another group first." };
  return { ok: false, message: "The group could not be deleted." };
}
