import Link from "next/link";

import { AdminShell } from "../../admin-shell";
import {
  CLAIM_KINDS,
  REVIEW_STATUSES,
  reviewPageHref,
  reviewQueueHref,
  reviewSubjectHref,
  SORTS,
  SUBJECT_TYPES,
  toggleHref,
} from "./review-query";
import {
  CLAIM_KIND_LABEL,
  claimKindIsNeverApprovable,
  FINDINGS_LABEL,
  FINDINGS_MEANING,
  SORT_LABEL,
  STATUS_LABEL,
  STATUS_MEANING,
  SUBJECT_TYPE_LABEL,
  SUBJECT_TYPE_PLURAL,
} from "./review-vocabulary";

import type { ActiveFilter, RejectedParam, ReviewQueueQuery } from "./review-query";
import type { ReviewQueueItemResponse, ReviewStatus } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * Every panel the review queue can render.
 *
 * ## Read-only, and structurally so
 *
 * No Server Action is imported, no `POST` is issued, and there is no decision control in any
 * state — not a disabled one either. A greyed-out "Approve" is a promise that the screen can
 * approve, and Phase A cannot: the decision endpoint needs an `expectedEvidenceSetHash` that only
 * the detail response carries, and there is no detail route yet.
 *
 * This file renders no form at all — the only one on the page is the shell's sign-out, which
 * `AdminShell` owns. Every filter is a link, so the whole control set is a set of navigations, and
 * so is the way into a subject.
 *
 * Each row now ends in a link to that subject's Phase B detail route — a Specification to
 * `/admin/catalog/review/specifications/:id`, a ProductClaim to
 * `/admin/catalog/review/product-claims/:id`. Both routes exist; nothing here links at a 404. The
 * href is built by `reviewSubjectHref`, carries the subject id and the current queue state, and
 * carries nothing else.
 *
 * ## What is deliberately not on screen
 *
 * Subject UUIDs, evidence-set hashes, source-document locators and raw source values are not in
 * the queue DTO at all, so there is nothing here to leak.
 *
 * ## `sourceRef` is displayed here — and displayed is the whole of the permission
 *
 * It is SAM's **internal import identity** for a Product: the stable handle that tells two similar
 * subjects apart and finds the row again in the ratified workbook. The Architect approved showing
 * it inside the authenticated Review UI, and approved nothing else.
 *
 * **It never enters URL state.** Not a route segment, not a query string, not a form field, and so
 * not browser history, not a reverse-proxy access log, and not analytics. There is no source
 * reference filter on this page for exactly that reason — the API supports one, and reaching it
 * through the address bar would put an internal identity everywhere a URL travels. The capability
 * is untouched and the access design is deferred; see the note in `review-query.ts`.
 *
 * It is labelled `Source reference` and nothing else — never a SKU, never a supplier or a brand,
 * never product content, never a link, and never given a copy control. It sits below the Product
 * name in size, weight and colour, because it identifies a row for an operator rather than naming
 * a product for a reader.
 *
 * It must not reach a public route, Payload, the generic shared Product types, SEO, analytics,
 * logs or browser storage. `apps/api`'s `source-ref-boundary.spec.ts` holds the three-entry
 * allowlist and proves the rest of the boundary is still closed.
 */

/* ========================================================================== */
/*  Frame                                                                      */
/* ========================================================================== */

/**
 * The Technical Review page frame.
 *
 * Chrome comes from the neutral `AdminShell`, which the lead inbox composes too. This file wrote
 * its own copy of the header until ADMIN-REVIEW-UI-1B-H1; that copy is gone, so there is one
 * implementation of the Admin bar on the surface rather than two that can drift apart.
 *
 * Importing the lead inbox's frame instead was the alternative and was refused: it would make
 * Technical Review a dependant of Leads, which is the wrong relationship between two sibling areas.
 * Neither feature imports the other; both import the neutral shell.
 */
export function ReviewFrame({
  user,
  children,
}: {
  readonly user: { readonly email: string; readonly role: string } | null;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <AdminShell title="Technical review" user={user} current="catalog-review">
      {children}
    </AdminShell>
  );
}

/* ========================================================================== */
/*  Notices                                                                    */
/* ========================================================================== */

function Notice({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="ad-notice">
      <h2 className="ad-notice-title">{heading}</h2>
      {children}
    </div>
  );
}

