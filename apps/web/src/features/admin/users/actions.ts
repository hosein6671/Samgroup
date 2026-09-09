"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "../session/require-admin";
import { getAdminAccessToken } from "../session/session";
import { apiPost, apiPatch } from "@/lib/api-client";

export async function createUser(_previous: string, form: FormData): Promise<string> {
  const access = await requireAdminAccess();
  if (access.state !== "authorized") return "Access denied or session unavailable.";
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return "Session expired. Reload before continuing.";
  const email = form.get("email");
  const password = form.get("password");
  const role = form.get("role");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof role !== "string" ||
    email.length > 254 ||
    password.length < 12 ||
    password.length > 1024 ||
    !["admin", "content_manager", "sales_expert", "customer"].includes(role)
  )
    return "Check the email, role and password (12–1024 characters).";
  const result = await apiPost("/admin/users", { email, password, role }, { accessToken });
  if (result.ok) {
    revalidatePath("/admin/users");
    return "Account created.";
  }
  if (result.reason === "http" && result.status === 409)
    return "That account already exists or changed. Reload and check the list before retrying.";
  if (result.reason === "http" && result.status === 400)
    return "Check the email, password and role.";
  return "Account creation could not be confirmed. Reload and check the list before retrying.";
}

export async function updateUser(_previous: string, form: FormData): Promise<string> {
  const access = await requireAdminAccess();
  if (access.state !== "authorized") return "Access denied or session unavailable.";
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return "Session expired. Reload before continuing.";
  const id = form.get("id");
  const role = form.get("role");
  const status = form.get("status");
  const revision = Number(form.get("revision"));
  if (
    typeof id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    typeof role !== "string" ||
    !["admin", "content_manager", "sales_expert", "customer"].includes(role) ||
    !["active", "disabled"].includes(String(status)) ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    return "Invalid account update.";
  const result = await apiPatch(
    `/admin/users/${encodeURIComponent(id)}`,
    { role, status, revision },
    { accessToken },
  );
  if (result.ok) {
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return "Account updated. Reload before making another change.";
  }
  if (result.reason === "http" && result.status === 409)
    return "Account changed or this action would affect your own account or the last administrator. Reload and check.";
  return "Update could not be confirmed. Reload and check the current account state.";
}
