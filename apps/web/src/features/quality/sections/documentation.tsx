import type { ReactNode } from "react";

import { ANCHORS, DOCUMENTATION } from "../quality-data";

/**
 * 5 · Documentation We Provide — SITE_STRUCTURE §7's "COA/TDS/SDS/Certificate of Origin/commercial
 * docs/loading photos".
 *
 * ── Not a download list, and composed so it cannot be read as one ───────────
 *
 * Six document names under a heading, on a website, are read as six files. Nothing here is a link,
 * nothing carries an access state, and `ProvidedDocument` has no `href` field to give one — the
 * category template's register carries an open/gated split because the Products landing owns a
 * download gate, and this page owns none. Whether any of these six can be obtained from this site
 * is unconfirmed, so the note says exactly that rather than leaving the register to imply an
 * answer.
 *
 * ── One scope line, on one document ─────────────────────────────────────────
 *
 * SITE_STRUCTURE §2 states the certificate of analysis is issued per batch, so that granularity
 * has a document behind it. §7 names the other five and says nothing about what each is issued
 * against, so they carry a name and no more. The category template's documentation section already
 * had one claim removed for going further than the source in precisely this way.
 */
export function QualityDocumentation(): ReactNode {
  return (
    <section className="fs-sec qc-docs" id={ANCHORS.documentation} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-docs-grid">
        <div className="qc-docs-copy reveal-fade-rise">
          <p className="fs-eyebrow">Documentation we provide</p>
          <h2 className="fs-d2">{DOCUMENTATION.heading}</h2>
          <p className="fs-lead">{DOCUMENTATION.lead}</p>

          <p className="qc-docs-note">{DOCUMENTATION.note}</p>
        </div>

        <div className="qc-docs-register">
          <p className="qc-docs-head">
            <span>{DOCUMENTATION.registerLabel}</span>
            <span className="fs-tnum">
              {String(DOCUMENTATION.documents.length).padStart(2, "0")}
            </span>
          </p>

          <ol className="qc-doclist reveal-stagger">
            {DOCUMENTATION.documents.map((document, i) => (
              <li className="qc-doc" key={document.id}>
                <span className="qc-doc-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>

                <span className="qc-doc-body">
                  <b>{document.name}</b>
                  {document.scope && <small>{document.scope}</small>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
