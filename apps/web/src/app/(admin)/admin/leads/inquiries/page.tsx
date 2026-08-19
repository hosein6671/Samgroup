import { redirect } from "next/navigation";

import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import {
  InboxEmpty,
  InboxForbidden,
  InboxFrame,
  InboxPagination,
  InboxUnavailable,
} from "@/features/admin/leads/inbox-frame";
import { InquiryFilters, InquiryTable } from "@/features/admin/leads/inquiry-views";
import { inboxPageHref, lastPage, readInquiryInboxQuery } from "@/features/admin/leads/lead-query";
import { INQUIRIES_PATH } from "@/features/admin/leads/lead-routes";
import { getAdminInquiries } from "@/features/admin/leads/leads-api";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { SearchParams } from "@/features/admin/leads/lead-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/leads/inquiries` — the inquiry inbox.
 *
 * ── One request path, and it is the only one ───────────────────────────────
 *
 * Browser → this Server Component → `getAdminInquiries` → NestJS. The access token is read from an
 * HttpOnly cookie inside `leads-api.ts` and attached to the internal hop; it is never a prop, never
 * in the markup, and never reachable from a browser. There is no `"use client"` anywhere in this
 * route's tree, so there is no client bundle for it to leak into.
 *
 * ── The order of the checks is the security property ───────────────────────
 *
 * Session first, then area, then data — the page never issues an admin request for a caller it has
 * not resolved. And the area check here decides *rendering only*: the NestJS guard on
 * `GET /admin/inquiries` authorizes the request independently, on the assumption that the caller
 * crafted it by hand (SECURITY.md §RBAC integration).
 *
 * ── Three roles may enter, and one of them may legitimately see nothing ────
 *
 * `requireAdminAccess("leads")` applies the "Forms & Leads" row of the RBAC matrix: **Admin,
 * Content Manager and Sales Expert**. `/admin` itself stays Admin-only — the two areas have
 * separate role lists on purpose, and neither was widened to accommodate the other.
 *
 * **Which rows a Sales Expert sees is not decided here.** NestJS scopes them to their own assigned
 * leads from the authenticated caller; this page sends no `assignedToId`, offers no control that
 * could select another user's queue, and has no URL spelling for one. A Sales Expert with nothing
 * assigned therefore reaches the **empty state**, which is the truthful rendering of a successful
 * read — not an authorization failure, and not worded as one.
 *
 * ── Four ways a read can end, and none of them is faked ────────────────────
 *
 * `unauthenticated` (a 401 from NestJS) means the credential is stale, so the browser is sent to
 * the handler that clears both cookies. `forbidden` renders a refusal and touches nothing.
 * `unavailable` renders a neutral notice and touches nothing — **an outage is never rendered as a
 * missing record or as a signed-out session.** `ok` renders the page, empty or not.
 *
 * ── Dynamic, and stated rather than inherited ──────────────────────────────
 *
 * `readAdminSession` reads `cookies()` and `headers()`, either of which permanently opts the route
 * out of static generation, and every fetch is `no-store` on both sides. `force-dynamic` and
 * `revalidate = 0` restate it so no future edit can put lead data into build output.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The document title names the screen rather than the product (WCAG 2.2 §2.4.2). `robots` is
 * inherited from the `(admin)` layout, which declares `noindex, nofollow, nocache, noarchive` for
 * the whole group — adding a title here does not disturb it.
 */
export const metadata: Metadata = { title: "Inquiries · SAM Group Admin" };

export default async function AdminInquiriesPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("leads");

  if (access.state === "unavailable") {
    return (
      <InboxFrame title="Inquiries" user={null} section="inquiries">
        <InboxUnavailable />
      </InboxFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <InboxFrame title="Inquiries" user={access.user} section="inquiries">
        <InboxForbidden />
      </InboxFrame>
    );
  }

  const query = readInquiryInboxQuery(await searchParams);
  const result = await getAdminInquiries(query);

  if (result.state === "unauthenticated") {
    redirect(SESSION_END_PATH);
  }

  return (
    <InboxFrame title="Inquiries" user={access.user} section="inquiries">
      <InquiryFilters query={query} />

      {result.state === "forbidden" ? <InboxForbidden /> : null}
      {result.state === "unavailable" || result.state === "not-found" ? <InboxUnavailable /> : null}

      {result.state === "ok" ? (
        <>
          {result.value.items.length === 0 ? (
            <InboxEmpty heading="No inquiries yet">
              {query.inquiryType === undefined
                ? "Nothing has been submitted, or nothing has been assigned to your account. New submissions appear here automatically."
                : "No inquiries of this type. Choose All types above to see everything available to you."}
            </InboxEmpty>
          ) : (
            <InquiryTable items={result.value.items} />
          )}

          <InboxPagination
            page={result.value.page}
            pages={lastPage(result.value.total, query.limit)}
            total={result.value.total}
            unit="inquiries"
            hrefForPage={(target) => inboxPageHref(INQUIRIES_PATH, query, target)}
          />
        </>
      ) : null}
    </InboxFrame>
  );
}
