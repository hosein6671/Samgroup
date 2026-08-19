import "server-only";

import { ADMIN_ROLE } from "../session/auth-api";
import { SALES_EXPERT_ROLE } from "../session/admin-areas";

import { EMPTY_ASSIGNEE_DIRECTORY, readAssigneeDirectory } from "./assignee-directory";
import { getLeadHistory } from "./leads-api";

import type { LeadSectionKey } from "./lead-routes";
import type { AssigneeOption } from "./workflow-views";
import type { AuthUser } from "../session/auth-api";
import type { LeadHistoryEntry, LeadStatus } from "@sam-group/types";

/**
 * Everything the Workflow panel needs, assembled once for both detail routes.
 *
 * ## Why this is shared rather than written twice
 *
 * The two detail pages differ only in which lead they read. Their workflow section is identical —
 * same role rules, same directory lookup, same history call — and two copies would be two places
 * for the "who may assign" rule to drift. The section key is the parameter.
 *
 * ## Role decides what is fetched, not just what is rendered
 *
 * A Content Manager's history is never requested: the API would answer 403, and asking is a round
 * trip to be refused. A Sales Expert's assignee directory is never requested either — `/admin/users`
 * is Admin-only and would refuse them, and the owner of a lead they can see is necessarily
 * themselves, which the session already knows.
 *
 * None of this is the boundary. NestJS authorizes each call independently; skipping a request the
 * caller would be refused is efficiency and error-avoidance, not access control.
 */

export type WorkflowPanelData = {
  readonly section: LeadSectionKey;
  readonly status: LeadStatus;
  readonly assigneeId: string | null;
  readonly assigneeLabel: string | null;
  readonly assigneeIsInactive: boolean;
  readonly canAssign: boolean;
  readonly canChangeStatus: boolean;
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly history: readonly LeadHistoryEntry[] | null;
};

export async function resolveWorkflowPanel({
  section,
  id,
  user,
  status,
  assigneeId,
}: {
  readonly section: LeadSectionKey;
  readonly id: string;
  readonly user: AuthUser;
  readonly status: string;
  readonly assigneeId: string | null;
}): Promise<WorkflowPanelData> {
  const isAdmin = user.role === ADMIN_ROLE;
  const isSales = user.role === SALES_EXPERT_ROLE;

  /*
   * Content Manager reads leads and nothing else on this panel: no status control, no assignment
   * control, no history. That is the "read" cell of the RBAC matrix taken literally, and the
   * history exclusion is this gate's decision — history is a record of which member of staff did
   * what, which is employee activity data rather than lead data.
   */
  const canAssign = isAdmin;
  const canChangeStatus = isAdmin || isSales;
  const canReadHistory = isAdmin || isSales;

  const directory = canAssign ? await readAssigneeDirectory() : EMPTY_ASSIGNEE_DIRECTORY;

  const historyResult = canReadHistory ? await getLeadHistory(section, id) : null;

  return {
    section,
    // The API's CHECK constraint guarantees the vocabulary, so this narrowing describes reality
    // rather than asserting over it. An unexpected value would render as stored (see the panel).
    status: status as LeadStatus,
    assigneeId,
    assigneeLabel: nameFor(assigneeId, directory.byId, user, isSales),
    assigneeIsInactive:
      assigneeId !== null && directory.byId.get(assigneeId)?.status === "disabled",
    canAssign,
    canChangeStatus,
    assigneeOptions: directory.options,
    /*
     * `null` means "not permitted to see it" and renders no History block at all. A failed or
     * unavailable history read is deliberately flattened to an empty list instead: the lead itself
     * loaded, and an operator should still be able to read and act on it when the audit trail is
     * momentarily unreachable.
     */
    history:
      historyResult === null ? null : historyResult.state === "ok" ? historyResult.value : [],
  };
}

/**
 * The owner as a person.
 *
 * An Admin resolves the id through the directory they just read. A Sales Expert cannot read
 * `/admin/users`, but they can only ever see leads assigned to themselves — so their own session
 * email is the correct and only possible answer. Anyone else, or an id the directory does not
 * know (a deleted account whose column has not yet been re-read), falls back to `null`, which the
 * panel renders as "Unassigned" rather than as a blank.
 */
function nameFor(
  assigneeId: string | null,
  byId: ReadonlyMap<string, { email: string }>,
  user: AuthUser,
  isSales: boolean,
): string | null {
  if (assigneeId === null) return null;
  if (isSales && assigneeId === user.id) return user.email;

  return byId.get(assigneeId)?.email ?? null;
}
