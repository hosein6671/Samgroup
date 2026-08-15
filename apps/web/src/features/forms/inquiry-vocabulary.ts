/**
 * The Inquiry form's two closed vocabularies, and the labels shown for them.
 *
 * ── Why this is mirrored here rather than imported ──────────────────────────
 *
 * `@sam-group/types` is types-only by decision — its own header says "never a runtime value" — and
 * `apps/web` cannot import from `apps/api`. So the seven `inquiryType` values are restated here, in
 * one module, the same way `segments-data.ts` mirrors the approved Segment rows for want of a
 * `GET /segments` endpoint.
 *
 * **The value is the contract; the label is presentation.** `value` is exactly what
 * `POST /inquiries` accepts — the physical enum label, never the human form — and the API rejects
 * anything else with a 400 naming `inquiryType`, so a drift here fails loudly rather than storing
 * something wrong. `label` is the wording SITE_STRUCTURE §10 gives the dropdown option, and it is
 * the presentation string schema.prisma's enum note says belongs outside the database.
 *
 * ── Labels are English in every locale ──────────────────────────────────────
 *
 * The same position `finder/sections/filters.tsx` states for the taxonomy chips, and for the same
 * reason: no Persian or Arabic vocabulary is approved for these options, and inventing it here
 * would be publishing approved-looking terminology nobody approved. `lang` and `dir` still come
 * from the `Locale` table, and still apply to this page.
 */

export type InquiryTypeOption = {
  /** The wire value. Must match `INQUIRY_TYPES` in the API's `create-inquiry.dto.ts`. */
  readonly value: string;
  readonly label: string;
};

/**
 * All seven, in the order SITE_STRUCTURE §10 lists the six Contact Us options, with Sample Request
 * last — it is the one the merge added, and it is reached from a CTA rather than chosen from the
 * dropdown in normal use.
 */
export const INQUIRY_TYPE_OPTIONS: readonly InquiryTypeOption[] = [
  { value: "product_inquiry", label: "Product inquiry" },
  { value: "request_a_quote", label: "Request a quote" },
  { value: "customized_solution", label: "Customized solution" },
  { value: "export_and_logistics", label: "Export & logistics" },
  { value: "distribution_partnership", label: "Distribution partnership" },
  { value: "general_inquiry", label: "General inquiry" },
  { value: "sample_request", label: "Sample request" },
];

/** The default selection when a page opens the form with no `?type=`. */
export const DEFAULT_INQUIRY_TYPE = "general_inquiry";

/** The value the Request a Quote route and the product CTA of the same name preselect. */
export const QUOTE_INQUIRY_TYPE = "request_a_quote";

/** The value the Request Sample CTA preselects. There is no separate sample form or endpoint. */
export const SAMPLE_INQUIRY_TYPE = "sample_request";

/** Whether a value off the URL names a real option — so `?type=` cannot preselect nonsense. */
export function isInquiryType(value: string | undefined): boolean {
  return INQUIRY_TYPE_OPTIONS.some((option) => option.value === value);
}

/**
 * Five Incoterm options, the fifth being "Not sure".
 *
 * DATA_MODEL_GAP_REVIEW §2 fixes this list for the Inquiry form specifically and notes that the
 * Customized Solutions form has four. The API enforces the difference — see both DTOs — and the two
 * lists are declared separately on this side too rather than shared.
 */
export const INQUIRY_INCOTERMS: readonly string[] = ["EXW", "FOB", "CFR", "CIF", "Not sure"];
