import Link from "next/link";

import { signOut } from "@/features/admin/actions";

import { ADMIN_PATH } from "../admin-routes";
import { roleMayEnter } from "../session/admin-areas";

import { CUSTOM_FORMULATION_REQUESTS_PATH, INQUIRIES_PATH } from "./lead-routes";

import type { ReactNode } from "react";

/**
 * The chrome and the non-happy states every inbox page shares.
 *
 * ── One frame, so the states cannot drift ──────────────────────────────────
 *
 * Four routes render five outcomes each — list, empty, forbidden, not-found, unavailable. Written
 * per route that is twenty panels, and the first thing that happens to twenty panels is that one of
 * them starts saying something the others do not. They are written once here and the routes choose
 * between them.
 *
 * ── The wording of each state is the point ─────────────────────────────────
 *
 * These are not interchangeable messages. "Not found" is a definitive answer about one record from
 * an authorized request; "Temporarily unavailable" says the platform did not answer and asserts
 * nothing about the record. An operator who is told a lead does not exist will stop looking for it,
 * which is why an outage must never render as a 404 — ADR-010 §7 fixes that for public content and
 * it matters more, not less, for a sales lead.
 *
 * Each state is legible without colour, icon or position: every one is a heading plus a sentence,
 * and none of them carries an icon at all (WCAG 2.2 §1.4.1).
 *
 * ── Server Components throughout ───────────────────────────────────────────
 *
 * Nothing here is `"use client"`, nothing takes an event handler, and the only interactive control
 * that is not a link is the sign-out form, which posts the same Server Action the shell uses — a
 * real `<button>` in a real `<form>`, so it is keyboard-operable before hydration. There are no
 * clickable `<div>`s anywhere on this surface.
 */

/** Which inbox is being viewed, so its navigation entry can carry `aria-current`. */
export type LeadSection = "inquiries" | "custom-formulation-requests";

/**
 * The bar at the top of every inbox page: who you are, the way out, and the way between modules.
 *
 * `user` is nullable because one state has no identity to show: when the platform could not answer,
 * the page knows a credential exists but not whose it is. Inventing a placeholder identity for that
 * case would be asserting something the render does not know.
 *
 * ── Landmarks ──────────────────────────────────────────────────────────────
 *
 * One `<main id="main-content">` per page — the target the root layout's skip link already points
 * at — and one `<nav>` with an accessible name. No `role="main"` or `role="navigation"` is added on
 * top: the native elements already carry those roles, and duplicating them is noise.
 *
 * ── Headings ───────────────────────────────────────────────────────────────
 *
 * `title` is the page's only `<h1>`, and every state rendered inside the frame uses `<h2>`. Nothing
 * skips a level for styling: the wordmark above it is a `<p>`, because it names the product rather
 * than the page.
 */
export function InboxFrame({
  title,
  user,
  section,
  children,
}: {
  readonly title: string;
  readonly user: { readonly email: string; readonly role: string } | null;
  readonly section?: LeadSection;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <main className="ad-shell ad-shell--wide" id="main-content">
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

      {user === null ? null : <AdminNav role={user.role} section={section} />}

      <h1 className="ad-heading">{title}</h1>

      {children}
    </main>
  );
}

/**
 * The Admin navigation.
 *
 * ── Affordance, not a boundary ─────────────────────────────────────────────
 *
 * **Every entry is filtered by the same area rule the destination enforces**, so nobody is offered a
 * link to a page that will refuse them. That is usability: the security boundary is the NestJS
 * guard, and hiding a link protects nothing.
 *
 * Two consequences, and the second was found in a browser rather than reasoned about:
 *
 * - The Admin-shell entry appears only for a role that may enter `/admin`. A Content Manager or
 *   Sales Expert working the inbox is not shown a link to a page that would answer "Access denied"
 *   — which is what the previous "← Admin" crumb would have done once those roles could get here.
 * - **A Customer sees no navigation at all.** They can reach this frame: `/admin/leads/inquiries`
 *   renders the refusal *inside* it, so the page still has its chrome and its sign-out control. If
 *   the entries were unconditional, the one role with no admin access anywhere would be looking at
 *   a menu of two pages that both refuse them. With no entry to render, the `<nav>` is omitted
 *   rather than emitted empty — an unlabelled empty landmark is noise in the landmark list.
 *
 * `aria-current="page"` marks the entry for the inbox being viewed, so a screen-reader user knows
 * where they are in the set without inferring it from the heading.
 */
