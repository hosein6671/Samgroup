import type { Metadata } from "next";
import type { StructuralScope } from "@sam-group/types";
import { publishedStructural } from "./published-structural";
import { isIndexingEnabled } from "@/features/seo/indexing";
import { absoluteUrl } from "@/features/seo/site";
export async function structuralMetadata(
  scope: StructuralScope,
  locale: string,
  fallback: Metadata,
): Promise<Metadata> {
  const content = await publishedStructural(scope, locale),
    seo = content?.seo;
  const title = seo?.metaTitle || fallback.title || undefined;
  const description = seo?.metaDescription || fallback.description || undefined;
  const canonical = seo?.canonicalUrl || fallback.alternates?.canonical;
  return {
    ...fallback,
    title,
    description,
    keywords: seo?.keywords,
    alternates: { ...fallback.alternates, canonical },
    robots: {
      index:
        isIndexingEnabled() && locale === "en" && content !== null && (seo?.robotsIndex ?? true),
      follow: isIndexingEnabled() && (seo?.robotsFollow ?? true),
    },
    openGraph: {
      ...fallback.openGraph,
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: typeof canonical === "string" ? canonical : undefined,
    },
    twitter: {
      images:
        fallback.twitter && "images" in fallback.twitter ? fallback.twitter.images : undefined,
      card: seo?.twitterCardType ?? "summary_large_image",
      title: seo?.twitterTitle || title,
      description: seo?.twitterDescription || description,
    },
  };
}
export async function structuralInSitemap(
  scope: StructuralScope,
  locale: string,
  path: string,
): Promise<boolean> {
  const content = await publishedStructural(scope, locale);
  return (
    content !== null &&
    content.seo?.robotsIndex !== false &&
    (!content.seo?.canonicalUrl || content.seo.canonicalUrl === absoluteUrl(path))
  );
}
