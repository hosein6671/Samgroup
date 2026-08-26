import { signOut } from "@/features/admin/actions";

import { AdminNav } from "./admin-nav";

import type { AdminNavKey } from "./admin-nav";
import type { ReactNode } from "react";

/**
 * The Admin chrome every area shares — and nothing else.
 *
 * ## Why it is neutral
 *
 * Leads and Technical Review are **siblings**. When the lead inbox was the only module with more
 * than one screen, its `InboxFrame` owned the bar, the identity line, the sign-out control and the
 * navigation; Technical Review then reproduced all four, which is how two copies of one header
 * start saying different things. Neither sibling can own the chrome without inverting the
 * relationship — the other would have to import from it to render its own header.
 *
 * So the chrome lives here, in the neutral Admin feature area, alongside `AdminNav`. `InboxFrame`
 * and `ReviewFrame` both compose it, neither imports the other, and there is exactly one
 * implementation of the header on the surface.
 *
 * ## What it owns, and what it must never own
 *
 * **Owns:** the `<main>` landmark and its skip-link target, the identity bar, the sign-out form,
 * the module navigation, and the page `<h1>`.
 *
 * **Does not own, deliberately:** inbox content, queue content, pagination, filters, per-feature
 * headings, and per-feature empty, forbidden, not-found or unavailable states. Those differ in
 * wording on purpose — "this lead does not exist" and "this subject is not in the queue" are not
 * the same sentence — and a shared component that tried to phrase both would end up phrasing
 * neither. Each feature keeps its own states next to the data they describe.
 *
 * ## Landmarks and headings
 *
 * One `<main id="main-content">` per page — the target the `(admin)` root layout's skip link points
 * at — and one navigation with an accessible name. No `role="main"` or `role="navigation"` on top:
 * the native elements already carry those roles and restating them is noise.
 *
 * `title` is the page's only `<h1>`; every state rendered inside uses `<h2>`. The wordmark above it
 * is a `<p>`, because it names the product rather than the page.
 *
 * ## `user` is nullable, and that is not an oversight
 *
 * One state has no identity to show: when the platform could not answer, the page knows a
 * credential exists but not whose it is. Inventing a placeholder identity there would assert
 * something the render does not know. With no user there is also no navigation, because entry
 * rules cannot be evaluated without a role.
 *
 * ## Server Component
 *
 * Nothing here is `"use client"` and nothing takes an event handler. The only control that is not
 * a link is the sign-out button, a real `<button>` in a real `<form>` bound to the same Server
 * Action the dashboard uses, so it is keyboard-operable before hydration.
 */
export function AdminShell({
  title,
  user,
  current,
  wide = true,
  children,
}: {
  readonly title: string;
  readonly user: { readonly email: string; readonly role: string } | null;
  readonly current?: AdminNavKey;
  /** The wide operational width. `false` is reserved for a future narrow Admin page. */
  readonly wide?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <main className={wide ? "ad-shell ad-shell--wide" : "ad-shell"} id="main-content">
      <div className="ad-bar">
        <div>
          <p className="ad-mark">SAM Group Admin</p>
          {user === null ? null : (
            <p className="ad-identity">
              {user.email} · <span className="ad-role">{user.role}</span>
            </p>
          )}
        </div>
        <form action={signOut}>
          <button className="ad-signout" type="submit">
            Sign out
          </button>
        </form>
      </div>

      {user === null ? null : <AdminNav role={user.role} current={current} />}

      <h1 className="ad-heading">{title}</h1>

      {children}
    </main>
  );
}
