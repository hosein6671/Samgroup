import { Suspense } from "react";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FORM_HEADINGS } from "@/features/contact/contact-data";
import { ContactTemplate } from "@/features/contact/contact-template";
import {
  ContactDirectorySection,
  ContactDirectorySkeleton,
} from "@/features/contact/sections/contact-directory-section";
import { resolveProductContext, single } from "@/features/contact/resolve-product-context";
import { JsonLd, type JsonLdObject } from "@/features/seo/json-ld";
import {
  DEFAULT_INQUIRY_TYPE,
  SAMPLE_INQUIRY_TYPE,
  isInquiryType,
} from "@/features/forms/inquiry-vocabulary";
import { getPrivacyPolicyHref } from "@/features/legal/privacy-policy";
import { structuralAlternates, localePath } from "@/features/seo/alternates";
import { absoluteUrl, organizationId } from "@/features/seo/site";
import { ROUTES } from "@/features/site/site-routes";
import { getActiveLocales } from "@/lib/locales";

/**
 * The Contact Us route — `/{locale}/contact-us`.
 *
 * ── The route is the sitemap's, unchanged ───────────────────────────────────
 *
 * SITE_STRUCTURE §0 fixes `/contact-us` and `/contact-us/request-a-quote`, and `site-routes.ts`
 * already declared both. Nothing new is invented here: this file makes the first of the two resolve,
 * and `request-a-quote/page.tsx` the second. **There is no `/request-sample` route and there must
 * not be** — the approved merge (SITE_STRUCTURE "Request Sample Form — RESOLVED") makes a sample
 * request an `Inquiry`, so the sample flow is this same route with the type preselected.
 *
 * ── Two query parameters, both optional, neither trusted ────────────────────
 *
 * `?type=` preselects the inquiry type and is checked against the seven-value vocabulary before it
 * is used — an unrecognised value falls back to the default rather than being passed through, so a
 * hand-edited URL cannot put an unknown option into the control. It is also only ever a *default*:
 * the `<select>` stays enabled on this route and the visitor may change it.
 *
 * `?product=` names a product slug and is resolved server-side into the id and name the form
 * carries. Every failure resolves to no context rather than to an error — see
 * `resolveProductContext`.
 *
 * The pairing that matters is the Product Detail page's "Request Sample" CTA, which links here with
 * both parameters set. That is the whole of the sample flow's mechanism.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment belongs to `app/[locale]/layout.tsx`, which generates it from the `Locale`
 * table and closes it with `dynamicParams = false`. This route introduces no dynamic segment of its
 * own. It is dynamic regardless: it reads `searchParams`, and the product lookup beneath it is
 * `cache: "no-store"`.
 */

const TITLE = "Contact SAM Group | Product & Quote Enquiries";
const DESCRIPTION =
  "Send a product question, quotation request, sample request, or documentation enquiry with the details needed for review.";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = absoluteUrl(localePath(locale, ROUTES.contactUs));

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: structuralAlternates(locale, ROUTES.contactUs),
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: TITLE,
      description: DESCRIPTION,
      url: canonical,
      locale,
      images: [
        {
          url: "/images/home/cta-technical-conversation.webp",
          width: 1672,
          height: 941,
          alt: "A technical sales discussion about a petroleum product requirement",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: ["/images/home/cta-technical-conversation.webp"],
    },
  };
}

export default async function ContactUsPage({
  params,
  searchParams,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  /*
   * The contact channels are deliberately NOT awaited here. They are read inside
   * `ContactDirectorySection`, behind the `Suspense` boundary below, so a slow or stopped CMS
   * delays neither the page shell nor the enquiry form — the one route on this page that reaches a
   * person, and the one that needs no CMS at all.
   */
  const [locales, privacyPolicyHref] = await Promise.all([
    getActiveLocales(),
    getPrivacyPolicyHref(locale),
  ]);

  const requestedType = single(query.type);
  const inquiryType = isInquiryType(requestedType)
    ? (requestedType as string)
    : DEFAULT_INQUIRY_TYPE;

  const product = await resolveProductContext(single(query.product), locale);

  const absoluteUrl_ = absoluteUrl(localePath(locale, ROUTES.contactUs));
  const schema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${absoluteUrl_}#contactpage`,
    url: absoluteUrl_,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: locale,
    about: { "@id": organizationId() },
  };

  /*
   * The `Organization` node moved into `ContactDirectorySection` with the values it is assembled
   * from. Only `ContactPage` is emitted here, because only it can be written without reading the
   * CMS — and structured data is not worth blocking a page render on.
   */
  return (
    <>
      <JsonLd data={schema} />
      <ContactTemplate
        locales={locales}
        locale={locale}
        copy={inquiryType === SAMPLE_INQUIRY_TYPE ? FORM_HEADINGS.sample : FORM_HEADINGS.general}
        inquiryType={inquiryType}
        privacyPolicyHref={privacyPolicyHref}
        product={product}
        directory={
          <Suspense fallback={<ContactDirectorySkeleton />}>
            <ContactDirectorySection locale={locale} />
          </Suspense>
        }
      />
    </>
  );
}
