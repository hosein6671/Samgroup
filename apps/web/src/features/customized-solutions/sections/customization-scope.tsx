import type { CustomizedSolutionsCapability } from "@sam-group/types";
import type { ReactNode } from "react";

export function CustomizationScope({
  capabilities,
}: {
  readonly capabilities: readonly CustomizedSolutionsCapability[];
}): ReactNode {
  return (
    <section className="fs-sec cs-scope" data-surface="light">
      <div className="fs-wrap cs-scope-grid">
        <header className="cs-scope-head reveal-fade-rise">
          <p className="fs-eyebrow">Requirement scope</p>
          <h2 className="fs-d2">Define what needs to change—and what must stay fixed.</h2>
          <p className="fs-lead">
            Start with the dimensions that matter to your application. Availability and the review
            route are confirmed against the complete brief.
          </p>
        </header>
        <ol className="cs-scope-list reveal-stagger">
          {capabilities.map((capability, index) => (
            <li key={capability.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{capability.title}</h3>
                {capability.description !== null && <p>{capability.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
