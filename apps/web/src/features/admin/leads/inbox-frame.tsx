import Link from "next/link";

import { AdminShell } from "../admin-shell";

import type { ReactNode } from "react";

/**
 * The non-happy states every inbox page shares, and the inbox's page frame.
 *
 * ── The chrome is no longer here ───────────────────────────────────────────
 *
 * The header, the identity line, the sign-out control and the module navigation moved to
 * `features/admin/admin-shell.tsx` and `features/admin/admin-nav.tsx` when Technical Review arrived
 * as a sibling area. Neither is re-exported from this file: nothing imported them through it, and a
 * pass-through export would leave two plausible owners for one component. Import them from the
 * neutral Admin area.
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
 * The lead inbox page frame.
 *
 * Chrome comes from the neutral `AdminShell`; this adds nothing to it but the inbox vocabulary.
 * The rendered markup is byte-for-byte what this component produced before the extraction — same
 * landmark, same bar, same identity line, same sign-out form, same navigation, same `<h1>` — which
 * is what the lead specs pin and why they needed no change.
 *
 * `section` stays named `section` rather than being renamed to the shell's `current`: four call
 * sites pass it, it is the inbox's own word, and renaming it would be churn in files this gate has
 * no business touching. It is a subset of `AdminNavKey`, so it passes straight through.
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
    <AdminShell title={title} user={user} current={section}>
      {children}
    </AdminShell>
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
