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
 * **No step description is rendered, because none exists.** The Global models a step as a name
 * alone; when descriptions are written they are a field and a line here, not a redesign.
 */
export function CustomizationProcess({
  process,
}: {
  readonly process: CustomizedSolutionsProcess;
}): ReactNode {
  return (
    <section className="fs-sec cs-process" id={ANCHORS.process} data-surface="light">
      <div className="fs-wrap">
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
                <span className="cs-step-num">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="cs-step-name">{step.name}</h3>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
