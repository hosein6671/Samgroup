import { INQUIRY_TYPES } from "../dto/create-inquiry.dto";

import type { InquiryTypeValue } from "../dto/create-inquiry.dto";

/**
 * The internal notification a persisted lead produces — a subject and a body, and nothing else.
 *
 * ── Plain text, with no HTML part at all ────────────────────────────────────
 *
 * `text` is the whole message. There is deliberately **no `html` field on this type**, so no code
 * path in this module can produce an HTML part even by mistake, and the "escape every user value"
 * problem is removed rather than solved: a `<script>` in a submitter's message is bytes in a text
 * body, and no mail client can execute it.
 *
 * That is a Phase-1 decision with a cost — the notification is plain — and it is the right trade
 * for a body assembled entirely out of unauthenticated public input. An HTML part may be added
 * later, but only with a real escaping story behind it, and this type is where that would start.
 */
export type LeadNotification = {
  readonly subject: string;
  readonly text: string;
};

/**
 * The labels the subject line uses — **owned here, by the backend, and imported from nowhere.**
 *
 * ── Where the wording comes from, and what this is not ──────────────────────
 *
 * The source of the wording is **SITE_STRUCTURE.md §10**, the approved copy for the Inquiry Type
 * dropdown. `apps/web/src/features/forms/inquiry-vocabulary.ts` renders the same options from the
 * same document and is therefore a *sibling* mirror of it — **not this map's source, and not a
 * dependency of any kind**. `apps/api` imports nothing from `apps/web`: the two applications are
 * deployed separately, `@sam-group/types` is types-only by decision, and a runtime import across
 * that line would couple a backend email to a frontend build.
 *
 * Restating the approved wording is what keeps this from inventing a second vocabulary; the
 * alternative was English labels chosen here, which nobody approved. Four subject lines do not
 * justify a shared package, and a divergence between the two mirrors would show up as a subject
 * that reads differently from the form — cosmetic, internal, and cheap to correct.
 *
 * Keyed by `InquiryTypeValue`, so a value added to `INQUIRY_TYPES` fails to compile until it is
 * given a label, exactly as `PRISMA_INQUIRY_TYPE` fails until it is given an enum member.
 *
 * English in every locale. The submission carries no locale, the mailbox is internal, and no
 * Persian or Arabic vocabulary is approved for these options.
 */
const INQUIRY_TYPE_LABEL: Record<InquiryTypeValue, string> = {
  product_inquiry: "Product inquiry",
  request_a_quote: "Request a quote",
  customized_solution: "Customized solution",
  export_and_logistics: "Export & logistics",
  distribution_partnership: "Distribution partnership",
  general_inquiry: "General inquiry",
  sample_request: "Sample request",
};

/**
 * The label for a wire value, falling back to the value itself.
 *
 * The fallback is unreachable through the API — `@IsIn(INQUIRY_TYPES)` rejects anything else before
 * a submission is written — and exists so that a future value reaching here unlabelled produces a
 * subject naming it rather than `undefined`.
 */
export function inquiryTypeLabel(inquiryType: string): string {
  return (INQUIRY_TYPE_LABEL as Record<string, string | undefined>)[inquiryType] ?? inquiryType;
}

/** Exported so a test can assert the mirror covers every wire value, not just the ones in use. */
export const LABELLED_INQUIRY_TYPES: readonly string[] = INQUIRY_TYPES;

export type InquiryNotificationInput = {
  readonly id: string;
  readonly createdAt: string;
  readonly privacyPolicyVersion: string | null;
  readonly inquiryType: InquiryTypeValue;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string;
  readonly country: string;
  readonly email: string;
  readonly industry: string;
  readonly phone?: string;
  readonly relatedProductId?: string;
  readonly productsOfInterest?: readonly string[];
  readonly requiredQuantity?: string;
  readonly destinationCountryPort?: string;
  readonly preferredIncoterm?: string;
  readonly message?: string;
};

export type CustomFormulationNotificationInput = {
  readonly id: string;
  readonly createdAt: string;
  readonly privacyPolicyVersion: string | null;
  readonly companyName: string;
  readonly country: string;
  readonly industry: string;
  readonly email: string;
  readonly phone?: string;
  readonly productOrApplication: string;
  readonly requiredSpecifications: string;
  readonly estimatedQuantity?: string;
  readonly packagingRequirements?: string;
  readonly destinationCountry?: string;
  readonly preferredIncoterm?: string;
  readonly additionalInformation?: string;
};

