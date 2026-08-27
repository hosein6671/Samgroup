import Image from "next/image";
import type { ReactNode } from "react";

import "../home/flagship.css";
import "./export-logistics.css";

import { Arrow } from "@/features/site/logo-mark";
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

export function ExportLogisticsExperience({ locale, locales }: SiteNavProps): ReactNode {
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
              <div className="fs-eyebrow">Export and logistics</div>
              <h1 className="fs-d1">Plan the product and the shipment in the same conversation.</h1>
              <p className="fs-lead">
                A useful export enquiry combines the selected product with quantity, packaging,
                destination, and preferred trade terms.
              </p>
              <div className="el-actions">
                <a className="fs-btn fs-btn--gold" href={localeHref(locale, ROUTES.requestQuote)}>
                  Discuss an export requirement <Arrow />
                </a>
                <a className="fs-btn fs-btn--glass" href="#packaging">
                  View packaging options
                </a>
              </div>
            </div>
            <figure className="el-hero-media">
              <Image
                src="/images/home/network-export-logistics.png"
                alt="Petroleum product logistics planning with containers and industrial packaging"
                fill
                priority
                sizes="(max-width: 900px) calc(100vw - 40px), 44vw"
              />
              <figcaption>Product · packaging · destination · trade term</figcaption>
            </figure>
          </div>
        </section>

        <section className="fs-sec el-brief" data-surface="light">
          <div className="fs-wrap el-brief-grid">
            <div>
              <div className="fs-eyebrow">Start with a complete brief</div>
              <h2 className="fs-d2">Five details make an export enquiry reviewable.</h2>
              <p className="fs-lead">
                Share what is already known. Unknown fields can be clarified without turning an
                assumption into a commercial term.
              </p>
            </div>
            <dl className="el-brief-list">
              {BRIEF_FIELDS.map(([term, detail], index) => (
                <div key={term}>
                  <dt>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {term}
                  </dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="fs-sec el-route" data-surface="midnight">
          <div className="fs-wrap">
            <SectionHead
              eyebrow="From requirement to delivery"
              title="A clear path from enquiry to shipment."
            >
              The sequence keeps technical, commercial, and shipment decisions connected. A step
              moves forward only with the information relevant to it.
            </SectionHead>
            <ol className="el-route-list">
              {DELIVERY_STEPS.map(([title, body], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fs-sec el-packaging" id="packaging" data-surface="light">
          <div className="fs-wrap">
            <SectionHead
              eyebrow="Flexible shipping and packaging"
              title="Packaging selected around product and route."
            >
              Available formats depend on the selected product, quantity, loading requirements, and
              destination. Availability is confirmed for the enquiry rather than assumed.
            </SectionHead>
            <div className="el-pack-grid">
              {PACKAGING.map(([title, body]) => (
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
              <div className="fs-eyebrow">Incoterms and commercial scope</div>
              <h2 className="fs-d2">State the trade term early.</h2>
              <p className="fs-lead">
                Indicate EXW, FOB, CFR, CIF, or “not sure” in the enquiry. The quotation should name
                the applicable Incoterm and place or port; payment terms and lead time are confirmed
                separately.
              </p>
            </div>
            <dl className="el-term-list">
              {INCOTERMS.map(([term, meaning]) => (
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
              <div className="fs-eyebrow">Preparing an export enquiry?</div>
              <h2 className="fs-d2">
                Send the grade, volume, packaging, destination, and Incoterm.
              </h2>
            </div>
            <div className="el-close-actions">
              <a className="fs-btn fs-btn--gold" href={localeHref(locale, ROUTES.requestQuote)}>
                Request export terms <Arrow />
              </a>
              <a className="fs-btn fs-btn--outline" href={localeHref(locale, ROUTES.products)}>
                Review products
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
