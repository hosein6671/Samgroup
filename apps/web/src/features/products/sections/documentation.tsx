import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { DOCUMENT_TIERS } from "../products-data";

/**
 * 4 · Documentation and catalogue access.
 *
 * ── The gate is narrow on purpose, and that is a decision, not an omission ───
 *
 * SITE_STRUCTURE §3 summarises this block as "TDS/SDS/COA download, gated behind a short
 * qualifying form". The approved data-model decision is narrower and states the opposite for two
 * of those three: gating covers the Company Catalogue and Product Catalogue **only**, and "TDS
 * and SDS are explicitly not gated" — a form in front of a viscosity table costs more than the
 * lead is worth (DATA_MODEL.md §DOWNLOAD_REQUEST; DATA_MODEL_GAP_REVIEW.md §5). CLAUDE.md §1
 * ranks the data model above SITE_STRUCTURE, so this block splits into two tiers accordingly.
 * The conflict is reported, not resolved in passing.
 *
 * Catalogue access still has no dedicated DownloadRequest endpoint. The page therefore sends the
 * buyer to the working enquiry route instead of presenting a disabled or silently inert form.
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
          inside a panel, and the panel is the gate. That also settles a composition problem the
          equal-card version had: the open tier holds three documents and the gated tier holds two
          plus a form, so boxing both left one box short and floating. An open list has no edge to
          look short against, and the columns are sized to the content rather than split evenly.
        */}
        <div className="pr-tiers">
          {DOCUMENT_TIERS.map((tier) => (
            <div className={`pr-tier pr-tier--${tier.kind} reveal-fade-rise`} key={tier.heading}>
              <p className="fs-eyebrow">{tier.kind === "gated" ? "Qualified access" : "Open"}</p>
              <h3>{tier.heading}</h3>
              <p className="pr-tier-note">{tier.note}</p>

              <ul className="pr-doclist">
                {tier.items.map((item) => (
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
