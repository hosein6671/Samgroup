import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { structuralEditorDefaults } from "@/features/content/structural-copy";
import type { StructuralScope } from "@sam-group/types";
import { FAQ_PAGE_DEFAULTS } from "@/features/faq/page-content";
import { categoryContentFor } from "@/features/products/localized-data";
import { localizeContent } from "@/i18n/localize-content";
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

async function viewHref(key: string, locale?: string): Promise<string | undefined> {
  const path = key.startsWith("category-")
    ? `${ROUTES.products}/${encodeURIComponent(key.slice(9))}`
    : key.startsWith("faq-")
      ? ROUTES.faq
      : VIEW_PATHS[key];
  if (!path) return undefined;
  if (locale !== undefined) return localeHref(locale, path);
  const fallback = (await getActiveLocales().catch(() => [])).find((item) => item.isDefault);
  return fallback ? localeHref(fallback.code, path) : undefined;
}
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ locale?: string | string[] }>;
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
  const [{ key }, query] = await Promise.all([params, searchParams]);
  /*
   * The language being edited, from `?locale=`. The choices are the active `Locale` table, never a
   * list in code; anything else falls back to the default locale, which is what this page edited
   * before languages were selectable. The API resolves the code again before the CMS sees it.
   */
  const locales = await getActiveLocales().catch(() => []);
  const defaultLocale = locales.find((item) => item.isDefault)?.code ?? "en";
  const requested = typeof query.locale === "string" ? query.locale : undefined;
  const locale = locales.some((item) => item.code === requested) ? requested! : defaultLocale;
  const isDefaultLocale = locale === defaultLocale;
  const languageName = locales.find((item) => item.code === locale)?.name ?? locale.toUpperCase();
  const accessToken = await getAdminAccessToken();
  type ContentRead = {
    key: string;
    revision: string;
    fields: Record<string, unknown>;
    schema: EditorField[];
  };
  const read = (code: string): Promise<{ ok: boolean; data?: ContentRead } | null> =>
    accessToken
      ? apiGet<ContentRead>(
          "/admin/content/" + encodeURIComponent(key),
          isDefaultLocale && code === defaultLocale ? {} : { locale: code },
          { accessToken },
        ).then((response) => (response.ok ? { ok: true, data: response.data } : { ok: false }))
      : Promise.resolve(null);
  // Another language is edited beside its source: the default locale's text is read too, and
  // shown as a reference, so a translator never has to open the English page in another tab.
  const [result, sourceResult] = await Promise.all([
    read(locale),
    isDefaultLocale ? Promise.resolve(null) : read(defaultLocale),
  ]);
  const data = result?.ok && result.data ? result.data : null;
  const sourceFields = sourceResult?.ok ? (sourceResult.data?.fields ?? null) : null;
  // A layout's built-in copy, in the language being edited.
  const localized = <T,>(value: T): T => (isDefaultLocale ? value : localizeContent(locale, value));
  const mediaResult = accessToken
    ? await apiGet<{ items: EditorialMedia[]; total: number }>(
        "/admin/content/media/library",
        {},
        { accessToken },
      )
    : null;
  const media =
    mediaResult?.ok && Array.isArray(mediaResult.data.items) ? mediaResult.data.items : [];
  const category = key.startsWith("category-") ? categoryContentFor(key.slice(9), locale) : null;
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
        ? localized(
            structuralEditorDefaults(
              key as StructuralScope,
              data?.fields ?? {},
              data?.revision !== "initial",
            ),
          )
        : key === "faq-page"
          ? {
              ...localized(FAQ_PAGE_DEFAULTS),
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
      {locales.length > 1 && (
        <nav className="ad-content-locales" aria-label="Content language">
          <ul>
            {locales.map((item) => (
              <li key={item.code}>
                <Link
                  href={
                    item.code === defaultLocale
                      ? `/admin/content/${encodeURIComponent(key)}`
                      : `/admin/content/${encodeURIComponent(key)}?locale=${item.code}`
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
        {languageName} content. Save a draft to keep changes private, or publish when the content is
        ready.
        {!isDefaultLocale &&
          " Fields not yet translated start from the page's built-in copy in this language, or empty where the page has none; publishing makes this language's version public."}
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
          viewHref={await viewHref(key, locale)}
          locale={isDefaultLocale ? undefined : locale}
        />
      ) : (
        <p className="ad-notice">The content could not be loaded. Please try again.</p>
      )}
      {sourceFields !== null && <SourceReference fields={sourceFields} />}
    </AdminShell>
  );
}

/**
 * The default-language text beside a translation: every non-empty text value of the source record,
 * read-only and collapsed by default. Labels are the field paths, which match the form's sections.
 */
function SourceReference({ fields }: { fields: Record<string, unknown> }): ReactNode {
  const rows: [string, string][] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (value.trim() && !/^(https?:|\/|#|mailto:|tel:)/.test(value)) rows.push([path, value]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${String(index + 1)}]`));
      return;
    }
    if (value && typeof value === "object")
      for (const [name, child] of Object.entries(value))
        if (!["id", "createdAt", "updatedAt", "_status", "source"].includes(name))
          walk(child, path ? `${path}.${name}` : name);
  };
  walk(fields, "");
  if (rows.length === 0) return null;
  return (
    <details className="ad-content-source">
      <summary>Source text (default language) — {rows.length} fields</summary>
      <dl>
        {rows.map(([path, text]) => (
          <div key={path}>
            <dt>{path}</dt>
            <dd lang="en" dir="ltr">
              {text}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
