"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { submitAssignmentChange, submitStatusChange } from "./workflow-actions";
import { STATUS_LABEL, TRANSITIONS } from "./workflow-vocabulary";
import { isFailure, WORKFLOW_IDLE } from "./workflow-state";

import type { LeadSectionKey } from "./lead-routes";
import type { WorkflowState } from "./workflow-state";
import type { LeadStatus } from "@sam-group/types";
import type { ReactNode, RefObject } from "react";

/**
 * The two workflow controls.
 *
 * ## Client Components, and what that does and does not mean
 *
 * Both are `"use client"` **only** so the outcome of a Server Action can be announced without a
 * navigation — that is what `useActionState` buys. No credential, no token and no internal origin
 * reaches this file: the action runs on the server, reads the HttpOnly cookie there, and returns a
 * `WorkflowState` whose type has no field that could carry a secret.
 *
 * Both work **before hydration**. They are real `<form>`s posting real Server Actions, so a slow
 * connection produces a working control rather than a dead one.
 *
 * ## Native `<select>` + explicit submit, deliberately
 *
 * No custom combobox, no listbox emulation, no auto-submit on change. A select that acts on
 * `change` is hostile to a keyboard user, who moves through options with the arrow keys and would
 * fire a mutation on every option they pass; it is equally bad with a screen reader, where the
 * selection is not final until the listbox closes. An explicit button also gives the operator a
 * moment to change their mind, which matters for a terminal transition.
 *
 * ## Feedback, focus, and why there is no modal
 *
 * The result is announced through a live region — `role="status"` for success, `role="alert"` for
 * everything else — rendered *inside* the form and referenced by `aria-describedby` on the select,
 * so the message is both announced and programmatically attached to the control it is about.
 *
 * **Focus is restored to the control, and it has to be done explicitly.** A successful mutation
 * calls `revalidatePath`, which re-renders the route and replaces this form's subtree — so the
 * submit button that had focus is unmounted and **focus falls back to `<body>`**, stranding a
 * keyboard user at the top of the document with no idea the change landed. Measured in a browser,
 * not reasoned about: the first version of this file claimed the element survived, and it does not.
 *
 * `useFocusOnOutcome` puts focus back on the `<select>` once the action resolves — the control the
 * operator is working with, so they continue from where they were and the live region has already
 * announced what happened. The select is chosen over the message deliberately: focusing a
 * `role="alert"` would move them away from the thing they still need to act on, and the message is
 * already attached to the field through `aria-describedby`.
 *
 * **No confirmation dialog**, including for `closed`. Closing is reopenable, so nothing here is
 * destructive; a modal would add a focus-trap surface to guard for no safety gained.
 */

/**
 * Return focus to `element` when a mutation resolves.
 *
 * Keyed on `status` rather than on the state object, so it fires once per outcome rather than on
 * every re-render. `idle` is skipped: nothing has happened yet, and stealing focus on first paint
 * would be worse than not restoring it at all.
 */
function useFocusOnOutcome(
  status: WorkflowState["status"],
  element: RefObject<HTMLSelectElement | null>,
): void {
  useEffect(() => {
    if (status === "idle") return;

    element.current?.focus();
  }, [status, element]);
}

export type AssigneeOption = {
  readonly id: string;
  readonly email: string;
};

/**
 * The status control.
 *
 * `from` travels in a hidden field carrying the value this page rendered from authoritative server
 * state — the compare-and-set predicate. A lead already in a state with no outward transitions
 * would render no control at all, which cannot happen with the current graph (every state has at
 * least one) but is handled rather than assumed.
 */
