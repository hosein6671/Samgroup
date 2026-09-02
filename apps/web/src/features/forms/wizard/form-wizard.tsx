"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FormStatus, formKey } from "../form-feedback";

import { BackIcon, ContinueIcon } from "./icons";
import { ReviewSummary } from "./review-summary";
import { StepIndicator } from "./step-indicator";
import {
  REVIEW_STEP_HEADING,
  firstInvalidStep,
  isReviewStep,
  totalSteps,
  type WizardStep,
} from "./wizard-steps";

import type { SubmissionState } from "../submission-state";
import type { ReactNode } from "react";

/**
 * The shared three-step shell behind every public customer-inquiry form.
 *
 * ── What it owns, and why that list is the whole point ──────────────────────
 *
 * The owner decision is that every public inquiry form is the same experience. So this component
 * owns the step state, the indicator, the navigation, per-step validation, focus movement, the
 * Enter-key guard, the review summary and the placement of consent and Turnstile. A form supplies
 * its steps, its fields and its submit copy — nothing behavioural. Two forms cannot diverge on any
 * of the above, because neither implements any of it.
 *
 * It also owns the `<form>` element. That is deliberate: the Enter guard, the per-step validation
 * and the review's `FormData` read all need the form node, and handing it to the shell is what
 * stops each caller from wiring three refs correctly.
 *
 * ── Values survive navigation because nothing unmounts ──────────────────────
 *
 * Every panel stays in the DOM and inactive ones carry `hidden`. Fields are uncontrolled, so what
 * the visitor typed is held by the browser, exactly as it was before this shell existed — which is
 * also what keeps the form working before hydration. No controlled-input layer was added, and no
 * browser storage: the repository has none for forms and this gate does not introduce any.
 *
 * `hidden` rather than unmounting is what makes "Back preserves everything" true by construction
 * rather than by a save/restore step that can be wrong.
 *
 * ── Validation is per step, and only per step ───────────────────────────────
 *
 * "Next" checks the controls inside the current panel and nothing else. It uses `checkValidity()`
 * to find the first invalid control, focuses it, and only then calls `reportValidity()` on that one
 * control — so the browser's message appears attached to a field that is actually focused, rather
 * than on whichever control the platform picked. Back never validates.
 *
 * ── Enter neither submits nor navigates ─────────────────────────────────────
 *
 * Owner decision: Enter in an ordinary control does nothing. It does not submit, and it does not
 * advance. Textareas keep it as a newline, focused buttons keep native activation, and every step
 * change happens through the explicit Back and Continue controls.
 *
 * This is enforced here rather than by omitting a submit button, because "there is no submit button
 * on this step" is an implicit-submission rule that varies with the number of controls in the form
 * and is not something to rely on. Only the review step's submit button submits.
 */
