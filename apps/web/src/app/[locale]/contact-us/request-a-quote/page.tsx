import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FORM_HEADINGS } from "@/features/contact/contact-data";
import { ContactTemplate } from "@/features/contact/contact-template";
import { resolveProductContext, single } from "@/features/contact/resolve-product-context";
import { QUOTE_INQUIRY_TYPE } from "@/features/forms/inquiry-vocabulary";
import { getPrivacyPolicyHref } from "@/features/legal/privacy-policy";
import { structuralAlternates, localePath } from "@/features/seo/alternates";
import { JsonLd } from "@/features/seo/json-ld";
import { absoluteUrl } from "@/features/seo/site";
import { webPageJsonLd } from "@/features/seo/structured-data";
import { ROUTES } from "@/features/site/site-routes";
import { getActiveLocales } from "@/lib/locales";

/**
 * This route had **no `generateMetadata` at all**, so it inherited the locale layout's site-wide
 * block and emitted no title, no description and — the defect that mattered — no canonical.
 *
 * A canonical is load-bearing here specifically: the route accepts `?product=`, so the Product
 * Detail page's "Request a Quote" CTA generates a distinct URL per product for what is one page.
 * Without a canonical each of those is a separate document to a crawler. The canonical points at
 * the clean, parameter-free URL, which is SEO_ARCHITECTURE.md §7's rule for exactly this shape.
 */
const TITLE = "Request a Product Quote | SAM Group";
const DESCRIPTION =
  "Request commercial terms by sharing the product or grade, quantity, packaging, destination, and preferred Incoterm.";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = absoluteUrl(localePath(locale, ROUTES.requestQuote));

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: structuralAlternates(locale, ROUTES.requestQuote),
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: TITLE,
      description: DESCRIPTION,
      url: canonical,
      locale,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

/**
 * The Request a Quote route — `/{locale}/contact-us/request-a-quote`.
 *
 * SITE_STRUCTURE §0 describes it exactly as this file implements it: "Defined — pre-filtered
 * Inquiry form". It is a child of Contact Us in the sitemap and it is a child of it here, it posts
 * to the same `POST /inquiries`, and it writes the same `Inquiry` row. The only difference from the
 * parent route is that `inquiryType` is fixed rather than chosen — this page's identity *is* the
 * type, so a control offering to change it would offer to make the page something else.
 *
 * Fixed, not merely defaulted: the type travels in a hidden input, and the API validates it against
 * the same seven-value enum as every other submission. A tampered hidden field is a 400 naming
 * `inquiryType`, never a mis-filed lead.
 *
 * `?product=` behaves exactly as on the parent route, and the Product Detail page's "Request a
 * Quote" CTA is what sets it.
 */

export default async function RequestAQuotePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [locales, privacyPolicyHref] = await Promise.all([
    getActiveLocales(),
    getPrivacyPolicyHref(locale),
  ]);

  const product = await resolveProductContext(single(query.product), locale);

  /*
   * No `directory` is passed, and that is unchanged behaviour: this route's subject is one focused
   * quotation request, and the contact-channel block belongs to the parent Contact Us page. The
   * consent label links the policy here on exactly the same condition as everywhere else.
   */
  return (
    <>
      <JsonLd
        data={webPageJsonLd({
          url: absoluteUrl(localePath(locale, ROUTES.requestQuote)),
          name: TITLE,
          description: DESCRIPTION,
          locale,
        })}
      />
      <ContactTemplate
        locales={locales}
        locale={locale}
        copy={FORM_HEADINGS.quote}
        inquiryType={QUOTE_INQUIRY_TYPE}
        lockInquiryType
        privacyPolicyHref={privacyPolicyHref}
        product={product}
      />
    </>
  );
}
