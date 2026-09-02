import { VisuallyHidden } from "@sam-group/ui";

import { StepCompleteIcon } from "./icons";
import { REVIEW_STEP_LABEL, type WizardStep } from "./wizard-steps";

import type { ReactNode } from "react";

/**
 * The shared step indicator.
 *
 * ── Semantics before styling ────────────────────────────────────────────────
 *
 * An ordered list inside a labelled `nav`, one item per step, each carrying its number, its short
 * label and its state. Three states exist and all three are announced rather than only drawn:
 *
 *   - **current** — `aria-current="step"`, the one WAI-ARIA attribute that means this
 *   - **completed** — a visually-hidden "completed" after the label, because a tick mark and a
 *     brass fill are colour and shape, and neither is available to a screen reader
 *   - **upcoming** — `disabled`, so it is announced as unavailable rather than silently doing
 *     nothing when activated
 *
 * `totalProgress` is rendered as text — "Step 2 of 3" — and not left to be inferred from counting
 * list items. It is the sentence a screen-reader user actually needs, and it is also what makes the
 * indicator comprehensible at 320px where the labels are at their smallest.
 *
 * ── Why the steps are buttons and not links ─────────────────────────────────
 *
 * They move between panels of a form that has not been submitted; there is no address to link to,
 * and giving them one would put an unsent form's state in the URL. `type="button"` is explicit on
 * every one of them, because a bare `<button>` inside a `<form>` defaults to `type="submit"` — the
 * single most common way a wizard submits itself when someone clicks a step number.
 *
 * ── Backwards only ─────────────────────────────────────────────────────────
 *
 * A completed step is reachable; an upcoming one is not. Jumping forward would skip the validation
 * "Next" performs, which is the only thing keeping a visitor from arriving at the review with three
 * empty required fields and no idea which ones. `onNavigate` is only ever called for an index the
 * visitor has already passed.
 */
export function StepIndicator({
  steps,
  activeIndex,
  furthestIndex,
  onNavigate,
  idPrefix,
}: {
  readonly steps: readonly WizardStep[];
  /** The step being shown. `steps.length` addresses the review step. */
  readonly activeIndex: number;
  /** The furthest step reached so far — everything up to it is navigable. */
  readonly furthestIndex: number;
  readonly onNavigate: (index: number) => void;
  readonly idPrefix: string;
}): ReactNode {
  /* The review step is appended here rather than stored, so no form has to declare it. */
  const entries = [
    ...steps.map((step) => ({ id: step.id, label: step.label })),
    { id: "review", label: REVIEW_STEP_LABEL },
  ];

  const total = entries.length;
  const activeLabel = entries[activeIndex]?.label ?? "";

  return (
    <nav className="fw-progress" aria-label="Form progress">
      {/*
       * The progress sentence, and the element that announces a step change.
       *
       * `aria-live="polite"` rather than a focus move for the announcement: focus goes to the new
       * panel's heading (the shell does that), and moving focus is not itself an announcement of
       * where in the sequence the visitor now is. The two are complementary.
       */}
      <p className="fw-progress-count" aria-live="polite">
        <span className="fs-tnum">
          Step {activeIndex + 1} of {total}
        </span>
        <span className="fw-progress-current">{activeLabel}</span>
      </p>

      <ol className="fw-progress-list">
        {entries.map((entry, index) => {
          const state = index === activeIndex ? "current" : index < furthestIndex ? "done" : "todo";
          const reachable = index < activeIndex || index <= furthestIndex;

          return (
            <li key={entry.id} data-state={state}>
              <button
                type="button"
                className="fw-progress-step"
                id={`${idPrefix}-step-tab-${entry.id}`}
                aria-current={index === activeIndex ? "step" : undefined}
                disabled={!reachable || index === activeIndex}
                onClick={() => onNavigate(index)}
              >
                {/*
                 * A completed step swaps its numeral for a tick; current and upcoming steps keep
                 * theirs. The tick is the visual half of the completed state — the fill and the
                 * brass border are the other half, and the word "completed" below is what carries
                 * it to assistive technology. Colour is never the only signal (WCAG 1.4.1).
                 *
                 * The numeral is `aria-hidden` because the position is already announced: the
                 * progress sentence says "Step 2 of 3", and the list is ordered.
                 */}
                <span className="fw-progress-num fs-tnum" aria-hidden="true">
                  {state === "done" ? (
                    <StepCompleteIcon size="sm" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="fw-progress-label">{entry.label}</span>
                {state === "done" && <VisuallyHidden> completed</VisuallyHidden>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
