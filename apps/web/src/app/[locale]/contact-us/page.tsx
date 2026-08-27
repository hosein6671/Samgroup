import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FORM_HEADINGS } from "@/features/contact/contact-data";
import { ContactTemplate } from "@/features/contact/contact-template";
import { resolveProductContext, single } from "@/features/contact/resolve-product-context";
import {
  DEFAULT_INQUIRY_TYPE,
  SAMPLE_INQUIRY_TYPE,
  isInquiryType,
} from "@/features/forms/inquiry-vocabulary";
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

/**
 * **No `robots`** — `app/[locale]/layout.tsx` declares `index: false, follow: false` for this whole
 * tree. **No canonical, no `hreflang`, no JSON-LD** — §14 specifies `ContactPage` structured data
 * for this URL and the shared `<JsonLd>` component FRONTEND_ARCHITECTURE §4 specifies does not
 * exist; adding it here would be the SEO gate arriving early, and a `ContactPage` schema carrying no
 * address or telephone would be an empty claim besides.
 */
export const metadata: Metadata = {
  title: "Contact SAM Group | Product & Quote Enquiries",
  description:
    "Send a product question, quotation request, sample request, or documentation enquiry with the details needed for review.",
};

export default async function ContactUsPage({
  params,
  searchParams,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const locales = await getActiveLocales();

  const requestedType = single(query.type);
  const inquiryType = isInquiryType(requestedType)
    ? (requestedType as string)
    : DEFAULT_INQUIRY_TYPE;

  const product = await resolveProductContext(single(query.product), locale);

  return (
    <ContactTemplate
      locales={locales}
      locale={locale}
      copy={inquiryType === SAMPLE_INQUIRY_TYPE ? FORM_HEADINGS.sample : FORM_HEADINGS.general}
      inquiryType={inquiryType}
      product={product}
    />
  );
}
