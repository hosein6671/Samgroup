import { redirect } from "next/navigation";

import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { FormulationTable } from "@/features/admin/leads/formulation-views";
import {
  InboxEmpty,
  InboxForbidden,
  InboxFrame,
  InboxPagination,
  InboxUnavailable,
} from "@/features/admin/leads/inbox-frame";
import {
  inboxPageHref,
  lastPage,
  readFormulationInboxQuery,
} from "@/features/admin/leads/lead-query";
import { CUSTOM_FORMULATION_REQUESTS_PATH } from "@/features/admin/leads/lead-routes";
import { getAdminCustomFormulationRequests } from "@/features/admin/leads/leads-api";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { SearchParams } from "@/features/admin/leads/lead-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/leads/custom-formulation-requests` — the Custom Formulation Request inbox.
 *
 * Structurally identical to the inquiry inbox, and its route note argues the session order, the
 * BFF-only request path, the three-role entry rule, the Sales Expert scoping and the failure
 * taxonomy in full. Two differences, both from the entity rather than from the page:
 *
 * - **No filter strip.** `custom_formulation_requests` carries no enumerated column, so the API
 *   declares no filter parameter and there is nothing to offer. A control that cannot change the
 *   result is worse than no control.
 * - **No type column.** Every row is the same kind of request; there is nothing to distinguish.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Custom formulation requests · SAM Group Admin" };

export default async function AdminCustomFormulationRequestsPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("leads");

  if (access.state === "unavailable") {
    return (
      <InboxFrame
        title="Custom formulation requests"
        user={null}
        section="custom-formulation-requests"
      >
        <InboxUnavailable />
      </InboxFrame>
    );
  }

  if (access.state === "forbidden") {
    return (
      <InboxFrame
        title="Custom formulation requests"
        user={access.user}
        section="custom-formulation-requests"
      >
        <InboxForbidden />
      </InboxFrame>
    );
  }

  const query = readFormulationInboxQuery(await searchParams);
  const result = await getAdminCustomFormulationRequests(query);

  if (result.state === "unauthenticated") {
    redirect(SESSION_END_PATH);
  }

  return (
    <InboxFrame
      title="Custom formulation requests"
      user={access.user}
      section="custom-formulation-requests"
    >
      {result.state === "forbidden" ? <InboxForbidden /> : null}
      {result.state === "unavailable" || result.state === "not-found" ? <InboxUnavailable /> : null}

      {result.state === "ok" ? (
        <>
          {result.value.items.length === 0 ? (
            <InboxEmpty heading="No custom formulation requests yet">
              Nothing has been submitted, or nothing has been assigned to your account. New requests
              appear here automatically.
            </InboxEmpty>
          ) : (
            <FormulationTable items={result.value.items} />
          )}

          <InboxPagination
            page={result.value.page}
            pages={lastPage(result.value.total, query.limit)}
            total={result.value.total}
            unit="requests"
            hrefForPage={(target) => inboxPageHref(CUSTOM_FORMULATION_REQUESTS_PATH, query, target)}
          />
        </>
      ) : null}
    </InboxFrame>
  );
}
