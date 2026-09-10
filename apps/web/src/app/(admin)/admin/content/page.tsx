import { FAMILIES } from "@/features/products/products-data";
import Link from "next/link";
import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import type { ReactNode } from "react";
export default async function Page(): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  return (
    <AdminShell
      title="Website content"
      user={access.state === "authorized" || access.state === "forbidden" ? access.user : null}
      current="content"
    >
      {access.state !== "authorized" ? (
        <p>Content editing is not available for this session.</p>
      ) : (
        <>
          <p className="ad-note">
            Edit English page content, save drafts and publish reviewed changes.
          </p>
          <div className="ad-module-grid">
            {[
              ["about-us", "About us"],
              ["customized-solutions", "Customized solutions"],
              ["quality-certifications", "Quality & certifications"],
              ["contact-us", "Contact details"],
            ].map(([key, label]) => (
              <Link className="ad-module-card" key={key} href={"/admin/content/" + key}>
                {label}
              </Link>
            ))}
          </div>
          <h2>Product category content</h2>
          <div className="ad-module-grid">
            {FAMILIES.map((family) => (
              <Link
                className="ad-module-card"
                key={family.id}
                href={"/admin/content/category-" + family.id}
              >
                {family.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
