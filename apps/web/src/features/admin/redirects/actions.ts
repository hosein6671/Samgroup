"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";

const LIST_PATH = "/admin/redirects";

export type RedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  locale: string | null;
  isActive: boolean;
};

async function token(): Promise<string | null> {
  const access = await requireAdminAccess("redirects");
  return access.state === "authorized" ? getAdminAccessToken() : null;
}

/**
 * Returns the created row rather than a plain status string — `RedirectsManager` holds the list
 * as local state (it is a Client Component sibling of no one, not a Server Component the create
 * action can re-render), so the new row is appended there directly instead of relying on
 * `revalidatePath` to reach a `useState` that only reads its `initial` prop once, on mount. Same
 * shape `uploadProductImage` already returns for the same reason.
 */
export async function createRedirect(
  form: FormData,
): Promise<{ row?: RedirectRow; message: string }> {
  const accessToken = await token();
  if (!accessToken) return { message: "Your editing session is unavailable." };
  const fromPath = form.get("fromPath");
  const toPath = form.get("toPath");
  const statusCode = form.get("statusCode");
  const locale = form.get("locale");
  if (
    typeof fromPath !== "string" ||
    !fromPath.startsWith("/") ||
    typeof toPath !== "string" ||
    !toPath.startsWith("/")
  )
    return { message: "Both paths must start with /." };
  const result = await apiPost<RedirectRow>(
    LIST_PATH,
    {
      fromPath,
      toPath,
      statusCode: statusCode === "302" ? 302 : 301,
      locale: typeof locale === "string" && locale.trim() ? locale.trim() : null,
    },
    { accessToken },
  );
  if (result.ok) {
    revalidatePath("/admin/redirects");
    return { row: result.data, message: "Redirect created." };
  }
  if (result.reason === "http" && result.status === 409)
    return { message: "A redirect already exists for that path and locale." };
  if (result.reason === "http" && result.status === 400)
    return {
      message:
        "Check both paths — a redirect cannot point a path at itself, and the locale must be a real one.",
    };
  return { message: "The redirect could not be created." };
}

export async function setRedirectActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message: string }> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Your editing session is unavailable." };
  const result = await apiPatch(
    `${LIST_PATH}/${encodeURIComponent(id)}`,
    { isActive },
    { accessToken },
  );
  if (!result.ok) return { ok: false, message: "The redirect could not be updated." };
  revalidatePath("/admin/redirects");
  return { ok: true, message: isActive ? "Redirect enabled." : "Redirect disabled." };
}

export async function deleteRedirect(id: string): Promise<{ ok: boolean; message: string }> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, message: "Your editing session is unavailable." };
  const result = await apiDelete(`${LIST_PATH}/${encodeURIComponent(id)}`, { accessToken });
  if (!result.ok) return { ok: false, message: "The redirect could not be removed." };
  revalidatePath("/admin/redirects");
  return { ok: true, message: "Redirect removed." };
}
