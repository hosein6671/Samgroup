import { VisuallyHidden } from "@sam-group/ui";
import type { ReactNode } from "react";

import { DOCUMENT_TIERS, DOWNLOAD_FIELDS } from "../products-data";

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
 * ── Why the form is disabled rather than wired to nothing ────────────────────
 *
 * There is no submission endpoint until M4. A form that accepts input and silently discards it is
 * worse than no form: it teaches a real buyer that they have made contact when they have not. So
 * the `<fieldset>` carries a real `disabled` attribute — every control drops out of the tab order
 * and out of submission at the platform level, not by styling — and a notice above the fields
 * says so before anyone starts typing. No fake success state, no `preventDefault` theatre.
 */
export function Documentation(): ReactNode {
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

              {tier.kind === "gated" && <DownloadGate />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The qualifying form, in its visual state only.
 *
 * Fields are exactly the set the approved `DownloadRequest` entity records — name, company,
 * country, email, consent — and no more. Every extra field on a lead form is a field the lead
 * does not fill in.
 */
function DownloadGate(): ReactNode {
  return (
    <>
      <p className="pr-inert">
        <span aria-hidden="true">◇</span>
        <span>
          <strong>Not connected.</strong> This is the design proof — the form is shown in its
          finished visual state and is deliberately inoperative. Submission endpoints arrive with
          the backend work; nothing typed here would be sent or stored.
        </span>
      </p>

      <fieldset className="pr-gate-fieldset" disabled>
        <VisuallyHidden as="legend">Request the catalogue</VisuallyHidden>

        <div className="pr-gate">
          {DOWNLOAD_FIELDS.map((field) => (
            <div className="fs-field" key={field.name}>
              <label htmlFor={`dl-${field.name}`}>{field.label}</label>
              <input
                id={`dl-${field.name}`}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
              />
            </div>
          ))}
        </div>

        <div className="pr-consent">
          <input id="dl-consent" name="consent" type="checkbox" />
          <label htmlFor="dl-consent">
            I agree to be contacted about this request and accept the privacy policy.
          </label>
        </div>

        <div className="fs-cta-actions">
          <button type="button" className="fs-btn fs-btn--gold">
            Download catalogue
          </button>
        </div>
      </fieldset>
    </>
  );
}