export function FormWizard({
  action,
  state,
  steps,
  idPrefix,
  fieldLabels,
  children,
  hiddenFields = null,
  consent,
  submitSlot,
}: {
  readonly action: (payload: FormData) => void;
  readonly state: SubmissionState;
  readonly steps: readonly WizardStep[];
  /** Namespaces every generated id, so two forms on one page cannot collide. */
  readonly idPrefix: string;
  /** Submitted name → visible label, for the review summary. */
  readonly fieldLabels: Readonly<Record<string, string>>;
  /** The fields of one step. Called once per declared step; panels stay mounted. */
  readonly children: (step: WizardStep, index: number) => ReactNode;
  /** Hidden inputs that belong to the payload but to no step. */
  readonly hiddenFields?: ReactNode;
  /** The consent control. Rendered on the review step only. */
  readonly consent: ReactNode;
  /**
   * The Turnstile widget wrapping this form's submit button, already composed by the caller.
   *
   * A node and **not** a `(submit) => node` wrapper, deliberately. `TurnstileWidget` hands its
   * child `blocked` and `describedBy` through a render prop, and those are exactly what keep the
   * submission fail-closed — the submit control stays disabled, with a reason, until a token
   * exists. A shell that built the `SubmitButton` itself would have to invent both values, and the
   * only value it could invent for `blocked` is `false`. So the caller composes the pair and the
   * shell decides only *where* it renders: on the review step, and nowhere else.
   */
  readonly submitSlot: ReactNode;
}): ReactNode {
  const [activeIndex, setActiveIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  /*
   * Bumped whenever the review step is entered, so the summary re-reads the form. The values live
   * in the DOM, so nothing else tells React they may have changed.
   */
  const [reviewToken, setReviewToken] = useState(0);

  const total = totalSteps(steps);
  const onReview = isReviewStep(steps, activeIndex);

  /** Focus a step's heading, so navigation lands somewhere that says where the visitor now is. */
  const focusHeading = useCallback((index: number) => {
    // The heading is rendered with tabIndex={-1}; focusing it is what a screen reader reads out.
    window.requestAnimationFrame(() => headingRefs.current[index]?.focus());
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setFurthestIndex((furthest) => Math.max(furthest, index));
      if (isReviewStep(steps, index)) setReviewToken((token) => token + 1);
      focusHeading(index);
    },
    [focusHeading, steps],
  );

  /**
   * The current panel's controls, in document order.
   *
   * Scoped to the panel rather than the form, which is what makes validation per-step: a required
   * field two steps ahead is not this step's problem and must not block it.
   */
  const currentControls = useCallback((): readonly HTMLElement[] => {
    const panel = formRef.current?.querySelector<HTMLElement>(
      `[data-wizard-step="${activeIndex}"]`,
    );

    if (!panel) return [];

    return [
      ...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea",
      ),
    ].filter((control) => !control.disabled);
  }, [activeIndex]);

  /** Advance if this step is valid; otherwise focus and report the first control that is not. */
  const advance = useCallback((): void => {
    for (const control of currentControls()) {
      if (control instanceof HTMLElement && "checkValidity" in control) {
        const candidate = control as unknown as HTMLInputElement;

        if (!candidate.checkValidity()) {
          candidate.focus();
          candidate.reportValidity();

          return;
        }
      }
    }

    goTo(Math.min(activeIndex + 1, total - 1));
  }, [activeIndex, currentControls, goTo, total]);

  /** Back. No validation — leaving a step half-filled is allowed and losing the values is not. */
  const goBack = useCallback((): void => {
    goTo(Math.max(activeIndex - 1, 0));
  }, [activeIndex, goTo]);

  /*
   * A server-side rejection returns the visitor to the field that caused it.
   *
   * The step is chosen from the errored field names, and focus follows to the control itself rather
   * than to the panel heading — after a failed submission the useful destination is the problem,
   * not the section it lives in. When no errored field belongs to a declared step (a consent or
   * Turnstile rejection), the visitor stays on the review step they submitted from.
   */
  useEffect(() => {
    if (state.status !== "invalid") return;

    const target = firstInvalidStep(steps, state.fieldErrors);

    if (target < 0) return;

    setActiveIndex(target);
    setFurthestIndex((furthest) => Math.max(furthest, target));

    window.requestAnimationFrame(() => {
      const step = steps[target];
      const name = step?.fields.find((field) => state.fieldErrors[field] !== undefined);
      const control = name
        ? formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)
        : undefined;

      if (control) control.focus();
      else headingRefs.current[target]?.focus();
    });
  }, [state, steps]);

  /*
   * The success state replaces the form rather than sitting above it — unchanged from both forms'
   * previous behaviour, and for the reason each of them recorded: a filled-in form left standing
   * under a confirmation reads as "not sent" and produces a duplicate request.
   */
  if (state.status === "success") return <FormStatus state={state} />;

  return (
    <>
      <FormStatus state={state} />

      <form
        action={action}
        key={formKey(state)}
        ref={formRef}
        className="fw-form"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;

          const target = event.target;

          /*
           * A textarea keeps Enter as a newline. It is the one control where the key has a meaning
           * of its own, and taking it would make the specification field unusable.
           */
          if (target instanceof HTMLTextAreaElement) return;

          /*
           * A focused button keeps native behaviour: Enter and Space activate it. That is how a
           * keyboard user works Back, Continue, Edit, a step in the indicator, and — on the review
           * step — the submit control. Nothing here interferes with any of them.
           */
          if (target instanceof HTMLButtonElement) return;

          /*
           * Everything else — input, select, checkbox, radio — is stopped and does nothing else.
           *
           * Owner decision: Enter in an ordinary field must not submit **and must not advance**.
           * An earlier revision of this shell advanced on Enter, which is a common wizard pattern
           * and is still the wrong one here: it moves the page under someone who pressed a key to
           * commit an autocomplete suggestion, and it makes the same keystroke mean "next step" in
           * a text field and "activate" on a button one Tab away. Step navigation happens through
           * the explicit Back and Continue buttons and nowhere else.
           *
           * `preventDefault` without a follow-up action is the whole behaviour: it suppresses
           * implicit submission, which is what would otherwise post the form from step one the
           * moment the review step's submit button exists in the DOM.
           */
          event.preventDefault();
        }}
      >
        {hiddenFields}

        <StepIndicator
          steps={steps}
          activeIndex={activeIndex}
          furthestIndex={furthestIndex}
          onNavigate={goTo}
          idPrefix={idPrefix}
        />

        {steps.map((step, index) => (
          <section
            className="fw-panel"
            data-wizard-step={index}
            hidden={index !== activeIndex}
            key={step.id}
            aria-labelledby={`${idPrefix}-panel-${step.id}`}
          >
            <h3
              className="fw-panel-head"
              id={`${idPrefix}-panel-${step.id}`}
              tabIndex={-1}
              ref={(node) => {
                headingRefs.current[index] = node;
              }}
            >
              {step.heading}
            </h3>

            <div className="fm-grid">{children(step, index)}</div>
          </section>
        ))}

        <section
          className="fw-panel fw-panel--review"
          data-wizard-step={steps.length}
          hidden={!onReview}
          aria-labelledby={`${idPrefix}-panel-review`}
        >
          <h3
            className="fw-panel-head"
            id={`${idPrefix}-panel-review`}
            tabIndex={-1}
            ref={(node) => {
              headingRefs.current[steps.length] = node;
            }}
          >
            {REVIEW_STEP_HEADING}
          </h3>

          {/*
           * Mounted only while the review is showing. The summary reads the DOM, so rendering it
           * behind `hidden` would read values that are about to change and never re-read them.
           * `reviewToken` is in the key so re-entering the review re-reads the form.
           */}
          {onReview && (
            <ReviewSummary
              key={reviewToken}
              form={formRef.current}
              steps={steps}
              fieldLabels={fieldLabels}
              onEdit={goTo}
              idPrefix={idPrefix}
            />
          )}

          <div className="fw-submit">
            {consent}
            {submitSlot}
          </div>
        </section>

        {/*
         * The only two step controls. Both keep their word — the arrow supports the direction, it
         * does not carry it — so the buttons read identically with icons suppressed, and both
         * arrows mirror under `dir="rtl"`.
         */}
        <div className="fw-actions">
          {activeIndex > 0 && (
            <button type="button" className="fs-btn fs-btn--glass" onClick={goBack}>
              <BackIcon size="sm" />
              Back
            </button>
          )}
          {!onReview && (
            <button type="button" className="fs-btn fs-btn--gold" onClick={advance}>
              Continue
              <ContinueIcon size="sm" />
            </button>
          )}
        </div>
      </form>
    </>
  );
}
