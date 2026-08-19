/**
 * What a workflow mutation reports back to the operator.
 *
 * ── Six states, because six things need different words ─────────────────────
 *
 * Collapsing them would be the failure this whole surface is designed against. The sharp one is
 * `conflict`: it is not the operator's mistake and not a fault, it is somebody else's edit, and
 * the only useful advice is to reload and look — "try again" would resend the same stale `from`
 * and fail identically.
 *
 * ── Announcement politeness is part of the state ────────────────────────────
 *
 * `saved` is announced with `role="status"` (polite — the operator is not blocked), everything
 * else with `role="alert"` (assertive — something needs attention now). Deriving it from the state
 * rather than from a prop means a new failure branch cannot accidentally be announced as success.
 */
export type WorkflowStatus =
  "idle" | "saved" | "conflict" | "forbidden" | "not-found" | "invalid" | "unavailable";

export type WorkflowState = {
  readonly status: WorkflowStatus;
  readonly message?: string;
};

export const WORKFLOW_IDLE: WorkflowState = { status: "idle" };

/**
 * The words, written once.
 *
 * None of them names an HTTP status, a role, or another operator. `conflict` deliberately does not
 * say *who* changed the lead: on a Sales Expert's screen that would disclose an Admin's action on
 * a record they do not own, and the operator's next step is identical either way.
 */
export const WORKFLOW_MESSAGE = {
  statusSaved: "Status updated.",
  assignmentSaved: "Assignment updated.",
  conflict: "This lead was changed by someone else. Reload and try again.",
  forbidden: "Your account cannot make this change.",
  notFound: "This lead is no longer available to you.",
  invalid: "That change could not be applied.",
  unavailable: "The platform is not responding, so nothing was changed. Please try again shortly.",
} as const;

/** Whether a state should be announced assertively. `idle` announces nothing at all. */
export function isFailure(state: WorkflowState): boolean {
  return state.status !== "idle" && state.status !== "saved";
}
