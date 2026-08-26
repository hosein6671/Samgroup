import Link from "next/link";

import { AdminShell } from "../../admin-shell";
import { backToQueueHref } from "./review-query";
import {
  BLOCKERS_HEADING,
  BLOCKERS_MEANING,
  ELIGIBILITY_LABEL,
  ELIGIBILITY_MEANING,
  EVIDENCE_ROLE_LABEL,
  EXTRACTION_METHOD_LABEL,
  HISTORY_DECISION_LABEL,
  HISTORY_EMPTY,
  HISTORY_EVIDENCE_LABEL,
  HISTORY_MEANING,
  INVALIDATION_EMPTY,
  INVALIDATION_HEADING,
  INVALIDATION_MEANING,
  INVALIDATION_REASON_LABEL,
  INVALIDATION_REASON_UNKNOWN,
  INVALIDATION_RETIRED_APPROVAL,
  LOCATOR_TYPE_LABEL,
  NOT_RECORDED,
  RESULT_BASIS_LABEL,
  SOURCE_DOCUMENT_ACCESS_NOTE,
  STATUS_LABEL,
  STATUS_MEANING,
  SUBJECT_TYPE_LABEL,
  UNIT_CLASSIFICATION_LABEL,
  UNIT_CLASSIFICATION_MEANING,
  URL_LOCATOR_WITHHELD,
  WARNINGS_EMPTY,
  WARNINGS_HEADING,
  WARNINGS_MEANING,
  WARNING_MEANING,
  unitIsAmbiguous,
} from "./review-vocabulary";

import type { ReviewQueueQuery } from "./review-query";
import type {
  ReviewBlocker,
  ReviewDetailResponse,
  ReviewEvidenceEntry,
  ReviewGradeRef,
  ReviewHistoryEntry,
  ReviewInvalidationEntry,
  ReviewProductRef,
  ReviewWarning,
} from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Review detail layout both subject types compose — and the boundary of what it may own.
 *
 * ## Why there is a shared shell at all
 *
 * A Specification and a ProductClaim are the same *screen*: the same chrome, the same Back link,
 * the same status and eligibility summary, the same evidence, the same immutable history. They
 * differ in exactly one panel group — what is under review. Writing that screen twice is how the
 * two come to disagree about what "Not recorded" means, or about whether a document can be opened.
 *
 * So this file owns the frame, the heading, the status and blocker summaries, the evidence
 * presentation, the history presentation and the field primitives. The two subject modules own
 * their own panels and nothing else.
 *
 * ## What it must never own
 *
 * **No decision action, in any form.** No approve, no reject, no needs-review, no supersede, no
 * editable note, no form, no button, and no disabled stand-in for one. Phase B is read-only and a
 * greyed-out Approve is a promise the screen cannot keep. `phase-boundary.spec.ts` fails the build
 * if a form, a field or a POST appears anywhere in this feature.
 *
 * ## Technical values are direction-isolated, always
 *
 * The Admin chrome is English and `dir="ltr"`, fixed by the `(admin)` root layout. The *data* is
 * not English: product names, source properties, raw values and document titles come from supplier
 * documents and may one day contain Persian or Arabic. A right-to-left run inside an LTR sentence
 * reorders the characters around it — a property key, a hash or a unit next to it can be rendered
 * in the wrong order without a single byte changing.
 *
 * Every value below therefore goes through `Value`, which wraps it in `<bdi>`. `<bdi>` is
 * `unicode-bidi: isolate` by definition, so each value is laid out on its own and cannot reorder
 * its neighbours. Identifiers that are meaningless in any direction but LTR — property keys, UUIDs,
 * hashes, media types — additionally carry `dir="ltr"`, which fixes the base direction inside the
 * isolate rather than letting the first strong character choose it.
 *
 * No bidi control character is ever emitted: `<bdi>` is markup, so nothing is injected into the
 * text, and a value that happens to contain one of the Unicode control characters is isolated by
 * the element and cannot escape it.
 */

