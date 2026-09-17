"use server";
import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api-client";
import { requireAdminAccess } from "../../session/require-admin";
import { getAdminAccessToken } from "../../session/session";

/**
 * ADR-026. Admin-only, unlike the blog category/tag equivalent (`createBlogReference`) — the
 * `segments` area, not `content`, gates this action.
 */
export async function createSegment(_previous: string, form: FormData): Promise<string> {
  const access = await requireAdminAccess("segments");
  if (access.state !== "authorized") return "Access denied or session unavailable.";
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return "Session expired. Reload before continuing.";
  const name = form.get("name");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60)
    return "Enter a name (1–60 characters).";
  const result = await apiPost("/admin/catalog/segments", { name: name.trim() }, { accessToken });
  if (result.ok) {
    revalidatePath("/admin/catalog/segments");
    return "Segment created.";
  }
  if (result.reason === "http" && result.status === 409)
    return "That name is already in use, or does not resolve to a usable Segment. Check the list below.";
  return "The Segment could not be created.";
}
