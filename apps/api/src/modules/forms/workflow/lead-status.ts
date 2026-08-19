/**
 * The lead workflow vocabulary and its transition graph — ADR-013.
 *
 * ## Three values, and why not more
 *
 * `new` · `in_progress` · `closed`. That is the whole vocabulary, and each answers a different
 * question an operator actually asks:
 *
 * - `new` — accepted and persisted, **nobody has begun working it**. Unchanged in meaning from
 *   the ingestion constant this replaces; the value is the same string, so no row moved.
 * - `in_progress` — **work has begun.** Says nothing about who owns it.
 * - `closed` — **no further work is intended.** Terminal by intent, and reopenable.
 *
 * **There is no `assigned` member, deliberately.** Ownership is `assignedToId`, which already
 * answers "is this assigned?" exactly. A status member saying the same thing would be a second
 * source of truth that can disagree with the first — `status = 'assigned'` with a NULL assignee is
 * representable and meaningless — and the two would have to be kept in step by convention.
 *
 * **There is no `contacted`, `qualified`, `won` or `lost`.** Those are commercial pipeline
 * semantics: `contacted` is an activity record wanting a timestamp and a note, `qualified` needs a
 * definition of "qualified" nobody has given, and won/lost only pays off with pipeline reporting,
 * which is deferred. A closing reason, when one is worth recording, goes in `StatusHistory.note` —
 * a column that already exists — rather than in a new enum member.
 *
 * ## The graph is enforced here, not in the database
 *
 * A CHECK constraint on `status` fixes the vocabulary (migration 20260820120000_add_lead_workflow)
 * but cannot see the previous value, so it cannot express `closed → new`. The graph therefore
 * lives in this module. The split is stated in the schema comment on both columns so neither half
 * looks like the whole rule.
 */

export const LEAD_STATUSES = ["new", "in_progress", "closed"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * The status every submission is created with. Unchanged in value from the constant this
 * supersedes, so the meaning of every existing row is preserved exactly.
 */
export const INITIAL_LEAD_STATUS: LeadStatus = "new";

/**
 * Where each status may go.
 *
 * ```
 * new         → in_progress          work begins
 * new         → closed               closed without being worked (spam, irrelevant, duplicate)
 * in_progress → closed               work finishes
 * closed      → in_progress          REOPENED
 * ```
 *
 * Everything else is refused, and the two refusals worth naming are:
 *
 * - **`closed → new` and `in_progress → new`.** `new` means "nobody has looked at this". Once
 *   somebody has, moving back to it would make the record assert something false. A correction
 *   belongs in the note on the next transition, not in a rewind.
 * - **`X → X`.** A no-op is not a change, and permitting it would write a `StatusHistory` row
 *   recording that nothing happened. Refused as a 400 rather than silently accepted, so a
 *   double-submitted form cannot pad the audit trail.
 *
 * **Reopening lands in `in_progress`, never `new`** — the lead has been seen, and the only honest
 * place to resume is the working state.
 */
const TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: ["in_progress"],
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Whether the graph permits `from → to`. Self-transitions are false — see the note above. */
export function isAllowedTransition(from: LeadStatus, to: LeadStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * The transitions offered from a given state — what the Admin UI renders as options.
 *
 * Exported so the frontend's control and the backend's rule read from the same source. The server
 * still validates: a select is a suggestion, and this list being right is not what makes the API
 * safe.
 */
export function allowedTransitionsFrom(from: LeadStatus): readonly LeadStatus[] {
  return TRANSITIONS[from];
}
