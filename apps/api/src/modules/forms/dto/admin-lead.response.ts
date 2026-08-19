import type { InquiryTypeValue } from "./create-inquiry.dto";

/**
 * What `/admin/inquiries` and `/admin/custom-formulation-requests` put on the wire.
 *
 * ── These are projections, not the rows ─────────────────────────────────────
 *
 * Every field below is selected explicitly in the service's Prisma `select`. Nothing is returned
 * because it happened to be on the record: these tables hold the most personal data the platform
 * currently stores — a named person, their employer, their address book entry and their free-text
 * business intent — and SECURITY.md §Personal Data Retention treats them accordingly. A `select`
 * is what makes "only what an operator needs to follow up" a property of the query rather than a
 * habit of the mapper.
 *
 * ── Three columns are omitted from both shapes, deliberately ────────────────
 *
 * `userId` — always NULL. Both submission endpoints are unauthenticated, so no row has ever
 * carried one; returning a column that is structurally null is noise that invites a UI to render
 * a field nobody can populate.
 *
 * `userId` was joined by `assignedToId` in that list until the workflow gate. **`assigneeId` is
 * now published** (ADR-013): the detail view renders the current owner and the assignment control
 * sends the value back as its compare-and-set predicate, so a response that withheld it would make
 * a safe write impossible. It stays an **id** — Forms cannot resolve a name without reading
 * `users`, and the Admin surface resolves it through `GET /admin/users` instead.
 *
 * `attachmentMediaId` — no upload endpoint exists (`POST /media/upload` is contracted and
 * unbuilt), so the column is null on every row. It is also a handle to an object-store record
 * with no read route behind it; publishing an id whose only possible use is a request that 404s
 * would describe a capability the platform does not have.
 *
 * ── The list is narrower than the detail, and that is the contract ──────────
 *
 * `message`, `requiredSpecifications` and every optional logistics field appear only on the
 * detail response. A list is a triage surface: it exists to let an operator choose which record
 * to open. Shipping every submission's free-text body in a page of 25 would put 25 people's
 * verbatim messages into one response, one server render and one browser, to render none of
 * them.
 */

/** One row of `GET /admin/inquiries`. */
export type AdminInquiryListItemResponse = {
  id: string;
  /** ISO 8601, server-generated at insert. */
  createdAt: string;
  inquiryType: InquiryTypeValue;
  firstName: string;
  lastName: string;
  companyName: string;
  country: string;
  email: string;
  /**
   * The product whose CTA produced this submission, or `null`. An **id**, not a name: resolving it
   * would mean a Catalog read per row, and the Products service exposes existence-by-id rather
   * than a name lookup. Enrichment is a later decision, not a projection detail.
   */
  relatedProductId: string | null;
  /** Workflow state: `new`, `in_progress` or `closed` — see `workflow/lead-status.ts`. */
  status: string;
  /** The owning Sales Expert, or `null` when unassigned. An id; the Admin UI resolves the name. */
  assigneeId: string | null;
};

/** `GET /admin/inquiries/:id` — the full submission, as submitted. */
export type AdminInquiryDetailResponse = AdminInquiryListItemResponse & {
  phone: string | null;
  industry: string;
  productsOfInterest: string[];
  requiredQuantity: string | null;
  destinationCountryPort: string | null;
  preferredIncoterm: string | null;
  message: string | null;
  /** Consent evidence. `true` on every row — the DTO refuses a submission without it. */
  consentGiven: boolean;
  /**
   * The Privacy Policy revision the consent was recorded against, or `null` when no versioned
   * policy was in force. Operational evidence, immutable after insert, and shown because the one
   * question it answers — "what did this person actually agree to?" — is unanswerable anywhere
   * else.
   */
  privacyPolicyVersion: string | null;
};

/** One row of `GET /admin/custom-formulation-requests`. */
export type AdminCustomFormulationRequestListItemResponse = {
  id: string;
  createdAt: string;
  companyName: string;
  country: string;
  industry: string;
  email: string;
  /** Free text from the requester, not a catalog reference — there is no product yet. */
  productOrApplication: string;
  status: string;
  assigneeId: string | null;
};

/** `GET /admin/custom-formulation-requests/:id`. */
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

/** A page of rows plus the counts `meta` carries. Shared by both list services. */
export type AdminLeadPageResult<T> = {
  readonly rows: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
};
