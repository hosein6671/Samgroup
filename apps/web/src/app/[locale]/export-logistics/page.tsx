import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ExportLogisticsExperience } from "@/features/export-logistics/export-logistics-experience";
import { structuralAlternates, localePath } from "@/features/seo/alternates";
import { JsonLd } from "@/features/seo/json-ld";
import { absoluteUrl } from "@/features/seo/site";
import { webPageJsonLd } from "@/features/seo/structured-data";
import { ROUTES } from "@/features/site/site-routes";
import { getActiveLocales } from "@/lib/locales";

const TITLE = "Petroleum Product Export & Logistics | SAM Group";
const DESCRIPTION =
  "Prepare a product enquiry with quantity, packaging, destination, and Incoterm for a clearer export and logistics conversation.";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  /*
   * The canonical was `/${locale}/export-logistics` — a site-relative string that Next resolved
   * against `metadataBase`, so the rendered tag was correct but the value was not the same string
   * the sitemap and the JSON-LD `@id` are built from. It now comes from the one helper all three
   * use. No `hreflang`: this page's copy is code-owned English in all three locales, and annotating
   * it as a Persian or Arabic version would be a false signal — see `features/seo/alternates.ts`.
   */
  const canonical = absoluteUrl(localePath(locale, ROUTES.exportLogistics));
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: structuralAlternates(locale, ROUTES.exportLogistics),
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: TITLE,
      description: DESCRIPTION,
      url: canonical,
      locale,
      images: [
        {
          url: "/images/home/network-export-logistics.webp",
          width: 1672,
          height: 941,
          alt: "SAM Group export and logistics planning for petroleum products",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: ["/images/home/network-export-logistics.webp"],
    },
  };
}

export default async function ExportLogisticsPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  const locales = await getActiveLocales();
  const url = absoluteUrl(localePath(locale, ROUTES.exportLogistics));

  return (
    <>
      <JsonLd data={webPageJsonLd({ url, name: TITLE, description: DESCRIPTION, locale })} />
      <ExportLogisticsExperience locale={locale} locales={locales} />
    </>
  );
}
