import "server-only";

import { apiGet } from "@/lib/api-client";

import { getAdminAccessToken } from "../session/session";

import type { AssigneeOption } from "./workflow-views";

/**
 * Who a lead may be assigned to, and who the current owner is — read through the **existing**
 * Admin-only `GET /admin/users`.
 *
 * ## Why this endpoint and not a new one
 *
 * Assignment is Admin-only, and `/admin/users` is already Admin-only and already shipped. Adding a
 * Forms-owned "eligible assignees" endpoint would duplicate a staff list across two modules, and
 * exposing one through Forms would mean Forms reading `users` — which the module boundary forbids
 * and an architecture test fails the build for. The filtering happens here, server-side, on data
 * the caller is already entitled to.
 *
 * ## What a failure means, and what it must not do
 *
 * An empty list is the safe degradation: the assignment control renders with "Unassigned" and no
 * staff options, so nothing can be assigned — rather than the page failing, or worse, offering a
 * stale list. **A failure here never blocks the lead from rendering**: an operator must still be
 * able to read a lead and change its status when the user list is unavailable.
 */

type AdminUser = {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
};

export type AssigneeDirectory = {
  /** Active Sales Experts, alphabetically — the options the assignment control offers. */
  readonly options: readonly AssigneeOption[];
  /** Every user by id, so a current owner can be named even if they are no longer eligible. */
  readonly byId: ReadonlyMap<string, AdminUser>;
};

export const EMPTY_ASSIGNEE_DIRECTORY: AssigneeDirectory = { options: [], byId: new Map() };

/**
 * Fetched only for a caller who may assign. A Sales Expert calling this would receive 403 — the
 * Users group is Admin-only — so the page does not call it for them, and their own lead's owner is
 * necessarily themselves.
 */
export async function readAssigneeDirectory(): Promise<AssigneeDirectory> {
  const accessToken = await getAdminAccessToken();

  if (accessToken === null) {
    return EMPTY_ASSIGNEE_DIRECTORY;
  }

  const result = await apiGet<AdminUser[]>("/admin/users", undefined, { accessToken });

  if (!result.ok) {
    console.warn("[admin/leads] /admin/users — assignee directory unavailable");

    return EMPTY_ASSIGNEE_DIRECTORY;
  }

  const users = result.data.filter(
    (user): user is AdminUser => typeof user.id === "string" && typeof user.email === "string",
  );

  return {
    // The same eligibility rule NestJS enforces, applied to the options offered: an ineligible
    // choice the API would refuse is a control that wastes the operator's time.
    options: users
      .filter((user) => user.role === "sales_expert" && user.status === "active")
      .map((user) => ({ id: user.id, email: user.email }))
      .sort((a, b) => a.email.localeCompare(b.email)),
    byId: new Map(users.map((user) => [user.id, user])),
  };
}
