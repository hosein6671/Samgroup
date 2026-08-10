import { VisuallyHidden } from "@sam-group/ui";
import type { ReactNode } from "react";

import { ANCHORS, CONSENT_LABEL, REQUEST_GROUPS, type RequestField } from "../solutions-data";

/**
 * 4 · Custom Product Request — SITE_STRUCTURE §5's `[FORM]`, and this page's terminal section.
 *
 * ── Terminal by decision ────────────────────────────────────────────────────
 *
 * The Products landing and all six category pages close with the shared `ClosingCta`, whose
 * primary action is "Request a custom solution" — pointing here. Rendering it on this page would
 * link the page to itself, so it is not rendered and not modified. The form is the closing
 * section, which is what those seven CTAs were sending people to in the first place.
 *
 * ── Why the form is disabled rather than wired to nothing ───────────────────
 *
 * Identical reasoning to the Products landing's download gate, and identical mechanics. There is
 * no submission endpoint: `POST /custom-formulation-requests` is in API_CONTRACT_FINAL and is not
 * built, and the `CustomFormulationRequest` entity behind it is currently missing the contact
 * columns this form collects (DATA_MODEL_GAP_REVIEW §1 — "no `email` and no `phone` field... there
 * is no way to reply to them").
 *
 * A form that accepts a detailed specification and silently discards it is worse than no form: it
 * teaches a real buyer that they have made contact when they have not. So the `<fieldset>` carries
 * a real `disabled` attribute — every control drops out of the tab order and out of submission at
 * the platform level, not by styling — and a notice above the fields says so before anyone starts
 * typing. No fake success state, no `preventDefault` theatre.
 *
 * **There is no `<form>` element at all.** The download gate does the same. With no endpoint to
 * name there is no honest `action`, and a `<form>` with nowhere to go would submit to the current
 * URL if the fieldset were ever un-disabled by a stylesheet or an extension. The absence is the
 * safeguard.
 *
 * ── The file input is a control, not an upload path ─────────────────────────
 *
 * "Upload Technical Specifications" is a real `<input type="file">` so the finished layout is
 * accurate, and it is inert for the same reason as everything else here. No storage decision is
 * implicated: nothing is read, nothing is transmitted, and the object-store replacement for
 * development MinIO is explicitly undecided (CLAUDE.md §2).
 */
export function CustomRequestForm(): ReactNode {
  return (
    <section className="fs-sec cs-request" id={ANCHORS.request} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap cs-request-inner">
        <header className="cs-request-head reveal-fade-rise">
          <p className="fs-eyebrow">Custom product request</p>
          <h2 className="fs-d2">State the requirement.</h2>
          <p className="fs-lead">
            The more of a specification that arrives with the request, the fewer rounds it takes to
            get to a sample. Nothing below is required except an address to reply to.
          </p>
        </header>

        <div className="cs-request-panel reveal-fade-rise">
          <p className="pr-inert">
            <span aria-hidden="true">◇</span>
            <span>
              <strong>Not connected.</strong> This is the design proof — the form is shown in its
              finished visual state and is deliberately inoperative. Submission endpoints arrive
              with the backend work; nothing typed here would be sent or stored.
            </span>
          </p>

          <fieldset className="pr-gate-fieldset" disabled>
            <VisuallyHidden as="legend">Custom product request</VisuallyHidden>

            {REQUEST_GROUPS.map((group) => (
              <div className="cs-group" key={group.id}>
                <h3 className="cs-group-head">{group.heading}</h3>

                <div className="cs-grid">
                  {group.fields.map((field) => (
                    <Field field={field} key={field.name} />
                  ))}
                </div>
              </div>
            ))}

            <div className="pr-consent">
              <input id="cs-consent" name="consent" type="checkbox" />
              <label htmlFor="cs-consent">{CONSENT_LABEL}</label>
            </div>

            <div className="fs-cta-actions cs-request-actions">
              <button type="button" className="fs-btn fs-btn--gold">
                Submit request
              </button>
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  );
}

/**
 * One control, chosen by `kind`.
 *
 * `required` is set on exactly one field, and the marker beside the label is `aria-hidden` with
 * the word carried in `VisuallyHidden` text — an asterisk alone is not a label a screen reader
 * can act on.
 *
 * The `disabled` attribute is not repeated per control. The ancestor `<fieldset disabled>` already
 * disables every descendant at the platform level; restating it here would be a second source of
 * truth for the page's most important property.
 */
function Field({ field }: { readonly field: RequestField }): ReactNode {
  const id = `cs-${field.name}`;

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

  return (
    <div className={field.wide ? "fs-field cs-field--wide" : "fs-field"}>
      {label}

      {field.kind === "textarea" && <textarea id={id} name={field.name} rows={4} />}

      {field.kind === "select" && (
        <select id={id} name={field.name} defaultValue="">
          <option value="">Select</option>
          {field.options?.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {field.kind === "file" && <input className="cs-file" id={id} name={field.name} type="file" />}

      {(field.kind === "text" || field.kind === "email" || field.kind === "tel") && (
        <input
          id={id}
          name={field.name}
          type={field.kind}
          autoComplete={field.autoComplete}
          required={field.required}
        />
      )}
    </div>
  );
}
