import { ANCHORS } from "../quality-anchors";

import type { QualityCertificationsSection } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 4 · Certifications — SITE_STRUCTURE §7's `[TO CONFIRM]`, and the reason this page is described at
 * source as the platform's highest-stakes page for accuracy.
 *
 * ── What is not here, and cannot be ─────────────────────────────────────────
 *
 * No certificate. No standard. No licence. No accreditation. No issuing body, number or validity
 * date. No mark, no logo, no greyed-out slot, no card grid with pending states, no count of how many
 * are expected.
 *
 * None of that is filtered out here — **none of it exists to filter**. The Payload
 * `certifications` group holds five localized strings and no array; `QualityCertificationsSection`
 * types five strings and no array; the API projection reads five strings and iterates nothing. This
 * component receives an object it cannot build a list from.
 *
 * That chain matters more than it looks. This Global is writable by a Content Manager under the
 * ordinary company-page rule, and SECURITY.md's RBAC matrix says a Content Manager may **never**
 * publish a certification. Those two facts stay compatible only while the schema cannot hold one.
 *
 * ── Why the section renders at all ──────────────────────────────────────────
 *
 * Because the platform points here. About Us's quality footnote, SITE_STRUCTURE §2 and §7 all send a
 * reader to this page for exactly this list. Omitting the section entirely would leave the question
 * open at the one address given for answering it, and a reader who is told nothing answers it by
 * assuming.
 *
 * ── The status is words, never a colour ─────────────────────────────────────
 *
 * `status` is real text in the document — "withheld", "unconfirmed", whatever the editor publishes,
 * in the reader's own language. The mark beside it is `aria-hidden` and is a hairline ring rather
 * than a filled badge: gold is the flagship's interactive colour, and a filled gold mark beside the
 * word "withheld" would read as something to click. Nothing about the state is carried by colour
 * alone (WCAG 1.4.1).
 */
export function QualityCertifications({
  certifications,
}: {
  readonly certifications: QualityCertificationsSection;
}): ReactNode {
  const { eyebrow, heading, status, statement, note } = certifications;

  return (
    <section className="fs-sec qc-certs" id={ANCHORS.certifications} data-surface="light">
      <div className="fs-wrap qc-certs-inner reveal-fade-rise">
        {eyebrow !== null && <p className="fs-eyebrow">{eyebrow}</p>}

        {(heading !== null || status !== null) && (
          <div className="qc-certs-body">
            {heading !== null && <h2 className="fs-d3">{heading}</h2>}

            {status !== null && (
              <p className="qc-certs-status">
                <span className="qc-certs-dot" aria-hidden="true" />
                {status}
              </p>
            )}
          </div>
        )}

        {statement !== null && <p className="qc-certs-statement">{statement}</p>}
        {note !== null && <p className="qc-certs-note">{note}</p>}
      </div>
    </section>
  );
}