function AdminNav({
  role,
  section,
}: {
  readonly role: string;
  readonly section?: LeadSection;
}): ReactNode {
  const entries: { href: string; label: string; current: boolean }[] = [];

  if (roleMayEnter(role, "shell")) {
    entries.push({ href: ADMIN_PATH, label: "Admin", current: false });
  }

  if (roleMayEnter(role, "leads")) {
    entries.push(
      { href: INQUIRIES_PATH, label: "Inquiries", current: section === "inquiries" },
      {
        href: CUSTOM_FORMULATION_REQUESTS_PATH,
        label: "Custom formulation requests",
        current: section === "custom-formulation-requests",
      },
    );
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <nav className="ad-nav ad-nav--inline" aria-label="Admin modules">
      {entries.map((entry) => (
        <Link
          className="ad-nav-link"
          href={entry.href}
          aria-current={entry.current ? "page" : undefined}
          key={entry.href}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}

/** A quiet block of prose inside the frame — used for every state that is not a list. */
export function InboxNotice({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="ad-notice">
      <h2 className="ad-notice-title">{heading}</h2>
      <p className="ad-note">{children}</p>
    </div>
  );
}

/**
 * The empty inbox. Neutral and final: there are no leads, and nothing is wrong.
 *
 * Nothing is invented to fill it — no sample rows, no placeholder metrics. A populated-looking
 * empty state is a lie an operator would act on. **This is also what an authorized Sales Expert
 * with no assigned leads sees**, and it is the correct answer for them: their queue is empty, and
 * that is a successful read rather than a refusal.
 *
 * It carries a heading like every other state, so the page's structure does not change shape
 * depending on whether there happen to be rows.
 */
export function InboxEmpty({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="ad-notice">
      <h2 className="ad-notice-title">{heading}</h2>
      <p className="ad-note">{children}</p>
    </div>
  );
}

/**
 * The platform did not answer. **No cookie is touched and no redirect happens** — an outage says
 * nothing about anyone's session, and signing an operator out because a container restarted is the
 * failure FRONTEND_ARCHITECTURE §2a names explicitly.
 *
 * The wording deliberately mentions no HTTP status and no authentication: nothing here is known
 * about the caller's credentials, so saying anything about them would be a guess.
 */
export function InboxUnavailable(): ReactNode {
  return (
    <InboxNotice heading="Temporarily unavailable">
      The platform is not responding, so this data could not be loaded. You have not been signed
      out, and nothing has been lost. Please try again shortly.
    </InboxNotice>
  );
}

/**
 * The credential is valid and the role is not permitted — NestJS said so, and NestJS is the
 * authority. Distinct from "not signed in": re-entering working credentials would change nothing,
 * so no sign-in link is offered and none is implied by the wording.
 */
export function InboxForbidden(): ReactNode {
  return (
    <InboxNotice heading="Access denied">
      Your account does not have access to this data. This is enforced by the platform, not by this
      page.
    </InboxNotice>
  );
}

/**
 * A definitive 404 from an authenticated, authorized request: this id names no record you can see.
 * Reached only when the API said so — never when it failed to answer.
 *
 * It carries the one recovery route that makes sense, a link back to the list it came from.
 */
export function InboxNotFound({
  label,
  backHref,
  backLabel,
}: {
  readonly label: string;
  readonly backHref: string;
  readonly backLabel: string;
}): ReactNode {
  return (
    <div className="ad-notice">
      <h2 className="ad-notice-title">Not found</h2>
      <p className="ad-note">{label}</p>
      <p className="ad-note">
        <Link className="ad-link" href={backHref}>
          {backLabel}
        </Link>
      </p>
    </div>
  );
}

/** The window of page numbers rendered around the current one, plus the two ends. */
const PAGE_WINDOW = 1;

/**
 * Which page numbers to render, and where the sequence is interrupted.
 *
 * Always the first page, the last page, and `PAGE_WINDOW` either side of the current one. A `null`
 * marks a gap. Rendering all of them would be an unbounded control set; rendering only prev/next
 * would leave a keyboard user pressing Next twelve times to reach page 13.
 */
function pageItems(page: number, pages: number): (number | null)[] {
  const wanted = new Set<number>([1, pages]);

  for (let n = page - PAGE_WINDOW; n <= page + PAGE_WINDOW; n += 1) {
    if (n >= 1 && n <= pages) wanted.add(n);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const items: (number | null)[] = [];

  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];

    if (previous !== undefined && value - previous > 1) items.push(null);

    items.push(value);
  }

  return items;
}

/**
 * Previous / page numbers / Next, plus how many records there are.
 *
 * ── Links, not buttons ─────────────────────────────────────────────────────
 *
 * A page of a list is a URL, so it should be shareable, bookmarkable, openable in a new tab and
 * navigable with the browser's own controls. Every href is built from the **parsed** query rather
 * than from the incoming URL string, so only recognised parameters survive a click — see
 * `lead-query.ts`.
 *
 * ── The boundary controls are inert, not fake ──────────────────────────────
 *
 * On the first page "Previous" is a `<span>`, not a disabled-looking link. An `<a>` has no disabled
 * state; one without an `href` is not focusable and not announced as a link, which is the honest
 * representation of a control that goes nowhere — and it means a keyboard user never lands on
 * something that does nothing when activated.
 *
 * ── Names, and no meaning carried by a glyph ───────────────────────────────
 *
 * The arrows are decorative and `aria-hidden`, so the accessible names are "Previous" and "Next"
 * rather than "left arrow Previous". Each number is labelled "Page 3" rather than left as a bare
 * digit, and the current one carries `aria-current="page"` as well as a fill, a border and a weight
 * change — three signals, none of them colour alone.
 */
export function InboxPagination({
  page,
  pages,
  total,
  unit,
  hrefForPage,
}: {
  readonly page: number;
  readonly pages: number;
  readonly total: number;
  /** The plural noun for a record on this page — "inquiries", "requests". */
  readonly unit: string;
  readonly hrefForPage: (page: number) => string;
}): ReactNode {
  const items = pageItems(page, pages);

  return (
    <nav className="ad-pager" aria-label="Pagination">
      <p className="ad-pager-position">
        {total} {unit} in total
      </p>

      <ol className="ad-pager-list">
        <li>
          {page > 1 ? (
            <Link className="ad-pager-step" href={hrefForPage(page - 1)} rel="prev">
              <span aria-hidden="true">←</span> Previous
            </Link>
          ) : (
            <span className="ad-pager-step ad-pager-step--inert">
              <span aria-hidden="true">←</span> Previous
            </span>
          )}
        </li>

        {items.map((item, index) =>
          item === null ? (
            /*
             * Keyed by position: a gap has no identity of its own, and the list is rebuilt from
             * scratch on every server render, so there is no reconciliation for the key to get
             * wrong.
             */
            <li key={`gap-${String(index)}`} className="ad-pager-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                className="ad-pager-step"
                href={hrefForPage(item)}
                aria-label={`Page ${String(item)}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Link>
            </li>
          ),
        )}

        <li>
          {page < pages ? (
            <Link className="ad-pager-step" href={hrefForPage(page + 1)} rel="next">
              Next <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="ad-pager-step ad-pager-step--inert">
              Next <span aria-hidden="true">→</span>
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}
