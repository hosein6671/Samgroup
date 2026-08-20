/**
 * The Custom Product Request form, as configuration — **code-owned, and deliberately not CMS**.
 *
 * ── Why this survived the CMS cutover ───────────────────────────────────────
 *
 * The Customized Solutions page moved to the Payload `CustomizedSolutions` Global in CMS-2A, and
 * its editorial fixture was deleted with it. This module is what that fixture was **not**: the
 * form is a contract with the API and the database, not copy.
 *
 * Every field name below is a DTO property `POST /custom-formulation-requests` accepts, and the
 * required set follows the `custom_formulation_requests` NOT NULL columns. An editor renaming a
 * label in a CMS text input could produce a form the database refuses, or a field the API answers
 * 400 for — so the vocabulary stays here, beside the contract it mirrors.
 * PAYLOAD_CONTENT_ARCHITECTURE.md §Customized Solutions states the same boundary from the CMS
 * side: that Global is "the surrounding page copy only, never the form data".
 */
/**
 * A field of the Custom Product Request form.
 *
 * `kind` is the control, not the CSS: `wide` is a layout hint the grid consumes, kept in data
 * because which fields deserve a full row is a property of the field's content length rather
 * than a decision the markup should re-derive.
 */
export type FieldKind = "text" | "email" | "tel" | "select" | "textarea" | "file";

export type RequestField = {
  /**
   * The submitted field name, and therefore the DTO property `POST /custom-formulation-requests`
   * accepts. Not a display concern: the API runs with `forbidNonWhitelisted`, so a name that is not
   * a DTO property is a 400 naming it, and `details[].field` comes back keyed by this same string —
   * which is what lets the error message render beside the input that caused it with no mapping
   * table in between.
   */
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** See the note on `REQUEST_GROUPS` — these follow the table's NOT NULL columns. */
  readonly required?: true;
  readonly options?: readonly string[];
  readonly autoComplete?: string;
  readonly wide?: true;
  /**
   * Rendered, and inoperative. Set on exactly one field — the attachment — because
   * `POST /media/upload` is contracted and unbuilt, so there is nowhere for a file to go.
   */
  readonly disabled?: true;
};

/**
 * The form, in three groups.
 *
 * ── The field set is the approved one, in full ──────────────────────────────
 *
 * Fourteen fields, and every one of them is specified in two documents that agree: SITE_STRUCTURE
 * §5's "Custom Product Request form fields" and DATA_MODEL_GAP_REVIEW §1, which restates the five
 * additions as exact `CustomFormulationRequest` columns. Nothing is added and nothing is dropped.
 *
 * ── What is required — and a documented conflict, resolved toward the schema ─
 *
 * This list previously marked only Email required, on the strength of SITE_STRUCTURE §5's single
 * asterisk and DATA_MODEL_GAP_REVIEW §1's two required columns. **The migrated schema disagrees**:
 * `custom_formulation_requests` declares `company_name`, `country`, `industry`, `email`,
 * `product_or_application`, `required_specifications` and `consent_given` NOT NULL — five more than
 * either document marks.
 *
 * Six fields are therefore marked required here, matching the columns, plus the consent checkbox
 * below. Not because more required fields are better — the opposite is true on a lead form — but
 * because the alternative is a form that invites a submission the database will refuse. The
 * discrepancy is reported for a documentation or schema decision rather than settled in this file;
 * the API's DTO takes the same position and says so at greater length.
 *
 * ── The Incoterm list is this form's, not the Inquiry form's ────────────────
 *
 * Four options: EXW, FOB, CFR, CIF. The Inquiry form on Contact Us has a fifth, "Not sure", and
 * DATA_MODEL_GAP_REVIEW §2 calls the difference out explicitly ("note the extra 'Not sure' option
 * the Customized Solutions form doesn't have"). Copying five options here would contradict a
 * documented distinction.
 *
 * ── Grouping ───────────────────────────────────────────────────────────────
 *
 * The three headings organise the fields; they are not content. Fourteen controls in one
 * undifferentiated grid is a form people abandon, and the source lists them in an order that
 * already falls into these three concerns.
 */
export type RequestGroup = {
  readonly id: string;
  readonly heading: string;
  readonly fields: readonly RequestField[];
};

export const REQUEST_GROUPS: readonly RequestGroup[] = [
  {
    id: "contact",
    heading: "Who is asking",
    fields: [
      {
        name: "companyName",
        label: "Company name",
        kind: "text",
        required: true,
        autoComplete: "organization",
      },
      {
        name: "country",
        label: "Country",
        kind: "text",
        required: true,
        autoComplete: "country-name",
      },
      {
        name: "email",
        label: "Email address",
        kind: "email",
        required: true,
        autoComplete: "email",
      },
      { name: "phone", label: "Phone / WhatsApp", kind: "tel", autoComplete: "tel" },
    ],
  },
  {
    id: "requirement",
    heading: "What is required",
    fields: [
      { name: "industry", label: "Industry", kind: "text", required: true },
      /*
       * `productOrApplication`, not `productApplication`. The name is the DTO property — see
       * `RequestField.name` — and the column it writes is `product_or_application`.
       */
      {
        name: "productOrApplication",
        label: "Product / application",
        kind: "text",
        required: true,
      },
      {
        name: "requiredSpecifications",
        label: "Required specifications",
        kind: "textarea",
        required: true,
        wide: true,
      },
      { name: "estimatedQuantity", label: "Estimated quantity", kind: "text" },
      { name: "packagingRequirements", label: "Packaging requirements", kind: "text" },
    ],
  },
  {
    id: "delivery",
    heading: "Where it is going",
    fields: [
      { name: "destinationCountry", label: "Target market / destination country", kind: "text" },
      {
        name: "preferredIncoterm",
        label: "Preferred Incoterm",
        kind: "select",
        options: ["EXW", "FOB", "CFR", "CIF"],
      },
      {
        name: "additionalInformation",
        label: "Additional information",
        kind: "textarea",
        wide: true,
      },
      /*
       * Still specified by SITE_STRUCTURE §5, still shown, and still inoperative — `disabled`, so
       * it drops out of the tab order and out of submission at the platform level rather than by
       * styling. `POST /media/upload` is contracted and unbuilt, and `attachmentMediaId` is not a
       * field the DTO accepts. A control that accepted a technical specification and discarded it
       * would be worse than one that says it cannot take it.
       */
      {
        name: "technicalSpecifications",
        label: "Upload technical specifications",
        kind: "file",
        disabled: true,
        wide: true,
      },
    ],
  },
];

/**
 * The consent checkbox.
 *
 * Separate from the groups above because it is not a data field the buyer is describing their
 * requirement with — it is the lawful basis for holding any of the rest. DATA_MODEL_GAP_REVIEW §1
 * is explicit that it is "legally required before this form can collect data at all".
 *
 * The privacy policy it refers to is a real route in the sitemap (`/privacy-policy`) that has no
 * page and no approved legal text yet — SITE_STRUCTURE's Outstanding Confirmations lists legal
 * review as a launch blocker. So the label names the policy without linking to a 404.
 */
export const CONSENT_LABEL =
  "I agree to be contacted about this request and accept the privacy policy.";
