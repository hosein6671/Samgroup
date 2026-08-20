import { ANCHORS } from "../quality-anchors";

import type { QualityDocumentation } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 5 · Documentation We Provide — SITE_STRUCTURE §7's "COA/TDS/SDS/Certificate of Origin/commercial
 * docs/loading photos".
 *
 * ── Not a download list, and composed so it cannot become one ───────────────
 *
 * Document names under a heading, on a website, are read as files. **Nothing here is a link**: no
 * `<a>` is rendered, nothing carries an access state, and `QualityDocument` has no `href` and no
 * file to give one — nor does the Payload `documents` array, which models a name and an optional
 * scope. The category template's register carries an open/gated split because the Products landing
 * owns a download gate; this page owns none, and whether any of these can be obtained from this site
 * is unconfirmed.
 *
 * The note that says so is CMS content and is rendered in every language the page is published in.
 * It is the one line that keeps the register from reading as a download list, so it renders whenever
 * an editor has written it.
 *
 * ── Scope lines are per-document and optional ───────────────────────────────
 *
 * SITE_STRUCTURE §2 states the certificate of analysis is issued per batch, so that granularity has
 * a document behind it; §7 names the others and says nothing about what each is issued against. The
 * field is optional for exactly that reason — the category template's documentation section already
 * had one claim removed for going further than the source in precisely this way.
 *
 * ── The eyebrow is CMS copy, and there is no English fallback for it ────────
 *
 * It rendered as a hardcoded English string until the eyebrow correction, and now comes from
 * `documentation.eyebrow` in the Global, localized like every other string here. An unwritten
 * eyebrow renders nothing — see `sections/approach.tsx` for the reasoning.
 */
export function QualityDocumentationSection({
  documentation,
}: {
  readonly documentation: QualityDocumentation;
}): ReactNode {
  const { eyebrow, heading, lead, registerLabel, documents, note } = documentation;

  return (
    <section className="fs-sec qc-docs" id={ANCHORS.documentation} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-docs-grid">
        <div className="qc-docs-copy reveal-fade-rise">
          {eyebrow !== null && <p className="fs-eyebrow">{eyebrow}</p>}
          {heading !== null && <h2 className="fs-d2">{heading}</h2>}
          {lead !== null && <p className="fs-lead">{lead}</p>}
          {note !== null && <p className="qc-docs-note">{note}</p>}
        </div>

        {documents.length > 0 && (
          <div className="qc-docs-register">
            {registerLabel !== null && (
              <p className="qc-docs-head">
                <span>{registerLabel}</span>
                <span className="fs-tnum">{String(documents.length).padStart(2, "0")}</span>
              </p>
            )}

            <ol className="qc-doclist reveal-stagger">
              {documents.map((document, i) => (
                <li className="qc-doc" key={document.name}>
                  <span className="qc-doc-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>

                  <span className="qc-doc-body">
                    <b>{document.name}</b>
                    {document.scope !== null && <small>{document.scope}</small>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
