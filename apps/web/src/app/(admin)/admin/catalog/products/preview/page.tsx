import { AdminShell } from "@/features/admin/admin-shell";
import { ProductWorkspacePreview } from "@/features/admin/catalog/products/product-workspace-preview";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product workspace preview · SAM Group Admin" };

export default async function ProductPreviewPage(): Promise<ReactNode> {
  const access = await requireAdminAccess();
  if (access.state !== "authorized") {
    return (
      <AdminShell title="Products" user={access.state === "forbidden" ? access.user : null}>
        <p className="ad-notice">
          {access.state === "forbidden"
            ? "Access denied."
            : "Your session could not be checked. Please try again."}
        </p>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Products" user={access.user}>
      <ProductWorkspacePreview />
    </AdminShell>
  );
}
