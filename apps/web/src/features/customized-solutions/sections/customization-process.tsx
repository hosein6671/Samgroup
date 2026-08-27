import { ANCHORS } from "../solutions-anchors";

import type { CustomizedSolutionsProcess } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The customization process — the stages, in order.
 *
 * An ordered list, because the numbers beside each stage are its position rather than decoration: a
 * screen reader announces the same sequence a sighted reader sees, and the numbering comes from the
 * list rather than from a stored field that could disagree with it.
 *
 * The section's anchor is `ANCHORS.process` — structural, code-owned, and the target the hero's step
 * index links to.
 *
 * Step descriptions are claim-controlled editorial copy. They explain what information changes at
 * each stage without promising timing, availability or an outcome.
 */
export function CustomizationProcess({
  process,
}: {
  readonly process: CustomizedSolutionsProcess;
}): ReactNode {
  return (
    <section className="fs-sec cs-process" id={ANCHORS.process} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap cs-process-inner">
        <header className="cs-process-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Our customization process</p>
            {process.heading !== null && <h2 className="fs-d2">{process.heading}</h2>}
          </div>
          {process.lead !== null && <p className="fs-lead">{process.lead}</p>}
        </header>

        {process.steps.length > 0 && (
          <ol className="cs-rail reveal-stagger">
            {process.steps.map((step, index) => (
              <li className="cs-step" key={step.name}>
                <div className="cs-step-topline">
                  <span className="cs-step-num">{String(index + 1).padStart(2, "0")}</span>
                  <span className="cs-step-status" aria-hidden="true" />
                </div>
                <div className="cs-step-copy">
                  <h3 className="cs-step-name">{step.name}</h3>
                  {step.description !== null && <p className="cs-step-note">{step.description}</p>}
                </div>
                {index < process.steps.length - 1 && (
                  <span className="cs-step-arrow" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
