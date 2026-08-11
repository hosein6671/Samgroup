import type { ReactNode } from "react";

import { ANCHORS, CERTIFICATIONS } from "../quality-data";

/**
 * 4 · Certifications — SITE_STRUCTURE §7's `[TO CONFIRM]`, and the reason this page is described
 * at source as the platform's highest-stakes page for accuracy.
 *
 * ── What is not here ────────────────────────────────────────────────────────
 *
 * No certificate. No standard. No licence. No accreditation. No issuing body, number or validity
 * date. No mark, no logo, no greyed-out slot, no card grid with pending states, no count of how
 * many are expected. Not one of those exists as a field in `quality-data.ts` either, so none can
 * be added here by filling something in.
 *
 * A grid of six empty certificate cards would publish the *shape* of a certification claim, and a
 * reader counts empty slots. The source document is emphatic that no placeholder certification is
 * ever published; the shape of one is still one.
 *
 * ── Why the section renders at all ──────────────────────────────────────────
 *
 * Because the platform points here. About Us's quality footnote, SITE_STRUCTURE §2 and §7 all send
 * a reader to this page for exactly this list. Omitting the section entirely would leave the
 * question open at the one address given for answering it, and a reader who is told nothing
 * answers it by assuming.
 *
 * ── Why it is composed as it is ─────────────────────────────────────────────
 *
 * A full band, deliberately quiet, holding one statement on a narrow measure. The emptiness is the
 * design: this is the only section on the page that says less than its heading promises, and the
 * composition is built so that reads as a decision rather than as an unfinished layout. The status
 * marker is a hairline chip, not a badge — gold is the flagship's interactive colour, and a filled
 * gold mark beside the word "withheld" would read as something to click.
 */
export function QualityCertifications(): ReactNode {
  return (
    <section className="fs-sec qc-certs" id={ANCHORS.certifications} data-surface="light">
      <div className="fs-wrap qc-certs-inner reveal-fade-rise">
        <p className="fs-eyebrow">{CERTIFICATIONS.eyebrow}</p>

        <div className="qc-certs-body">
          <h2 className="fs-d3">{CERTIFICATIONS.heading}</h2>

          <p className="qc-certs-status">
            <span className="qc-certs-dot" aria-hidden="true" />
            {CERTIFICATIONS.status}
          </p>
        </div>

        <p className="qc-certs-statement">{CERTIFICATIONS.statement}</p>
        <p className="qc-certs-note">{CERTIFICATIONS.note}</p>
      </div>
    </section>
  );
}
