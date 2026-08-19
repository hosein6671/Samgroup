import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";

import { roleMayEnter } from "./admin-areas";
import { ACCESS_COOKIE } from "./cookie-contract";
import { SESSION_SIGNAL_HEADER, SESSION_SIGNAL_UNAVAILABLE } from "./session-signal";
import { me } from "./auth-api";

import type { AdminArea } from "./admin-areas";
import type { AuthUser } from "./auth-api";

/**
 * The server-only Admin session boundary. **Every** authorization decision on this surface starts
 * here, and no client bundle can reach it.
 *
 * ── `import "server-only"` is the enforcement, not the convention ───────────
 *
 * Next aliases the bare specifier to a module that throws when it is pulled into a browser bundle,
 * so importing this file from a Client Component fails `next build` outright rather than shipping a
 * token to a browser. `lib/api-client.ts` documents the same mechanism and relies on it for the
 * same reason; this module has strictly more to lose, because what it handles is a credential
 * rather than an internal origin.
 *
 * ── Refresh happens above this file, never inside it ────────────────────────
 *
 * This module **never rotates anything**. It reads the access cookie middleware has already
 * ensured is fresh, and asks NestJS who it belongs to. That division is forced by the framework —
 * `cookies().set()` is rejected outside the action phase, so a render cannot persist a rotated
 * refresh token, and a refresh whose replacement cannot be stored destroys the session it was
 * meant to preserve. It also happens to be the right shape: middleware runs exactly once per
 * incoming browser request, which makes "at most one refresh per request" a structural property
 * rather than something a lock has to enforce.
 *
 * ── One `/auth/me` per request, by `cache()` ────────────────────────────────
 *
 * React's `cache()` memoizes for the lifetime of a single server request. The layout, the page and
 * any future protected component all call `readAdminSession()` and share one call — no duplicate
 * round trip, no possibility of two components disagreeing about who is signed in, and no
 * per-render cache of our own to invalidate. It is scoped to the request, so nothing leaks between
 * users and nothing survives into a second request.
 *
 * ── Nothing here is cached by Next ──────────────────────────────────────────
 *
 * `cookies()` and `headers()` are both dynamic APIs: reading either opts the route out of static
 * generation permanently, so no Admin page can be prerendered at build time and no identity can be
 * baked into output. `apiGet` sends `cache: "no-store"` on top of that. Both halves are stated
 * rather than inherited.
 */

/**
 * What the server knows about the caller, before any role question is asked.
 *
 * Four states, and the last two are the distinction the whole gate turns on:
 *
 * - `anonymous` — no usable access credential, and no reason to think the platform is unwell.
 * - `authenticated` — NestJS confirmed the identity on this request.
 * - `expired` — a credential was presented and **NestJS refused it**. Auth truth: unknown, expired,
 *   revoked, rotated, deleted account, disabled account, or a token predating the credential
 *   cutoff. The cookies are stale and must go.
 * - `unavailable` — the platform could not answer. Says nothing about the credential, so the
 *   credential is left exactly where it is.
 */
export type AdminSession =
  | { readonly state: "anonymous" }
  | { readonly state: "authenticated"; readonly user: AuthUser }
  | { readonly state: "expired" }
  | { readonly state: "unavailable" };

/**
 * The access token for this request, or `null`.
 *
 * Server-side callers only — this is what a future protected Admin page passes to `apiGet` as
 * `{ accessToken }` when it fetches `/admin/*` data. It returns the raw cookie value and asserts
 * nothing about it: the token is opaque to this tier, and whether it is still good is answered by
 * the API refusing it, never by inspecting it here.
 *
 * **The returned string must not be rendered, passed to a Client Component, logged, or put in a
 * URL.** There is no compile-time guard against that beyond `server-only` on the module.
 */
