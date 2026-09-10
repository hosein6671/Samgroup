import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell
        title="Shared FAQ"
        current="content"
        user={access.state === "forbidden" ? access.user : null}
      >
        <p>Content editing is not available for this session.</p>
      </AdminShell>
    );
  const query = await searchParams;
  const candidate = Number(query.page ?? 1);
  const page = Number.isInteger(candidate) && candidate > 0 && candidate <= 100000 ? candidate : 1;
  const accessToken = await getAdminAccessToken();
  const result = accessToken
    ? await apiGet<{ entryKey: string; question: string; revision: string; status: string }[]>(
        "/admin/faqs",
        { page: String(page) },
        { accessToken },
      )
    : null;
  return (
    <AdminShell title="Shared FAQ" current="content" user={access.user}>
      <Link href="/admin/content">All content pages</Link>
      <p className="ad-note">
        Write an answer once and select the product categories where it belongs. Enable the shared
        FAQ library in each category editor before publishing that category.
      </p>
      <Link className="ad-module-card" href={`/admin/content/faq-${randomUUID()}`}>
        Create a question
      </Link>
      {!result?.ok ? (
        <p className="ad-notice">Questions could not be loaded. Try again.</p>
      ) : (
        <>
          {result.data.length === 0 ? (
            <p>No questions on this page.</p>
          ) : (
            <ul>
              {result.data.map((item) => (
                <li key={item.entryKey}>
                  <Link href={`/admin/content/faq-${item.entryKey}`}>{item.question}</Link> —{" "}
                  {item.status === "published" ? "Published" : "Draft"}
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="FAQ list pages">
            {page > 1 && <Link href={`/admin/faqs?page=${page - 1}`}>Previous page</Link>}{" "}
            {page * 20 < (result.meta.total ?? 0) && (
              <Link href={`/admin/faqs?page=${page + 1}`}>Next page</Link>
            )}
          </nav>
        </>
      )}
    </AdminShell>
  );
}
