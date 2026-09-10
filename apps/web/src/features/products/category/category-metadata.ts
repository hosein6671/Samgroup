import type { Metadata } from "next";
import type { SeoFields } from "@sam-group/types";
import { isIndexingEnabled } from "@/features/seo/indexing";
import type { ProductCategoryContent } from "./category-contract";

export function categoryMetadata(
  content: ProductCategoryContent,
  locale: string,
  seo?: SeoFields,
  unavailable = false,
): Metadata {
  const canonical = seo?.canonicalUrl || `/${locale}/products/${content.familyId}`;
  const title = seo?.metaTitle || content.meta.title;
  const description = seo?.metaDescription || content.meta.description;
  const ogTitle = seo?.ogTitle || title;
  const ogDescription = seo?.ogDescription || description;
  const socialImage = content.hero.image?.src ?? "/images/products-portfolio-review.webp";
  const enabled = isIndexingEnabled() && !unavailable;
  return {
    title,
    description,
    keywords: seo?.keywords,
    alternates: { canonical },
    robots: {
      index: enabled && (seo?.robotsIndex ?? true),
      follow: enabled && (seo?.robotsFollow ?? true),
    },
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      locale,
      images: [{ url: socialImage, alt: "SAM Group petroleum and lubricant product range" }],
    },
    twitter: {
      card: seo?.twitterCardType ?? "summary_large_image",
      title: seo?.twitterTitle || ogTitle,
      description: seo?.twitterDescription || ogDescription,
      images: [socialImage],
    },
  };
}
