import {
  structuralList,
  structuralSection,
  type StructuralFields,
} from "@/features/content/structural-copy";
import Image from "next/image";
import type { ReactNode } from "react";

import "../home/flagship.css";
import "./export-logistics.css";

import { Arrow, LogoMark } from "@/features/site/logo-mark";
import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";
import { localeHref, ROUTES } from "@/features/site/site-routes";

const BRIEF_FIELDS = [
  ["Product", "Product family, grade, or application"],
  ["Quantity", "Required volume or order estimate"],
  ["Packaging", "Preferred format or handling constraint"],
  ["Destination", "Country and named port or place"],
  ["Trade term", "EXW, FOB, CFR, CIF, or not sure"],
] as const;

const DELIVERY_STEPS = [
  ["Identify", "Confirm the product family, grade, and intended application."],
  ["Review", "Check the available technical information and required documents."],
  ["Define", "Record quantity, packaging, destination, and handling requirements."],
  ["Align", "State the preferred Incoterm and named place or port."],
  ["Confirm", "Document the commercial scope returned for review."],
  ["Prepare", "Coordinate order information and applicable shipment documents."],
  ["Dispatch", "Align loading and dispatch details against the confirmed brief."],
  ["Handover", "Provide the applicable shipment-document set."],
] as const;

const PACKAGING = [
  ["Bulk", "For requirements assessed around tank and route compatibility."],
  ["Flexitank", "A containerised bulk option, subject to product and route review."],
  ["Drums", "A defined industrial format for palletised or container loading."],
  ["IBC", "Intermediate bulk format where product and destination allow."],
  ["Pails", "Smaller industrial packs for selected product requirements."],
  ["Retail packs", "Pack configuration assessed against product and market brief."],
] as const;

const INCOTERMS = [
  ["EXW", "Buyer arranges collection from the named place after the goods are made available."],
  ["FOB", "Seller delivers the goods on board at the named port of shipment."],
  [
    "CFR",
    "Seller arranges cost and freight to the named destination port; risk transfers earlier.",
  ],
  ["CIF", "CFR scope with the contractually applicable cargo insurance arranged by the seller."],
] as const;

export function ExportLogisticsExperience({
  locale,
  locales,
  editorial,
}: SiteNavProps & { readonly editorial?: StructuralFields }): ReactNode {
  const copy = structuralSection("export-logistics", "page", editorial);

  const isEnglishRoute = locale === "en";
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />
      <main id="main-content" {...(!isEnglishRoute && { lang: "en", dir: "ltr" })}>
        {!isEnglishRoute && (
          <p className="el-fallback-note" role="note">
            This page has not been translated into this language. It is shown in English.
          </p>
        )}

        <section className="el-hero" data-surface="midnight">
          <div className="fs-wrap el-hero-grid">
            <div className="el-hero-copy">
              <div className="fs-eyebrow">{copy.text("export_and_logistics")}</div>
              <h1 className="fs-d1">{copy.text("plan_the_product_and_the")}</h1>
              <p className="fs-lead">{copy.text("a_useful_export_enquiry_combines")}</p>
              <div className="el-actions">
                <a className="fs-btn fs-btn--gold" href={localeHref(locale, ROUTES.requestQuote)}>
                  {copy.text("discuss_an_export_requirement")}
                  <Arrow />
                </a>
                <a className="fs-btn fs-btn--glass" href="#packaging">
                  {copy.text("view_packaging_options")}
                </a>
              </div>
            </div>
            <figure className="el-hero-media">
              <Image
                src="/images/home/network-export-logistics.webp"
                alt={copy.text("petroleum_product_logistics_planning_with")}
                fill
                priority
                sizes="(max-width: 900px) calc(100vw - 40px), 44vw"
              />
              <span className="fs-photo-brand" aria-hidden="true">
                <LogoMark height={18} />
                <span>SAM GROUP</span>
              </span>
              <figcaption>{copy.text("product_packaging_destination_trade_term")}</figcaption>
            </figure>
          </div>
        </section>

        <section className="fs-sec el-brief" data-surface="light">
          <div className="fs-wrap el-brief-grid">
            <div>
              <div className="fs-eyebrow">{copy.text("start_with_a_complete_brief")}</div>
              <h2 className="fs-d2">{copy.text("five_details_make_an_export")}</h2>
              <p className="fs-lead">{copy.text("share_what_is_already_known")}</p>
            </div>
            <dl className="el-brief-list">
              {structuralList(editorial, "brief_fields", BRIEF_FIELDS).map(
                ([term, detail], index) => (
                  <div key={term}>
                    <dt>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {term}
                    </dt>
                    <dd>{detail}</dd>
                  </div>
                ),
              )}
            </dl>
          </div>
        </section>

        <section className="fs-sec el-route" data-surface="midnight">
          <div className="fs-wrap">
            <SectionHead
              eyebrow={copy.text("from_requirement_to_delivery")}
              title={copy.text("a_clear_path_from_enquiry")}
            >
              {copy.text("the_sequence_keeps_technical_commercial")}
            </SectionHead>
            <ol className="el-route-list">
              {structuralList(editorial, "delivery_steps", DELIVERY_STEPS).map(
                ([title, body], index) => (
                  <li key={title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </li>
                ),
              )}
            </ol>
          </div>
        </section>

        <section className="fs-sec el-packaging" id="packaging" data-surface="light">
          <div className="fs-wrap">
            <SectionHead
              eyebrow={copy.text("flexible_shipping_and_packaging")}
              title={copy.text("packaging_selected_around_product_and")}
            >
              {copy.text("available_formats_depend_on_the")}
            </SectionHead>
            <div className="el-pack-grid">
              {structuralList(editorial, "packaging", PACKAGING).map(([title, body]) => (
                <article key={title}>
                  <span aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fs-sec el-terms" data-surface="midnight">
          <div className="fs-wrap el-terms-grid">
            <div className="el-terms-copy">
              <div className="fs-eyebrow">{copy.text("incoterms_and_commercial_scope")}</div>
              <h2 className="fs-d2">{copy.text("state_the_trade_term_early")}</h2>
              <p className="fs-lead">{copy.text("indicate_exw_fob_cfr_cif")}</p>
            </div>
            <dl className="el-term-list">
              {structuralList(editorial, "incoterms", INCOTERMS).map(([term, meaning]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="fs-sec el-close" data-surface="light">
          <div className="fs-wrap el-close-grid">
            <div>
              <div className="fs-eyebrow">{copy.text("preparing_an_export_enquiry")}</div>
              <h2 className="fs-d2">{copy.text("send_the_grade_volume_packaging")}</h2>
            </div>
            <div className="el-close-actions">
              <a className="fs-btn fs-btn--gold" href={localeHref(locale, ROUTES.requestQuote)}>
                {copy.text("request_export_terms")}
                <Arrow />
              </a>
              <a className="fs-btn fs-btn--outline" href={localeHref(locale, ROUTES.products)}>
                {copy.text("review_products")}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="el-section-head">
      <div>
        <div className="fs-eyebrow">{eyebrow}</div>
        <h2 className="fs-d2">{title}</h2>
      </div>
      <p>{children}</p>
    </div>
  );
}
