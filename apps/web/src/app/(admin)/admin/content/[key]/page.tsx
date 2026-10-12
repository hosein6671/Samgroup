import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { structuralEditorDefaults } from "@/features/content/structural-copy";
import type { StructuralScope } from "@sam-group/types";
import { FAQ_PAGE_DEFAULTS } from "@/features/faq/page-content";
import { getCategoryContent } from "@/features/products/category/data";
import { categoryEditorDefaults } from "@/features/products/category/category-editorial";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { AdminShell } from "@/features/admin/admin-shell";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";
import { ContentForm } from "@/features/admin/content/content-form";
import type { EditorialMedia, EditorField } from "@/features/admin/content/content-form";
import type { ReactNode } from "react";
import { getActiveLocales } from "@/lib/locales";
import { localeHref, ROUTES } from "@/features/site/site-routes";

/**
 * Where an editor sees this content on the public site, in the default language (the one this
 * editor writes). Header and footer appear on every page, so they open the home page; a content
 * key with no page of its own opens nothing.
 */
const VIEW_PATHS: Record<string, string> = {
  home: ROUTES.home,
  header: ROUTES.home,
  footer: ROUTES.home,
  "about-us": ROUTES.aboutUs,
  "customized-solutions": ROUTES.customizedSolutions,
  "quality-certifications": ROUTES.qualityCertifications,
  "contact-us": ROUTES.contactUs,
  "export-logistics": ROUTES.exportLogistics,
  "products-landing": ROUTES.products,
  "faq-page": ROUTES.faq,
};

async function viewHref(key: string): Promise<string | undefined> {
  const path = key.startsWith("category-")
    ? `${ROUTES.products}/${encodeURIComponent(key.slice(9))}`
    : key.startsWith("faq-")
      ? ROUTES.faq
      : VIEW_PATHS[key];
  if (!path) return undefined;
  const locale = (await getActiveLocales().catch(() => [])).find((item) => item.isDefault);
  return locale ? localeHref(locale.code, path) : undefined;
}
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("content");
  if (access.state !== "authorized")
    return (
      <AdminShell
        title="Website content"
        user={access.state === "forbidden" ? access.user : null}
        current="content"
      >
        <p>Content editing is not available for this session.</p>
      </AdminShell>
    );
  const { key } = await params;
  const accessToken = await getAdminAccessToken();
  const result = accessToken
    ? await apiGet<{
        key: string;
        revision: string;
        fields: Record<string, unknown>;
        schema: EditorField[];
      }>("/admin/content/" + encodeURIComponent(key), {}, { accessToken })
    : null;
  const data = result?.ok ? result.data : null;
  const mediaResult = accessToken
    ? await apiGet<{ items: EditorialMedia[]; total: number }>(
        "/admin/content/media/library",
        {},
        { accessToken },
      )
    : null;
  const media =
    mediaResult?.ok && Array.isArray(mediaResult.data.items) ? mediaResult.data.items : [];
  const category = key.startsWith("category-") ? getCategoryContent(key.slice(9)) : null;
  const initial =
    category && data?.fields
      ? {
          ...categoryEditorDefaults(category),
          seo: {
            metaTitle: category.meta.title,
            metaDescription: category.meta.description,
            robotsIndex: true,
            robotsFollow: true,
            twitterCardType: "summary_large_image",
            keywords: [],
          },
          ...Object.fromEntries(Object.entries(data.fields).filter(([, value]) => value !== null)),
        }
      : Object.prototype.hasOwnProperty.call(STRUCTURAL_DEFAULTS, key)
        ? structuralEditorDefaults(
            key as StructuralScope,
            data?.fields ?? {},
            data?.revision !== "initial",
          )
        : key === "faq-page"
          ? {
              ...FAQ_PAGE_DEFAULTS,
              ...Object.fromEntries(
                Object.entries(data?.fields ?? {}).filter(([, value]) => value !== null),
              ),
            }
          : key.startsWith("faq-")
            ? {
                question: "",
                answer: "",
                topic: "products",
                relatedCategoryKeys: [],
                showOnContactPage: false,
                sortOrder: 0,
                ...Object.fromEntries(
                  Object.entries(data?.fields ?? {}).filter(([, value]) => value !== null),
                ),
              }
            : (data?.fields ?? {});
  return (
    <AdminShell title="Edit website content" user={access.user} current="content">
      <Link href="/admin/content">All content pages</Link>
      <h2>
        {key === "faq-page"
          ? "FAQ page & SEO"
          : key.startsWith("faq-")
            ? "Edit shared answer"
            : key.replaceAll("-", " ")}
      </h2>
      {key.startsWith("faq-") && <Link href="/admin/faqs">All shared questions</Link>}
      <p className="ad-note">
        English content. Save a draft to keep changes private, or publish when the content is ready.
      </p>
      {category && <Link href="/admin/faqs">Manage shared FAQ answers</Link>}
      {category && (
        <p className="ad-note">
          Edit the page narrative and applications here. Choose the shared FAQ switch to show
          published answers from the library.
        </p>
      )}
      {data &&
      typeof data.revision === "string" &&
      Array.isArray(data.schema) &&
      data.fields &&
      typeof data.fields === "object" ? (
        <ContentForm
          pageKey={key}
          revision={data.revision}
          operationId={randomUUID()}
          schema={data.schema}
          initial={initial}
          media={media}
          viewHref={await viewHref(key)}
        />
      ) : (
        <p className="ad-notice">The content could not be loaded. Please try again.</p>
      )}
    </AdminShell>
  );
}
