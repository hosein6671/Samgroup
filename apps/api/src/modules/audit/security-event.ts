import type { AuditEventName } from "./audit.service";

/** Allow-listed path classification: no raw URL, query or headers are persisted. */
export function securityEvent(method: string, path: string, status: number): AuditEventName | null {
  if (method === "POST") {
    if (path === "/api/v1/auth/login") return "auth.login";
    if (path === "/api/v1/auth/refresh") return "auth.refresh";
    if (path === "/api/v1/auth/logout") return "auth.logout";
  }
  if (status === 401 || status === 403) return "access.denied";
  return null;
}