/**
 * The API could not be reached at all.
 *
 * Says explicitly that nobody has been signed out, because the middleware's refresh path
 * deliberately keeps the session alive through an outage and a reader who sees a failure page has
 * no other way to know that.
 */
export function ReviewUnavailable(): ReactNode {
  return (
    <Notice heading="Temporarily unavailable">
      <p className="ad-note">
        The platform is not responding, so the review queue could not be loaded. You have not been
        signed out, and nothing has been changed. Please try again shortly.
      </p>
    </Notice>
  );
}

/** Something answered, and answered wrongly. Distinct from an outage, and from zero results. */
export function ReviewFailed(): ReactNode {
  return (
    <Notice heading="The queue could not be read">
      <p className="ad-note">
        The platform answered, but not in a way this page can read. Nothing has been changed. If
        this persists, it needs looking at rather than retrying.
      </p>
    </Notice>
  );
}

/** Authenticated, wrong role. Never rendered as an empty queue — that would read as "no work". */
export function ReviewForbidden(): ReactNode {
  return (
    <Notice heading="Access denied">
      <p className="ad-note">
        Your account does not have access to the technical review queue. This is enforced by the
        platform, not by this page.
      </p>
    </Notice>
  );
}

/**
 * The API refused the query.
 *
 * Only reachable from a hand-edited URL — every control on this page emits a value from the closed
 * vocabulary `review-query.ts` validates against. It exists anyway, because "the platform is not
 * responding" would send someone to check a service that is fine.
 */
export function ReviewInvalidQuery({ field }: { readonly field: string | null }): ReactNode {
  return (
    <Notice heading="That filter was refused">
      <p className="ad-note">
        {field === null
          ? "The platform refused this combination of filters."
          : `The platform refused the “${field}” filter in this address.`}{" "}
        Nothing has been changed.
      </p>
      <p className="ad-note">
        <Link
          className="ad-link"
          href={reviewQueueHref({ page: 1, limit: 25, sort: "-createdAt" })}
        >
          Open the unfiltered queue
        </Link>
      </p>
    </Notice>
  );
}

/**
 * Parameters this page dropped before building the request.
 *
 * `role="status"` rather than `role="alert"`: the page rendered, the valid filters were applied,
 * and this is a correction rather than a failure. It is announced because the alternative is a
 * reader believing a filter is active that is not.
 */
