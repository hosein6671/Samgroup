/**
 * Customized Solutions page content, as fixtures.
 *
 * ── What this module is ─────────────────────────────────────────────────────
 *
 * Same contract as `features/home/home-data.ts` and `features/products/products-data.ts`: every
 * export is the *shape* of a real fetch, so wiring this page up later is a swap of this module
 * rather than a rewrite of the components. A hardcoded repeating list in JSX is the one pattern
 * the project forbids outright (PROJECT_HANDOFF §6.7).
 *
 * The shapes track the **Payload `CustomizedSolutions` Global** field-for-field
 * (`docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md` §Customized Solutions), because that Global is
 * what will supply this copy: `headingTitle`/`introText`, `whatCanWeCustomize[]`,
 * `customizationProcess[]`, `privateLabelProgramme`, `caseExamples[]`. The form is deliberately
 * *not* part of that Global — it submits to Prisma's `CustomFormulationRequest`, and that
 * document states the separation explicitly ("this Global is the surrounding page copy only,
 * never the form data").
 *
 * ── What is deliberately absent, and why ────────────────────────────────────
 *
 * Three of the page's seven specified sections are **not built and have no fields here**:
 *
 * - **What Can We Customize?** — `whatCanWeCustomize` is specified as a five-entry array of
 *   `{ title, description }`. The five entries are named in no document in `docs/`.
 * - **Private Label Programme** — `privateLabelProgramme` is specified as rich text plus
 *   `weProvide[]` / `youProvide[]`. Neither list is populated anywhere in `docs/`.
 * - **Case Examples** — `caseExamples` is specified as three anonymized project summaries and
 *   SITE_STRUCTURE §5 marks them "currently placeholders — `[TO CONFIRM]` real, customer-approved
 *   cases". Publishing an invented case study is publishing an invented customer.
 *
 * Absent, not empty. This follows the precedent the category contract already sets for
 * `industries` and `applications`: a section with no approved source does not render, and the
 * type carries no slot that a plausible guess could be dropped into later by accident. When copy
 * is approved, each is a field here plus a section file — no change to what is below.
 *
 * **There is no timeline field and no MOQ field.** SITE_STRUCTURE §5 gives an indicative timeline
 * for the process and a minimum order quantity for the private label programme, and marks both
 * `[ESTIMATE — CONFIRM]` / `[TO CONFIRM]`. CLAUDE.md §4 forbids seeding either into a page, so
 * neither figure appears in this file — not even commented out.
 */

import { ROUTES } from "@/features/site/site-routes";

/* ---------------------------------------------------------------- anchors */

/**
 * In-page anchors, written once.
 *
 * The hero's primary action points at the request form, which is on this page — an anchor, not a
 * route. That is worth stating plainly: every other page's hero CTA resolves to a `ROUTES` entry,
 * and this one deliberately does not, because the thing it is asking for is directly below it.
 */
export const ANCHORS = {
  process: "process",
  request: "custom-request",
} as const;

/* ------------------------------------------------------------------- hero */

export type PageIntro = {
  /** Payload `headingTitle`. */
  readonly heading: string;
  readonly eyebrow: string;
  readonly lead: string;
  readonly primary: { readonly label: string; readonly href: string };
  readonly secondary: { readonly label: string; readonly href: string };
};

/**
 * Hero copy.
 *
 * **Restrained by instruction**, exactly as `products-data.ts` says of its own descriptors. No
 * source document supplies approved marketing copy for this page, so nothing here makes a claim:
 * it states what the route is and what the page contains. There are no capacities, lead times,
 * markets, customer counts, certifications or performance claims anywhere in this module.
 *
 * The register is not invented either — it is the wording already published on seven frozen
 * pages. `ClosingCta`'s standing copy reads "Formulation to a customer brief is a route of its
 * own, and a sample is the first stage of it", and that CTA is what sends a visitor here. The
 * page they land on should answer in the same voice rather than introduce a second one.
 *
 * The sampling statement behind it is documented rather than assumed: SITE_STRUCTURE §7's
 * Sampling Policy confirms samples are issued at the first stage, before commitment.
 */
