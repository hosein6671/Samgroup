import { EditIcon } from "./icons";
import { reviewEntries, type WizardStep } from "./wizard-steps";

import type { ReactNode } from "react";

/**
 * The review step's summary — what is about to be sent, grouped by the step it came from.
 *
 * ── Read from the form, not from state ──────────────────────────────────────
 *
 * `reviewEntries` reads the live `<form>` through `FormData`, which is the same object the Server
 * Action receives. The summary therefore cannot disagree with the payload: there is no second copy
 * of the answers to fall out of sync, and no controlled-input layer was added to produce one.
 *
 * ── Every group has an Edit action ──────────────────────────────────────────
 *
 * One per step rather than one per field. A visitor who spots a wrong company name wants to be back
 * in the step that owns it with the field focused, and per-field edit buttons would put a control
 * between every row of a list whose job is to be read quickly. The button names the step it returns
 * to, so its accessible name is never a bare "Edit".
 *
 * ── Empty optional fields are shown, not hidden ─────────────────────────────
 *
 * A blank optional field renders as "Not provided" rather than being dropped. Omitting it would
 * make the summary a list of what was filled in, which is a different question from what is about
 * to be sent — and the second one is what a review is for.
 *
 * Nothing here invents content: every label comes from the form's own field definitions and every
 * value is what the visitor typed.
 */
export function ReviewSummary({
  form,
  steps,
  fieldLabels,
  onEdit,
  idPrefix,
}: {
  /** The live form element. `null` before the ref attaches, which renders nothing. */
  readonly form: HTMLFormElement | null;
  readonly steps: readonly WizardStep[];
  readonly fieldLabels: Readonly<Record<string, string>>;
  readonly onEdit: (index: number) => void;
  readonly idPrefix: string;
}): ReactNode {
  if (form === null) return null;

  return (
    <div className="fw-review">
      {steps.map((step, index) => {
        const entries = reviewEntries(form, step, fieldLabels);

        if (entries.length === 0) return null;

        const headingId = `${idPrefix}-review-${step.id}`;

        return (
          <section className="fw-review-group" key={step.id} aria-labelledby={headingId}>
            <header className="fw-review-head">
              <h4 className="fw-review-title" id={headingId}>
                {step.heading}
              </h4>
              <button type="button" className="fw-review-edit" onClick={() => onEdit(index)}>
                <EditIcon size="sm" />
                Edit
                {/*
                 * The step name is in the accessible name but not repeated visually — three
                 * buttons reading "Edit contact details", "Edit request details" would crowd a
                 * summary whose headings already say which is which.
                 */}
                <span className="fw-sr-only"> {step.heading}</span>
              </button>
            </header>

            <dl className="fw-review-list">
              {entries.map((entry) => (
                <div className="fw-review-row" key={entry.name}>
                  <dt>{entry.label}</dt>
                  <dd data-empty={entry.empty ? "true" : undefined}>
                    {entry.empty ? "Not provided" : entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
