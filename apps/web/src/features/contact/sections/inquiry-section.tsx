import type { ReactNode } from "react";

import { InquiryForm, type ProductContext } from "@/features/forms/inquiry-form";

import { ANCHORS, type FormHeading } from "../contact-data";

/**
 * 2 · The inquiry form, in its panel.
 *
 * A Server Component that renders one Client Component. That is the boundary FRONTEND_ARCHITECTURE
 * §Data fetching asks for: the heading, the panel and the surface are server-rendered, and only the
 * part that has to react to a submission is not. The product context was resolved by the route
 * before this rendered — this section passes it through and fetches nothing itself.
 *
 * **This section is the page's terminal content.** There is no closing CTA below it, because every
 * closing CTA on the platform points here; rendering one would link the page to itself, the same
 * reasoning `custom-request-form.tsx` states for its own page.
 */
export function InquirySection({
  copy,
  inquiryType,
  lockInquiryType = false,
  privacyPolicyHref = null,
  product = null,
}: {
  readonly copy: FormHeading;
  readonly inquiryType: string;
  readonly lockInquiryType?: boolean;
  /**
   * The published Privacy Policy's address, or `null` when none is published. Resolved by the route
   * and passed straight through — the form is a Client Component and cannot read the API itself.
   */
  readonly privacyPolicyHref?: string | null;
  readonly product?: ProductContext | null;
}): ReactNode {
  return (
    <section className="fs-sec ct-form" id={ANCHORS.form} data-surface="light">
      <div className="fs-wrap ct-form-inner">
        <div className="ct-form-intro">
          <header className="ct-form-head reveal-fade-rise">
            <p className="fs-eyebrow">{copy.eyebrow}</p>
            <h2 className="fs-d3">{copy.heading}</h2>
            <p className="fs-lead">{copy.lead}</p>
          </header>

          <aside className="ct-brief" aria-labelledby="ct-brief-title">
            <p className="ct-brief-label" id="ct-brief-title">
              Useful details
            </p>
            <ul>
              <li>Product, grade, or application</li>
              <li>Required quantity and packaging</li>
              <li>Destination country or port</li>
              <li>Specification or preferred Incoterm</li>
            </ul>
            <p>Share only what is known. Missing details can be clarified during review.</p>
          </aside>
        </div>

        <div className="ct-form-panel reveal-fade-rise" data-surface="midnight">
          <InquiryForm
            inquiryType={inquiryType}
            lockInquiryType={lockInquiryType}
            privacyPolicyHref={privacyPolicyHref}
            product={product}
          />
        </div>
      </div>
    </section>
  );
}
