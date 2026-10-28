"use server";

import { revalidatePath } from "next/cache";

import { apiPatch } from "@/lib/api-client";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";

/** ADR-029 §3: Admin and Content Manager may place a product in a group of its own family. */
export async function setProductApplicationGroup(
  productId: string,
  groupId: string | null,
): Promise<{ ok: boolean; message: string }> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return { ok: false, message: "Your editing session is unavailable." };
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return { ok: false, message: "Sign in again before saving." };
  const result = await apiPatch(
    `/admin/products/${encodeURIComponent(productId)}/application-group`,
    { groupId },
    { accessToken },
  );
  if (!result.ok) return { ok: false, message: "The group could not be saved." };
  revalidatePath(`/admin/catalog/products/${productId}`);
  revalidatePath("/[locale]/products/[slug]", "page");
  return { ok: true, message: "Group saved." };
}
