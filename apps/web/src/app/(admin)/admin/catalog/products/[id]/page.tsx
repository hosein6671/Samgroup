import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { apiGet } from "@/lib/api-client";
import { ContentForm } from "@/features/admin/content/content-form";
import {
  PRODUCT_EDITOR_SCHEMA,
  PRODUCT_LOCALIZATION_EDITOR_SCHEMA,
} from "@/features/admin/catalog/products/product-editor-schema";
import { getActiveLocales } from "@/lib/locales";
import { ProductMediaManager } from "@/features/admin/catalog/products/product-media-manager";
import type { ProductMediaItem } from "@/features/admin/catalog/products/media-actions";
import { ProductSegmentManager } from "@/features/admin/catalog/products/product-segment-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit product · SAM Group Admin" };
export default async function ProductEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string | string[] }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell title="Edit product" user={access.state === "forbidden" ? access.user : null}>
        <p>Product editing is unavailable for this session.</p>
      </AdminShell>
    );
  const { id } = await params;
  const query = await searchParams;
  const token = await getAdminAccessToken();
  if (!token) redirect(SESSION_END_PATH);
  /*
   * The language being edited, from `?locale=` (ADR-027 §3). The choices are the active `Locale`
   * table, never a list in code; anything else edits the default locale.
   */
  const locales = await getActiveLocales().catch(() => []);
  const defaultLocale = locales.find((item) => item.isDefault)?.code ?? "en";
  const requested = typeof query.locale === "string" ? query.locale : undefined;
  const locale = locales.some((item) => item.code === requested) ? requested! : defaultLocale;
  const isDefaultLocale = locale === defaultLocale;
  const languageName = locales.find((item) => item.code === locale)?.name ?? locale.toUpperCase();
  const result = await apiGet<{
    revision: string;
    slug: string;
    category: string;
    translationStatus?: "machine_draft" | "human_reviewed";
    fields: Record<string, unknown>;
  }>(`/admin/products/${encodeURIComponent(id)}`, isDefaultLocale ? {} : { locale }, {
    accessToken: token,
  });
  const images = await apiGet<ProductMediaItem[]>(
    `/admin/products/${encodeURIComponent(id)}/images`,
    {},
    { accessToken: token },
  );
  const segments = await apiGet<{
    assigned: string[];
    available: { id: string; name: string; slug: string }[];
  }>(`/admin/products/${encodeURIComponent(id)}/segments`, {}, { accessToken: token });
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  return (
    <AdminShell title="Edit product" user={access.user} current="products">
      <p>
        <Link className="ad-link" href="/admin/catalog/products">
          All products
        </Link>
      </p>
      {result.ok && typeof result.data.revision === "string" && result.data.fields ? (
        <>
          {locales.length > 1 && (
            <nav className="ad-content-locales" aria-label="Content language">
              <ul>
                {locales.map((item) => (
                  <li key={item.code}>
                    <Link
                      href={
                        item.code === defaultLocale
                          ? `/admin/catalog/products/${encodeURIComponent(id)}`
                          : `/admin/catalog/products/${encodeURIComponent(id)}?locale=${item.code}`
                      }
                      aria-current={item.code === locale ? "page" : undefined}
                      lang={item.code}
                    >
                      {item.nativeName}
                      <span>{item.code.toUpperCase()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <p className="ad-note">
            {result.data.category} · {languageName} content. Drafts stay private until published.
            Product URLs and technical approvals are unchanged by this editor.
            {!isDefaultLocale &&
              ` The product name stays "${String(result.data.fields.name ?? "")}" in every language. Sections this language has not published show the ${defaultLocale.toUpperCase()} text on the public page.`}
          </p>
          <p>
            <Link className="ad-link" href={`/${locale}/products/${result.data.slug}`}>
              View published product
            </Link>
          </p>
          {isDefaultLocale && (
            <>
              <ProductMediaManager productId={id} initial={images.ok ? images.data : []} />
              <ProductSegmentManager
                productId={id}
                initial={segments.ok ? segments.data : { assigned: [], available: [] }}
              />
            </>
          )}
          <ContentForm
            key={locale}
            pageKey={id}
            resource="product"
            revision={result.data.revision}
            operationId={randomUUID()}
            schema={isDefaultLocale ? PRODUCT_EDITOR_SCHEMA : PRODUCT_LOCALIZATION_EDITOR_SCHEMA}
            initial={
              isDefaultLocale
                ? result.data.fields
                : {
                    ...result.data.fields,
                    translationStatus: result.data.translationStatus ?? "machine_draft",
                  }
            }
            {...(isDefaultLocale ? {} : { locale })}
          />
        </>
      ) : (
        <p className="ad-notice">The product could not be loaded. Please try again.</p>
      )}
    </AdminShell>
  );
}
