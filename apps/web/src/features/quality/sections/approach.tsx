import type { ReactNode } from "react";

import { ANCHORS, APPROACH } from "../quality-data";

/**
 * 2 · Our Quality Approach — SITE_STRUCTURE §7's "Incoming/In-Process/Outgoing testing stages".
 *
 * ── Three stages and nothing inside them ────────────────────────────────────
 *
 * The source names the stages and describes none of them. So each stage here carries its name and
 * one line saying where in the material's passage it sits — which is the meaning the stage's own
 * name already carries, not a description of what is done there. `quality-data.ts` records the
 * reasoning at length; the short version is that elaborating a quality stage is writing a
 * procedure, and no document in this project authorises one.
 *
 * The footnote says so on the page. A reader shown three stage names will otherwise fill in the
 * contents themselves.
 *
 * ── Why it is drawn as a chain rather than three cards ──────────────────────
 *
 * Three cards would present the stages as parallel options. They are not: they are consecutive,
 * and the whole claim of the section is the sequence. So the stages sit on a single rule with the
 * ordinals marking positions along it, and the rule is a hairline rather than an arrow — the page
 * is stating an order, not animating a process.
 */
export function QualityApproach(): ReactNode {
  return (
    <section className="fs-sec qc-approach" id={ANCHORS.approach} data-surface="light">
      <div className="fs-wrap">
        <header className="qc-approach-head reveal-fade-rise">
          <p className="fs-eyebrow">Our quality approach</p>
          <h2 className="fs-d2">{APPROACH.heading}</h2>
          <p className="fs-lead">{APPROACH.lead}</p>
        </header>

        <ol className="qc-stages reveal-stagger">
          {APPROACH.stages.map((stage, i) => (
            <li className="qc-stage" key={stage.id}>
              <span className="qc-stage-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="qc-stage-name">{stage.name}</h3>
              <p className="qc-stage-when">{stage.when}</p>
            </li>
          ))}
        </ol>

        <p className="qc-approach-foot reveal-fade-rise">{APPROACH.footnote}</p>
      </div>
    </section>
  );
}
