import Link from "next/link";

import {
  DetailField,
  DetailGroup,
  DetailTextField,
  DetailTimeField,
  SubmittedAt,
} from "./lead-fields";
import { customFormulationRequestDetailPath } from "./lead-routes";
import { statusLabel } from "./workflow-vocabulary";

import type {
  AdminCustomFormulationRequestDetailResponse,
  AdminCustomFormulationRequestListItemResponse,
} from "@sam-group/types";
import type { LeadStatus } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Custom Formulation Request inbox's list and detail views.
 *
 * ── A separate inbox, because it is a separate thing ───────────────────────
 *
 * `CustomFormulationRequest` is its own table with its own columns — there is no `inquiryType`, no
 * name fields, and no product reference, because the form describes a product that does not exist
 * yet. Folding it into the inquiry list would mean a table half of whose columns are empty for half
 * of its rows, and would hide the one distinction that changes how the request is handled.
 *
 * ── `requiredSpecifications` is detail-only ────────────────────────────────
 *
 * It is the heaviest free-text field either lead entity carries — a formulation brief — and the API
 * does not send it on the list response. `productOrApplication` stands in as the one-line summary,
 * which is what it is.
 *
 * The table's semantics are the inquiry table's, argued there in full: a real `<caption>`, `scope`
 * on every header, one real link per row rather than a clickable row, and a focusable scroll
 * container so the page body never scrolls sideways.
 */

export function FormulationTable({
  items,
}: {
  readonly items: readonly AdminCustomFormulationRequestListItemResponse[];
}): ReactNode {
  return (
    <div
      className="ad-table-scroll"
      tabIndex={0}
      role="group"
      aria-label="Custom formulation requests, scrollable"
    >
      <table className="ad-table">
        <caption className="ad-sr-only">
          Custom formulation requests, newest first. {items.length} shown on this page.
        </caption>
        <thead>
          <tr>
            <th scope="col">Submitted</th>
            <th scope="col">Company</th>
            <th scope="col">Product or application</th>
            <th scope="col">Industry</th>
            <th scope="col">Country</th>
            <th scope="col">Email</th>
            <th scope="col">Status</th>
            <th scope="col">Assigned</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="ad-cell-stamp">
                <SubmittedAt iso={item.createdAt} />
              </td>
              <th scope="row" className="ad-cell-name">
                <Link className="ad-link" href={customFormulationRequestDetailPath(item.id)}>
                  <span className="ad-sr-only">View request from </span>
                  {item.companyName}
                </Link>
              </th>
              <td>{item.productOrApplication}</td>
              <td>{item.industry}</td>
              <td>{item.country}</td>
              <td className="ad-cell-email">{item.email}</td>
              <td className="ad-cell-status">{statusLabel(item.status)}</td>
              {/*
               * Whether the lead has an owner, as a word. The owner's *name* is not resolved here:
               * a list render would need a staff read per page to do it, and an inbox is scanned
               * for "is anyone on this?" rather than for who. The detail view names the person.
               */}
              <td className="ad-cell-assigned">{item.assigneeId === null ? "No" : "Yes"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One request, grouped the same way an inquiry is, so the two details read alike. */
export function FormulationDetail({
  request,
}: {
  readonly request: AdminCustomFormulationRequestDetailResponse;
}): ReactNode {
  return (
    <div className="ad-detail">
      <DetailGroup title="Submission">
        <DetailTimeField label="Received" iso={request.createdAt} />
        <DetailField label="Reference" value={request.id} />
      </DetailGroup>

      <DetailGroup title="Contact">
        <DetailField label="Email" value={request.email} />
        <DetailField label="Phone" value={request.phone} />
      </DetailGroup>

      <DetailGroup title="Company">
        <DetailField label="Company" value={request.companyName} />
        <DetailField label="Country" value={request.country} />
        <DetailField label="Industry" value={request.industry} />
      </DetailGroup>

      <DetailGroup title="Request">
        <DetailField label="Product or application" value={request.productOrApplication} />
        <DetailTextField label="Required specifications" value={request.requiredSpecifications} />
        <DetailField label="Estimated quantity" value={request.estimatedQuantity} />
        <DetailTextField label="Packaging requirements" value={request.packagingRequirements} />
        <DetailField label="Destination country" value={request.destinationCountry} />
        <DetailField label="Preferred incoterm" value={request.preferredIncoterm} />
        <DetailTextField label="Additional information" value={request.additionalInformation} />
      </DetailGroup>

      <DetailGroup title="Consent">
        <DetailField label="Consent given" value={request.consentGiven ? "Yes" : "No"} />
        <DetailField
          label="Privacy Policy revision"
          value={request.privacyPolicyVersion ?? "None in force at submission"}
        />
      </DetailGroup>
    </div>
  );
}
