"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiPatch, apiPostFormData } from "@/lib/api-client";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";

export type ProductMediaItem = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};
type UploadResult = { item?: ProductMediaItem; message: string };
type MutationResult = { ok: boolean; message: string };

async function token(): Promise<string | null> {
  const access = await requireAdminAccess("content");
  return access.state === "authorized" ? getAdminAccessToken() : null;
}

export async function uploadProductImage(productId: string, form: FormData): Promise<UploadResult> {
  const accessToken = await token();
  if (!accessToken) return { message: "Your editing session is unavailable." };
  const image = form.get("image");
  const altText = form.get("altText");
  if (!(image instanceof File) || typeof altText !== "string" || !altText.trim())
    return { message: "Choose an image and enter descriptive alt text." };
  const body = new FormData();
  body.set("image", image);
  body.set("altText", altText.trim());
  const result = await apiPostFormData<ProductMediaItem>(
    `/admin/products/${encodeURIComponent(productId)}/images`,
    body,
    { accessToken },
  );
  if (!result.ok) return { message: "The product image could not be uploaded." };
  revalidatePath(`/admin/catalog/products/${productId}`);
  revalidatePath("/en/products", "layout");
  return { item: result.data, message: "Image uploaded." };
}

export async function makeProductImagePrimary(
  productId: string,
  imageId: string,
): Promise<MutationResult> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Your editing session is unavailable." };
  const result = await apiPatch<{ updated: true }>(
    `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/primary`,
    {},
    { accessToken },
  );
  revalidatePath(`/admin/catalog/products/${productId}`);
  revalidatePath("/en/products", "layout");
  return result.ok
    ? { ok: true, message: "Primary image updated." }
    : { ok: false, message: "The primary image could not be updated." };
}

export async function removeProductImage(
  productId: string,
  imageId: string,
): Promise<MutationResult> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Your editing session is unavailable." };
  const result = await apiDelete<{ deleted: true }>(
    `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    { accessToken },
  );
  revalidatePath(`/admin/catalog/products/${productId}`);
  revalidatePath("/en/products", "layout");
  return result.ok
    ? { ok: true, message: "Image removed." }
    : { ok: false, message: "The image could not be removed." };
}
