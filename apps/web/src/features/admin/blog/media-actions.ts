"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiPatch, apiPostFormData } from "@/lib/api-client";
import { requireAdminAccess } from "../session/require-admin";
import { getAdminAccessToken } from "../session/session";

export type BlogMediaItem = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};
type UploadResult = { item?: BlogMediaItem; message: string };
type MutationResult = { ok: boolean; message: string };

async function token(): Promise<string | null> {
  const access = await requireAdminAccess("content");
  return access.state === "authorized" ? getAdminAccessToken() : null;
}

function revalidate(postId: string): void {
  revalidatePath(`/admin/blog/posts/${postId}`);
  revalidatePath("/en/insights", "layout");
}

export async function uploadBlogImage(postId: string, form: FormData): Promise<UploadResult> {
  const accessToken = await token();
  if (!accessToken) return { message: "Your editing session is unavailable." };
  const image = form.get("image"),
    altText = form.get("altText");
  if (!(image instanceof File) || typeof altText !== "string" || !altText.trim())
    return { message: "Choose an image and enter descriptive alt text." };
  const body = new FormData();
  body.set("image", image);
  body.set("altText", altText.trim());
  const result = await apiPostFormData<BlogMediaItem>(
    `/admin/blog/posts/${encodeURIComponent(postId)}/images`,
    body,
    { accessToken },
  );
  if (!result.ok) return { message: "The article image could not be uploaded." };
  revalidate(postId);
  return { item: result.data, message: "Image uploaded." };
}

export async function makeBlogImagePrimary(
  postId: string,
  imageId: string,
): Promise<MutationResult> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Your editing session is unavailable." };
  const result = await apiPatch<{ updated: true }>(
    `/admin/blog/posts/${encodeURIComponent(postId)}/images/${encodeURIComponent(imageId)}/primary`,
    {},
    { accessToken },
  );
  revalidate(postId);
  return result.ok
    ? { ok: true, message: "Featured image updated." }
    : { ok: false, message: "The featured image could not be updated." };
}

export async function removeBlogImage(postId: string, imageId: string): Promise<MutationResult> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Your editing session is unavailable." };
  const result = await apiDelete<{ deleted: true }>(
    `/admin/blog/posts/${encodeURIComponent(postId)}/images/${encodeURIComponent(imageId)}`,
    { accessToken },
  );
  revalidate(postId);
  return result.ok
    ? { ok: true, message: "Image removed." }
    : { ok: false, message: "The image could not be removed." };
}