type Line = readonly [label: string, value: string | undefined];

/**
 * The one place a submitted value becomes part of a message.
 *
 * Two things happen here, and neither is escaping — in a text body there is nothing to escape
 * into:
 *
 * 1. An absent, blank or whitespace-only value yields `undefined`, and `render` drops the line
 *    entirely. "if present" in the approved field list is implemented here, once, rather than as a
 *    conditional per field.
 * 2. Nothing is removed, replaced or truncated. The value reaches the body as typed; `render`
 *    handles its line breaks.
 */
function line(label: string, value: string | null | undefined): Line {
  if (value === null || value === undefined) {
    return [label, undefined];
  }

  const trimmed = value.trim();

  return [label, trimmed === "" ? undefined : trimmed];
}

/**
 * Continuation lines of a multi-line value are indented under their label, so a pasted
 * specification cannot be misread as further fields. Presentation only — the characters of the
 * value are unchanged, and the indent is added rather than substituted.
 */
const INDENT = "  ";

function render(lines: readonly Line[]): string {
  return lines
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([label, value]) => `${label}: ${value.replace(/\r?\n/g, `\n${INDENT}`)}`)
    .join("\n");
}

/**
 * What a `null` `privacyPolicyVersion` prints as.
 *
 * The column is nullable and is `null` for every row written today, because no approved Privacy
 * Policy exists — `privacy-policy-revision.ts` records why, at length. An empty value would read as
 * a field that failed to render; this states the fact the row actually holds, and invents no
 * revision identifier.
 */
const NO_PRIVACY_REVISION = "none recorded";

/**
 * ── What the body may and may not contain ───────────────────────────────────
 *
 * Only persisted submission fields, in the order the approved field list gives them. Nothing is
 * derived, enriched or looked up: `relatedProductId` is printed as the id it is, because resolving
 * a product name would put a Catalog read inside a path whose entire premise is that its failure
 * does not matter.
 *
 * Nothing here promises anything, either — no price, no availability, no response time, no
 * acceptance of any commercial term. The message reports a submission and stops.
 */
export function buildInquiryNotification(input: InquiryNotificationInput): LeadNotification {
  const productsOfInterest = input.productsOfInterest?.filter((entry) => entry.trim() !== "") ?? [];

  return {
    subject: `New SAM Group inquiry — ${inquiryTypeLabel(input.inquiryType)}`,
    text: render([
      line("Submission ID", input.id),
      line("Received", input.createdAt),
      line("Inquiry type", inquiryTypeLabel(input.inquiryType)),
      line("First name", input.firstName),
      line("Last name", input.lastName),
      line("Company", input.companyName),
      line("Country", input.country),
      line("Email", input.email),
      line("Phone", input.phone),
      line("Industry", input.industry),
      line("Related product ID", input.relatedProductId),
      line(
        "Products of interest",
        productsOfInterest.length > 0 ? productsOfInterest.join(", ") : undefined,
      ),
      line("Required quantity", input.requiredQuantity),
      line("Destination country / port", input.destinationCountryPort),
      line("Preferred Incoterm", input.preferredIncoterm),
      line("Message", input.message),
      line("Privacy Policy revision", input.privacyPolicyVersion ?? NO_PRIVACY_REVISION),
    ]),
  };
}

/**
 * The Custom Product Request form on `/customized-solutions`.
 *
 * **No product reference, and no inquiry type.** `custom_formulation_requests` has neither column —
 * see `custom-formulation-requests.service.ts` for why — so the subject is fixed rather than
 * parameterised, and no "Related product ID" line exists to omit.
 */
export function buildCustomFormulationNotification(
  input: CustomFormulationNotificationInput,
): LeadNotification {
  return {
    subject: "New SAM Group custom formulation request",
    text: render([
      line("Submission ID", input.id),
      line("Received", input.createdAt),
      line("Company", input.companyName),
      line("Country", input.country),
      line("Industry", input.industry),
      line("Email", input.email),
      line("Phone", input.phone),
      line("Product or application", input.productOrApplication),
      line("Required specifications", input.requiredSpecifications),
      line("Estimated quantity", input.estimatedQuantity),
      line("Packaging requirements", input.packagingRequirements),
      line("Destination country", input.destinationCountry),
      line("Preferred Incoterm", input.preferredIncoterm),
      line("Additional information", input.additionalInformation),
      line("Privacy Policy revision", input.privacyPolicyVersion ?? NO_PRIVACY_REVISION),
    ]),
  };
}
