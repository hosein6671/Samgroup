import { redirect } from "next/navigation";

import { signOut } from "@/features/admin/actions";
import { LOGIN_PATH, SESSION_END_PATH } from "@/features/admin/admin-routes";
import { readAdminSession, resolveAdminAccess } from "@/features/admin/session/session";

import type { ReactNode } from "react";

/**
 * `/admin` — the Admin shell.
 *
 * ── This is a session proof, not a dashboard ────────────────────────────────
 *
 * It shows who is signed in, what role the server says they hold, and a way to sign out. That is
 * the whole surface, deliberately: this gate builds the browser session layer, and every operational
 * module — the lead inbox, catalog administration, user management, translations — is its own gate
 * with its own approval. The page fetches **no `/admin/*` data at all**, which is also why nothing
 * here depends on the authorization check below being correct: there is no protected payload on the
 * page to leak.
 *
 * ── The four ways this request can end ──────────────────────────────────────
 *
 * `anonymous` → `/login`. Middleware has already tried to refresh; if there is still no credential
 * there was nothing to refresh with.
 *
 * `expired` → the session-end handler. NestJS **refused** the access token the browser still holds —
 * a deleted account, a `disabled` one, or one whose token predates its credential-revocation cutoff.
 * Those cookies are stale and must be cleared, and a Server Component cannot clear them: Next 15
 * permits `cookies().set()` only in the action phase. Redirecting straight to `/login` would leave
 * the stale access cookie in place, middleware would wave it through on the next request, and the
 * two would bounce until it aged out. The Route Handler clears both and lands on `/login`, closing
 * the loop in one hop.
 *
 * `unavailable` → a neutral state, and **no redirect and no cookie is touched**. The platform did
 * not answer; that says nothing about anyone's session. Telling a signed-in operator to log in
 * because a container restarted — and deleting their seven-day credential on the way — is the
 * failure this branch exists to prevent.
 *
 * `forbidden` → an authenticated non-Admin. See below.
 *
 * ── Dynamic by construction, and stated anyway ──────────────────────────────
 *
 * `readAdminSession` reads `cookies()` and `headers()`, either of which permanently opts the route
 * out of static generation, and `apiGet` sends `cache: "no-store"`. `force-dynamic` and
 * `revalidate = 0` restate it so no future edit can quietly make an operator's identity part of
 * build output.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage(): Promise<ReactNode> {
  const session = await readAdminSession();

  if (session.state === "anonymous") {
    redirect(LOGIN_PATH);
  }

  if (session.state === "expired") {
    redirect(SESSION_END_PATH);
  }

  const access = resolveAdminAccess(session);

  if (access.state === "unavailable") {
    return (
      <main className="ad-centre" id="main-content">
        <div className="ad-panel">
          <p className="ad-mark">SAM Group Admin</p>
          <h1 className="ad-title">Temporarily unavailable</h1>
          <p className="ad-lede">
            The platform is not responding, so your session could not be confirmed. You have not
            been signed out. Please try again shortly.
          </p>
        </div>
      </main>
    );
  }

  /*
   * An authenticated account that is not an Admin — a Content Manager, Sales Expert or Customer.
   *
   * Shown as a distinct refusal rather than folded into "not signed in", because the two need
   * different things done about them and collapsing them would send someone to re-enter
   * credentials that are working perfectly. It discloses nothing beyond what the caller has already
   * proven about themselves: their own email, their own role, and the fact that this surface exists
   * — which they knew, because they navigated to it.
   *
   * Sign-out is offered here on purpose. Without it the only way out of this page for someone
   * signed in as the wrong account is to clear cookies by hand.
   */
  if (access.state === "forbidden") {
    return (
      <main className="ad-centre" id="main-content">
        <div className="ad-panel">
          <p className="ad-mark">SAM Group Admin</p>
          <h1 className="ad-title">Access denied</h1>
          <p className="ad-lede">
            You are signed in as {access.user.email}, which does not have access to the Admin
            Dashboard.
          </p>
          <form action={signOut}>
            <button className="ad-submit" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="ad-shell" id="main-content">
      <div className="ad-bar">
        <div>
          <p className="ad-mark">SAM Group Admin</p>
          <p className="ad-identity">
            {access.user.email} · <span className="ad-role">{access.user.role}</span>
          </p>
        </div>
        {/*
         * A real <form> posting a Server Action, not a link. Signing out revokes a session
         * server-side and clears two cookies; a GET that does either is a GET that a prefetch or a
         * link scanner can fire. It also means the control works before hydration.
         */}
        <form action={signOut}>
          <button className="ad-signout" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <p className="ad-note">
        Your session is active. Administration modules are not built yet — this release adds the
        Admin sign-in and session layer only.
      </p>
    </main>
  );
}