export const INTRO: PageIntro = {
  eyebrow: "Customized solutions",
  heading: "Formulation to your brief.",
  lead: "Where the published range does not answer a specification, the alternative is not a substitution — it is a formulation developed against your requirement and qualified before you commit to it.",
  primary: { label: "Submit a request", href: `#${ANCHORS.request}` },
  secondary: { label: "See the standard range", href: ROUTES.products },
};

/**
 * Payload `introText`, as the paragraphs it will render as.
 *
 * An array rather than one string because the field is rich text — a single string would have to
 * be split in the component, which is where formatting decisions do not belong.
 */
export const INTRODUCTION: {
  readonly heading: string;
  readonly body: readonly string[];
} = {
  heading: "A route of its own, not an exception to the catalogue.",
  body: [
    "The product pages publish what is already formulated. This page is the other half: a requirement stated as a specification, developed to it, and confirmed by sample before any commitment is made on either side.",
    "A sample is issued at the first stage rather than the last. That ordering is the point — it means a specification is proven against your own testing before quantities, packaging and terms are discussed at all.",
  ],
};

/* ------------------------------------------------------- customization process */

/**
 * One step of Payload's `customizationProcess` array (`stepNumber`, `title`, `description`).
 *
 * `stepNumber` is not a field here: it is the array index, and storing a number beside a position
 * is storing the same fact twice. `note` is Payload's `description`, and it is **optional and
 * unset in every step below** — the six step *names* are documented, the descriptions are not.
 */
export type ProcessStep = {
  readonly id: string;
  readonly name: string;
  readonly note?: string;
};

/**
 * The six steps.
 *
 * **These names are transcribed, not composed.** `docs/technology/FRONTEND_STACK.md` names the
 * sequence in full where it explains why GSAP was selected — "Customization Process: Understand →
 * Develop → Test → Approve → Produce → Deliver". That is the only place in the documentation the
 * six steps are enumerated, and SITE_STRUCTURE §5's "now explicitly 6 steps" agrees with the
 * count. Nothing is added to them and nothing is elaborated.
 *
 * The descriptions Payload specifies alongside each name are pending editorial copy, so the rail
 * renders names only and says so once, rather than six times over with invented sentences.
 */
export const PROCESS_STEPS: readonly ProcessStep[] = [
  { id: "understand", name: "Understand" },
  { id: "develop", name: "Develop" },
  { id: "test", name: "Test" },
  { id: "approve", name: "Approve" },
  { id: "produce", name: "Produce" },
  { id: "deliver", name: "Deliver" },
];

/* ------------------------------------------------- custom product request form */

/**
 * A field of the Custom Product Request form.
 *
 * `kind` is the control, not the CSS: `wide` is a layout hint the grid consumes, kept in data
 * because which fields deserve a full row is a property of the field's content length rather
 * than a decision the markup should re-derive.
 */
export type FieldKind = "text" | "email" | "tel" | "select" | "textarea" | "file";

export type RequestField = {
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** Only where the source marks it. See the note on `REQUEST_GROUPS`. */
  readonly required?: true;
  readonly options?: readonly string[];
  readonly autoComplete?: string;
  readonly wide?: true;
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
 * ── What is required, and what is not ───────────────────────────────────────
 *
 * **Only Email Address and the consent checkbox.** SITE_STRUCTURE §5 marks exactly one field with
 * an asterisk (`Email Address*`), and DATA_MODEL_GAP_REVIEW §1 marks exactly two entity columns
 * required — `email` and `consentGiven`. Everything else is nullable there and unmarked there.
 * Marking more fields required would be inventing a validation rule, and on a lead form an
 * invented required field is a lead that does not arrive.
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
      { name: "companyName", label: "Company name", kind: "text", autoComplete: "organization" },
      { name: "country", label: "Country", kind: "text", autoComplete: "country-name" },
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
      { name: "industry", label: "Industry", kind: "text" },
      { name: "productApplication", label: "Product / application", kind: "text" },
      {
        name: "requiredSpecifications",
        label: "Required specifications",
        kind: "textarea",
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
      {
        name: "technicalSpecifications",
        label: "Upload technical specifications",
        kind: "file",
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
