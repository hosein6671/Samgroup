/**
 * The four `/auth/*` calls, as this tier makes them — and the distinction every one of them keeps.
 *
 * ── Auth truth and infrastructure failure are different answers ─────────────
 *
 * This is the module's reason for existing. A 401 from NestJS is a statement about the caller's
 * credentials: the token is unknown, expired, revoked, already rotated, or belongs to a deleted or
 * disabled account (API_CONTRACT_FINAL §2.2a collapses all six into one generic 401 on purpose).
 * A connection refused, a timeout or a 500 is a statement about the platform, and says nothing at
 * all about the credential.
 *
 * Collapsing the two is the specific failure this gate must not ship. It would tell a signed-in
 * operator they had been signed out because a container restarted, and — far worse — it would
 * **destroy a perfectly valid seven-day refresh token** on the strength of a transient network
 * error. So `AuthAttempt` has three arms rather than two, and no caller can accidentally treat
 * `unavailable` as `rejected` because neither is a boolean.
 *
 * ── Nothing here reads or writes a cookie ───────────────────────────────────
 *
 * These functions take raw token strings and return raw token strings. Cookie mechanics live in
 * `cookie-contract.ts` and are applied by the three surfaces that can actually mutate cookies
 * (middleware, Server Action, Route Handler). Keeping transport free of cookie knowledge is what
 * lets middleware — which cannot use `next/headers` — share this module with the Server Actions,
 * which cannot use `NextResponse`.
 *
 * ── Middleware-safe ─────────────────────────────────────────────────────────
 *
 * `lib/api-client` is already imported by `middleware.ts` for the locale lookup and runs in the
 * Edge runtime today, so reusing it here needs no second HTTP helper and no duplicated failure
 * taxonomy. It carries `import "server-only"`, which Next resolves to an empty module on every
 * server runtime including middleware, and to a throwing module in a browser bundle — so this file
 * inherits that build-time guarantee rather than restating it.
 *
 * ── No response is trusted by shape ─────────────────────────────────────────
 *
 * `apiGet`/`apiPost` assert `T` without validating it. That is acceptable for a category name and
 * unacceptable for a credential: an upstream that answered `{ data: {} }` would otherwise produce
 * `undefined` written into a cookie as the string `"undefined"`. Every field below is checked
 * before it is returned, and a payload that does not carry two non-empty token strings is reported
 * as `unavailable` — a contract violation is an infrastructure fault, not a statement that the
 * user's credentials are bad.
 */

import { apiGet, apiPost, apiPostNoContent } from "@/lib/api-client";

import type { ApiFailure } from "@/lib/api-client";

/**
 * What one call to `/auth/*` produced.
 *
 * - `ok` — the API answered, and the payload is the contracted shape.
 * - `rejected` — the API refused the credential. **Auth truth.** Clear cookies, require a login.
 * - `throttled` — the credential-stuffing budget is spent (§Rate limits: login, 5 per 15 minutes).
 *   Neither a statement about the password nor a fault; it needs its own message.
 * - `unavailable` — no answer, an error the caller cannot act on, or a body that is not the
 *   contract. **Never a reason to discard a credential.**
 */
export type AuthAttempt<T> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "rejected" }
  | { readonly outcome: "throttled" }
  | { readonly outcome: "unavailable"; readonly detail: string };

/** The token pair, as `POST /auth/login` and `POST /auth/refresh` both serve it. */
export type AuthTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

/** The authenticated caller, as `POST /auth/login` and `GET /auth/me` both serve them. */
export type AuthUser = {
  readonly id: string;
  readonly email: string;
  /** The physical enum label — `admin`, `content_manager`, `sales_expert`, `customer`. */
  readonly role: string;
};

/** The one role the Admin surface admits, spelled as `apps/api`'s `user-role.ts` puts it on the wire. */
export const ADMIN_ROLE = "admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty string, or `null`. Used on every field read off an auth response. */
function readString(source: Record<string, unknown>, field: string): string | null {
  const value = source[field];

  return typeof value === "string" && value !== "" ? value : null;
}

function readTokens(data: unknown): AuthTokens | null {
  if (!isRecord(data)) return null;

  const accessToken = readString(data, "accessToken");
  const refreshToken = readString(data, "refreshToken");

  return accessToken === null || refreshToken === null ? null : { accessToken, refreshToken };
}

function readUser(data: unknown): AuthUser | null {
  if (!isRecord(data)) return null;

  const id = readString(data, "id");
  const email = readString(data, "email");
  const role = readString(data, "role");

  return id === null || email === null || role === null ? null : { id, email, role };
}

/**
 * The failure branches of `ApiResult`, mapped onto `AuthAttempt`.
 *
 * **401 and 403 are the only statuses that mean "rejected".** Everything else — 400, 404, 5xx, a
 * malformed envelope, an unreachable host — is `unavailable`, and the reasoning is asymmetric on
 * purpose: mistaking an outage for a rejection costs a valid session, while mistaking a rejection
 * for an outage costs one redirect and is corrected on the next request.
 *
 * `label` names the call for the log line. **No token, header or body is ever logged** — only the
 * status, the API's own error code, or the transport code (`ECONNREFUSED`, `TimeoutError`), which
 * `describeTransportFailure` already guarantees carries no URL.
 */
