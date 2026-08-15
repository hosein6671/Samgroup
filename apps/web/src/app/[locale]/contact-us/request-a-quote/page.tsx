import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FORM_HEADINGS } from "@/features/contact/contact-data";
import { ContactTemplate } from "@/features/contact/contact-template";
import { resolveProductContext, single } from "@/features/contact/resolve-product-context";
import { QUOTE_INQUIRY_TYPE } from "@/features/forms/inquiry-vocabulary";

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

/** Same inheritance and same omissions as the parent route — see its note. */
export const metadata: Metadata = {
  title: "Request a Quote — Sam Group",
  description:
    "Ask for a quotation on a published grade. Give the grade, the quantity and the destination.",
};

export default async function RequestAQuotePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  const product = await resolveProductContext(single(query.product), locale);

  return (
    <ContactTemplate
      copy={FORM_HEADINGS.quote}
      inquiryType={QUOTE_INQUIRY_TYPE}
      lockInquiryType
      product={product}
    />
  );
}
