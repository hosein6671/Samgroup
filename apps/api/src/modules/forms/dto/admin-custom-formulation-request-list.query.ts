import { AdminLeadListQuery } from "./admin-lead-list.query";

/**
 * `GET /admin/custom-formulation-requests` query parameters — pagination and ordering, and
 * nothing else.
 *
 * The class exists rather than the controller reusing `AdminLeadListQuery` directly because that
 * base is abstract and because the two endpoints' filter sets are already different and will keep
 * diverging: `inquiryType` has no counterpart here. `custom_formulation_requests` carries no
 * enumerated column at all — `industry` and `productOrApplication` are free text submitted by the
 * requester — so there is no frozen vocabulary a filter could be backed by, and inventing one
 * would mean deciding a facet vocabulary inside a read-only gate.
 */
export class AdminCustomFormulationRequestListQuery extends AdminLeadListQuery {}
