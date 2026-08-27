import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ExportLogisticsExperience } from "@/features/export-logistics/export-logistics-experience";
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
  const canonical = `/${locale}/export-logistics`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: TITLE,
      description: DESCRIPTION,
      url: canonical,
      locale,
      images: [
        {
          url: "/images/home/network-export-logistics.png",
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
      images: ["/images/home/network-export-logistics.png"],
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
  return <ExportLogisticsExperience locale={locale} locales={locales} />;
}
