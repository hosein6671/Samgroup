/**
 * The shape of a customer-inquiry form's steps — the single source of truth both public inquiry
 * forms configure and neither one re-implements.
 *
 * ── Why this is data rather than markup ─────────────────────────────────────
 *
 * The owner decision is that every public customer-inquiry form uses one three-step experience.
 * The *fields* differ between the Inquiry form and the Custom Product Request — they post to
 * different endpoints with different DTOs — but the shell, the indicator, the navigation, the
 * validation behaviour and the review must not. Expressing the steps as data is what lets the shell
 * own all of that while each form keeps its own field set and its own payload mapping explicit.
 *
 * `fields` is the load-bearing part. It is the list of submitted names belonging to a step, and it
 * drives three things that would otherwise drift apart: which controls "Next" validates, which step
 * a server-side field error jumps to, and what the review summary lists under which heading. One
 * list, three consumers.
 */

/** One data-entry step. The review step is the shell's and is never declared here. */
export type WizardStep = {
  /** Stable identifier, used for panel ids and as the render key. Never shown. */
  readonly id: string;
  /**
   * The indicator label. Kept deliberately short — two words at most — because it has to stay
   * legible and untruncated at 320px beside two siblings and a step number.
   */
  readonly label: string;
  /** The panel's own heading, and the element focus moves to when the step becomes active. */
  readonly heading: string;
  /**
   * The submitted field names in this step, in the order they should be reviewed.
   *
   * A name here that the step does not actually render is harmless — validation and the review
   * both skip what is not in the form — which is what lets a form vary its fields by prop (the
   * Inquiry form's `compact` and `lockInquiryType` variants) without needing a second step table.
   */
  readonly fields: readonly string[];
};

/**
 * The review step's identifier.
 *
 * It is a constant rather than a declared step because the review is the shell's behaviour, not a
 * form's configuration: it renders from `fields` and `fieldLabels`, it is always last, and it is
 * the only step that may carry the consent control and the Turnstile widget.
 */
export const REVIEW_STEP_ID = "review";

/** The review step's indicator label and heading, shared by every form. */
export const REVIEW_STEP_LABEL = "Review";
export const REVIEW_STEP_HEADING = "Review and submit";

/**
 * The total number of steps a form presents, including the review.
 *
 * The owner decision fixes this at three — Contact details, Request details, Review and submit —
 * but the shell derives it rather than hardcoding it, so a form that legitimately needs a different
 * count is a configuration change and not a rewrite of the indicator.
 */
export function totalSteps(steps: readonly WizardStep[]): number {
  return steps.length + 1;
}

/** True when `index` addresses the review step rather than one of the declared data steps. */
export function isReviewStep(steps: readonly WizardStep[], index: number): boolean {
  return index >= steps.length;
}

/**
 * The index of the first step holding a field the server rejected, or `-1`.
 *
 * Used to move a visitor back to the problem after a round trip. `-1` rather than a fallback to the
 * last step deliberately: an `invalid` outcome whose fields belong to no declared step means the
 * error is not about a field this form shows — a consent or Turnstile rejection, say — and the
 * right place for the visitor is the review step they submitted from, not an arbitrary one.
 */
export function firstInvalidStep(
  steps: readonly WizardStep[],
  fieldErrors: Readonly<Record<string, unknown>>,
): number {
  return steps.findIndex((step) => step.fields.some((name) => fieldErrors[name] !== undefined));
}

/**
 * A submitted value, prepared for display in the review summary.
 *
 * `value` is always a string because the summary renders what was typed, and `empty` is carried
 * separately so the summary can say "Not provided" in the same voice for a blank optional field
 * rather than rendering an empty row that reads as a rendering fault.
 */
export type ReviewEntry = {
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly empty: boolean;
};

/**
 * Read the current values of one step's fields out of a live form.
 *
 * `FormData` and not React state, because the fields are uncontrolled — the panels stay mounted and
 * `hidden` so values survive navigation without a controlled-input layer, which is also what makes
 * the form work before hydration. The DOM is therefore the source of truth for what will be
 * submitted, and reading it here means the review cannot disagree with the payload.
 *
 * Checkboxes are excluded by the caller through `fieldLabels`: the consent control belongs to the
 * review step itself and is not something the review summarises back.
 */
export function reviewEntries(
  form: HTMLFormElement,
  step: WizardStep,
  fieldLabels: Readonly<Record<string, string>>,
): readonly ReviewEntry[] {
  const data = new FormData(form);

  return step.fields.flatMap((name) => {
    const label = fieldLabels[name];
    const control = form.elements.namedItem(name);

    // A field the form does not render in this variant, or one with no label to show it under.
    if (label === undefined || !control) return [];

    const raw = data.get(name);
    const submitted = typeof raw === "string" ? raw.trim() : "";

    /*
     * A `<select>` submits its option's VALUE, and for the enquiry type that value is
     * `general_inquiry` — a vocabulary token, not something to show a person reviewing what they
     * are about to send. The selected option's text is the label the visitor actually chose, so
     * that is what the summary reads back.
     *
     * The submitted payload is untouched by this: the value still goes to the API exactly as it
     * did. Only the review's rendering differs, which is the one place a token would be read by a
     * human rather than by a DTO.
     *
     * An empty submitted value short-circuits, and that is not a detail: an unchosen optional
     * select still has an option selected — the placeholder — so reading its text would put
     * "Select" in the summary where "Not provided" belongs.
     */
    const value =
      submitted !== "" && isSelect(control) ? selectedText(control, submitted) : submitted;

    return [{ name, label, value, empty: value === "" }];
  });
}

function isSelect(control: Element | RadioNodeList): control is HTMLSelectElement {
  return "options" in control && "selectedIndex" in control;
}

/** The chosen option's visible text, falling back to the submitted value if it cannot be read. */
function selectedText(control: HTMLSelectElement, submitted: string): string {
  const option = control.selectedOptions?.[0] ?? control.options?.[control.selectedIndex];

  return option?.textContent?.trim() ?? submitted;
}
