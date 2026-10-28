"use server";

import { revalidatePath } from "next/cache";

import { apiPatch } from "@/lib/api-client";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";

/**
 * ADR-030: Product Family and Product Type are Admin-only, so this action is gated by the
 * Admin-only `segments` area, as group and Segment structure are.
 */
export async function setProductClassification(
  productId: string,
  categoryId: string,
  productTypeId: string | null,
): Promise<{ ok: boolean; message: string }> {
  const access = await requireAdminAccess("segments");
  if (access.state !== "authorized") return { ok: false, message: "Access denied." };
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return { ok: false, message: "Sign in again before saving." };
  const result = await apiPatch<{ groupCleared: boolean }>(
    `/admin/products/${encodeURIComponent(productId)}/classification`,
    { categoryId, productTypeId },
    { accessToken },
  );
  if (!result.ok) return { ok: false, message: "The classification could not be saved." };
  revalidatePath(`/admin/catalog/products/${productId}`);
  revalidatePath("/[locale]/products/[slug]", "page");
  return {
    ok: true,
    message: result.data.groupCleared
      ? "Saved. The product left its application group — choose a group of the new family below."
      : "Saved.",
  };
}