/* ========================================================================== */
/*  Frame                                                                      */
/* ========================================================================== */

/**
 * The detail page frame — the same neutral `AdminShell` the queue composes.
 *
 * `current="catalog-review"` keeps the module navigation marking Technical Review while a subject
 * is open: a detail page is inside that module, not beside it.
 */
export function ReviewDetailFrame({
  title,
  user,
  children,
}: {
  readonly title: string;
  readonly user: { readonly email: string; readonly role: string } | null;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <AdminShell title={title} user={user} current="catalog-review">
      {children}
    </AdminShell>
  );
}

/**
 * The way back to the queue.
 *
 * Rendered above everything else so it is the first thing in the tab order after the chrome, and
 * named for its destination rather than as "Back" alone — WCAG 2.2 §2.4.4 asks a link to be
 * understandable from its own text, and "Back" is not.
 *
 * `href` is built by `backToQueueHref` from the validated query, so it is always the queue and can
 * never be pointed anywhere else. There is no `returnTo`, no history call and no script.
 */
export function BackToQueue({ query }: { readonly query: ReviewQueueQuery }): ReactNode {
  return (
    <p className="ad-crumb">
      <Link className="ad-link" href={backToQueueHref(query)}>
        Back to review queue
      </Link>
    </p>
  );
}

/* ========================================================================== */
/*  Field primitives                                                           */
/* ========================================================================== */

/**
 * One technical value, direction-isolated.
 *
 * `technical` fixes the base direction to LTR and switches to the technical face. Use it for
 * anything that is an identifier rather than prose — property keys, UUIDs, hashes, media types,
 * numeric payloads. Product names and document titles are prose in their own language and take the
 * isolate without the direction override.
 */
export function Value({
  children,
  technical = false,
}: {
  readonly children: ReactNode;
  readonly technical?: boolean;
}): ReactNode {
  return (
    <bdi
      className={technical ? "ad-value ad-value--technical" : "ad-value"}
      dir={technical ? "ltr" : undefined}
    >
      {children}
    </bdi>
  );
}

/**
 * One label/value row of a definition list.
 *
 * A real `<dt>`/`<dd>` pair, so the association is in the markup rather than implied by position —
 * WCAG 2.2 §1.3.1. An absent value renders the words "Not recorded" in the absent style; it is
 * never a blank cell, which reads as a rendering fault, and never "None", which would assert that
 * the source said there was none.
 */
export function Field({
  label,
  value,
  technical = false,
  hint,
}: {
  readonly label: string;
  readonly value: string | number | null | undefined;
  readonly technical?: boolean;
  readonly hint?: string;
}): ReactNode {
  const absent = value === null || value === undefined || value === "";

  return (
    <div className="ad-field-row">
      <dt className="ad-field-label">{label}</dt>
      <dd className={absent ? "ad-field-value ad-field-value--absent" : "ad-field-value"}>
        {absent ? NOT_RECORDED : <Value technical={technical}>{String(value)}</Value>}
        {hint === undefined ? null : <span className="ad-field-hint">{hint}</span>}
      </dd>
    </div>
  );
}

/**
 * A panel — a `<section>` named by its own `<h2>`.
 *
 * `aria-labelledby` pointing at the heading, exactly as `lead-fields.tsx` and `workflow-panel.tsx`
 * already do on this surface: the section becomes a named `region`, and its name is the visible
 * heading rather than a second string that could drift from it. One convention across the Admin
 * surface, not two.
 *
 * The page has exactly one `<h1>` above these, and sub-parts inside them use `<h3>`, so no level is
 * skipped.
 */
