import { ANCHORS } from "../quality-anchors";

import type { QualityApproach } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 2 · Our Quality Approach — SITE_STRUCTURE §7's "Incoming/In-Process/Outgoing testing stages".
 *
 * ── Three stages and nothing inside them ────────────────────────────────────
 *
 * The source names the stages and describes none of them. So each stage carries its name and one
 * line saying where in the material's passage it sits — which is the meaning the stage's own name
 * already carries, not a description of what is done there. The Payload Global models exactly those
 * two fields and no third: elaborating a quality stage is writing a procedure, and no document in
 * this project authorises one.
 *
 * The footnote says so on the page, and it is a CMS field for the same reason the stages are —
 * a reader shown three stage names will otherwise fill in the contents themselves, in whichever
 * language they are reading.
 *
 * ── Why it is drawn as a chain rather than three cards ──────────────────────
 *
 * Three cards would present the stages as parallel options. They are not: they are consecutive, and
 * the whole claim of the section is the sequence. So the stages sit on a single rule with the
 * ordinals marking positions along it, and the rule is a hairline rather than an arrow — the page is
 * stating an order, not animating a process.
 *
 * ── The eyebrow is CMS copy, and there is no English fallback for it ────────
 *
 * It rendered as a hardcoded English string until the eyebrow correction. That was wrong on a page
 * served in `en`, `fa` and `ar`: an eyebrow is a visible line of page copy naming the band a reader
 * is in, not layout, so a Persian or Arabic reader met an English label above translated content.
 *
 * It now comes from `approach.eyebrow` in the Global, localized like every other string here. **No
 * fallback string exists in this component** — an unwritten eyebrow renders nothing, because
 * reverting to English is precisely the behaviour that was removed. The heading below it is
 * unaffected either way, so the hierarchy does not move.
 */
export function QualityApproach({ approach }: { readonly approach: QualityApproach }): ReactNode {
  const { eyebrow, heading, lead, stages, footnote } = approach;

  return (
    <section className="fs-sec qc-approach" id={ANCHORS.approach} data-surface="light">
      <div className="fs-wrap">
        {(eyebrow !== null || heading !== null || lead !== null) && (
          <header className="qc-approach-head reveal-fade-rise">
            {eyebrow !== null && <p className="fs-eyebrow">{eyebrow}</p>}
            {heading !== null && <h2 className="fs-d2">{heading}</h2>}
            {lead !== null && <p className="fs-lead">{lead}</p>}
          </header>
        )}

        {stages.length > 0 && (
          <ol className="qc-stages reveal-stagger">
            {stages.map((stage, i) => (
              <li className="qc-stage" key={stage.name}>
                <span className="qc-stage-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="qc-stage-name">{stage.name}</h3>
                <p className="qc-stage-when">{stage.when}</p>
              </li>
            ))}
          </ol>
        )}

        {footnote !== null && <p className="qc-approach-foot reveal-fade-rise">{footnote}</p>}
      </div>
    </section>
  );
}
