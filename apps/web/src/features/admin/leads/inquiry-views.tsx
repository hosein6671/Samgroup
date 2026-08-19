import Link from "next/link";

import { INQUIRY_TYPE_OPTIONS } from "@/features/forms/inquiry-vocabulary";

import {
  DetailField,
  DetailGroup,
  DetailTextField,
  DetailTimeField,
  SubmittedAt,
} from "./lead-fields";
import { inboxFilterHref } from "./lead-query";
import { INQUIRIES_PATH, inquiryDetailPath } from "./lead-routes";
import { inquiryTypeLabel } from "./lead-vocabulary";
import { statusLabel } from "./workflow-vocabulary";

import type { InboxQuery } from "./lead-query";
import type { AdminInquiryDetailResponse, AdminInquiryListItemResponse } from "@sam-group/types";
import type { LeadStatus } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The inquiry inbox's list and detail views.
 *
 * ── The list is a triage surface ───────────────────────────────────────────
 *
 * Seven columns, and the submitter's message is not one of them. The API does not send it on the
 * list response at all — a page of 25 would put 25 people's verbatim text on the wire to render
 * none of it — so the omission is structural rather than a CSS decision. What is here is what an
 * operator chooses a record by: when it arrived, what kind of request it is, who sent it, and from
 * where.
 *
 * ── The type is shown, because four flows share one table ──────────────────
 *
 * General Inquiry, Request a Quote, Sample Request and the rest are one `Inquiry` row with a
 * different `inquiryType` (DATA_MODEL §3, API_CONTRACT_FINAL §2.6 — there is no `/sample-requests`
 * endpoint and no separate entity). Without the type column an inbox of them is undifferentiated,
 * so it is the first thing after the timestamp, and it is also the one filter the endpoint offers.
 *
 * Custom Formulation Requests are a **separate table** and have their own inbox; they are not an
 * `inquiryType` and never appear in this list.
 */

/**
 * The filter strip.
 *
 * Links, not a form: each filter is a URL, so it is shareable, bookmarkable and reachable with the
 * browser's own controls, and it needs no JavaScript to work. `aria-current="true"` marks the
 * active one — "true" rather than "page" because the filter selects a view of this page rather than
 * naming a different one.
 *
 * The active chip changes weight as well as fill and border, so the selection is not carried by
 * colour alone (WCAG 2.2 §1.4.1).
 */
