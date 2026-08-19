import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/features/admin/actions";
import { LOGIN_PATH, SESSION_END_PATH } from "@/features/admin/admin-routes";
import {
  CUSTOM_FORMULATION_REQUESTS_PATH,
  INQUIRIES_PATH,
} from "@/features/admin/leads/lead-routes";
import { roleMayEnter } from "@/features/admin/session/admin-areas";
import { readAdminSession, resolveAdminAccess } from "@/features/admin/session/session";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin` — the Admin shell.
 *
 * ── Still not a dashboard ───────────────────────────────────────────────────
 *
 * It shows who is signed in, what role the server says they hold, a way to sign out, and — since
 * the lead inbox landed — links into the two modules that exist. That is the whole surface,
 * deliberately: catalog administration, blog, user management, locales and translations are each
 * their own gate with their own approval, and no summary, count or metric is shown for anything,
 * including leads. A count here would be a second read of the same data with no operational use.
 *
 * The page still fetches **no `/admin/*` data at all**. That is why nothing here depends on the
 * authorization check below being correct: there is no protected payload on this page to leak, and
 * the pages the links point at each resolve the session themselves.
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

/**
 * The title names the screen (WCAG 2.2 §2.4.2). The `(admin)` layout's `robots` declaration —
 * `noindex, nofollow, nocache, noarchive` — is inherited and untouched by adding one.
 */
export const metadata: Metadata = { title: "Admin Dashboard · SAM Group Admin" };

export default async function AdminPage(): Promise<ReactNode> {
  const session = await readAdminSession();

  if (session.state === "anonymous") {
    redirect(LOGIN_PATH);
  }

  if (session.state === "expired") {
    redirect(SESSION_END_PATH);
  }

  // "shell" is `/admin` itself and is Admin-only. `/admin/leads/**` passes "leads" and admits
  // three roles; the two lists are separate on purpose (see admin-areas.ts).
  const access = resolveAdminAccess(session, "shell");

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
    /*
     * A Content Manager or Sales Expert is refused *this page* and is entitled to the lead inbox —
     * SECURITY.md's "Forms & Leads" row grants them read. Offering that link is the difference
     * between a dead end and a redirect someone can act on, and it discloses nothing: the roles
     * that see it are the roles the API would serve. A Customer matches no area and sees only the
     * refusal and the way out.
     */
    const leadsOpen = roleMayEnter(access.user.role, "leads");

    return (
      <main className="ad-centre" id="main-content">
        <div className="ad-panel">
          <p className="ad-mark">SAM Group Admin</p>
          <h1 className="ad-title">Access denied</h1>
          <p className="ad-lede">
            You are signed in as {access.user.email}, which does not have access to this page.
          </p>
          {leadsOpen ? (
            <p className="ad-lede">
              Your account can open the{" "}
              <Link className="ad-link" href={INQUIRIES_PATH}>
                lead inbox
              </Link>
              .
            </p>
          ) : null}
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

      {/*
       * The page's one <h1>. The wordmark above is a <p> because it names the product rather than
       * the screen; a heading hierarchy that started at the brand would leave this page without a
       * title of its own. "Admin Dashboard" is the surface's canonical name (CLAUDE.md §3).
       */}
      <h1 className="ad-heading">Admin Dashboard</h1>

      {/*
       * The navigation, and the smallest thing that reaches the only built module. Two links, no
       * sidebar, no section headings, no counts — an operator needs a way in, and everything beyond
       * that is a navigation architecture this gate has no basis to design.
       *
       * Visibility here is an affordance, never the boundary: this page is Admin-only, so an Admin
       * is the only role that reaches it, and every link's destination re-checks entry for itself.
       */}
      <nav className="ad-nav" aria-label="Admin modules">
        <Link className="ad-nav-link" href={INQUIRIES_PATH}>
          Inquiries
        </Link>
        <Link className="ad-nav-link" href={CUSTOM_FORMULATION_REQUESTS_PATH}>
          Custom formulation requests
        </Link>
      </nav>

      <p className="ad-note">
        Your session is active. The lead inbox is the only operational module built so far —
        catalog, blog, users, locales and translations are not available yet.
      </p>
    </main>
  );
}
