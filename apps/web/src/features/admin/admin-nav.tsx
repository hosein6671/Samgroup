import Link from "next/link";

import { ADMIN_PATH } from "./admin-routes";
import { CATALOG_REVIEW_PATH } from "./catalog/review/review-routes";
import { CUSTOM_FORMULATION_REQUESTS_PATH, INQUIRIES_PATH } from "./leads/lead-routes";
import { roleMayEnter } from "./session/admin-areas";

import type { ReactNode } from "react";

/**
 * The Admin module navigation, shared by every Admin area.
 *
 * ## Why it lives here
 *
 * It was declared inside `leads/inbox-frame.tsx` while the lead inbox was the only module with more
 * than one screen. Technical Review is a **sibling** of Leads, not something underneath it, and a
 * navigation owned by one sibling cannot list the other without inverting that relationship — the
 * review feature would have to import from the leads feature to render its own chrome. Moving it
 * to `features/admin/` puts it where both areas can reach it and neither owns it (ratified decision
 * D7).
 *
 * Nothing about the lead entries changed in the move: same paths, same labels, same order, same
 * role gating, same `aria-current`. `inbox-frame.tsx` re-exports this component, so the lead specs
 * that import `AdminNav` through it keep working against the same implementation.
 *
 * ## Affordance, not a boundary
 *
 * **Every entry is filtered by the same area rule the destination enforces**, so nobody is offered
 * a link to a page that will refuse them. That is usability: the security boundary is the NestJS
 * guard, and hiding a link protects nothing. SECURITY.md §RBAC integration: "UI hiding is not
 * authorization."
 *
 * Two consequences, and the second was found in a browser rather than reasoned about:
 *
 * - The Admin-shell entry appears only for a role that may enter `/admin`. A Content Manager or
 *   Sales Expert working the inbox is not shown a link to a page that would answer "Access denied".
 * - **A Customer sees no navigation at all.** They can reach this frame: `/admin/leads/inquiries`
 *   renders the refusal *inside* it, so the page still has its chrome and its sign-out control. If
 *   the entries were unconditional, the one role with no admin access anywhere would be looking at
 *   a menu of pages that all refuse them. With no entry to render, the `<nav>` is omitted rather
 *   than emitted empty — an unlabelled empty landmark is noise in the landmark list.
 *
 * `aria-current="page"` marks the entry being viewed, so a screen-reader user knows where they are
 * in the set without inferring it from the heading.
 */

/**
 * Which entry is the page being viewed.
 *
 * The two lead values are the `LeadSectionKey` vocabulary unchanged, so the leads call site passes
 * its existing `section` prop straight through.
 */
export type AdminNavKey = "inquiries" | "custom-formulation-requests" | "catalog-review";

type Entry = {
  readonly href: string;
  readonly label: string;
  readonly current: boolean;
};

export function AdminNav({
  role,
  current,
}: {
  readonly role: string;
  readonly current?: AdminNavKey;
}): ReactNode {
  const entries: Entry[] = [];

  if (roleMayEnter(role, "shell")) {
    // The dashboard is never "current" from another module's page — it is the way back, not a peer.
    entries.push({ href: ADMIN_PATH, label: "Admin", current: false });
  }

  if (roleMayEnter(role, "leads")) {
    entries.push(
      { href: INQUIRIES_PATH, label: "Inquiries", current: current === "inquiries" },
      {
        href: CUSTOM_FORMULATION_REQUESTS_PATH,
        label: "Custom formulation requests",
        current: current === "custom-formulation-requests",
      },
    );
  }

  if (roleMayEnter(role, "review")) {
    entries.push({
      href: CATALOG_REVIEW_PATH,
      label: "Technical review",
      current: current === "catalog-review",
    });
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
