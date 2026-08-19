import { redirect } from "next/navigation";

import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { FormulationDetail } from "@/features/admin/leads/formulation-views";
import {
  InboxForbidden,
  InboxFrame,
  InboxNotFound,
  InboxUnavailable,
} from "@/features/admin/leads/inbox-frame";
import { CUSTOM_FORMULATION_REQUESTS_PATH } from "@/features/admin/leads/lead-routes";
import { getAdminCustomFormulationRequest } from "@/features/admin/leads/leads-api";
import { resolveWorkflowPanel } from "@/features/admin/leads/resolve-workflow";
import { WorkflowPanel } from "@/features/admin/leads/workflow-panel";
import { requireAdminAccess } from "@/features/admin/session/require-admin";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/admin/leads/custom-formulation-requests/[id]` — one request.
 *
 * The not-found / unavailable separation is the inquiry detail route's, unchanged and for the same
 * reason: a definitive API 404 is a real missing record, and everything else is an outage. Neither
 * is ever rendered as the other.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The title names the screen, not the product — WCAG 2.2 §2.4.2. */
export const metadata: Metadata = { title: "Custom formulation request · SAM Group Admin" };

export default async function AdminCustomFormulationRequestDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess("leads");

  if (access.state === "unavailable") {
    return (
      <InboxFrame
        title="Custom formulation request"
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
        title="Custom formulation request"
        user={access.user}
        section="custom-formulation-requests"
      >
        <InboxForbidden />
      </InboxFrame>
    );
  }

  const { id } = await params;
  const result = await getAdminCustomFormulationRequest(id);

  if (result.state === "unauthenticated") {
    redirect(SESSION_END_PATH);
  }

  /*
   * The Workflow section is assembled only once the lead itself resolved. Fetching it for a lead
   * that answered 404 or an outage would be a request for a record the caller cannot have, and the
   * page renders the lead's own failure state instead.
   */
  const workflow =
    result.state === "ok"
      ? await resolveWorkflowPanel({
          section: "custom-formulation-requests",
          id: result.value.id,
          user: access.user,
          status: result.value.status,
          assigneeId: result.value.assigneeId,
        })
      : null;

  return (
    <InboxFrame
      title="Custom formulation request"
      user={access.user}
      section="custom-formulation-requests"
    >
      {result.state === "ok" && workflow !== null ? (
        <WorkflowPanel
          section={workflow.section}
          id={result.value.id}
          status={workflow.status}
          assigneeId={workflow.assigneeId}
          assigneeLabel={workflow.assigneeLabel}
          assigneeIsInactive={workflow.assigneeIsInactive}
          canAssign={workflow.canAssign}
          canChangeStatus={workflow.canChangeStatus}
          assigneeOptions={workflow.assigneeOptions}
          history={workflow.history}
        />
      ) : null}
      {result.state === "ok" ? <FormulationDetail request={result.value} /> : null}
      {result.state === "forbidden" ? <InboxForbidden /> : null}
      {result.state === "unavailable" ? <InboxUnavailable /> : null}
      {result.state === "not-found" ? (
        <InboxNotFound
          label="This request does not exist, or is not one you have access to."
          backHref={CUSTOM_FORMULATION_REQUESTS_PATH}
          backLabel="Back to custom formulation requests"
        />
      ) : null}
    </InboxFrame>
  );
}
