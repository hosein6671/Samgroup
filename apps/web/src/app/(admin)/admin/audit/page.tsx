import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/admin-shell";
import { SESSION_END_PATH } from "@/features/admin/admin-routes";
import { requireAdminAccess } from "@/features/admin/session/require-admin";
import { getAdminAccessToken } from "@/features/admin/session/session";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity and security events · SAM Group Admin" };
type EventRow = {
  id: string;
  occurredAt: string;
  actorId: string | null;
  subjectId: string | null;
  event: string;
  outcome: string;
  httpStatus: number | null;
};
function isEvent(value: unknown): value is EventRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    ["id", "occurredAt", "event", "outcome"].every((key) => typeof row[key] === "string") &&
    (row.subjectId === null || typeof row.subjectId === "string") &&
    (row.actorId === null || typeof row.actorId === "string") &&
    (row.httpStatus === null || typeof row.httpStatus === "number")
  );
}
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    source?: string;
    actorId?: string;
    event?: string;
    outcome?: string;
    from?: string;
    to?: string;
  }>;
}): Promise<ReactNode> {
  const access = await requireAdminAccess();
  if (access.state !== "authorized")
    return (
      <AdminShell
        current="audit"
        title="Security events"
        user={access.state === "forbidden" ? access.user : null}
      >
        <p className="ad-notice">
          {access.state === "forbidden" ? "Access denied." : "Your session could not be checked."}
        </p>
      </AdminShell>
    );
  const params = await searchParams;
  const content = params.source === "content";
  const filters: Record<string, string> = content ? { source: "content" } : {};
  for (const key of ["actorId", "event", "outcome", "from", "to"] as const) {
    if (content && key === "outcome") continue;
    if (typeof params[key] === "string" && params[key].trim()) filters[key] = params[key].trim();
  }
  const pageHref = (value: number): string =>
    `/admin/audit?${new URLSearchParams({ ...filters, page: String(value) })}`;
  const raw = params.page ?? "1";
  const page = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(page) || page < 1 || page > 100000)
    return (
      <AdminShell current="audit" title="Security events" user={access.user}>
        <p className="ad-notice">
          Invalid page. <Link href="/admin/audit">Return to first page</Link>
        </p>
      </AdminShell>
    );
  const accessToken = await getAdminAccessToken();
  if (accessToken === null) redirect(SESSION_END_PATH);
  const result = await apiGet<unknown>(
    content ? "/admin/content-events" : "/admin/audit-events",
    {
      ...Object.fromEntries(Object.entries(filters).filter(([key]) => key !== "source")),
      ...(filters.from
        ? { from: /T\d{2}:\d{2}(:\d{2})?$/.test(filters.from) ? `${filters.from}Z` : filters.from }
        : {}),
      ...(filters.to
        ? { to: /T\d{2}:\d{2}(:\d{2})?$/.test(filters.to) ? `${filters.to}Z` : filters.to }
        : {}),
      page: String(page),
    },
    { accessToken },
  );
  if (!result.ok && result.reason === "http" && result.status === 401) redirect(SESSION_END_PATH);
  const rows =
    result.ok && Array.isArray(result.data) && result.data.every(isEvent) ? result.data : null;
  return (
    <AdminShell current="audit" title="Activity and security events" user={access.user}>
      <p className="ad-note">
        {content
          ? "Confirmed content saves and publications, with the editor and affected page."
          : "Account changes, login, refresh, logout and denied access."}
      </p>
      <nav aria-label="Event source" className="ad-pager">
        <Link href="/admin/audit" aria-current={!content ? "page" : undefined}>
          Account and security
        </Link>
        <Link href="/admin/audit?source=content" aria-current={content ? "page" : undefined}>
          Content activity
        </Link>
      </nav>
      <form method="get" className="ad-user-form" aria-label="Filter events">
        {content && <input type="hidden" name="source" value="content" />}
        <label>
          Actor ID
          <input name="actorId" defaultValue={filters.actorId} />
        </label>
        <label>
          Event
          <select name="event" defaultValue={filters.event ?? ""}>
            <option value="">All events</option>
            {(content
              ? ["content.save-draft", "content.publish"]
              : [
                  "auth.login",
                  "product.draft_saved",
                  "product.published",
                  "product.image_uploaded",
                  "product.image_primary_changed",
                  "product.image_removed",
                  "auth.refresh",
                  "auth.logout",
                  "access.denied",
                  "user.created",
                  "user.role_changed",
                  "user.status_changed",
                ]
            ).map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
        </label>
        {!content && (
          <label>
            Outcome
            <select name="outcome" defaultValue={filters.outcome ?? ""}>
              <option value="">All outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </label>
        )}
        <label>
          From (UTC)
          <input name="from" type="datetime-local" defaultValue={filters.from} />
        </label>
        <label>
          To (UTC)
          <input name="to" type="datetime-local" defaultValue={filters.to} />
        </label>
        <button type="submit">Apply filters</button>
        <Link href={content ? "/admin/audit?source=content" : "/admin/audit"}>Reset filters</Link>
      </form>
      {rows === null ? (
        <p className="ad-notice">
          {!result.ok && result.reason === "http" && result.status === 403
            ? "Access denied."
            : !result.ok && result.reason === "http" && result.status === 400
              ? "Check the actor ID and time range, then apply filters again."
              : "Events are unavailable. Please try again."}
        </p>
      ) : (
        <>
          <div
            className="ad-table-scroll"
            role="region"
            aria-label={content ? "Content activity" : "Security events"}
            tabIndex={0}
          >
            <table className="ad-table">
              <caption>
                {content ? "Content activity" : "Security events"} · page {page}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Time (UTC)</th>
                  <th scope="col">Event</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Actor</th>
                  <th scope="col">{content ? "Affected page" : "Affected record"}</th>
                  <th scope="col">HTTP status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <time dateTime={row.occurredAt}>{row.occurredAt}</time>
                    </td>
                    <td>{row.event}</td>
                    <td>{row.outcome}</td>
                    <td>{row.actorId ?? "Not identified"}</td>
                    <td>{row.subjectId ?? "—"}</td>
                    <td>{row.httpStatus ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="ad-notice">No events on this page.</p>}
          <nav
            aria-label={content ? "Content activity pages" : "Security event pages"}
            className="ad-pager"
          >
            {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
            {result.ok &&
              typeof result.meta.total === "number" &&
              page * 50 < result.meta.total && <Link href={pageHref(page + 1)}>Next</Link>}
          </nav>
        </>
      )}
    </AdminShell>
  );
}
