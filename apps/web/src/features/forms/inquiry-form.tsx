"use client";

import { VisuallyHidden } from "@sam-group/ui";
import { useActionState } from "react";
import type { ReactNode } from "react";

import { submitInquiry } from "./actions";
import {
  FieldError,
  FormStatus,
  SubmitButton,
  formKey,
  invalidProps,
  issuesFor,
  valueFor,
} from "./form-feedback";
import { INQUIRY_INCOTERMS, INQUIRY_TYPE_OPTIONS } from "./inquiry-vocabulary";
import { IDLE, type SubmissionState } from "./submission-state";

/**
 * The Inquiry form — one component behind General Contact, Request a Quote and Request a Sample.
 *
 * ── Why one component and not three ─────────────────────────────────────────
 *
 * All three are the same submission with a different `inquiryType`; DATA_MODEL.md merged the sample
 * request into `Inquiry` for exactly that reason, and building a second form per flow would rebuild
 * on this side what the merge removed on the other. The differences between the flows are two
 * props: which type is preselected, and whether the visitor may change it.
 *
 * ── The client boundary is this file and its two helpers ────────────────────
 *
 * The pages that embed it are Server Components; the sections around it are Server Components; the
 * fetch that resolves the product context happens server-side before this renders. This is a Client
 * Component only because the outcome has to be rendered without a navigation.
 *
 * `useActionState` posts to `submitInquiry`, which is a Server Action — the browser never calls
 * NestJS. It also means the form **works before hydration**: React submits the same `FormData` the
 * platform would have, so a visitor on a slow connection is not looking at a dead form.
 *
 * ── On success the form is replaced, not left standing ──────────────────────
 *
 * A confirmation above a still-filled form invites a second submission, and a second submission is
 * a second row in a sales queue with no deduplication. So the success state renders the banner and
 * nothing else.
 *
 * ── Required fields are the API's, restated in the markup ───────────────────
 *
 * Six inputs carry `required` and they are exactly the six `inquiries` columns that are NOT NULL and
 * that SITE_STRUCTURE §10 marks with an asterisk. The attribute is a courtesy — it saves a round
 * trip — and never the enforcement: the DTO decides, and its `details[].field` is what fills in the
 * messages below.
 */

/** The product a Request Quote / Request Sample CTA carried into the form, resolved server-side. */
export type ProductContext = {
  /** The `Product.id` submitted as `relatedProductId`. Verified again by the API before writing. */
  readonly id: string;
  readonly name: string;
  /** Used only to link back to the product page the CTA was clicked from. */
  readonly href: string;
};

