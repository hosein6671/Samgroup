import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

/**
 * What this section needs from the page rendering it.
 *
 * Same split `ClosingCtaProps` already established: `locale` is required so no call site can
 * render a locale-less link, `productSlug` stays optional because this section (like the closing
 * CTA) is reused nowhere that lacks one today, but the type should not assume that stays true.
 */
export type ProductTechnicalDocumentsProps = {
  /** The route's own locale segment, threaded down from `ProductDetailTemplate`. */
  readonly locale: string;
  /** The product's own slug, as `GET /products/:slug` returned it in this locale. */
  readonly productSlug?: string;
};

/**
 * The enquiry this CTA opens, and the one it deliberately does not.
 *
 * ── Why `?type=product_inquiry`, and not a new value ────────────────────────
 *
 * `INQUIRY_TYPE_OPTIONS` is a closed, seven-value vocabulary the API enforces (`inquiry-
 * vocabulary.ts`); nothing here may add an eighth. "Request technical documents" is not its own
 * kind of contact — it is a buyer asking a question about a specific product, which is exactly
 * what `product_inquiry` ("Product inquiry") already means. Reusing it is a correct semantic fit,
 * not an overload: the alternative, `general_inquiry`, would have discarded the one fact this CTA
 * actually knows (which product) in its very own preselection.
 *
 * `?type=` only ever sets the form's default — `ContactUsPage` validates it against the
 * vocabulary and leaves the `<select>` enabled, exactly as it does for the existing "Request
 * Sample" and "Request a Quote" CTAs this one is modelled on.
 *
 * ── Why this reaches Contact Us and not a document endpoint ─────────────────
 *
 * There is no `DownloadRequest`/document-delivery endpoint on the platform (`products-data.ts`'s
 * own note on the unrelated, still-gated Company/Product Catalogue makes the same point). This
 * link opens the same Inquiry form the sample and quote CTAs open, with `?product={slug}` carrying
 * the same server-resolved context (`resolveProductContext`) that renders "This enquiry
 * references **{name}**" above the form — so the destination visibly identifies the product
 * without this page ever claiming a document is attached or ready to fetch.
 */
const TECHNICAL_DOCUMENT_INQUIRY_TYPE = "product_inquiry";

function requestHref(locale: string, productSlug: string | undefined): string {
  const path = localeHref(locale, ROUTES.contactUs);
  const type = `type=${TECHNICAL_DOCUMENT_INQUIRY_TYPE}`;

  if (productSlug === undefined) {
    return `${path}?${type}`;
  }

  return `${path}?${type}&product=${encodeURIComponent(productSlug)}`;
}

export function ProductTechnicalDocuments({
  locale,
  productSlug,
}: ProductTechnicalDocumentsProps): ReactNode {
  const documents = [
    {
      code: "TDS",
      title: "Technical Data Sheet",
      detail:
        "Use the current issued sheet to review published properties, test methods and product guidance.",
    },
    {
      code: "SDS",
      title: "Safety Data Sheet",
      detail:
        "Use the market-applicable sheet for hazards, handling, storage, transport and emergency information.",
    },
    {
      code: "COA",
      title: "Certificate of Analysis",
      detail:
        "Where supplied, the batch document reports the tested results associated with that batch.",
    },
  ] as const;

  return (
    <section className="fs-sec pd-docs" data-surface="midnight" id="technical-documents">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap pd-docs-inner">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Technical documents</p>
          <h2 className="fs-d2">Review the issued document, not an assumption.</h2>
          <p className="fs-lead">
            Request the current document set for the product, market and batch context relevant to
            your enquiry.
          </p>
        </header>
        <div className="pd-document-grid reveal-stagger">
          {documents.map((document) => (
            <article key={document.code}>
              <span>{document.code}</span>
              <h3>{document.title}</h3>
              <p>{document.detail}</p>
            </article>
          ))}
        </div>

        {/*
          Visually secondary by design — `.fs-btn--glass`, the same restrained variant the hero
          uses for its own non-primary action on this identical midnight surface, never gold.
          "Request technical documents" names what happens next (a conversation), not what this
          page has (a file): no document is attached, generated, or implied to already exist.
        */}
        <p className="pd-docs-cta reveal-fade-rise">
          <a href={requestHref(locale, productSlug)} className="fs-btn fs-btn--glass">
            Request technical documents
            <Arrow size={15} />
          </a>
        </p>
      </div>
    </section>
  );
}
