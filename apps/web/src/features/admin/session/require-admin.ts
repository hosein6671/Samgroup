import "server-only";

import { redirect } from "next/navigation";

import { LOGIN_PATH, SESSION_END_PATH } from "../admin-routes";

import { readAdminSession, resolveAdminAccess } from "./session";

import type { AdminArea } from "./admin-areas";
import type { AdminAccess } from "./session";

/**
 * The two redirects every protected Admin page performs before it can render anything, in one
 * place.
 *
 * ── What it does, and what it deliberately does not ────────────────────────
 *
 * `anonymous` → `/login`. Middleware has already had its chance to refresh; no credential means
 * there was nothing to refresh with.
 *
 * `expired` → `/admin/session/end`. NestJS **refused** the access token the browser still holds.
 * Those cookies are stale and a Server Component cannot clear them — Next 15 permits
 * `cookies().set()` only in the action phase — so the render hands off to the Route Handler that
 * can, which clears both and lands on `/login`. Redirecting straight to `/login` instead would
 * leave the stale cookie in place and bounce against middleware until it aged out.
 *
 * Everything else is **returned, not decided here**: `authorized`, `forbidden` and `unavailable`
 * are rendered differently by every page, and a helper that redirected on `forbidden` would send
 * someone with working credentials to re-enter them, while one that redirected on `unavailable`
 * would treat a container restart as an authentication failure. Both are named in
 * FRONTEND_ARCHITECTURE §2a as things this surface must not do.
 *
 * ── `redirect()` throws, which is why the return type has three members ────
 *
 * Next signals a redirect by throwing, so control does not return from those branches. A caller
 * holding an `AdminAccess` is therefore past them and cannot forget to handle a state that is not
 * in the type.
 *
 * ── The shell is not routed through this ───────────────────────────────────
 *
 * `/admin/page.tsx` performs the same two redirects inline and predates this helper. It is left
 * alone deliberately: rewriting a shipped, tested page is a change with no behavioural benefit,
 * and the two agree because they are the same three lines. Any *new* protected page uses this.
 *
 * ── `area` decides which role list applies ────────────────────────────────
 *
 * `"shell"` (the default) is `/admin`, Admin-only. `"leads"` is `/admin/leads/**`, which admits
 * Admin, Content Manager and Sales Expert per SECURITY.md's "Forms & Leads" row. The lists are in
 * `admin-areas.ts`; nothing about the redirect behaviour differs between areas — an anonymous or
 * stale caller is handled identically wherever they were heading.
 *
 * ── Still not the enforcement ──────────────────────────────────────────────
 *
 * SECURITY.md §RBAC integration: "UI hiding is not authorization." This decides what to render.
 * Every `/api/v1/admin/*` request is independently authorized by a NestJS guard, so a page that
 * fetched lead data despite a wrong answer here would still be refused by the API.
 */
export async function requireAdminAccess(area: AdminArea = "shell"): Promise<AdminAccess> {
  const session = await readAdminSession();

  if (session.state === "anonymous") {
    redirect(LOGIN_PATH);
  }

  if (session.state === "expired") {
    redirect(SESSION_END_PATH);
  }

  return resolveAdminAccess(session, area);
}
