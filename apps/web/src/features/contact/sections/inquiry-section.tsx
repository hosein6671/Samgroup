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
  product = null,
}: {
  readonly copy: FormHeading;
  readonly inquiryType: string;
  readonly lockInquiryType?: boolean;
  readonly product?: ProductContext | null;
}): ReactNode {
  return (
    <section className="fs-sec ct-form" id={ANCHORS.form} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap ct-form-inner">
        <header className="ct-form-head reveal-fade-rise">
          <p className="fs-eyebrow">{copy.eyebrow}</p>
          <h2 className="fs-d2">{copy.heading}</h2>
          <p className="fs-lead">{copy.lead}</p>
        </header>

        <div className="ct-form-panel reveal-fade-rise">
          <InquiryForm
            inquiryType={inquiryType}
            lockInquiryType={lockInquiryType}
            product={product}
          />
        </div>
      </div>
    </section>
  );
}
