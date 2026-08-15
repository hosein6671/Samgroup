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
import { SiteNav } from "@/features/site/site-nav";

import { ContactHero } from "./sections/hero";
import { InquirySection } from "./sections/inquiry-section";

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
  inquiryType,
  lockInquiryType = false,
  product = null,
}: {
  readonly copy: FormHeading;
  readonly inquiryType: string;
  readonly lockInquiryType?: boolean;
  /** Resolved by the route from `?product=`, or null when the form was opened without one. */
  readonly product?: ProductContext | null;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <ContactHero />

        <InquirySection
          copy={copy}
          inquiryType={inquiryType}
          lockInquiryType={lockInquiryType}
          product={product}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
