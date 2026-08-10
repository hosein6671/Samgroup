import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

import type { SectionProps } from "../category-section";

/**
 * 10 · Documentation — SITE_STRUCTURE §4 item 10.
 *
 * ── Not the landing page's block, and not a copy of it ──────────────────────
 *
 * The frozen Products landing carries the platform-level documentation block: two tiers, and the
 * qualifying form for the catalogue. Repeating that here would put a second dead form on the
 * site and say nothing this page does not already imply.
 *
 * A category page's version of the question is narrower and more useful: *which documents exist
 * for these grades, and what is each one about?* So this is a document register — three
 * documents, each with the scope it is issued at — plus a single line pointing at the one thing
 * that is gated, on the page that owns the gate.
 *
 * ── The access split is a resolved conflict, restated ───────────────────────
 *
 * SITE_STRUCTURE §3 describes documentation as "TDS/SDS/COA download, gated behind a short
 * qualifying form". The approved data model says the opposite for all three: gating covers the
 * Company and Product catalogues only, and "TDS and SDS are explicitly not gated"
 * (DATA_MODEL.md §`DOWNLOAD_REQUEST`, DATA_MODEL_GAP_REVIEW.md §5). CLAUDE.md §1 ranks the data
 * model higher, the frozen landing already implements that resolution, and this page follows it.
 *
 * ── One claim was removed here ──────────────────────────────────────────────
 *
 * An earlier revision printed "Issued against each of the N designations published above",
 * derived from `catalogueRows`. The count was accurate; the statement was not approved.
 * SITE_STRUCTURE §7 confirms COA, TDS and SDS are provided and says nothing about the granularity
 * one is issued at — so asserting one document per designation went further than the source. Each
 * document now states only what §7 supports, and the COA's per-batch scope, which §7 does state.
 */
export function CategoryDocumentation({ content }: SectionProps): ReactNode {
  const { documentation } = content;

  return (
    <section className="fs-sec pc-docs" id="documentation" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pc-docs-grid">
        <div className="pc-docs-copy reveal-fade-rise">
          <p className="fs-eyebrow">Documentation</p>
          <h2 className="fs-d2">{documentation.heading}</h2>
          <p className="fs-lead">{documentation.intro}</p>
        </div>

        <ol className="pc-doc-register reveal-stagger">
          {documentation.documents.map((document) => (
            <li className="pc-doc" key={document.code} data-access={document.access}>
              <span className="pc-doc-code">{document.code}</span>

              <span className="pc-doc-body">
                <b>{document.label}</b>
                <small>{document.scope}</small>
              </span>

              <span className="pc-doc-access">
                {document.access === "open" ? "No form" : "Qualified"}
              </span>
            </li>
          ))}

          {/*
            The gated tier gets one line and a link rather than a second copy of the landing's
            form. One gate, one place, one form to build when the endpoint exists.
          */}
          <li className="pc-doc pc-doc--pointer">
            <span className="pc-doc-code" aria-hidden="true">
              ◇
            </span>

            <span className="pc-doc-body">
              <b>Catalogues</b>
              <small>{documentation.note}</small>
            </span>

            <a className="pc-doc-link" href={ROUTES.documentation}>
              Open
              <Arrow size={13} />
            </a>
          </li>
        </ol>
      </div>
    </section>
  );
}