export function RejectedParams({
  rejected,
}: {
  readonly rejected: readonly RejectedParam[];
}): ReactNode {
  if (rejected.length === 0) return null;

  return (
    <div className="ad-warn" role="status">
      <p className="ad-warn-title">
        {rejected.length === 1
          ? "One part of this address was not applied"
          : `${String(rejected.length)} parts of this address were not applied`}
      </p>
      <ul className="ad-warn-list">
        {rejected.map((entry) => (
          <li key={entry.param}>
            <code className="ad-mono">{entry.param}</code> {entry.reason}. The rest of the queue is
            filtered as asked.
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Nothing matched. Names the filters, because at 1,546 rows "nothing here" is never the reason. */
export function ReviewEmpty({
  query,
  filters,
}: {
  readonly query: ReviewQueueQuery;
  readonly filters: readonly ActiveFilter[];
}): ReactNode {
  if (filters.length === 0) {
    return (
      <Notice heading="No review subjects">
        <p className="ad-note">
          The catalogue holds no Specifications or ProductClaims to review. Nothing has been
          filtered out — this is the whole queue.
        </p>
      </Notice>
    );
  }

  return (
    <Notice heading="No subjects match these filters">
      <p className="ad-note">Nothing in the queue matches all of:</p>
      <ul className="ad-warn-list">
        {filters.map((filter) => (
          <li key={filter.param}>
            {filter.label}: <strong>{filter.value}</strong>
          </li>
        ))}
      </ul>
      <p className="ad-note">
        <Link className="ad-link" href={reviewQueueHref(query, clearAll(query))}>
          Clear all filters
        </Link>
      </p>
    </Notice>
  );
}

function clearAll(query: ReviewQueueQuery): Partial<Record<keyof ReviewQueueQuery, undefined>> {
  const cleared: Partial<Record<keyof ReviewQueueQuery, undefined>> = {};
  for (const key of Object.keys(query) as (keyof ReviewQueueQuery)[]) {
    if (key !== "page" && key !== "limit" && key !== "sort") cleared[key] = undefined;
  }
  return cleared;
}

/* ========================================================================== */
/*  Legend — what the statuses mean                                            */
/* ========================================================================== */

/**
 * The status legend, and the reason this page opens on all 1,546 rows.
 *
 * Ratified decision D8. `NEEDS_REVIEW` reads like "the backlog" and `SOURCE_RECORDED` reads like
 * "done"; both readings are wrong, and the second one would quietly hide 1,416 unapproved rows from
 * whoever is meant to approve them. Written on the page rather than left to a convention, because a
 * convention is not visible to the person doing the work.
 */
export function StatusLegend({ total }: { readonly total: number }): ReactNode {
  return (
    <section className="ad-legend" aria-labelledby="ad-legend-title">
      <h2 className="ad-legend-title" id="ad-legend-title">
        What this queue contains
      </h2>
      <p className="ad-note">
        Every subject below is <strong>unapproved</strong> and none of it is published. The queue
        opens on all of it rather than on one status.
      </p>
      <dl className="ad-legend-list">
        <div className="ad-legend-row">
          <dt>
            <StatusBadge status="source_recorded" />
          </dt>
          <dd className="ad-note">{STATUS_MEANING.source_recorded}</dd>
        </div>
        <div className="ad-legend-row">
          <dt>
            <StatusBadge status="needs_review" />
          </dt>
          <dd className="ad-note">{STATUS_MEANING.needs_review}</dd>
        </div>
        <div className="ad-legend-row">
          <dt className="ad-legend-term">{FINDINGS_LABEL.unresolved}</dt>
          <dd className="ad-note">{FINDINGS_MEANING}</dd>
        </div>
      </dl>
      <p className="ad-note">
        {total} review {total === 1 ? "subject" : "subjects"} in the queue in total.
      </p>
    </section>
  );
}

/* ========================================================================== */
/*  Status and findings                                                        */
/* ========================================================================== */

/**
 * A review status, as a word.
 *
 * The class carries a tint, the text carries the meaning, and the text is never the tint's
 * fallback — remove every colour from this page and it still reads correctly (WCAG 2.2 §1.4.1). An
 * unrecognised status renders as the API spelled it rather than as a blank badge.
 */
export function StatusBadge({ status }: { readonly status: ReviewStatus }): ReactNode {
  const label: string = STATUS_LABEL[status] ?? status;
  return <span className={`ad-badge ad-badge--${status.replace(/_/g, "-")}`}>{label}</span>;
}

/** The findings column. Both outcomes are words; neither is an icon and neither is a bare dot. */
export function FindingsMark({ unresolved }: { readonly unresolved: boolean }): ReactNode {
  return unresolved ? (
    <span className="ad-badge ad-badge--finding">{FINDINGS_LABEL.unresolved}</span>
  ) : (
    <span className="ad-quiet">{FINDINGS_LABEL.clear}</span>
  );
}

/* ========================================================================== */
/*  Filters                                                                    */
/* ========================================================================== */

function ChipRow({
  label,
  id,
  children,
}: {
  readonly label: string;
  readonly id: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="ad-filter-row">
      <p className="ad-filter-label" id={id}>
        {label}
      </p>
      <nav className="ad-filters" aria-labelledby={id}>
        {children}
      </nav>
    </div>
  );
}

function Chip({
  href,
  on,
  children,
}: {
  readonly href: string;
  readonly on: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Link
      className={on ? "ad-chip ad-chip--on" : "ad-chip"}
      href={href}
      aria-current={on ? "true" : undefined}
    >
      {children}
    </Link>
  );
}

/**
 * The filter controls.
 *
 * Every one is a **link**, so the whole surface works before hydration, with the keyboard, and with
 * the back button. Selecting the value already selected clears it, so each control is its own way
 * out. Changing any of them resets to page 1 (`reviewQueueHref`).
 *
 * Only the closed vocabularies get controls. There is no endpoint publishing the `SpecProperty`
 * dictionary or the `ProductType` list, so `propertyKey`, `productType`, `family`, `productSlug`,
 * and `documentLocator` are honoured from the URL and listed in the active-filter summary, but no
 * control invents their options.
 *
 * **Claim kind appears only when specifications are not the chosen subject type.** The API excludes
 * specifications from any query carrying `claimKind`, so offering the control alongside
 * `subjectType=specification` would offer a guaranteed empty result.
 */
export function ReviewFilters({ query }: { readonly query: ReviewQueueQuery }): ReactNode {
  return (
    <section className="ad-filter-panel" aria-labelledby="ad-filters-title">
      <h2 className="ad-sr-only" id="ad-filters-title">
        Filter and sort the review queue
      </h2>

      <ChipRow label="Subject type" id="ad-filter-subject">
        <Chip
          href={reviewQueueHref(query, { subjectType: undefined })}
          on={query.subjectType === undefined}
        >
          All types
        </Chip>
        {SUBJECT_TYPES.map((type) => (
          <Chip
            href={toggleHref(query, "subjectType", type)}
            on={query.subjectType === type}
            key={type}
          >
            {SUBJECT_TYPE_PLURAL[type]}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Review status" id="ad-filter-status">
        <Chip
          href={reviewQueueHref(query, { reviewStatus: undefined })}
          on={query.reviewStatus === undefined}
        >
          All statuses
        </Chip>
        {REVIEW_STATUSES.map((status) => (
          <Chip
            href={toggleHref(query, "reviewStatus", status)}
            on={query.reviewStatus === status}
            key={status}
          >
            {STATUS_LABEL[status]}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Findings" id="ad-filter-findings">
        <Chip
          href={reviewQueueHref(query, { unresolvedFindings: undefined })}
          on={query.unresolvedFindings === undefined}
        >
          Any
        </Chip>
        <Chip
          href={toggleHref(query, "unresolvedFindings", true)}
          on={query.unresolvedFindings === true}
        >
          {FINDINGS_LABEL.unresolved}
        </Chip>
        <Chip
          href={toggleHref(query, "unresolvedFindings", false)}
          on={query.unresolvedFindings === false}
        >
          {FINDINGS_LABEL.clear}
        </Chip>
      </ChipRow>

      {query.subjectType === "specification" ? null : (
        <ChipRow label="Claim kind" id="ad-filter-claim-kind">
          <Chip
            href={reviewQueueHref(query, { claimKind: undefined })}
            on={query.claimKind === undefined}
          >
            All kinds
          </Chip>
          {CLAIM_KINDS.map((kind) => (
            <Chip
              href={toggleHref(query, "claimKind", kind)}
              on={query.claimKind === kind}
              key={kind}
            >
              {CLAIM_KIND_LABEL[kind]}
            </Chip>
          ))}
        </ChipRow>
      )}

      <ChipRow label="Order" id="ad-filter-sort">
        {SORTS.map((sort) => (
          <Chip href={reviewQueueHref(query, { sort })} on={query.sort === sort} key={sort}>
            {SORT_LABEL[sort]}
          </Chip>
        ))}
      </ChipRow>
    </section>
  );
}

/**
 * What is currently narrowing the queue, in words, with a way to remove each.
 *
 * Announced as text rather than inferred from which chips look pressed — a reader using a screen
 * reader, or one who arrived by link, has no other way to know why the count is what it is.
 */
export function ActiveFilterSummary({
  query,
  filters,
  total,
}: {
  readonly query: ReviewQueueQuery;
  readonly filters: readonly ActiveFilter[];
  readonly total: number;
}): ReactNode {
  if (filters.length === 0) {
    return (
      <p className="ad-filter-summary">
        Showing all {total} unapproved review {total === 1 ? "subject" : "subjects"}. No filter is
        applied.
      </p>
    );
  }

  return (
    <div className="ad-filter-summary">
      <p>
        Showing {total} {total === 1 ? "subject" : "subjects"} matching{" "}
        {filters.length === 1 ? "one filter" : `${String(filters.length)} filters`}:
      </p>
      <ul className="ad-filter-active">
        {filters.map((filter) => (
          <li key={filter.param}>
            <span className="ad-filter-active-label">{filter.label}:</span>{" "}
            <strong>{filter.value}</strong>{" "}
            <Link className="ad-link" href={filter.clearHref}>
              <span className="ad-sr-only">Remove the {filter.label} filter</span>
              <span aria-hidden="true">clear</span>
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link className="ad-link" href={reviewQueueHref(query, clearAll(query))}>
          Clear all filters
        </Link>
      </p>
    </div>
  );
}

/* ========================================================================== */
/*  The table                                                                  */
/* ========================================================================== */

/**
 * The queue itself.
 *
 * ## One semantic table, columns ordered by priority
 *
 * A real `<table>` with `<caption>`, `<th scope="col">` and a row header — an operational queue is
 * read by scanning one column against another, and there is no card layout that survives that.
 *
 * The columns are ordered so the three that identify and triage a row (**Product, Status,
 * Findings**) come first and are readable at 375 px without scrolling. The rest follow and are
 * reached by scrolling the region horizontally.
 *
 * **No column is hidden at any width**, and that is a Phase A constraint rather than a preference:
 * the audit's column-priority plan relied on each row linking to a detail page that carried every
 * value. There is no detail page yet, so hiding a column here would make its value unreachable
 * rather than merely deferred. When Phase B lands, the low-priority columns can be dropped on
 * narrow screens because the detail route will then be a real alternative.
 *
 * The scroll region is `tabindex={0}` with a name and a `role="region"`, so a keyboard-only reader
 * can scroll it — a scrollable box reachable only by pointer fails WCAG 2.2 §2.1.1.
 */
export function ReviewQueueTable({
  items,
  total,
  page,
  pages,
  query,
}: {
  readonly items: readonly ReviewQueueItemResponse[];
  readonly total: number;
  readonly page: number;
  readonly pages: number;
  /**
   * The queue state the rows were fetched with. Carried into each detail link so the reader comes
   * back to the list they left, and never used for anything else.
   */
  readonly query: ReviewQueueQuery;
}): ReactNode {
  return (
    <div
      className="ad-table-scroll"
      role="region"
      aria-label="Review queue, scrollable"
      tabIndex={0}
    >
      <table className="ad-table ad-table--dense">
        <caption className="ad-sr-only">
          Unapproved review subjects. Page {page} of {pages}, {total} in total.
        </caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Status</th>
            <th scope="col">Findings</th>
            <th scope="col">Type</th>
            <th scope="col">Subject</th>
            <th scope="col">Summary</th>
            <th scope="col">Grade</th>
            <th scope="col">Evidence</th>
            <th scope="col">Decisions</th>
            <th scope="col">Recorded</th>
            <th scope="col">Review</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <QueueRow item={item} key={`${item.subjectType}:${item.id}`} query={query} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One row, ending in a link to that subject's detail page.
 *
 * ## Where the link goes, and how it is named
 *
 * A Specification links to `/admin/catalog/review/specifications/:id`, a ProductClaim to
 * `/admin/catalog/review/product-claims/:id`. `reviewSubjectHref` picks the base from the row's own
 * `subjectType`, so the two can never cross.
 *
 * The accessible name identifies **the product and what is under review** — "Review Specification
 * kinematic_viscosity_100c for HSB 2000" — rather than being "Review" repeated down the column.
 * WCAG 2.2 §2.4.4 asks a link to make sense from its own text, and twenty-five identical links do
 * not. The visible text stays short because the row around it carries the same information; the
 * full sentence is in `aria-label`, which is what a screen reader's link list reads.
 *
 * ## What the URL carries
 *
 * The subject id, and the queue state so the reader can come back to the page and filters they
 * left. **Not the source reference**: that column is displayed on this screen and enters no URL,
 * no browser history and no access log. `review-query.ts`, which builds this href, does not know
 * the field exists.
 */
function QueueRow({
  item,
  query,
}: {
  readonly item: ReviewQueueItemResponse;
  readonly query: ReviewQueueQuery;
}): ReactNode {
  const neverApprovable = item.claimKind !== null && claimKindIsNeverApprovable(item.claimKind);
  const subject =
    item.propertyKey ?? (item.claimKind === null ? null : CLAIM_KIND_LABEL[item.claimKind]);

  return (
    <tr>
      <th scope="row" className="ad-cell-name">
        <span className="ad-cell-strong">{item.product.name}</span>
        <span className="ad-cell-sub">{item.product.slug}</span>
        {item.product.sourceRef === null ? null : (
          /*
           * Plain text on its own line, beneath the name and the slug. Labelled in full rather than
           * abbreviated: an unlabelled code next to a product name reads as a part number, and this
           * is not one. No link and no copy control — both would invite treating it as something to
           * hand to somebody outside this screen.
           */
          <span className="ad-cell-sub">
            Source reference <span className="ad-cell-ref">{item.product.sourceRef}</span>
          </span>
        )}
        {item.product.family === null && item.product.productType === null ? null : (
          <span className="ad-cell-sub">
            {[item.product.family, item.product.productType].filter(Boolean).join(" · ")}
          </span>
        )}
      </th>
      <td className="ad-cell-status">
        <StatusBadge status={item.reviewStatus} />
      </td>
      <td className="ad-cell-status">
        <FindingsMark unresolved={item.hasUnresolvedFindings} />
      </td>
      <td>{SUBJECT_TYPE_LABEL[item.subjectType]}</td>
      <td className="ad-mono">
        {item.propertyKey ?? (item.claimKind === null ? "—" : CLAIM_KIND_LABEL[item.claimKind])}
        {neverApprovable ? <span className="ad-cell-sub">Never approvable</span> : null}
      </td>
      <td className="ad-cell-summary">{item.summary}</td>
      <td>
        {item.grade === null ? (
          <span className="ad-quiet">No grade</span>
        ) : (
          <>
            {item.grade.label}
            {item.grade.gradeSystem === null ? null : (
              <span className="ad-cell-sub">{item.grade.gradeSystem}</span>
            )}
          </>
        )}
      </td>
      <td className="ad-cell-stamp">{item.evidenceCount}</td>
      <td className="ad-cell-stamp">{item.reviewCount}</td>
      <td className="ad-cell-stamp">
        <time dateTime={item.createdAt}>{item.createdAt.slice(0, 10)}</time>
      </td>
      <td>
        <Link
          className="ad-link"
          href={reviewSubjectHref(item.subjectType, item.id, query)}
          aria-label={`Review ${SUBJECT_TYPE_LABEL[item.subjectType]}${
            subject === null ? "" : ` ${subject}`
          } for ${item.product.name}`}
        >
          Review
        </Link>
      </td>
    </tr>
  );
}

/* ========================================================================== */
/*  Pagination                                                                 */
/* ========================================================================== */

const PAGE_WINDOW = 1;

function pageItems(page: number, pages: number): (number | null)[] {
  const wanted = new Set<number>([1, pages]);
  for (let n = page - PAGE_WINDOW; n <= page + PAGE_WINDOW; n += 1) {
    if (n >= 1 && n <= pages) wanted.add(n);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: (number | null)[] = [];
  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) items.push(null);
    items.push(value);
  }
  return items;
}

/**
 * Pagination over the filtered, sorted queue.
 *
 * Every link is built by `reviewPageHref`, which carries the whole query state forward — a reader
 * on page 4 of "unresolved findings, product claims" stays there. The ends are inert markup rather
 * than links that go nowhere, and the current page carries `aria-current="page"` so it is announced
 * rather than merely tinted.
 */
export function ReviewPagination({
  query,
  page,
  pages,
  total,
}: {
  readonly query: ReviewQueueQuery;
  readonly page: number;
  readonly pages: number;
  readonly total: number;
}): ReactNode {
  const items = pageItems(page, pages);

  return (
    <nav className="ad-pager" aria-label="Review queue pagination">
      <p className="ad-pager-position">
        {total} review {total === 1 ? "subject" : "subjects"} in total · page {page} of {pages}
      </p>
      <ol className="ad-pager-list">
        <li>
          {page > 1 ? (
            <Link className="ad-pager-step" href={reviewPageHref(query, page - 1)} rel="prev">
              <span aria-hidden="true">←</span> Previous
            </Link>
          ) : (
            <span className="ad-pager-step ad-pager-step--inert">
              <span aria-hidden="true">←</span> Previous
            </span>
          )}
        </li>
        {items.map((item, index) =>
          item === null ? (
            <li key={`gap-${String(index)}`} className="ad-pager-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                className="ad-pager-step"
                href={reviewPageHref(query, item)}
                aria-label={`Page ${String(item)}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link className="ad-pager-step" href={reviewPageHref(query, page + 1)} rel="next">
              Next <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="ad-pager-step ad-pager-step--inert">
              Next <span aria-hidden="true">→</span>
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}