export function InquiryFilters({ query }: { readonly query: InboxQuery }): ReactNode {
  return (
    <nav className="ad-filters" aria-label="Filter inquiries by type">
      <Link
        className={query.inquiryType === undefined ? "ad-chip ad-chip--on" : "ad-chip"}
        href={inboxFilterHref(INQUIRIES_PATH, undefined)}
        aria-current={query.inquiryType === undefined ? true : undefined}
      >
        All types
      </Link>
      {INQUIRY_TYPE_OPTIONS.map((option) => (
        <Link
          className={query.inquiryType === option.value ? "ad-chip ad-chip--on" : "ad-chip"}
          href={`${INQUIRIES_PATH}?${new URLSearchParams({ inquiryType: option.value }).toString()}`}
          aria-current={query.inquiryType === option.value ? true : undefined}
          key={option.value}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The table.
 *
 * ── A real table, because it is real tabular data ──────────────────────────
 *
 * `<th scope="col">` on every column and `<th scope="row">` on the name, so a screen reader
 * announces "Company: Analytical Engines Ltd" rather than reading a bare cell. The `<caption>` is
 * the table's accessible name; it is hidden visually because the `<h1>` above already says what the
 * table is, and a second visible line would be redundant for a sighted reader while its absence
 * would leave the table unnamed for everyone else.
 *
 * ── One link per row, and it is not a clickable row ────────────────────────
 *
 * The record is opened through a real `<a>` on the name. A row-level click handler would be
 * unreachable by keyboard and invisible to assistive technology; there is none here, and no
 * `<div>` on this surface is clickable. The link's accessible name carries the record it opens —
 * "View inquiry from Ada Lovelace" — with the visible text unchanged, so the name still contains
 * the label (WCAG 2.2 §2.5.3) while satisfying §2.4.4 outside the table's row context.
 *
 * ── It scrolls inside itself, not the page ─────────────────────────────────
 *
 * The wrapper is the scroll container and carries `tabIndex={0}` with a group role and a name, so a
 * keyboard user can scroll it without a pointer — a scrollable region that cannot be focused is a
 * §2.1.1 failure. The page body never scrolls sideways as a result. A card layout was rejected: an
 * inbox is read by scanning one column against another, which cards destroy.
 */
export function InquiryTable({
  items,
}: {
  readonly items: readonly AdminInquiryListItemResponse[];
}): ReactNode {
  return (
    <div className="ad-table-scroll" tabIndex={0} role="group" aria-label="Inquiries, scrollable">
      <table className="ad-table">
        <caption className="ad-sr-only">
          Inquiries, newest first. {items.length} shown on this page.
        </caption>
        <thead>
          <tr>
            <th scope="col">Submitted</th>
            <th scope="col">Type</th>
            <th scope="col">Name</th>
            <th scope="col">Company</th>
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
              <td>{inquiryTypeLabel(item.inquiryType)}</td>
              <th scope="row" className="ad-cell-name">
                <Link className="ad-link" href={inquiryDetailPath(item.id)}>
                  <span className="ad-sr-only">View inquiry from </span>
                  {item.firstName} {item.lastName}
                </Link>
              </th>
              <td>{item.companyName}</td>
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

/**
 * One inquiry, grouped for follow-up.
 *
 * ── `relatedProductId` is shown as an id ───────────────────────────────────
 *
 * Not resolved to a product name. Doing so would mean a second API call per detail view against a
 * Catalog endpoint that answers by slug rather than by id, on a page whose job is to show what was
 * submitted. The id is what the record holds, and enrichment is a decision with its own cost.
 *
 * ── Consent evidence is shown, and it is not decoration ────────────────────
 *
 * `privacyPolicyVersion` is written once at insert and is immutable afterwards (enforced by a
 * database trigger). It answers the only question that cannot be answered anywhere else: which text
 * this person actually agreed to. `null` is the truthful answer for every row written so far — no
 * versioned policy was in force — and it is rendered as such rather than hidden.
 */
export function InquiryDetail({
  inquiry,
}: {
  readonly inquiry: AdminInquiryDetailResponse;
}): ReactNode {
  return (
    <div className="ad-detail">
      <DetailGroup title="Submission">
        <DetailTimeField label="Received" iso={inquiry.createdAt} />
        <DetailField label="Type" value={inquiryTypeLabel(inquiry.inquiryType)} />
        <DetailField label="Reference" value={inquiry.id} />
      </DetailGroup>

      <DetailGroup title="Contact">
        <DetailField label="Name" value={`${inquiry.firstName} ${inquiry.lastName}`} />
        <DetailField label="Email" value={inquiry.email} />
        <DetailField label="Phone" value={inquiry.phone} />
      </DetailGroup>

      <DetailGroup title="Company">
        <DetailField label="Company" value={inquiry.companyName} />
        <DetailField label="Country" value={inquiry.country} />
        <DetailField label="Industry" value={inquiry.industry} />
      </DetailGroup>

      <DetailGroup title="Request">
        <DetailField
          label="Products of interest"
          value={
            inquiry.productsOfInterest.length === 0 ? null : inquiry.productsOfInterest.join(", ")
          }
        />
        <DetailField label="Related product id" value={inquiry.relatedProductId} />
        <DetailField label="Required quantity" value={inquiry.requiredQuantity} />
        <DetailField label="Destination country / port" value={inquiry.destinationCountryPort} />
        <DetailField label="Preferred incoterm" value={inquiry.preferredIncoterm} />
        <DetailTextField label="Message" value={inquiry.message} />
      </DetailGroup>

      <DetailGroup title="Consent">
        <DetailField label="Consent given" value={inquiry.consentGiven ? "Yes" : "No"} />
        <DetailField
          label="Privacy Policy revision"
          value={inquiry.privacyPolicyVersion ?? "None in force at submission"}
        />
      </DetailGroup>
    </div>
  );
}
