"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_PATH, LOGIN_PATH } from "./admin-routes";
import { login, logout } from "./session/auth-api";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./session/cookie-contract";
import { clearAdminCookies, writeAdminCookies } from "./session/cookie-store";

import type { LoginState } from "./login-state";

/**
 * The Admin surface's two mutations: sign in, and sign out.
 *
 * ── Server Actions, for the reason the public forms are ─────────────────────
 *
 * FRONTEND_ARCHITECTURE §11 routes every write through a Server Action, and `apps/api` runs with
 * `cors: false` because API_CONTRACT_FINAL §1 states no browser-originated call ever reaches
 * NestJS — so a client-side POST could not succeed and would leak the internal origin trying. Here
 * there is a second reason on top: the credentials must never exist in a browser context at all.
 * The password is read from `FormData` inside this process and the tokens are written straight into
 * HttpOnly cookies; neither is ever returned to the caller, and `LoginState` carries no field that
 * could hold one.
 *
 * ── This is also where cookies can actually be written ──────────────────────
 *
 * Next 15 permits `cookies().set()` only in the action phase and in Route Handlers. Middleware owns
 * rotation because it runs before a render; these two own the start and the end of a session
 * because they run as actions. No other surface in the app mutates an auth cookie.
 *
 * ── CSRF ────────────────────────────────────────────────────────────────────
 *
 * Server Actions are POST-only to an unguessable, build-generated action id, and Next verifies the
 * `Origin`/`Host` pair before invoking one — a cross-site form cannot call either of these. Both
 * cookies are additionally `SameSite=Strict`, so a cross-site request would not carry a credential
 * even if it reached us. **Future Admin mutations must preserve both properties**: they belong in
 * Server Actions or same-origin-checked Route Handlers, never in a handler that accepts a
 * cross-origin POST.
 *
 * ── Nothing here is logged ──────────────────────────────────────────────────
 *
 * No password, no token, no cookie value, in any branch. `auth-api.ts` logs statuses and transport
 * codes only.
 */

/** Read one text field. Absent, non-string and whitespace-only all become `""`. */
function field(form: FormData, name: string): string {
  const value = form.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/**
 * `POST /auth/login`, then two cookies, then `/admin`.
 *
 * ── Empty input is refused here rather than round-tripped ───────────────────
 *
 * The one piece of validation this tier does, and only because sending `{ email: "", password: "" }`
 * would consume one of five attempts in the API's 15-minute credential-stuffing budget to learn
 * something the form already knows. Every rule about what a *valid* credential is still belongs to
 * the API.
 *
 * ── `redirect()` throws, so it must sit outside the try/catch nothing wraps ──
 *
 * `redirect()` signals by throwing a `NEXT_REDIRECT` digest. It is called last, after the cookies
 * are written, and no `catch` in this module can swallow it — `api-client.ts` documents the same
 * hazard and rethrows framework control flow for exactly this reason.
 *
 * The destination is the frozen constant, never anything derived from the request. There is no
 * `next`/`returnTo` parameter in this gate, so there is no open-redirect surface to get wrong.
 */
export async function signIn(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = field(form, "email");
  const password = field(form, "password");

  if (email === "" || password === "") {
    return { status: "invalid" };
  }

  const attempt = await login(email, password);

  if (attempt.outcome === "rejected") return { status: "invalid" };
  if (attempt.outcome === "throttled") return { status: "throttled" };
  if (attempt.outcome === "unavailable") return { status: "unavailable" };

  /*
   * `user` from the login body is deliberately discarded. §2.2a serves `{ id, email, role }` here,
   * but authorization is `GET /auth/me`'s answer on the request that needs it — a role captured at
   * login and trusted afterwards is a role that survives being revoked. The Admin shell re-reads it.
   */
  await writeAdminCookies(attempt.value.tokens);

  redirect(ADMIN_PATH);
}

/**
 * `POST /auth/logout`, then two cleared cookies, then `/login` — **in that order of importance.**
 *
 * ── The browser is cleared unconditionally ──────────────────────────────────
 *
 * Whatever the API says. Already revoked, 401, 500, unreachable, no credential to send in the first
 * place: the cookies go. Someone who clicks "Sign out" has stated an intention about *this browser*,
 * and honouring it must not depend on a network hop succeeding. Leaving a live seven-day refresh
 * token in a browser because a container was restarting is the failure mode worth designing against.
 *
 * ── And not retried ─────────────────────────────────────────────────────────
 *
 * Logout is idempotent server-side, so a retry would be safe — and pointless. The local credential
 * is gone either way; the only consequence of an unreached API is that one `auth_sessions` row
 * lives out its remaining TTL unusable by anyone, because the token that addressed it no longer
 * exists anywhere.
 *
 * The call is skipped entirely when either factor is missing, since §2.2a requires both — a Bearer
 * token for who is asking and a body token for which session to end — and a request known to be
 * incomplete is not worth making.
 */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  /*
   * Empty counts as absent, not merely missing-keyed. A cleared cookie is written as `""` with
   * `Max-Age: 0`, and while a browser then drops it outright, nothing guarantees this process reads
   * the jar after the browser has acted on that — a repeated sign-out is the obvious case. Sending
   * `Bearer ` and `{ refreshToken: "" }` would be a request known to be unauthenticable, spent to
   * learn nothing. `middleware.ts` applies the same rule to the refresh cookie.
   */
  if (
    accessToken !== undefined &&
    accessToken !== "" &&
    refreshToken !== undefined &&
    refreshToken !== ""
  ) {
    await logout(accessToken, refreshToken);
  }

  await clearAdminCookies();

  redirect(LOGIN_PATH);
}
