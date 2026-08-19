import { redirect } from "next/navigation";

import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import {
  InboxForbidden,
  InboxFrame,
  InboxNotFound,
  InboxUnavailable,
} from "@/features/admin/leads/inbox-frame";
import { InquiryDetail } from "@/features/admin/leads/inquiry-views";
import { INQUIRIES_PATH } from "@/features/admin/leads/lead-routes";
import { getAdminInquiry } from "@/features/admin/leads/leads-api";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/leads/inquiries/[id]` — one submission.
 *
 * ── Not-found and unavailable are different pages, deliberately ────────────
 *
 * A **definitive 404 from NestJS** — an authenticated, authorized request against an id that names
 * no record the caller may see — renders "Not found". Anything else that went wrong renders
 * "Temporarily unavailable". They are never collapsed: an operator told a lead does not exist stops
 * looking for it, and a container restart must not be able to say that. This is the same rule
 * ADR-010 §7 fixes for Product Detail, applied to a record that only exists once.
 *
 * `notFound()` is deliberately not called. It would render the framework's 404 boundary, of which
 * the `(admin)` group has none, and it would put the two outcomes back on one path — the shape this
 * separation exists to avoid. The state is rendered in the frame instead, with a link back to the
 * inbox.
 *
 * ── A malformed id never reaches this render's data call as a query ────────
 *
 * The API validates `:id` as a UUID and answers 400 for anything else, which arrives here as
 * `unavailable` rather than as a fake 404 — an honest description of "the API refused the request I
 * built". The id from the URL is encoded before it is put in the path, in `leads-api.ts`.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The title names the screen, not the product — WCAG 2.2 §2.4.2. */
export const metadata: Metadata = { title: "Inquiry · SAM Group Admin" };

export default async function AdminInquiryDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("leads");

  if (access.state === "unavailable") {
    return (
      <InboxFrame title="Inquiry" user={null} section="inquiries">
        <InboxUnavailable />
      </InboxFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <InboxFrame title="Inquiry" user={access.user} section="inquiries">
        <InboxForbidden />
      </InboxFrame>
    );
  }

  const { id } = await params;
  const result = await getAdminInquiry(id);

  if (result.state === "unauthenticated") {
    redirect(SESSION_END_PATH);
  }

  return (
    <InboxFrame title="Inquiry" user={access.user} section="inquiries">
      {result.state === "ok" ? <InquiryDetail inquiry={result.value} /> : null}
      {result.state === "forbidden" ? <InboxForbidden /> : null}
      {result.state === "unavailable" ? <InboxUnavailable /> : null}
      {result.state === "not-found" ? (
        <InboxNotFound
          label="This inquiry does not exist, or is not one you have access to."
          backHref={INQUIRIES_PATH}
          backLabel="Back to inquiries"
        />
      ) : null}
    </InboxFrame>
  );
}
