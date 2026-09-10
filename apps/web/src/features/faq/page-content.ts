import { cache } from "react";
import type { SeoFields } from "@sam-group/types";
import type { Metadata } from "next";
import { apiGet } from "@/lib/api-client";
import { absoluteUrl } from "@/features/seo/site";
import { isIndexingEnabled } from "@/features/seo/indexing";

export const FAQ_PAGE_DEFAULTS = {
  eyebrow: "SAM Group · Questions & answers",
  title: "A clearer starting point for your enquiry.",
  introduction:
    "Explore product, sample and supply questions before sharing your requirements with our team.",
  questionsHeading: "Frequently asked questions",
  contactHeading: "Have a specific requirement?",
  contactText:
    "Include the product or application, quantity and destination so your enquiry has the right context.",
  contactLabel: "Ask our team →",
  seo: {
    metaTitle: "Frequently Asked Questions | SAM Group",
    metaDescription:
      "Find answers about product selection, samples, ordering and export enquiries.",
    robotsIndex: true,
    robotsFollow: true,
    twitterCardType: "summary" as const,
    keywords: [],
  },
};
export type FaqPageData = {
  fields: Partial<Record<Exclude<keyof typeof FAQ_PAGE_DEFAULTS, "seo">, string>>;
  seo?: SeoFields;
};
export const getFaqPageContent = cache(async (locale: string): Promise<FaqPageData | null> => {
  if (locale !== "en") return { fields: {} };
  const response = await apiGet<{ available: boolean; content: FaqPageData | null }>(
    "/content/globals/faq-page",
    { locale },
  );
  if (!response.ok) return null;
  if (!response.data.available) return { fields: {} };
  return response.data.content && typeof response.data.content.fields === "object"
    ? response.data.content
    : null;
});
export function faqPageMetadata(
  locale: string,
  content: FaqPageData | null,
  hasAnswers: boolean,
  filtered: boolean,
): Metadata {
  const seo = content?.seo;
  const title = seo?.metaTitle || FAQ_PAGE_DEFAULTS.seo.metaTitle;
  const description = seo?.metaDescription || FAQ_PAGE_DEFAULTS.seo.metaDescription;
  const canonical = seo?.canonicalUrl || absoluteUrl(`/${locale}/faq`);
  const enabled = isIndexingEnabled() && content !== null;
  return {
    title,
    description,
    keywords: seo?.keywords,
    alternates: { canonical },
    robots: {
      index: enabled && locale === "en" && !filtered && hasAnswers && (seo?.robotsIndex ?? true),
      follow: enabled && (seo?.robotsFollow ?? true),
    },
    openGraph: {
      type: "website",
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: canonical,
    },
    twitter: {
      card: seo?.twitterCardType ?? "summary",
      title: seo?.twitterTitle || title,
      description: seo?.twitterDescription || description,
    },
  };
}
export function faqInSitemap(locale: string, content: FaqPageData | null): boolean {
  if (content === null || locale !== "en" || content.seo?.robotsIndex === false) return false;
  const canonical = content.seo?.canonicalUrl;
  return !canonical || canonical === absoluteUrl(`/${locale}/faq`);
}
