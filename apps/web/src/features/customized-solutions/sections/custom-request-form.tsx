"use client";

import { VisuallyHidden } from "@sam-group/ui";
import { useActionState } from "react";
import type { ReactNode } from "react";

import { submitCustomFormulationRequest } from "@/features/forms/actions";
import {
  FieldError,
  FormStatus,
  SubmitButton,
  formKey,
  invalidProps,
  issuesFor,
  valueFor,
} from "@/features/forms/form-feedback";
import { IDLE, type SubmissionState } from "@/features/forms/submission-state";

import { ANCHORS } from "../solutions-anchors";
import { CONSENT_LABEL, REQUEST_GROUPS, type RequestField } from "../solutions-form";

/**
 * 4 · Custom Product Request — SITE_STRUCTURE §5's `[FORM]`, and this page's terminal section.
 *
 * ── Terminal by decision ────────────────────────────────────────────────────
 *
 * The Products landing and all six category pages close with the shared `ClosingCta`, whose primary
 * action is "Request a custom solution" — pointing here. Rendering it on this page would link the
 * page to itself, so it is not rendered. The form is the closing section, which is what those seven
 * CTAs were sending people to in the first place.
 *
 * ── It is connected now, and this file changed accordingly ──────────────────
 *
 * It was a `<fieldset disabled>` with no `<form>` around it, behind a "Not connected" notice,
 * because `POST /custom-formulation-requests` did not exist and the entity behind it was missing the
 * columns needed to reply to a submission. Both statements are now false: the endpoint is built, and
 * `custom_formulation_requests` carries `email`, `phone`, `destination_country`,
 * `preferred_incoterm` and `consent_given`.
 *
 * The safeguard the old version described is kept in the one place it still applies — the file
 * input. `POST /media/upload` remains contracted and unbuilt, so that control alone stays
 * `disabled`, at the platform level rather than by styling, and the notice below now says only
 * that. Nothing else on the form is inert, and there is no fake success state: what is rendered
 * after a submission is what the API actually answered.
 *
 * ── The client boundary ─────────────────────────────────────────────────────
 *
 * This section became a Client Component; the four sections around it did not, and the page shell
 * did not. It posts through a Server Action, so the browser never calls NestJS — which it could not
 * do anyway, `apps/api` runs with `cors: false`.
 */
export function CustomRequestForm(): ReactNode {
  const [state, action] = useActionState<SubmissionState, FormData>(
    submitCustomFormulationRequest,
    IDLE,
  );

  return (
    <section className="fs-sec cs-request" id={ANCHORS.request} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap cs-request-inner">
        <header className="cs-request-head reveal-fade-rise">
          <p className="fs-eyebrow">Custom product request</p>
          <h2 className="fs-d2">State the requirement.</h2>
          <p className="fs-lead">
            The more of a specification that arrives with the request, the fewer rounds it takes to
            get to a sample.
          </p>
        </header>

        <div className="cs-request-panel reveal-fade-rise">
          <FormStatus state={state} />

          {/*
           * The success state replaces the form rather than sitting above it. A filled-in form left
           * standing under a confirmation reads as "not sent" and produces a duplicate request.
           */}
          {state.status !== "success" && (
            <form action={action} noValidate key={formKey(state)}>
              <p className="pr-inert">
                <span aria-hidden="true">◇</span>
                <span>
                  <strong>Attachments are not accepted yet.</strong> Every other field below is
                  submitted and stored. The upload control is shown because the form specifies it
                  and is deliberately inoperative — describe the specification in the text fields
                  for now.
                </span>
              </p>

              {REQUEST_GROUPS.map((group) => (
                <div className="cs-group" key={group.id}>
                  <h3 className="cs-group-head">{group.heading}</h3>

                  <div className="cs-grid">
                    {group.fields.map((field) => (
                      <Field field={field} state={state} key={field.name} />
                    ))}
                  </div>
                </div>
              ))}

              <div className="pr-consent">
                <input id="cs-consentGiven" name="consentGiven" type="checkbox" required />
                <label htmlFor="cs-consentGiven">{CONSENT_LABEL}</label>
              </div>
              <FieldError id="cs-consentGiven-error" issues={issuesFor(state, "consentGiven")} />

              <div className="fs-cta-actions cs-request-actions">
                <SubmitButton label="Submit request" pendingLabel="Submitting…" />
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * One control, chosen by `kind`, with its label, its error message and the wiring between them.
 *
 * `required` comes from the field definition, which now follows the table's NOT NULL columns — see
 * the note on `REQUEST_GROUPS`. The marker beside the label is `aria-hidden` with the word carried
 * in `VisuallyHidden` text: an asterisk alone is not a label a screen reader can act on.
 *
 * `disabled` is set from the field rather than from an ancestor `<fieldset disabled>`. That is the
 * change the connection required: a fieldset would disable the whole form to make one control
 * inert.
 */
function Field({
  field,
  state,
}: {
  readonly field: RequestField;
  readonly state: SubmissionState;
}): ReactNode {
  const id = `cs-${field.name}`;
  const errorId = `${id}-error`;
  const aria = invalidProps(state, field.name, errorId);
  /* Restored after a failed attempt; `undefined` before the first one. See `formKey`. */
  const restored = valueFor(state, field.name);

  const label = (
    <label htmlFor={id}>
      {field.label}
      {field.required && (
        <>
          <span aria-hidden="true"> *</span>
          <VisuallyHidden as="span"> (required)</VisuallyHidden>
        </>
      )}
    </label>
  );

  const className = [
    "fs-field",
    field.wide === true ? "cs-field--wide" : "",
    field.disabled === true ? "fm-field--disabled" : "",
  ]
    .filter((token) => token !== "")
    .join(" ");

  return (
    <div className={className}>
      {label}

      {field.kind === "textarea" && (
        <textarea
          id={id}
          name={field.name}
          rows={4}
          required={field.required}
          defaultValue={restored}
          {...aria}
        />
      )}

      {field.kind === "select" && (
        <select
          id={id}
          name={field.name}
          defaultValue={restored ?? ""}
          required={field.required}
          {...aria}
        >
          <option value="">Select</option>
          {field.options?.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {field.kind === "file" && (
        <input className="cs-file" id={id} name={field.name} type="file" disabled />
      )}

      {(field.kind === "text" || field.kind === "email" || field.kind === "tel") && (
        <input
          id={id}
          name={field.name}
          type={field.kind}
          autoComplete={field.autoComplete}
          required={field.required}
          defaultValue={restored}
          {...aria}
        />
      )}

      <FieldError id={errorId} issues={issuesFor(state, field.name)} />
    </div>
  );
}