export async function getAdminAccessToken(): Promise<string | null> {
  const jar = await cookies();

  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

/**
 * Whether middleware reported that it could not reach NestJS on this request.
 *
 * Only meaningful when there is no access cookie — see `session-signal.ts` for why forging it
 * grants nothing.
 */
async function refreshWasUnavailable(): Promise<boolean> {
  const requestHeaders = await headers();

  return requestHeaders.get(SESSION_SIGNAL_HEADER) === SESSION_SIGNAL_UNAVAILABLE;
}

/**
 * Resolve the caller's session, once per request.
 *
 * The order matters. An absent access cookie is checked before anything else, because middleware
 * has already had its chance to produce one: if it is still missing, either there was no refresh
 * credential (anonymous) or the refresh could not be completed for infrastructure reasons
 * (unavailable, flagged by the header). Only when a token *is* present does this ask NestJS about
 * it, and NestJS's answer is final.
 */
export const readAdminSession = cache(async (): Promise<AdminSession> => {
  const accessToken = await getAdminAccessToken();

  if (accessToken === null) {
    return (await refreshWasUnavailable()) ? { state: "unavailable" } : { state: "anonymous" };
  }

  const attempt = await me(accessToken);

  if (attempt.outcome === "ok") {
    return { state: "authenticated", user: attempt.value };
  }

  /*
   * `rejected` is the only branch that condemns the cookies. `throttled` cannot occur here —
   * `GET /auth/me` consumes no throttler budget, by decision — and is folded into `unavailable`
   * rather than given a branch nothing can reach, because a state that cannot happen is a state
   * nobody maintains correctly.
   */
  return attempt.outcome === "rejected" ? { state: "expired" } : { state: "unavailable" };
});

/**
 * The Admin surface's authorization result.
 *
 * `anonymous` and `expired` are absent on purpose: both end in a redirect, so a caller that has an
 * `AdminAccess` in hand is past them and cannot forget to handle them.
 */
export type AdminAccess =
  | { readonly state: "authorized"; readonly user: AuthUser }
  | { readonly state: "forbidden"; readonly user: AuthUser }
  | { readonly state: "unavailable" };

/**
 * Whether the authenticated caller may **enter** an area of the Admin surface.
 *
 * ── Per area, not per surface ───────────────────────────────────────────────
 *
 * `area` defaults to `"shell"`, which is `/admin` and is Admin-only. `/admin/leads/**` passes
 * `"leads"` and admits Admin, Content Manager and Sales Expert — SECURITY.md's "Forms & Leads"
 * row. The lists live in `admin-areas.ts`; this function only applies them.
 *
 * The two are deliberately not one list. Widening `/admin` because `/admin/leads` had to widen
 * would grant a Content Manager a shell built for a role that can do things they cannot.
 *
 * ── The role comes from the server, on this request ─────────────────────────
 *
 * `user.role` is whatever `GET /auth/me` just re-read out of `sam_platform`. It is not decoded
 * from the token — the access token carries `sub`, `iat` and `exp` and no role claim exists to
 * decode — and it is not remembered from login. A role change or an account disable therefore takes
 * effect on the very next Admin request.
 *
 * ── And it is not the real enforcement either ───────────────────────────────
 *
 * SECURITY.md §RBAC integration: "UI hiding is not authorization." This check decides what to
 * render. **Every `/api/v1/admin/*` request is independently authorized by a NestJS guard**, on the
 * assumption that the caller crafted it by hand — so a page reaching data it should not have is
 * refused by the API regardless of what this returns.
 *
 * **It never decides which records a page shows.** A Sales Expert is scoped to their own leads by
 * NestJS, from the authenticated caller; `apps/web` sends no `assignedToId` and has no way to ask
 * for anyone else's. An authorized Sales Expert with nothing assigned sees an empty inbox, which is
 * a successful read, not a refusal.
 */
export function resolveAdminAccess(session: AdminSession, area: AdminArea = "shell"): AdminAccess {
  if (session.state === "unavailable") {
    return { state: "unavailable" };
  }

  if (session.state !== "authenticated") {
    throw new Error("resolveAdminAccess requires a resolved session");
  }

  return roleMayEnter(session.user.role, area)
    ? { state: "authorized", user: session.user }
    : { state: "forbidden", user: session.user };
}
