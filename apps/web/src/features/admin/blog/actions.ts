"use server";

import { redirect } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { requireAdminAccess } from "../session/require-admin";
import { getAdminAccessToken } from "../session/session";

export async function createBlogPost(_previous: string, form: FormData): Promise<string> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized") return "Your editing session is unavailable.";
  const title = form.get("title"),
    slug = form.get("slug"),
    content = form.get("content"),
    categoryId = form.get("categoryId");
  if (
    ![title, slug, content, categoryId].every((value) => typeof value === "string" && value.trim())
  )
    return "Complete all required fields.";
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return "Sign in again before creating the article.";
  const result = await apiPost<{ id: string; revision: string }>(
    "/admin/blog/posts",
    {
      content: {
        title: String(title).trim(),
        slug: String(slug).trim(),
        content: String(content).trim(),
        categoryId,
        tagIds: form.getAll("tagIds").map(String),
        seo: {
          robotsIndex: true,
          robotsFollow: true,
          keywords: [],
          twitterCardType: "summary_large_image",
        },
      },
    },
    { accessToken },
  );
  if (!result.ok)
    return result.reason === "http" && result.status === 409
      ? "This URL slug is already in use."
      : "The article could not be created. Check the fields and try again.";
  redirect(`/admin/blog/posts/${result.data.id}`);
}

export async function createBlogReference(_previous: string, form: FormData): Promise<string> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized") return "Your editing session is unavailable.";
  const kind = form.get("kind"),
    name = form.get("name"),
    slug = form.get("slug");
  if (
    (kind !== "categories" && kind !== "tags") ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof slug !== "string" ||
    !slug.trim()
  )
    return "Enter a name and URL slug.";
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return "Sign in again before saving.";
  const result = await apiPost(
    `/admin/blog/${kind}`,
    { name: name.trim(), slug: slug.trim() },
    { accessToken },
  );
  if (!result.ok)
    return result.reason === "http" && result.status === 409
      ? "This URL slug is already in use."
      : "The item could not be created.";
  redirect("/admin/blog/posts/new");
}
