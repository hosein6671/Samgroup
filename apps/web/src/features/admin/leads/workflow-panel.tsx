import { SubmittedAt } from "./lead-fields";
import { statusLabel } from "./workflow-vocabulary";
import { AssignmentControl, StatusControl } from "./workflow-views";

import type { LeadSectionKey } from "./lead-routes";
import type { AssigneeOption } from "./workflow-views";
import type { LeadHistoryEntry, LeadStatus } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Workflow section — who owns this lead, what state it is in, how to change either, and what
 * has happened to it.
 *
 * ## It sits above Submission, deliberately
 *
 * An operator opening a lead is answering "what do I do with this?" before "what did they say?".
 * The submission is reference material; the workflow is the reason the page is open.
 *
 * ## A Server Component that renders two Client Components
 *
 * Everything here — the current state, the assignee's name, the history — is server-rendered from
 * authoritative API state. Only the two controls are client, and only so their outcome can be
 * announced without a navigation. Nothing on this page trusts a mutation response as its source of
 * truth: after a successful action the route is revalidated and re-read.
 *
 * ## Role decides what is rendered, and it is not the boundary
 *
 * A Sales Expert sees the status control and no assignment control; a Content Manager sees neither,
 * and no history. NestJS refuses each of those independently — hiding a control protects nothing —
 * so this is an affordance that keeps operators away from refusals they would not understand.
 */
export function WorkflowPanel({
  section,
  id,
  status,
  assigneeId,
  assigneeLabel,
  assigneeIsInactive,
  canAssign,
  canChangeStatus,
  assigneeOptions,
  history,
}: {
  readonly section: LeadSectionKey;
  readonly id: string;
  readonly status: LeadStatus;
  readonly assigneeId: string | null;
  /** The owner as a person — an email, or `null` when unassigned or unresolvable. */
  readonly assigneeLabel: string | null;
  /** Whether the current owner's account is disabled, where authoritative data says so. */
  readonly assigneeIsInactive: boolean;
  readonly canAssign: boolean;
  readonly canChangeStatus: boolean;
  readonly assigneeOptions: readonly AssigneeOption[];
  /** `null` when the caller may not read history — a Content Manager. */
  readonly history: readonly LeadHistoryEntry[] | null;
}): ReactNode {
  return (
    <section className="ad-group" aria-labelledby="ad-group-workflow">
      <h2 className="ad-group-title" id="ad-group-workflow">
        Workflow
      </h2>

      <dl className="ad-fields">
        <div className="ad-field-row">
          <dt className="ad-field-label">Status</dt>
          {/*
           * The status as words. Never a colour or a badge alone: a status that only a palette
           * distinguishes is invisible to a monochrome display, a colour-vision difference and a
           * screen reader alike (WCAG 2.2 §1.4.1).
           */}
          <dd className="ad-field-value">{statusLabel(status)}</dd>
        </div>
        <div className="ad-field-row">
          <dt className="ad-field-label">Assignee</dt>
          <dd
            className={
              assigneeLabel === null ? "ad-field-value ad-field-value--absent" : "ad-field-value"
            }
          >
            {assigneeLabel ?? UNASSIGNED}
            {assigneeIsInactive ? (
              // Text, not a dot. The operator needs to know this lead is parked with someone who
              // cannot sign in — that is an operational fact, not a decoration.
              <span className="ad-inactive-mark"> — account disabled</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {canChangeStatus || canAssign ? (
        <div className="ad-workflow-controls">
          {canChangeStatus ? <StatusControl section={section} id={id} current={status} /> : null}
          {canAssign ? (
            <AssignmentControl
              section={section}
              id={id}
              currentAssigneeId={assigneeId}
              options={assigneeOptions}
            />
          ) : null}
        </div>
      ) : null}

      {history === null ? null : <WorkflowHistory entries={history} />}
    </section>
  );
}

/**
 * The chronological record, newest first.
 *
 * ## An ordered list, because it is one
 *
 * `<ol>` gives a screen reader "list, 4 items" and a position within it — orientation a stack of
 * `<div>`s cannot provide. The markers are removed visually; the semantics stay.
 *
 * ## Identity comes from the snapshot, and a deleted actor is still named
 *
 * Every entry renders `actorEmail`, which was captured at mutation time and never updated. That is
 * the entire reason the snapshot columns exist: deleting a `User` is this platform's strongest
 * revocation, and without the snapshot every audit row that person wrote would go blank. An entry
 * whose snapshot is genuinely absent says "unknown" rather than rendering an empty gap that reads
 * as a bug.
 */
function WorkflowHistory({
  entries,
}: {
  readonly entries: readonly LeadHistoryEntry[];
}): ReactNode {
  return (
    <div className="ad-history">
      <h3 className="ad-history-title" id="ad-history-heading">
        History
      </h3>

      {entries.length === 0 ? (
        <p className="ad-note">Nothing has happened to this lead yet.</p>
      ) : (
        <ol className="ad-history-list" aria-labelledby="ad-history-heading">
          {entries.map((entry) => (
            <li className="ad-history-item" key={`${entry.kind}-${entry.at}`}>
              <p className="ad-history-what">{describe(entry)}</p>
              <p className="ad-history-meta">
                <SubmittedAt iso={entry.at} />
                <span aria-hidden="true"> · </span>
                <span>{entry.actorEmail ?? "unknown"}</span>
              </p>
              {entry.note === null || entry.note === "" ? null : (
                <p className="ad-history-note">{entry.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * The word for "no owner", wherever ownership is displayed.
 *
 * A null assignee is rendered as this literal text and never as a blank, a dash or an omission:
 * "Assignment changed from Unassigned to ada@…" states what happened, while a gap where a name
 * should be reads as a rendering fault. It is the same word the current-assignee row and the
 * control's first option use, so one vocabulary describes ownership everywhere on the page.
 */
const UNASSIGNED = "Unassigned";

/**
 * One entry as a sentence.
 *
 * ## Both kinds read as "changed from X to Y", and neither uses a glyph
 *
 * An arrow is announced as "right arrow" by some screen readers and skipped entirely by others, so
 * the from/to pair is written out. Status and assignment share the same phrasing because they are
 * the same shape of fact — a transition with two ends — and a reader scanning the list should not
 * have to learn two grammars.
 *
 * ## Every assignment entry names both ends, including the empty one
 *
 * `NULL → A`, `A → B` and `B → NULL` all render as a full pair, with `Unassigned` standing in for
 * a null. Phrasing the first as "Assigned to A" and the last as "Assignment cleared" would have
 * been shorter, but it hides half the fact: the reader could not tell a first assignment from a
 * reassignment whose previous owner had been deleted, and "cleared" never says what it was cleared
 * from. Preserving ownership changes is the entire reason `LeadAssignmentHistory` exists.
 *
 * The values are **snapshots**, captured at mutation time — so this still names people whose
 * accounts have since been deleted, which is when it matters most.
 */
function describe(entry: LeadHistoryEntry): string {
  if (entry.kind === "status") {
    const from = entry.fromStatus === null ? null : statusLabel(entry.fromStatus);
    const to = statusLabel(entry.toStatus);

    return from === null ? `Status set to ${to}` : `Status changed from ${from} to ${to}`;
  }

  const from = entry.fromAssigneeEmail ?? UNASSIGNED;
  const to = entry.toAssigneeEmail ?? UNASSIGNED;

  return `Assignment changed from ${from} to ${to}`;
}
