/**
 * The Admin lead inbox's wire shapes — `GET /api/v1/admin/inquiries` and
 * `GET /api/v1/admin/custom-formulation-requests`, plus their `:id` detail responses.
 *
 * ── Read-only, and narrower than the rows behind them ──────────────────────
 *
 * These describe **projections**, not tables. `apps/api` selects each field explicitly, and three
 * columns present on both entities are deliberately absent from every shape here: `userId` (always
 * null — both submission endpoints are unauthenticated), `assignedToId` (the server-side scoping
 * key, published nowhere because this gate builds no assignment action), and `attachmentMediaId`
 * (no upload endpoint exists). A field appearing in this file is a field the API was asked to
 * return.
 *
 * There is no create, update or delete shape, because there is no admin write endpoint. Assignment
 * and the status lifecycle are a separate gate; `status` below is the ingestion state and has
 * exactly one value.
 *
 * ── Transcribed, not shared ────────────────────────────────────────────────
 *
 * Same constraint as `api.ts`: `apps/api` declares its own copy in
 * `modules/forms/dto/admin-lead.response.ts` and is not coupled to this file. The agreement between
 * the two is maintained by reading and by the tests on either side, not by `tsc`.
 */

/**
 * The seven `inquiryType` values, spelled as the API serves them — the same vocabulary
 * `POST /inquiries` accepts, and the physical labels of the `inquiry_type` enum.
 *
 * A closed union rather than `string`: the inbox renders a human label per value, and a value
 * outside this set is a contract violation the frontend should notice rather than pass through.
 */
export type AdminInquiryType =
  | "product_inquiry"
  | "request_a_quote"
  | "customized_solution"
  | "export_and_logistics"
  | "distribution_partnership"
  | "general_inquiry"
  | "sample_request";

/** One row of the inquiry inbox. The submitter's free-text message is **not** here. */
export type AdminInquiryListItemResponse = {
  id: string;
  /** ISO 8601, server-generated at insert. */
  createdAt: string;
  inquiryType: AdminInquiryType;
  firstName: string;
  lastName: string;
  companyName: string;
  country: string;
  email: string;
  /** The product whose CTA produced the submission, as an id — never a resolved name. */
  relatedProductId: string | null;
  status: string;
};

export type AdminInquiryDetailResponse = AdminInquiryListItemResponse & {
  phone: string | null;
  industry: string;
  productsOfInterest: string[];
  requiredQuantity: string | null;
  destinationCountryPort: string | null;
  preferredIncoterm: string | null;
  message: string | null;
  consentGiven: boolean;
  /** The Privacy Policy revision consented to, or `null` when none was in force. */
  privacyPolicyVersion: string | null;
};

export type AdminCustomFormulationRequestListItemResponse = {
  id: string;
  createdAt: string;
  companyName: string;
  country: string;
  industry: string;
  email: string;
  productOrApplication: string;
  status: string;
};

export type AdminCustomFormulationRequestDetailResponse =
  AdminCustomFormulationRequestListItemResponse & {
    phone: string | null;
    requiredSpecifications: string;
    estimatedQuantity: string | null;
    packagingRequirements: string | null;
    additionalInformation: string | null;
    destinationCountry: string | null;
    preferredIncoterm: string | null;
    consentGiven: boolean;
    privacyPolicyVersion: string | null;
  };
