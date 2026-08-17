/**
 * Payload's own role model and the access predicates built on it.
 *
 * ADR-006 is the authority: Payload keeps its **own** admin users in `sam_cms`, with its own role
 * model mirroring the CMS-facing rules in SECURITY.md's RBAC matrix. There is no SSO bridge, no
 * account syncing from the platform `User` table, and no shared cookies — a role here is not a
 * platform role and must never be treated as one.
 */

import type { Access, FieldAccess, PayloadRequest } from "payload";

/**
 * ADR-006 fixes "minimum `Admin` and `Content Manager`". `service` is the third and exists for one
 * reason: API_CONTRACT_FINAL.md §4 requires NestJS to reach Payload "server-to-server with a
 * service credential", and a credential needs an identity whose reach is narrower than an editor's.
 * It is not an editorial role and must never be granted to a person.
 */
export const ROLES = ["admin", "content-manager", "service"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Whatever `req.user` happens to be, reduced to the one property these predicates read.
 *
 * Structural rather than Payload's own `User`: that name resolves differently depending on whether
 * the generated `payload-types.ts` has been picked up, and the predicates below care about exactly
 * one field. Narrowing to it keeps them correct under both.
 */
type RoleBearer = { roles?: unknown } | null | undefined;

function hasRole(user: RoleBearer, role: Role): boolean {
  const roles: unknown = user?.roles;

  return Array.isArray(roles) && roles.includes(role);
}

export function isAdmin(user: RoleBearer): boolean {
  return hasRole(user, "admin");
}

export function isEditor(user: RoleBearer): boolean {
  return isAdmin(user) || hasRole(user, "content-manager");
}

export function isService(user: RoleBearer): boolean {
  return hasRole(user, "service");
}

/** Admin only — used for the Users collection itself. */
export const adminOnly: Access = ({ req: { user } }) => isAdmin(user);

/** Admin or Content Manager — the editorial write gate (SECURITY.md's CMS Content row). */
export const editorOnly: Access = ({ req: { user } }) => isEditor(user);

export const adminOnlyField: FieldAccess = ({ req: { user } }) => isAdmin(user);

/**
 * Who may open the admin panel at all.
 *
 * The `service` identity is authenticated but is not a person, so it is refused here even though it
 * can read through the REST API. Without this it could sign in and browse editorial content with a
 * credential that lives in a server's environment file.
 */
// Not `Access`: the auth collection's `admin` gate is boolean-only — a query constraint would be
// meaningless for "may this person open the panel".
export const canAccessAdminPanel = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  isEditor(user);

/**
 * Editorial read: everything for an editor, **published only** for the service identity, nothing
 * for anyone else.
 *
 * The three branches are the whole security posture of the public content path:
 *
 * - **Unauthenticated → false.** Payload's own default (`Boolean(user)`, verified in
 *   `payload/dist/auth/defaultAccess.js`), restated here so it is a decision rather than an
 *   inherited default. It matters more than it looks: nginx routes `cms.<domain>/*` straight to
 *   this application (`docker/nginx/templates/default.conf.template`), so Payload's REST API is
 *   publicly *routable* — refusing anonymous reads is what keeps it not publicly *readable*.
 * - **`service` → a `_status` constraint, not `true`.** API_CONTRACT_FINAL.md §4 makes
 *   published-state filtering NestJS's responsibility; this makes it additionally impossible to
 *   bypass. A Content module bug — or a `?draft=true` that somehow survived — still cannot surface
 *   an unpublished page, which is exactly the guarantee the Admin-publish gate depends on.
 * - **Editor → true**, because drafts are what the admin panel exists to edit.
 */
export const publishedForService: Access = ({ req: { user } }) => {
  if (isEditor(user)) {
    return true;
  }

  if (isService(user)) {
    return { _status: { equals: "published" } };
  }

  return false;
};

/**
 * Media read: editors and the service identity, nobody else.
 *
 * **Unconditional `true` for `service`, and that is not an oversight** — it is the one place the
 * Media rule deliberately differs from `publishedForService`, so the difference is stated rather
 * than left to be inferred:
 *
 * Media has no draft/publish cycle. `Pages` does, which is what gives `publishedForService` a
 * `_status` column to constrain on; an upload has no equivalent state, so there is no "unpublished
 * media" for a constraint to exclude and a copied `_status` filter would silently match nothing and
 * make every image unreachable.
 *
 * What actually keeps unreferenced media out of a public response is upstream of this: NestJS reads
 * media only by following a relationship from a document it has already been allowed to read, so an
 * image reachable through a published page is exactly the set it can see. And the objects
 * themselves are anonymously readable by design — they live in the `sam-public` bucket and are
 * served by nginx at `/media/*` — so this rule governs access to the *metadata* (alt text, sizes,
 * the record), never secrecy of the bytes.
 *
 * Anonymous is still refused, for the same reason as `Pages`: `cms.<domain>` is publicly routable,
 * and Payload's REST API must not be a second, unaudited way to enumerate the CMS.
 */
export const mediaRead: Access = ({ req: { user } }) => isEditor(user) || isService(user);
