import { ADMIN_ROLE } from "./auth-api";

/**
 * Which roles may **enter** which part of the Admin surface.
 *
 * ## Entry, and nothing finer
 *
 * This file answers one question: may this role open this screen at all? It never decides which
 * records a screen shows. That distinction is the whole design:
 *
 * - **Entry** is a UI affordance. Getting it wrong shows someone a page whose data request the API
 *   will refuse anyway, or hides a page they were entitled to.
 * - **Scope** — which leads a Sales Expert sees — is an access-control decision, and it is made in
 *   NestJS from the authenticated caller, per SECURITY.md §RBAC integration rule 2. `apps/web`
 *   sends no `assignedToId`, offers no "leads for user X" control, and has no URL spelling for one.
 *
 * A Sales Expert with no assigned leads therefore gets the **normal empty state**, not a refusal:
 * an empty queue is the truthful answer to a request that succeeded.
 *
 * ## The areas are separate on purpose
 *
 * `/admin` and `/admin/leads/**` do **not** share a role list, and the surface is not widened
 * wholesale. The shell stays Admin-only until something on it is meant for another role; the lead
 * inbox follows SECURITY.md's "Forms & Leads" row, which grants read to Content Manager and
 * own-leads-only to Sales Expert. A future module gets its own entry here, matching its own row of
 * the matrix — never a blanket `/admin/*` rule.
 *
 * ## Still not the enforcement
 *
 * SECURITY.md §RBAC integration: "UI hiding is not authorization." Every `/api/v1/admin/*` request
 * is independently authorized by a NestJS guard on the assumption that the caller crafted it by
 * hand, and the guards list the same roles this file does. If the two ever disagree, the API wins
 * and the user sees a refusal — which is the safe direction.
 */

/** The role vocabulary, spelled as `apps/api`'s `user-role.ts` puts it on the wire. */
export const CONTENT_MANAGER_ROLE = "content_manager";
export const SALES_EXPERT_ROLE = "sales_expert";
export const CUSTOMER_ROLE = "customer";

/**
 * The parts of the Admin surface that have their own entry rule.
 *
 * Two today. A third arrives with the next module, and adding one is meant to be a line here plus
 * the matching `@Roles()` in NestJS — not a change to how any page is written.
 */
export type AdminArea = "shell" | "leads";

/**
 * Area → the roles permitted to open it.
 *
 * `shell` is `/admin` itself: Admin only, unchanged from the session gate that shipped it. Nothing
 * on that page is meant for another role yet, and widening it would be an authorization change
 * with no surface behind it.
 *
 * `leads` is `/admin/leads/**`: the "Forms & Leads" row of the RBAC matrix — Admin (all), Content
 * Manager (read), Sales Expert (own leads only). `customer` is in neither list, and its cell in
 * that row is the public submission form, not this surface.
 */
export const AREA_ROLES: Readonly<Record<AdminArea, readonly string[]>> = {
  shell: [ADMIN_ROLE],
  leads: [ADMIN_ROLE, CONTENT_MANAGER_ROLE, SALES_EXPERT_ROLE],
};

/** Whether a role may open an area. Unknown roles are refused — the list is an allow-list. */
export function roleMayEnter(role: string, area: AdminArea): boolean {
  return AREA_ROLES[area].includes(role);
}
