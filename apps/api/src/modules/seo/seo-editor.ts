/** Ordinary SEO fields; image ownership and structured data have separate write workflows. */
export type EditableSeo = {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterCardType?: "summary" | "summary_large_image";
  robotsIndex: boolean;
  robotsFollow: boolean;
  keywords: string[];
};
