import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { DOCUMENT_TIERS } from "../products-data";

/**
 * 5 · Technical-data trust, and catalogue access.
 *
 * ── What changed, and why ────────────────────────────────────────────────────
 *
 * This section used to promise TDS/SDS/COA as open PDF downloads — a claim transcribed from
 * SITE_STRUCTURE §3 that no part of the platform has ever implemented. The Products and structured
 * technical-data workstream built the real mechanism: approved Specification rows render as
 * structured values directly on a Product's own page, and there is deliberately no public PDF
 * route. `DOCUMENT_TIERS`' own doc comment in `products-data.ts` records the correction in full,
 * including a second one made after the first shipped: a bare paragraph left the open tier
 * visibly thinner than the gated panel beside it, so it now renders `fields` — the real six-column
 * structure of the table it is describing — through the same `.pr-doclist` construction the gated
 * tier's own document list already uses, rather than a second list style for a second kind of list.
 *
 * ── The gate is narrow on purpose, and that is a decision, not an omission ───
 *
 * The gated Catalogue tier is unrelated to per-grade technical data and is unaffected by the
 * correction above: gating covers the Company Catalogue and Product Catalogue **only**
 * (DATA_MODEL.md §DOWNLOAD_REQUEST; DATA_MODEL_GAP_REVIEW.md §5), and catalogue access still has
 * no dedicated DownloadRequest endpoint — the page sends the buyer to the working enquiry route
 * instead of presenting a disabled or silently inert form.
 */
export function Documentation({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec pr-docs" id="documentation" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pr-docs-inner">
        <header className="pr-docs-head reveal-fade-rise">
          <p className="fs-eyebrow">Documentation</p>
          <h2 className="fs-d2">Specifications first, forms second.</h2>
        </header>

        {/*
          The two tiers are deliberately unlike each other, not two equal cards.

          The open tier has no container at all — it sits directly on the section, because that is
          what "no gate" looks like when you draw it. The gated tier is the only thing on the page
          inside a panel, and the panel is the gate.
        */}
        <div className="pr-tiers">
          {DOCUMENT_TIERS.map((tier) => (
            <div className={`pr-tier pr-tier--${tier.kind} reveal-fade-rise`} key={tier.heading}>
              <p className="fs-eyebrow">{tier.kind === "gated" ? "Qualified access" : "Open"}</p>
              <h3>{tier.heading}</h3>
              <p className="pr-tier-note">{tier.note}</p>

              <ul className="pr-doclist">
                {(tier.kind === "gated" ? tier.items : tier.fields).map((item) => (
                  <li key={item.label}>
                    {item.label}
                    <span>{item.meta}</span>
                  </li>
                ))}
              </ul>

              {tier.kind === "gated" && <CatalogueRoute locale={locale} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The honest route to catalogue access until the dedicated DownloadRequest contract is shipped.
 */
function CatalogueRoute({ locale }: { readonly locale: string }): ReactNode {
  return (
    <div className="pr-catalogue-route">
      <p>
        Share your company, market, and product interest through the enquiry route. Catalogue access
        can then be handled against a reviewable business request.
      </p>
      <a href={localeHref(locale, ROUTES.contactUs)} className="fs-btn fs-btn--gold">
        Request catalogue access
        <Arrow size={15} />
      </a>
    </div>
  );
}
