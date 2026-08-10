import type { ReactNode } from "react";

import { ANCHORS, PROCESS_STEPS } from "../solutions-data";

/**
 * 3 · Our Customization Process — SITE_STRUCTURE §5's third section.
 *
 * ── Six names, and the discipline of stopping there ─────────────────────────
 *
 * The six steps are transcribed from `docs/technology/FRONTEND_STACK.md`, the only document that
 * enumerates them: Understand → Develop → Test → Approve → Produce → Deliver. Payload's
 * `customizationProcess` array specifies a `description` beside each `title`; none is written, so
 * none is printed. The rail says so once, in the note under it, rather than repeating an
 * apology under each of six names.
 *
 * A step whose description is invented here would be inventing a commitment about how this
 * business develops a formulation — the same class of content as an invented lead time.
 *
 * ── No timeline ─────────────────────────────────────────────────────────────
 *
 * SITE_STRUCTURE §5 gives the process an indicative timeline and marks it `[ESTIMATE — CONFIRM]`
 * in the same breath. It is not here, in any form: not in the data module, not in this component,
 * not as a rounded-off version of itself. The note states that timings are not published, without
 * restating the figures it is declining to publish.
 *
 * ── The drawing ─────────────────────────────────────────────────────────────
 *
 * A rail, not six cards. Six equal cards would say the steps are alternatives; they are a
 * sequence, and each one only begins because the one before it finished. So they run as a single
 * connected line with the connector drawn between the markers, and the numbering carries the
 * order rather than a decorative index.
 *
 * FRONTEND_ARCHITECTURE §8 reserves GSAP + ScrollTrigger for this component. **It is not used
 * here**, by decision: GSAP is not a dependency of `apps/web`, adding one needs approval, and the
 * scroll-choreographed treatment it was reserved for is a sequence of six *descriptions* — which
 * is the content this page does not have yet. The rail reveals with the design system's
 * scroll-driven CSS instead, which costs no JavaScript at all. When the descriptions are approved
 * and the animated treatment is commissioned, this is the component it applies to.
 */
export function CustomizationProcess(): ReactNode {
  return (
    <section className="fs-sec cs-process" id={ANCHORS.process} data-surface="light">
      <div className="fs-wrap">
        <header className="cs-process-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Our customization process</p>
            <h2 className="fs-d2">Six stages, in order.</h2>
          </div>
          {/*
            Deliberately says nothing about which stage issues the sample.

            The sampling policy is documented — SITE_STRUCTURE §7 confirms a sample is issued at
            the first stage, before commitment — and the introduction states it. Which of these
            six named stages that corresponds to is *not* documented anywhere, and pinning it to
            one would be inventing the mapping. So the sequence is described as a sequence.
          */}
          <p className="fs-lead">
            Each stage completes before the next begins. What is below is the sequence itself — the
            detail of what any one stage involves is answered against a stated requirement.
          </p>
        </header>

        <ol className="cs-rail reveal-stagger">
          {PROCESS_STEPS.map((step, i) => (
            <li className="cs-step" key={step.id}>
              <span className="cs-step-num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="cs-step-name">{step.name}</h3>
              {/*
                Optional and unset in every step today — see `solutions-data.ts`. The branch is
                here so that approving the copy is a fixture edit and not a component change.
              */}
              {step.note && <p className="cs-step-note">{step.note}</p>}
            </li>
          ))}
        </ol>

        <p className="cs-process-note reveal-fade-rise">
          <span aria-hidden="true">◇</span>
          <span>
            Stage descriptions and indicative timings are not published here. Both are pending
            confirmation, and an unconfirmed schedule on this page would read as a commitment.
            Timings for a specific requirement are given in response to a request.
          </span>
        </p>
      </div>
    </section>
  );
}