export function StatusControl({
  section,
  id,
  current,
}: {
  readonly section: LeadSectionKey;
  readonly id: string;
  readonly current: LeadStatus;
}): ReactNode {
  const [state, action] = useActionState<WorkflowState, FormData>(
    submitStatusChange,
    WORKFLOW_IDLE,
  );
  const options = TRANSITIONS[current];
  const messageId = "ad-status-feedback";
  const select = useRef<HTMLSelectElement>(null);

  useFocusOnOutcome(state.status, select);

  if (options.length === 0) {
    return null;
  }

  return (
    <form action={action} className="ad-workflow-form">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="from" value={current} />

      <label className="ad-label" htmlFor="ad-status-select">
        Change status
      </label>
      <select
        className="ad-select"
        ref={select}
        id="ad-status-select"
        name="to"
        defaultValue={options[0]}
        aria-describedby={state.status === "idle" ? undefined : messageId}
        aria-invalid={isFailure(state) ? true : undefined}
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {STATUS_LABEL[option]}
          </option>
        ))}
      </select>

      <SubmitButton idle="Update status" busy="Updating…" />
      <WorkflowFeedback state={state} id={messageId} />
    </form>
  );
}

/**
 * The assignment control — rendered only for an Admin, and only ever as an affordance.
 *
 * The option list is active Sales Experts plus "Unassigned". `Admin`, `Content Manager` and
 * `Customer` accounts are not offered, matching the eligibility rule NestJS enforces: under the
 * single-role model an Admin who also sells cannot own a lead, and widening that would be a role
 * decision rather than a UI one.
 *
 * `"unassigned"` is the sentinel for "no owner" because an HTML option value cannot be `null`; the
 * Server Action translates it at the edge so no magic string travels further.
 */
export function AssignmentControl({
  section,
  id,
  currentAssigneeId,
  options,
}: {
  readonly section: LeadSectionKey;
  readonly id: string;
  readonly currentAssigneeId: string | null;
  readonly options: readonly AssigneeOption[];
}): ReactNode {
  const [state, action] = useActionState<WorkflowState, FormData>(
    submitAssignmentChange,
    WORKFLOW_IDLE,
  );
  const messageId = "ad-assignment-feedback";
  const select = useRef<HTMLSelectElement>(null);

  useFocusOnOutcome(state.status, select);

  return (
    <form action={action} className="ad-workflow-form">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fromAssigneeId" value={currentAssigneeId ?? "unassigned"} />

      <label className="ad-label" htmlFor="ad-assignee-select">
        Change assignee
      </label>
      <select
        className="ad-select"
        ref={select}
        id="ad-assignee-select"
        name="assigneeId"
        defaultValue={currentAssigneeId ?? "unassigned"}
        aria-describedby={state.status === "idle" ? undefined : messageId}
        aria-invalid={isFailure(state) ? true : undefined}
      >
        <option value="unassigned">Unassigned</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.email}
          </option>
        ))}
      </select>

      <SubmitButton idle="Update assignee" busy="Updating…" />
      <WorkflowFeedback state={state} id={messageId} />
    </form>
  );
}

/**
 * The outcome, announced.
 *
 * Rendered as an element the state produces rather than toggled with `hidden`, so the live region
 * announces on insertion. `role="status"` is polite for a success the operator is not blocked by;
 * every failure is `role="alert"`, because something needs attention before they carry on.
 *
 * The id is what the control's `aria-describedby` points at, so the message is attached to the
 * field as well as announced — a screen-reader user re-reading the select hears why it is invalid.
 */
function WorkflowFeedback({
  state,
  id,
}: {
  readonly state: WorkflowState;
  readonly id: string;
}): ReactNode {
  if (state.status === "idle" || state.message === undefined) {
    return null;
  }

  return (
    <p
      className={isFailure(state) ? "ad-feedback ad-feedback--bad" : "ad-feedback"}
      id={id}
      role={isFailure(state) ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

/**
 * The submit control, disabled while the action is in flight.
 *
 * `useFormStatus` reads the pending state of the `<form>` it sits inside, which is React's own
 * answer and cannot disagree with reality — which is why it is a separate component rather than a
 * prop. The label changes with the disabled state: a disabled button with unchanged text reads as
 * broken rather than as busy.
 */
function SubmitButton({ idle, busy }: { readonly idle: string; readonly busy: string }): ReactNode {
  const { pending } = useFormStatus();

  return (
    <button className="ad-workflow-submit" type="submit" disabled={pending}>
      {pending ? busy : idle}
    </button>
  );
}
