"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { FAILURE_MESSAGE, SUCCESS_MESSAGE, type SubmissionState } from "./submission-state";
import { FieldErrorIcon, FormErrorIcon, FormSuccessIcon, SubmitIcon } from "./wizard/icons";

/**
 * The parts of a submission form that are identical whichever form it is — the outcome banner, the
 * per-field message, and the button that knows it is submitting.
 *
 * One `"use client"` module holding all three, imported by both forms, so the client boundary is
 * drawn once and the two forms cannot end up announcing the same outcome differently.
 */

/**
 * The outcome banner, rendered above the fields.
 *
 * ── Two roles, and the difference is deliberate ─────────────────────────────
 *
 * A success is `role="status"` (`aria-live="polite"`): the person has finished, and interrupting
 * them mid-sentence is not what they need. A failure is `role="alert"` (`aria-live="assertive"`):
 * the form is still in front of them and something must be done about it. Both are rendered as the
 * element the state produces rather than toggled by `hidden`, so the live region announces on
 * insertion.
 *
 * ── The success state replaces the form ─────────────────────────────────────
 *
 * Not shown alongside it. See `InquiryForm` — leaving a filled-in form under a confirmation is what
 * produces duplicate leads, because the natural reading of "still there" is "did not send".
 *
 * ── `invalid` renders no banner ─────────────────────────────────────────────
 *
 * Unless the API reported something naming no field. Field errors belong beside their inputs, and a
 * summary above them would state twice what the inputs already say — and would be the copy that
 * goes stale when a field's message changes.
 */
export function FormStatus({ state }: { readonly state: SubmissionState }): ReactNode {
  if (state.status === "success") {
    return (
      <p className="fm-banner fm-banner--ok" role="status">
        <FormSuccessIcon />
        {SUCCESS_MESSAGE}
      </p>
    );
  }

  if (state.status === "throttled") {
    return (
      <p className="fm-banner fm-banner--bad" role="alert">
        <FormErrorIcon />
        {FAILURE_MESSAGE.throttled}
      </p>
    );
  }

  if (state.status === "unavailable") {
    return (
      <p className="fm-banner fm-banner--bad" role="alert">
        <FormErrorIcon />
        {FAILURE_MESSAGE.unavailable}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p className="fm-banner fm-banner--bad" role="alert">
        <FormErrorIcon />
        {FAILURE_MESSAGE.error}
      </p>
    );
  }

  if (state.status === "invalid" && state.formError !== null) {
    return (
      <p className="fm-banner fm-banner--bad" role="alert">
        <FormErrorIcon />
        {state.formError}
      </p>
    );
  }

  return null;
}

/**
 * The issues reported for one field, or `null`.
 *
 * `id` is what the input's `aria-describedby` points at, which is the whole mechanism: the
 * assistive technology reads the message as part of the field rather than as loose text near it.
 * Only the first issue is shown — class-validator reports one per failed constraint, so a blank
 * required field can produce three sentences that all say the same thing, and the first is the one
 * that names the actual problem.
 */
export function FieldError({
  id,
  issues,
}: {
  readonly id: string;
  readonly issues: readonly string[] | undefined;
}): ReactNode {
  if (issues === undefined || issues.length === 0) {
    return null;
  }

  return (
    <p className="fs-err" id={id}>
      <FieldErrorIcon />
      {issues[0]}
    </p>
  );
}

/**
 * The submit button, disabled while the action is in flight — and while anything else says the form
 * is not ready to send.
 *
 * `useFormStatus` rather than a prop for the pending half: it reads the pending state of the
 * `<form>` this button is inside, which is React's own answer and cannot disagree with reality. It
 * requires the button to be a descendant of the form rather than the component that renders it —
 * which is why this is its own component and not a branch inside the form.
 *
 * Disabling is what prevents the double submission that creates two identical leads. The label
 * changes with it, because a disabled button with unchanged text reads as broken rather than busy.
 *
 * `blocked` is the second half, and today its only source is the Turnstile challenge: there is no
 * point offering a control whose submission the API will refuse for want of a token. A disabled
 * control that does not say why is the failure mode of the pattern, so `describedBy` is required to
 * carry the id of the sentence that explains it — the label deliberately does **not** change, since
 * the reason is not "busy" and belongs in prose rather than in a verb.
 */
export function SubmitButton({
  label,
  pendingLabel,
  blocked = false,
  describedBy,
}: {
  readonly label: string;
  readonly pendingLabel: string;
  /** True when something outside the submission itself says the form cannot be sent yet. */
  readonly blocked?: boolean;
  /** The id of the element explaining `blocked`. */
  readonly describedBy?: string | undefined;
}): ReactNode {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="fs-btn fs-btn--gold"
      disabled={pending || blocked}
      aria-describedby={blocked ? describedBy : undefined}
    >
      {/*
       * The send mark is dropped while the submission is in flight. The pending label is the
       * state — "Sending…" — and an icon that says "send" beside a word that says "sending" is
       * two claims about the same thing, one of which is now stale.
       */}
      {!pending && <SubmitIcon size="sm" />}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** The issues for one field, from whichever state the form is in. Empty unless it is `invalid`. */
export function issuesFor(state: SubmissionState, field: string): readonly string[] | undefined {
  return state.status === "invalid" ? state.fieldErrors[field] : undefined;
}

/**
 * What a field should be redrawn with after a rejection, or `undefined` before the first one.
 *
 * Paired with `formKey` below. React 19 resets an uncontrolled form once its action completes, so
 * after **any** failure every control is blank; the remount `formKey` forces makes the inputs read
 * this `defaultValue` and the buyer keeps what they typed. Before the first failure — and after a
 * success, where the form is unmounted anyway — there is nothing to restore and the answer is
 * `undefined`, which leaves the control genuinely uncontrolled.
 */
export function valueFor(state: SubmissionState, field: string): string | undefined {
  return state.status === "idle" || state.status === "success" ? undefined : state.values[field];
}

/**
 * The `key` that remounts the fields after each failed attempt.
 *
 * `0` until the first one. Every subsequent failure increments it, which is what makes React
 * discard the reset DOM nodes and build new ones from the `defaultValue`s above — the mechanism is
 * described in full on `Resubmittable` in `submission-state.ts`.
 */
export function formKey(state: SubmissionState): number {
  return state.status === "idle" || state.status === "success" ? 0 : state.attempt;
}

/**
 * The `aria-*` attributes an input needs when it may be carrying an error.
 *
 * Both attributes are set from the same condition, so the announced state and the styled state
 * (`.fs-field input[aria-invalid="true"]`) cannot disagree — the same discipline
 * `finder/sections/filters.tsx` applies to `data-active` / `aria-current`.
 */
export function invalidProps(
  state: SubmissionState,
  field: string,
  errorId: string,
): { "aria-invalid"?: "true"; "aria-describedby"?: string } {
  return issuesFor(state, field) === undefined
    ? {}
    : { "aria-invalid": "true", "aria-describedby": errorId };
}