export function InquiryForm({
  inquiryType,
  lockInquiryType = false,
  product = null,
  variant = "full",
}: {
  /** The preselected `inquiryType`. Already validated against the vocabulary by the caller. */
  readonly inquiryType: string;
  /**
   * True on the Request a Quote route, where the page's whole identity is the type. The value then
   * travels in a hidden input — still validated by the API, which is what makes tampering a 400
   * rather than a mis-filed lead.
   */
  readonly lockInquiryType?: boolean;
  readonly product?: ProductContext | null;
  /** A shorter homepage treatment; it keeps every API-required field and the message. */
  readonly variant?: "full" | "compact";
}): ReactNode {
  const [state, action] = useActionState<SubmissionState, FormData>(submitInquiry, IDLE);
  const compact = variant === "compact";

  if (state.status === "success") {
    return <FormStatus state={state} />;
  }

  return (
    <>
      <FormStatus state={state} />

      {product !== null && (
        <p className="fm-context">
          <span>This enquiry references</span>
          <b>{product.name}</b>
          <a href={product.href}>View the product</a>
        </p>
      )}

      {/*
       * `key` remounts every control after each failed attempt, which is what restores the values
       * React 19 wiped when it reset the form. See `Resubmittable` for why that reset happens.
       */}
      <form action={action} noValidate key={formKey(state)}>
        {/*
         * Hidden, verified, and never rendered as an editable field. The visitor chose a product by
         * clicking a CTA on its page, not by typing an id — offering it as an input would invite
         * exactly the tampering the server-side check exists to catch.
         */}
        {product !== null && <input type="hidden" name="relatedProductId" value={product.id} />}
        {lockInquiryType && <input type="hidden" name="inquiryType" value={inquiryType} />}

        <div className="fm-group">
          <h3 className="fm-group-head">
            {compact ? "Contact and requirement" : "Contact details"}
          </h3>

          <div className="fm-grid">
            <Field
              label="First name"
              name="firstName"
              state={state}
              required
              autoComplete="given-name"
            />
            <Field
              label="Last name"
              name="lastName"
              state={state}
              required
              autoComplete="family-name"
            />
            <Field
              label="Company name"
              name="companyName"
              state={state}
              required
              autoComplete="organization"
            />
            <Field
              label="Country"
              name="country"
              state={state}
              required
              autoComplete="country-name"
            />
            <Field
              label="Email address"
              name="email"
              type="email"
              state={state}
              required
              autoComplete="email"
            />
            {!compact && (
              <Field
                label="Phone / WhatsApp"
                name="phone"
                type="tel"
                state={state}
                autoComplete="tel"
              />
            )}
            <Field label="Industry" name="industry" state={state} required />

            {!lockInquiryType && (
              <div className="fs-field">
                <label htmlFor="inq-inquiryType">
                  Enquiry type
                  <Required />
                </label>
                <select
                  id="inq-inquiryType"
                  name="inquiryType"
                  defaultValue={valueFor(state, "inquiryType") ?? inquiryType}
                  required
                  {...invalidProps(state, "inquiryType", "inq-inquiryType-error")}
                >
                  {INQUIRY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError id="inq-inquiryType-error" issues={issuesFor(state, "inquiryType")} />
              </div>
            )}

            {compact && (
              <div className="fs-field fm-field--wide">
                <label htmlFor="inq-message">Product requirement</label>
                <textarea
                  id="inq-message"
                  name="message"
                  rows={4}
                  defaultValue={valueFor(state, "message")}
                  {...invalidProps(state, "message", "inq-message-error")}
                />
                <FieldError id="inq-message-error" issues={issuesFor(state, "message")} />
              </div>
            )}
          </div>
        </div>

        {!compact && (
          <div className="fm-group">
            <h3 className="fm-group-head">Product and supply details</h3>

            <div className="fm-grid">
              <Field label="Required quantity" name="requiredQuantity" state={state} />
              <Field
                label="Destination country / port"
                name="destinationCountryPort"
                state={state}
              />

              <div className="fs-field">
                <label htmlFor="inq-preferredIncoterm">Preferred Incoterm</label>
                <select
                  id="inq-preferredIncoterm"
                  name="preferredIncoterm"
                  defaultValue={valueFor(state, "preferredIncoterm") ?? ""}
                >
                  <option value="">Select</option>
                  {INQUIRY_INCOTERMS.map((incoterm) => (
                    <option key={incoterm} value={incoterm}>
                      {incoterm}
                    </option>
                  ))}
                </select>
                <FieldError
                  id="inq-preferredIncoterm-error"
                  issues={issuesFor(state, "preferredIncoterm")}
                />
              </div>

              <div className="fs-field fm-field--wide">
                <label htmlFor="inq-message">Product requirement</label>
                <textarea
                  id="inq-message"
                  name="message"
                  rows={5}
                  defaultValue={valueFor(state, "message")}
                  {...invalidProps(state, "message", "inq-message-error")}
                />
                <FieldError id="inq-message-error" issues={issuesFor(state, "message")} />
              </div>
            </div>
          </div>
        )}

        <div className="fm-consent">
          <input id="inq-consent" name="consentGiven" type="checkbox" required />
          <label htmlFor="inq-consent">{CONSENT_LABEL}</label>
        </div>
        <FieldError id="inq-consent-error" issues={issuesFor(state, "consentGiven")} />

        <div className="fm-actions">
          <SubmitButton label="Send enquiry" pendingLabel="Sending…" />
          <p className="fm-required-note">Fields marked required must be completed.</p>
        </div>
      </form>
    </>
  );
}

/**
 * The consent checkbox label.
 *
 * Names the privacy policy without linking to it: `/privacy-policy` is a real route in the sitemap
 * with no page and no approved legal text, and SITE_STRUCTURE's Outstanding Confirmations lists
 * legal review as a launch blocker. A link to a 404 beside a consent checkbox is worse than no
 * link. The same wording the Custom Product Request form already carries.
 */
const CONSENT_LABEL = "I agree to be contacted about this enquiry and accept the privacy policy.";

/**
 * The required marker. The asterisk is decorative; the word is what a screen reader reads — an
 * asterisk alone is not a label anything can act on. The same construction
 * `custom-request-form.tsx` already uses, through the same primitive.
 */
function Required(): ReactNode {
  return (
    <>
      <span aria-hidden="true"> *</span>
      <VisuallyHidden as="span"> (required)</VisuallyHidden>
    </>
  );
}

/** One text input, with its label, its error message, and the wiring between them. */
function Field({
  label,
  name,
  state,
  type = "text",
  required = false,
  autoComplete,
  wide = false,
}: {
  readonly label: string;
  readonly name: string;
  readonly state: SubmissionState;
  readonly type?: "text" | "email" | "tel";
  readonly required?: boolean;
  readonly autoComplete?: string;
  readonly wide?: boolean;
}): ReactNode {
  const id = `inq-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className={wide ? "fs-field fm-field--wide" : "fs-field"}>
      <label htmlFor={id}>
        {label}
        {required && <Required />}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={valueFor(state, name)}
        {...invalidProps(state, name, errorId)}
      />
      <FieldError id={errorId} issues={issuesFor(state, name)} />
    </div>
  );
}