export function Panel({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="ad-group" aria-labelledby={groupId(heading)}>
      <h2 className="ad-group-title" id={groupId(heading)}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** The heading's id, derived from its text — the same rule `lead-fields.tsx` uses. */
function groupId(title: string): string {
  return `ad-group-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
}

/** A named sub-part of a panel, under an `<h3>`. Used to keep raw and normalized apart. */
export function SubPanel({
  heading,
  note,
  children,
}: {
  readonly heading: string;
  readonly note?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="ad-subgroup">
      <h3 className="ad-subgroup-title">{heading}</h3>
      {note === undefined ? null : <p className="ad-note">{note}</p>}
      {children}
    </div>
  );
}

/** The grid every panel puts its fields in. */
export function Fields({ children }: { readonly children: ReactNode }): ReactNode {
  return <dl className="ad-fields">{children}</dl>;
}

/* ========================================================================== */
/*  Product context                                                            */
/* ========================================================================== */

/**
 * Which Product, and which grade, the subject belongs to.
 *
 * Identical for both subject types, so it lives here rather than being written twice.
 *
 * ## `sourceRef` is displayed, and displayed is the whole of the permission
 *
 * SAM's internal import identity for a Product — the handle that tells two similar subjects apart
 * and finds the row again in the ratified workbook. The Architect approved showing it inside the
 * authenticated Review UI and approved nothing else. It is labelled in full, never abbreviated,
 * never a link, never given a copy control, and it is not in this page's URL: the address carries
 * the subject id and the queue filters, and `review-query.ts` does not know the field exists.
 */
export function ProductContext({
  product,
  grade,
}: {
  readonly product: ReviewProductRef;
  readonly grade: ReviewGradeRef | null;
}): ReactNode {
  return (
    <Panel heading="Product context">
      <Fields>
        <Field label="Product name" value={product.name} />
        <Field label="Product slug" value={product.slug} technical />
        <Field label="Source reference" value={product.sourceRef} technical />
        <Field label="Product family" value={product.family} technical />
        <Field label="Product type" value={product.productType} technical />
        <Field label="Grade" value={grade?.label ?? null} />
        <Field label="Grade system" value={grade?.gradeSystem ?? null} technical />
      </Fields>
    </Panel>
  );
}

/* ========================================================================== */
/*  Status, eligibility and blockers                                           */
/* ========================================================================== */

/**
 * Where the subject stands, in words.
 *
 * Status is text with its meaning next to it, never a colour on its own — WCAG 2.2 §1.4.1. The
 * status badge carries the same class the queue uses, and the class contributes no information the
 * text does not already carry.
 *
 * A retired subject (`deletedAt` set) says so here rather than only appearing as a blocker further
 * down, because it changes how everything else on the page should be read.
 */
export function SubjectStatus({ subject }: { readonly subject: ReviewDetailResponse }): ReactNode {
  return (
    <Panel heading="Review status">
      <Fields>
        <Field
          label="Current status"
          value={STATUS_LABEL[subject.reviewStatus] ?? subject.reviewStatus}
          hint={STATUS_MEANING[subject.reviewStatus]}
        />
        <Field label="Subject type" value={SUBJECT_TYPE_LABEL[subject.subjectType]} />
        <Field label="Recorded" value={subject.createdAt.slice(0, 10)} technical />
        <Field
          label="Retired"
          value={subject.deletedAt === null ? null : subject.deletedAt.slice(0, 10)}
          technical
        />
        <Field
          label="Approval eligibility"
          value={
            subject.eligibleForApproval ? ELIGIBILITY_LABEL.eligible : ELIGIBILITY_LABEL.blocked
          }
          hint={ELIGIBILITY_MEANING}
        />
      </Fields>
    </Panel>
  );
}

/**
 * Why the subject cannot be approved as it stands.
 *
 * A real `<ul>` of sentences, announced as a list with a count. Never a colour, never an icon, and
 * never a tooltip: a blocker is the reason a reviewer's next action is unavailable, and hiding it
 * behind a hover would put it out of reach of a keyboard and a touch screen at once.
 *
 * An empty blocker list is stated rather than omitted. "There are no blockers" and "the page did
 * not render the blockers" look identical when the panel simply disappears.
 */
export function ApprovalBlockers({
  blockers,
  prohibited,
}: {
  readonly blockers: readonly ReviewBlocker[];
  /** A permanent reason this subject kind can never be approved, when one applies. */
  readonly prohibited?: string;
}): ReactNode {
  return (
    <Panel heading={BLOCKERS_HEADING}>
      {prohibited === undefined ? null : <p className="ad-note ad-note--strong">{prohibited}</p>}
      {blockers.length === 0 ? (
        <p className="ad-note">
          {ELIGIBILITY_LABEL.eligible}. {ELIGIBILITY_MEANING}
        </p>
      ) : (
        <>
          <p className="ad-note ad-note--strong">
            {blockers.length} {blockers.length === 1 ? "blocker" : "blockers"} recorded.{" "}
            {BLOCKERS_MEANING}
          </p>
          <ul className="ad-issue-list ad-issue-list--blocker">
            {blockers.map((entry) => (
              <li className="ad-issue" data-blocker-code={entry.code} key={entry.code}>
                <IssueCode code={entry.code} label="Blocker" />
                <span className="ad-issue-message">{entry.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/**
 * Reasons to look twice, in their own panel — and the panel is separate for a reason.
 *
 * ## Why not one list with two styles
 *
 * A warning and a blocker answer different questions: one is "look at this before you decide", the
 * other is "you cannot decide yes". Interleaving them in one list makes the difference carried by
 * styling, and styling is exactly what a screen reader, a high-contrast mode and a printout all
 * discard. Two `<section>`s with two `<h2>`s and two `<ul>`s put the difference in the STRUCTURE,
 * so it survives every one of those.
 *
 * The distinction is also stated in words — `WARNINGS_MEANING` says outright that none of these
 * makes the subject ineligible — because every subject in the catalogue currently carries two
 * document warnings, and a reviewer who reads them as blockers will approve nothing at all.
 *
 * ## The code travels with the message
 *
 * The API sends `{code, message}`. The message is what a person reads; the code is the contract,
 * and it is rendered as its own element and mirrored onto `data-warning-code` so the tests assert
 * against the identity rather than against English prose. It is technical text and is
 * direction-isolated LTR like every other identifier on this surface.
 *
 * ## Still nothing to act on
 *
 * No control, no dismissal, no "acknowledge". A warning is a statement, and Phase B has no writes.
 */
export function ReviewWarnings({
  warnings,
}: {
  readonly warnings: readonly ReviewWarning[];
}): ReactNode {
  return (
    <Panel heading={WARNINGS_HEADING}>
      <p className="ad-note">{WARNINGS_MEANING}</p>

      {warnings.length === 0 ? (
        <p className="ad-note">{WARNINGS_EMPTY}</p>
      ) : (
        <>
          <p className="ad-note">
            {warnings.length} {warnings.length === 1 ? "warning" : "warnings"} recorded.
          </p>
          <ul className="ad-issue-list ad-issue-list--warning">
            {warnings.map((entry) => (
              <li className="ad-issue" data-warning-code={entry.code} key={entry.code}>
                <IssueCode code={entry.code} label="Warning" />
                <span className="ad-issue-message">{entry.message}</span>
                {WARNING_MEANING[entry.code] === undefined ? null : (
                  <span className="ad-field-hint">{WARNING_MEANING[entry.code]}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/**
 * One stable code, rendered as an identifier rather than as prose.
 *
 * `label` is visually hidden and is what a screen reader hears before the code, so "BLOCKER
 * SOURCE_ASSET_ABSENT" is announced rather than a bare snake-case token that means nothing read
 * aloud. The code itself is `dir="ltr"` technical text like every other identifier here.
 */
function IssueCode({ code, label }: { readonly code: string; readonly label: string }): ReactNode {
  return (
    <span className="ad-issue-code">
      <span className="ad-sr-only">{label}: </span>
      <bdi className="ad-value ad-value--technical" dir="ltr">
        {code}
      </bdi>
    </span>
  );
}

/* ========================================================================== */
/*  Evidence and source documents                                              */
/* ========================================================================== */

/**
 * The evidence behind the subject, and the documents that stated it.
 *
 * ## The frozen source-document boundary is stated, not implied
 *
 * There is no document proxy: ADR-014 stores no bytes, and the API publishes no download route, no
 * redirect and no signed URL. So this panel renders **no anchor, no download, no preview and no
 * disabled control that looks like one**. It says why, in `SOURCE_DOCUMENT_ACCESS_NOTE`, because a
 * document panel with no link otherwise reads as either "the evidence is missing" or "somebody
 * forgot the link", and both are wrong.
 *
 * A URL locator's *address* is not printed. Everything else about the document is: title,
 * publisher, revision, document date, retrieval date, file fingerprint, media type and size. An
 * uploaded file's locator is a file name rather than an address and is shown in full.
 *
 * ## Raw is verbatim, and is never quietly corrected
 *
 * Every raw field is what the document said. Where the source gave no unit, or gave one this
 * platform cannot interpret, that is stated as ambiguity next to the value — never resolved, never
 * substituted, and never rendered as though the source had been clearer than it was.
 */
export function EvidencePanel({
  evidence,
}: {
  readonly evidence: readonly ReviewEvidenceEntry[];
}): ReactNode {
  return (
    <Panel heading="Evidence and source documents">
      <p className="ad-note">{SOURCE_DOCUMENT_ACCESS_NOTE}</p>

      {evidence.length === 0 ? (
        <p className="ad-note ad-note--strong">
          This subject cites no evidence. Nothing in the catalogue records where its value came
          from.
        </p>
      ) : (
        <ol className="ad-evidence-list">
          {evidence.map((entry, index) => (
            <EvidenceItem entry={entry} key={entry.sourceFactId} position={index + 1} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

function EvidenceItem({
  entry,
  position,
}: {
  readonly entry: ReviewEvidenceEntry;
  readonly position: number;
}): ReactNode {
  const ambiguous = unitIsAmbiguous(entry.unitClassification);

  return (
    <li className="ad-evidence-item">
      <h3 className="ad-evidence-title">
        Evidence {position} · {EVIDENCE_ROLE_LABEL[entry.role] ?? entry.role}
      </h3>

      <SubPanel heading="As the source stated it">
        <Fields>
          <Field label="Raw property" value={entry.rawProperty} technical />
          <Field label="Raw value" value={entry.rawValue} technical />
          <Field
            label="Raw unit"
            value={entry.rawUnit}
            technical
            hint={UNIT_CLASSIFICATION_MEANING[entry.unitClassification]}
          />
          <Field
            label="Unit classification"
            value={UNIT_CLASSIFICATION_LABEL[entry.unitClassification] ?? entry.unitClassification}
          />
          <Field label="Raw test method" value={entry.rawMethod} technical />
          <Field label="Raw grade" value={entry.rawGrade} technical />
          <Field
            label="Result basis"
            value={RESULT_BASIS_LABEL[entry.resultBasis] ?? entry.resultBasis}
          />
          <Field
            label="Extraction method"
            value={EXTRACTION_METHOD_LABEL[entry.extractionMethod] ?? entry.extractionMethod}
          />
          <Field label="Evidence note" value={entry.note} />
          <Field label="Source fact id" value={entry.sourceFactId} technical />
        </Fields>
        {ambiguous ? (
          <p className="ad-note ad-note--strong">
            The source unit is unsettled and has not been corrected by this platform.
          </p>
        ) : null}
      </SubPanel>

      <SubPanel heading="Where in the document">
        <Fields>
          <Field label="Page" value={entry.pageNumber} technical />
          <Field label="Sheet" value={entry.sheetName} technical />
          <Field label="Row" value={entry.rowNumber} technical />
          <Field label="Column" value={entry.columnLabel} technical />
        </Fields>
      </SubPanel>

      <SubPanel heading="Source document">
        <Fields>
          <Field label="Title" value={entry.document.title} />
          <Field label="Publisher" value={entry.document.publisher} />
          <Field
            label="Recorded as"
            value={LOCATOR_TYPE_LABEL[entry.document.locatorType] ?? entry.document.locatorType}
          />
          {entry.document.locatorType === "uploaded_file" ? (
            <Field label="File name" value={entry.document.locatorValue} technical />
          ) : (
            <div className="ad-field-row">
              <dt className="ad-field-label">Locator</dt>
              <dd className="ad-field-value ad-field-value--absent">{URL_LOCATOR_WITHHELD}</dd>
            </div>
          )}
          <Field label="Revision" value={entry.document.revisionLabel} technical />
          <Field label="Document date" value={entry.document.documentDate} technical />
          <Field label="Retrieved" value={entry.document.retrievedAt.slice(0, 10)} technical />
          <Field label="File fingerprint (SHA-256)" value={entry.document.assetSha256} technical />
          <Field label="File type" value={entry.document.assetMediaType} technical />
          <Field
            label="File size"
            value={
              entry.document.assetByteSize === null ? null : `${entry.document.assetByteSize} bytes`
            }
            technical
          />
          <Field label="Document id" value={entry.document.id} technical />
          <Field
            label="Superseded by"
            value={entry.document.supersededById}
            technical
            hint={
              entry.document.supersededById === null
                ? undefined
                : "A later revision of this document has replaced it."
            }
          />
        </Fields>
      </SubPanel>
    </li>
  );
}

/* ========================================================================== */
/*  Immutable review history                                                   */
/* ========================================================================== */

/**
 * Prior decisions, newest first.
 *
 * ## Immutable, and shown as immutable
 *
 * No edit control, no delete control, no re-open, no reply. Entries are appended by the API and
 * never amended, and this panel offers nothing that would suggest otherwise.
 *
 * `reviewerEmail` is the **snapshot** the decision was recorded with, not a lookup against the user
 * table: it still names the reviewer after the account is gone. Nothing here infers a reviewer,
 * substitutes the current user, or renders a placeholder identity — an audit trail that guesses is
 * not an audit trail.
 *
 * ## The empty state is a sentence, not an absent panel
 *
 * Live DEV holds zero decisions against every subject, so this is the state the screen is in today.
 * It says what that means — the status came from the importer, not from a person — rather than
 * leaving a reviewer to infer it from a missing panel.
 */
export function ReviewHistory({
  history,
}: {
  readonly history: readonly ReviewHistoryEntry[];
}): ReactNode {
  return (
    <Panel heading="Review history">
      <p className="ad-note">{HISTORY_MEANING}</p>

      {history.length === 0 ? (
        <p className="ad-note ad-note--strong">{HISTORY_EMPTY}</p>
      ) : (
        <ol className="ad-history-list">
          {history.map((entry) => (
            <HistoryItem entry={entry} key={entry.id} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

/**
 * System invalidations, newest first — and the reason they are their own panel.
 *
 * ## Not a decision, and never rendered as one
 *
 * These entries come from `review_invalidations`, which is a different table from
 * `technical_reviews` for the reason ADR-017 gives: a `TechnicalReview` records that a named person
 * decided something, and nobody decided this. The API keeps them in a separate array, and this
 * keeps them in a separate panel, under a heading that says what they are, in wording that never
 * uses a decision verb.
 *
 * Three things are therefore structurally absent rather than merely omitted: there is no reviewer
 * name, because `ReviewInvalidationEntry` carries none; there is no decision label, because it
 * carries none; and there is no way for this component to reach either, because it is handed
 * nothing else.
 *
 * ## Still read-only, like everything on this surface
 *
 * No control, no link, no locator, no hash. A reason code becomes a sentence and nothing more.
 * `phase-boundary.spec.ts` covers this file unchanged and none of its rules is relaxed for it.
 */
export function ReviewInvalidations({
  invalidations,
}: {
  readonly invalidations: readonly ReviewInvalidationEntry[];
}): ReactNode {
  return (
    <Panel heading={INVALIDATION_HEADING}>
      <p className="ad-note">{INVALIDATION_MEANING}</p>

      {invalidations.length === 0 ? (
        <p className="ad-note ad-note--strong">{INVALIDATION_EMPTY}</p>
      ) : (
        <ol className="ad-history-list">
          {invalidations.map((entry) => (
            <li className="ad-history-item ad-history-item--system" key={entry.id}>
              <p className="ad-history-what" data-invalidation-reason={entry.reasonCode}>
                {INVALIDATION_REASON_LABEL[entry.reasonCode] ?? INVALIDATION_REASON_UNKNOWN}
              </p>
              <p className="ad-history-meta">
                {INVALIDATION_RETIRED_APPROVAL} ·{" "}
                <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function HistoryItem({ entry }: { readonly entry: ReviewHistoryEntry }): ReactNode {
  return (
    <li className="ad-history-item">
      <p className="ad-history-what">{HISTORY_DECISION_LABEL[entry.decision] ?? entry.decision}</p>
      <p className="ad-history-meta">
        <Value>{entry.reviewerEmail}</Value> ·{" "}
        <time dateTime={entry.reviewedAt}>{entry.reviewedAt.slice(0, 10)}</time>
      </p>
      <p className="ad-history-meta">
        {entry.evidenceCurrent ? HISTORY_EVIDENCE_LABEL.current : HISTORY_EVIDENCE_LABEL.stale}
      </p>
      {entry.note === null ? null : <p className="ad-history-note">{entry.note}</p>}
    </li>
  );
}

/* ========================================================================== */
/*  Failure states                                                             */
/* ========================================================================== */

/**
 * Every way a detail request can end without a subject, as its own sentence.
 *
 * They are separate components rather than one parameterised notice because the distinctions are
 * the point, and a shared component with a `kind` prop is how two of them end up saying the same
 * thing. In particular **not-found and unavailable are never collapsed**: a reviewer told a subject
 * does not exist stops looking for it, and a container restart must not be able to say that.
 *
 * None of them renders a status code, an endpoint, a backend message, a token or a stack trace.
 */
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

export function DetailForbidden(): ReactNode {
  return (
    <Notice heading="Access denied">
      <p className="ad-note">
        Your account does not have access to technical review. Technical review is restricted to
        Administrators.
      </p>
    </Notice>
  );
}

export function DetailNotFound(): ReactNode {
  return (
    <Notice heading="Subject not found">
      <p className="ad-note">
        No review subject exists at this address. It may have been removed from the catalogue, or
        the address may be from an older link.
      </p>
    </Notice>
  );
}

export function DetailInvalidId(): ReactNode {
  return (
    <Notice heading="Not a review subject address">
      <p className="ad-note">
        The identifier in this address is not one the platform recognises, so no subject was looked
        up. This is usually a hand-edited or truncated link.
      </p>
    </Notice>
  );
}

/**
 * The platform did not answer.
 *
 * States explicitly that the reader is still signed in. An outage that reads like a sign-out sends
 * an operator to re-enter credentials that were never the problem, and repeated failed sign-ins are
 * their own hazard.
 */
export function DetailUnavailable(): ReactNode {
  return (
    <Notice heading="Technical review is temporarily unavailable">
      <p className="ad-note">
        The platform did not answer, so this subject could not be loaded. You are still signed in —
        try again in a moment.
      </p>
    </Notice>
  );
}

export function DetailFailed(): ReactNode {
  return (
    <Notice heading="This subject could not be loaded">
      <p className="ad-note">
        The platform answered with something this screen cannot read. Nothing has been changed. If
        it happens again, report it with the time it occurred.
      </p>
    </Notice>
  );
}
