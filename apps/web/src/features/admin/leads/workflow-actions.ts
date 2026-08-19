"use server";

import { revalidatePath } from "next/cache";

import { changeLeadAssignment, changeLeadStatus } from "./leads-api";
import { LEAD_SECTION_PATH } from "./lead-routes";
import { WORKFLOW_MESSAGE } from "./workflow-state";

import type { LeadSectionKey } from "./lead-routes";
import type { WorkflowState } from "./workflow-state";
import type { LeadStatus } from "@sam-group/types";

/**
 * The two lead workflow mutations, as Server Actions.
 *
 * ## Why Server Actions and not a client fetch
 *
 * `apps/api` runs with `cors: false` and API_CONTRACT_FINAL §1 states that no browser-originated
 * call reaches NestJS, so a client-side PATCH could not succeed — and it would need the access
 * token in a browser context to try. Here the token is read from an HttpOnly cookie inside this
 * process and attached to the internal hop; it never enters a client bundle, a prop or the markup.
 *
 * ## CSRF, inherited rather than re-solved
 *
 * Server Actions are POST-only to an unguessable build-generated action id, and Next verifies the
 * `Origin`/`Host` pair before invoking one; both session cookies are `SameSite=Strict` on top. The
 * note on `features/admin/actions.ts` requires every future Admin mutation to preserve those two
 * properties, and these do.
 *
 * ## The form state is a discriminated result, not a boolean
 *
 * A mutation can fail in five distinct ways and each needs different words in front of the
 * operator — most importantly `conflict`, which is neither their mistake nor a fault. Collapsing
 * them would make "someone else edited this" read as "something went wrong", and the operator's
 * correct next action (reload and look) would be lost.
 *
 * ## `revalidatePath` is what makes the page authoritative again
 *
 * On success the detail route is revalidated so the next render reads the new state from the API
 * rather than from anything this action returned. The action's own result carries only the message
 * to announce — the page never trusts a mutation response as its source of truth.
 */

/** Both actions take their target from the form, so one action serves both lead kinds. */
type Target = { section: LeadSectionKey; id: string };

function readTarget(formData: FormData): Target | null {
  const section = formData.get("section");
  const id = formData.get("id");

  if (typeof section !== "string" || typeof id !== "string") return null;
  if (section !== "inquiries" && section !== "custom-formulation-requests") return null;

  return { section, id };
}

const LEAD_STATUSES: readonly LeadStatus[] = ["new", "in_progress", "closed"];

function readStatus(value: FormDataEntryValue | null): LeadStatus | null {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value)
    ? (value as LeadStatus)
    : null;
}

/**
 * `PATCH .../status`.
 *
 * `from` is read from a hidden field the page rendered from authoritative server state, so it is
 * the value the operator was actually looking at. That is the whole compare-and-set: if the lead
 * moved between render and submit, the API answers 409 and this returns `conflict`.
 *
 * **Nothing here validates the transition.** The graph is the server's, and a copy in this file
 * would be a second rule able to disagree with it. The `<select>` offers only reachable options as
 * a courtesy; the API is what refuses.
 */
export async function submitStatusChange(
  _previous: WorkflowState,
  formData: FormData,
): Promise<WorkflowState> {
  const target = readTarget(formData);
  const from = readStatus(formData.get("from"));
  const to = readStatus(formData.get("to"));

  if (target === null || from === null || to === null) {
    return { status: "invalid", message: WORKFLOW_MESSAGE.invalid };
  }

  const result = await changeLeadStatus(target.section, target.id, { from, to });

  if (result.state === "ok") {
    revalidatePath(`${LEAD_SECTION_PATH[target.section]}/${target.id}`);

    return { status: "saved", message: WORKFLOW_MESSAGE.statusSaved };
  }

  return toFailure(result.state, result.state === "invalid" ? result.issue : null);
}

/**
 * `PATCH .../assignment` — Admin only.
 *
 * The role is not checked here. NestJS refuses a non-Admin with 403 and this reports it, which is
 * the correct division: a check in this file would be a second authority able to disagree with the
 * one that matters, and hiding the control (which the page also does) is an affordance rather than
 * a boundary.
 *
 * `"unassigned"` is the sentinel the `<select>` uses for "no owner", because an HTML option value
 * cannot be `null`. It is translated here, at the edge, so nothing downstream carries a magic
 * string.
 */
export async function submitAssignmentChange(
  _previous: WorkflowState,
  formData: FormData,
): Promise<WorkflowState> {
  const target = readTarget(formData);

  if (target === null) {
    return { status: "invalid", message: WORKFLOW_MESSAGE.invalid };
  }

  const assigneeId = readAssignee(formData.get("assigneeId"));
  const fromAssigneeId = readAssignee(formData.get("fromAssigneeId"));

  if (assigneeId === undefined || fromAssigneeId === undefined) {
    return { status: "invalid", message: WORKFLOW_MESSAGE.invalid };
  }

  const result = await changeLeadAssignment(target.section, target.id, {
    fromAssigneeId,
    assigneeId,
  });

  if (result.state === "ok") {
    revalidatePath(`${LEAD_SECTION_PATH[target.section]}/${target.id}`);

    return { status: "saved", message: WORKFLOW_MESSAGE.assignmentSaved };
  }

  return toFailure(result.state, result.state === "invalid" ? result.issue : null);
}

/** `"unassigned"` → `null`; a non-empty string → itself; anything else → `undefined` (rejected). */
function readAssignee(value: FormDataEntryValue | null): string | null | undefined {
  if (value === "unassigned") return null;
  if (typeof value === "string" && value !== "") return value;

  return undefined;
}

/**
 * One failure branch per outcome, each with its own words.
 *
 * `conflict` gets the sentence the gate specified verbatim, because it has to tell the operator
 * both what happened and what to do — and "try again" alone would be wrong advice, since retrying
 * the same stale `from` would fail identically.
 */
function toFailure(
  state: "unauthenticated" | "forbidden" | "not-found" | "conflict" | "invalid" | "unavailable",
  issue: string | null,
): WorkflowState {
  switch (state) {
    case "conflict":
      return { status: "conflict", message: WORKFLOW_MESSAGE.conflict };
    case "forbidden":
      return { status: "forbidden", message: WORKFLOW_MESSAGE.forbidden };
    case "not-found":
      return { status: "not-found", message: WORKFLOW_MESSAGE.notFound };
    case "invalid":
      return {
        status: "invalid",
        message:
          issue === null ? WORKFLOW_MESSAGE.invalid : `${WORKFLOW_MESSAGE.invalid} ${issue}.`,
      };
    /*
     * `unauthenticated` is folded into `unavailable` on purpose. Middleware refreshes the session
     * before any render, so a 401 here means the credential died mid-interaction — and a Server
     * Action cannot redirect a form submission to the session-end handler without discarding the
     * operator's input. The neutral message is honest (the write did not happen) and the next
     * navigation goes through middleware, which resolves the session properly.
     */
    case "unauthenticated":
    case "unavailable":
      return { status: "unavailable", message: WORKFLOW_MESSAGE.unavailable };
  }
}
