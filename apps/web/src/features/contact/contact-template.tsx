import type { ReactNode } from "react";

/*
 * The same two-stylesheet arrangement the other feature templates use: `flagship.css` declares the
 * brand scope and the shared `.fs-*` primitives every control here is drawn with, `forms.css` holds
 * the submission-form constructions shared with Customized Solutions, and `contact.css` holds this
 * page's own.
 */
import "../home/flagship.css";
import "../forms/forms.css";
import "./contact.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { ContactHero } from "./sections/hero";
import { InquirySection } from "./sections/inquiry-section";
import { ContactPathways } from "./sections/pathways";

import type { FormHeading } from "./contact-data";
import type { ProductContext } from "@/features/forms/inquiry-form";

/**
 * The Contact Us template — one component behind both `/contact-us` and
 * `/contact-us/request-a-quote`.
 *
 * The two routes differ in three values, all passed in: the heading copy, the preselected
 * `inquiryType`, and whether the type control is shown at all. They are the same page otherwise,
 * and duplicating it would mean two files to keep in step for one form.
 *
 * ── A short page, and the reason is stated where the copy is ────────────────
 *
 * Hero, form. Five of SITE_STRUCTURE §10's seven sections are absent because every one of them is
 * contact details the project has not confirmed — `contact-data.ts` records that in full. This is
 * the honest rendering of what exists, and it is also the clearest possible signal of what still
 * has to be supplied before this page can launch.
 */
export function ContactTemplate({
  copy,
  directory = null,
  inquiryType,
  locale,
  locales,
  lockInquiryType = false,
  privacyPolicyHref = null,
  product = null,
}: {
  readonly copy: FormHeading;
  /**
   * The contact-channel directory, supplied by the route as a node rather than as data.
   *
   * It arrives already wrapped in its own `Suspense` boundary so the CMS read behind it cannot
   * delay the hero or the enquiry form, and it is a **node** so a route that has no directory to
   * show — `/contact-us/request-a-quote`, which is the same template with the type fixed — simply
   * passes nothing instead of taking on a data dependency it does not use.
   */
  readonly directory?: ReactNode;
  readonly inquiryType: string;
  /** The route locale segment, forwarded to the shared chrome — see `SiteNavProps`. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  readonly lockInquiryType?: boolean;
  /** The published Privacy Policy's address, or `null` when none is published. */
  readonly privacyPolicyHref?: string | null;
  /** Resolved by the route from `?product=`, or null when the form was opened without one. */
  readonly product?: ProductContext | null;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <ContactHero />
        <ContactPathways locale={locale} />
        {directory}

        <InquirySection
          copy={copy}
          inquiryType={inquiryType}
          lockInquiryType={lockInquiryType}
          privacyPolicyHref={privacyPolicyHref}
          product={product}
        />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
