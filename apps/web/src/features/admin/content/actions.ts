"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { apiPatch } from "@/lib/api-client";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
export type EditState = { message: string; revision: string; operationId: string; saved: boolean };
export async function saveContent(previous: EditState, form: FormData): Promise<EditState> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return { ...previous, saved: false, message: "Your editing session is unavailable." };
  const key = form.get("key"),
    raw = form.get("fields"),
    action = form.get("action");
  const product = form.get("resource") === "product";
  if (
    typeof key !== "string" ||
    typeof raw !== "string" ||
    raw.length > 200000 ||
    !["save-draft", "publish"].includes(String(action))
  )
    return { ...previous, saved: false, message: "Check the content fields." };
  let fields: unknown;
  try {
    fields = JSON.parse(raw);
  } catch {
    return { ...previous, saved: false, message: "Check the content fields." };
  }
  if (
    (product || key.startsWith("category-") || key === "faq-page") &&
    fields &&
    typeof fields === "object" &&
    "seo" in fields &&
    fields.seo &&
    typeof fields.seo === "object"
  ) {
    const seo = fields.seo as Record<string, unknown>;
    if (product && seo.canonicalUrl === "") delete seo.canonicalUrl;
    if (Array.isArray(seo.keywords))
      seo.keywords = seo.keywords
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => String(value).trim());
  }
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return { ...previous, saved: false, message: "Sign in again before saving." };
  const result = await apiPatch<{ revision: string; slug?: string }>(
    `/admin/${product ? "products" : "content"}/${encodeURIComponent(key)}`,
    product
      ? { content: fields, action, revision: Number(previous.revision) }
      : { fields, action, revision: previous.revision, operationId: previous.operationId },
    { accessToken },
  );
  if (!result.ok)
    return {
      ...previous,
      saved: false,
      message:
        result.reason === "http" && result.status === 409
          ? "This page changed. Reload before saving; keep a copy of your edits."
          : result.reason === "http" && result.status === 400
            ? "Check the required fields, text lengths and URL format. Your edits have been kept."
            : "Save was not confirmed. Keep your edits and reload before retrying.",
    };
  if (!result.data || typeof result.data.revision !== "string")
    return {
      ...previous,
      saved: false,
      message: "Save was not confirmed. Reload to check the page.",
    };
  revalidatePath(product ? `/admin/catalog/products/${key}` : `/admin/content/${key}`);
  if (key.startsWith("faq-")) revalidatePath("/admin/faqs");
  if (action === "publish") {
    if (key.startsWith("faq-")) {
      revalidatePath("/en/products", "layout");
      revalidatePath("/en/faq");
      revalidatePath("/sitemap.xml");
      revalidatePath("/en/contact-us");
    }
    if (key.startsWith("category-")) revalidatePath("/sitemap.xml");
    if (product && result.data.slug) {
      revalidatePath(`/en/products/${result.data.slug}`);
      revalidatePath("/en/products", "layout");
      revalidatePath("/admin/catalog/products");
    } else if (!product && !key.startsWith("faq-"))
      revalidatePath(key.startsWith("category-") ? `/en/products/${key.slice(9)}` : `/en/${key}`);
  }
  return {
    message:
      action === "publish"
        ? "Published successfully."
        : "Draft saved. The public page is unchanged.",
    saved: true,
    revision: result.data.revision,
    operationId: randomUUID(),
  };
}