function classifyFailure<T>(failure: ApiFailure, label: string): AuthAttempt<T> {
  if (failure.reason === "unreachable") {
    console.error(`[admin-auth] ${label} did not reach the API (${failure.detail})`);

    return { outcome: "unavailable", detail: failure.detail };
  }

  if (failure.reason === "malformed") {
    console.error(`[admin-auth] ${label} answered ${failure.status} with a non-envelope body`);

    return { outcome: "unavailable", detail: `malformed:${failure.status}` };
  }

  if (failure.status === 401 || failure.status === 403) {
    return { outcome: "rejected" };
  }

  if (failure.status === 429) {
    return { outcome: "throttled" };
  }

  console.error(`[admin-auth] ${label} answered ${failure.status} (${failure.code ?? "no code"})`);

  return { outcome: "unavailable", detail: `http:${failure.status}` };
}

/**
 * `POST /auth/login` — the only call in this module that carries a password.
 *
 * The body is `{ email, password }` and nothing else: the global pipe runs `forbidNonWhitelisted`,
 * so an extra property answers 400 naming it rather than being stripped. A 400 from a mistyped
 * email is therefore possible, and it maps to `unavailable` rather than `rejected` — the DTO
 * disagreeing with the form is our bug, not the operator's wrong password, and labelling it
 * "invalid credentials" would send someone to reset a password that was never the problem.
 *
 * **Neither argument is ever logged**, here or in `classifyFailure`.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthAttempt<{ readonly tokens: AuthTokens; readonly user: AuthUser }>> {
  const result = await apiPost<unknown>("/auth/login", { email, password });

  if (!result.ok) {
    return classifyFailure(result, "POST /auth/login");
  }

  const tokens = readTokens(result.data);
  const user = readUser(isRecord(result.data) ? result.data.user : null);

  if (tokens === null || user === null) {
    console.error("[admin-auth] POST /auth/login answered 200 without a usable session payload");

    return { outcome: "unavailable", detail: "login-payload" };
  }

  return { outcome: "ok", value: { tokens, user } };
}

/**
 * `POST /auth/refresh` — rotation. Carries no `Authorization` header, by contract.
 *
 * §2.2a: the endpoint exists to be reachable once the access token has expired, so the refresh
 * token is the authentication factor and travels in the body. The presented session is revoked in
 * the same transaction that creates its replacement, so **a successful call invalidates the token
 * that was passed in**: the caller must persist `value.refreshToken` or the session is lost.
 *
 * Concurrent use of one token is safe on the API side — a conditional `UPDATE` under READ COMMITTED
 * gives exactly one winner and one generic 401 (ADR-012) — but this tier still refreshes at most
 * once per browser request, because the loser of that race would be a signed-in operator getting
 * bounced to the login page.
 */
export async function refresh(refreshToken: string): Promise<AuthAttempt<AuthTokens>> {
  const result = await apiPost<unknown>("/auth/refresh", { refreshToken });

  if (!result.ok) {
    return classifyFailure(result, "POST /auth/refresh");
  }

  const tokens = readTokens(result.data);

  if (tokens === null) {
    console.error("[admin-auth] POST /auth/refresh answered 200 without a usable token pair");

    return { outcome: "unavailable", detail: "refresh-payload" };
  }

  return { outcome: "ok", value: tokens };
}

/**
 * `GET /auth/me` — **the only authority on who is signed in and what they may do.**
 *
 * The guard behind it re-reads `sam_platform` on every request and checks deletion, `disabled`
 * status and the credential-revocation cutoff at once, which is why a disabled account fails its
 * very next request rather than at the end of the access token's fifteen minutes. Nothing in this
 * frontend decides identity or role any other way: the access token carries `sub`, `iat` and `exp`
 * and no role claim at all, so there is nothing to decode even if decoding were permitted.
 */
export async function me(accessToken: string): Promise<AuthAttempt<AuthUser>> {
  const result = await apiGet<unknown>("/auth/me", undefined, { accessToken });

  if (!result.ok) {
    return classifyFailure(result, "GET /auth/me");
  }

  const user = readUser(result.data);

  if (user === null) {
    console.error("[admin-auth] GET /auth/me answered 200 without a usable identity");

    return { outcome: "unavailable", detail: "me-payload" };
  }

  return { outcome: "ok", value: user };
}

/**
 * `POST /auth/logout` — 204, idempotent, and requires **both** factors.
 *
 * The Bearer token says who is asking and the body says which session to end; revocation is scoped
 * to the authenticated user, so presenting someone else's refresh token revokes nothing and still
 * answers 204. The API deliberately does not report the difference.
 *
 * The result is returned for logging only. **The caller clears the browser cookies either way** —
 * see `endAdminSession`. An explicit logout that left a credential in the browser because the API
 * was unreachable would be the worst possible reading of "failed safely".
 */
export async function logout(
  accessToken: string,
  refreshToken: string,
): Promise<AuthAttempt<null>> {
  const result = await apiPostNoContent("/auth/logout", { refreshToken }, { accessToken });

  if (!result.ok) {
    return classifyFailure(result, "POST /auth/logout");
  }

  return { outcome: "ok", value: null };
}
