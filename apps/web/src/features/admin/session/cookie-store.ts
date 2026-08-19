import "server-only";

import { cookies } from "next/headers";

import {
  ACCESS_COOKIE,
  AUTH_COOKIES,
  CLEARED_VALUE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearedCookieOptions,
  refreshCookieOptions,
} from "./cookie-contract";

import type { AuthTokens } from "./auth-api";

/**
 * Writing and clearing the two auth cookies through `next/headers`.
 *
 * ── Why this is not in `actions.ts` ─────────────────────────────────────────
 *
 * **Every export of a `"use server"` module becomes a network-callable endpoint.** Putting a
 * cookie-clearing helper there would publish an action id that anyone could POST to; harmless in
 * effect — it destroys only the caller's own credentials — but an endpoint nobody asked for, on the
 * one surface where the endpoint inventory should be exactly as long as the feature list. So the
 * shared mechanics live here, in a plain server-only module, and `actions.ts` exports only the two
 * things that are genuinely actions: `signIn` and `signOut`.
 *
 * ── Why this is not in `cookie-contract.ts` either ──────────────────────────
 *
 * That module is deliberately free of `server-only`, `next/headers` and transport, because
 * middleware reaches the same attributes through `NextResponse.cookies` and a test reaches them
 * directly. This module is the `next/headers` half, used by the two surfaces that have an action
 * phase — Server Actions and the Route Handler — and by nothing else.
 *
 * Middleware does not use this file: it must write to a `NextResponse` it is about to return, and
 * `cookies()` is not available to it at all.
 */

/**
 * Store a freshly issued token pair.
 *
 * Called on login only. Rotation during navigation is middleware's, because a render cannot mutate
 * cookies and a rotation whose replacement cannot be persisted destroys the session.
 */
export async function writeAdminCookies(tokens: AuthTokens): Promise<void> {
  const jar = await cookies();

  jar.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions());
  jar.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
}

/**
 * Expire both cookies, with the exact attributes they were issued under.
 *
 * The name, `Path` and `Domain` semantics must match the original triple a browser keys on.
 * Clearing `sam_admin_access` at a narrower path would not remove the one set at `/` — it would
 * create a second cookie shadowing it at exactly the Admin paths, leaving a credential in place
 * while the operation reported success. Both are issued at `Path=/` and cleared at `Path=/` for
 * that reason, and `clearedCookieOptions` differs from the issuing options in `maxAge` alone.
 */
export async function clearAdminCookies(): Promise<void> {
  const jar = await cookies();
  const options = clearedCookieOptions();

  for (const name of AUTH_COOKIES) {
    jar.set(name, CLEARED_VALUE, options);
  }
}
