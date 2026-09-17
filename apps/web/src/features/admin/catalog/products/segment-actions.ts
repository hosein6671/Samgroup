"use server";

import { revalidatePath } from "next/cache";
import { apiPatch } from "@/lib/api-client";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";

type MutationResult = { ok: boolean; message: string; assigned?: string[] };

export async function setProductSegments(
  productId: string,
  segmentIds: string[],
): Promise<MutationResult> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return { ok: false, message: "Your editing session is unavailable." };
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return { ok: false, message: "Sign in again before saving." };
  const result = await apiPatch<{ assigned: string[] }>(
    `/admin/products/${encodeURIComponent(productId)}/segments`,
    { segmentIds },
    { accessToken },
  );
  if (!result.ok) return { ok: false, message: "The Segments could not be saved." };
  revalidatePath(`/admin/catalog/products/${productId}`);
  revalidatePath("/en/products/finder");
  return { ok: true, message: "Segments saved.", assigned: result.data.assigned };
}
