import { NextResponse } from "next/server";

import { LOGIN_PATH } from "@/features/admin/admin-routes";
import {
  AUTH_COOKIES,
  CLEARED_VALUE,
  clearedCookieOptions,
} from "@/features/admin/session/cookie-contract";

/**
 * `GET /admin/session/end` — clear both auth cookies, then go to `/login`.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * It is the one thing a Server Component cannot do. Next 15 permits `cookies().set()` only in the
 * action phase (verified in `next/dist/server/web/spec-extension/adapters/request-cookies.js`:
 * `areCookiesMutableInCurrentPhase` returns `requestStore.phase === 'action'`), so when
 * `GET /auth/me` refuses an access token the browser still holds — a deleted account, a `disabled`
 * one, a token predating its credential-revocation cutoff — the render has no way to remove it.
 *
 * Redirecting straight to `/login` from the page would leave the stale cookie in place; middleware
 * would see a present access cookie on the next request and let it through; the page would refuse
 * again. That is an infinite bounce. A Route Handler *can* set cookies, so the render redirects
 * here, both cookies are expired, and the loop closes in one hop.
 *
 * ── It is not a proxy and not a redirector ──────────────────────────────────
 *
 * It reads **no** request parameter of any kind — no `next`, no `returnTo`, no path forwarding —
 * and its destination is a frozen constant. There is nothing here to point at an external origin,
 * and no arbitrary NestJS path can be reached through it. It is the only Route Handler on the
 * platform, and it exists for one framework constraint rather than as the beginning of a browser-
 * facing API surface.
 *
 * ── GET, and why that is acceptable ─────────────────────────────────────────
 *
 * A handler that mutates state on GET normally deserves suspicion. What it "mutates" is the
 * destruction of the caller's own credentials in the caller's own browser: the worst a forced hit
 * can achieve is signing someone out, and `SameSite=Strict` means a cross-site request would not
 * carry the cookies to begin with. It has to be a GET because a redirect from a render can only
 * produce one.
 *
 * **Deliberate sign-out is `signOut` in `actions.ts`, not this.** That one also calls
 * `POST /auth/logout` so the refresh session is revoked server-side. This handler is the cleanup
 * path for a credential NestJS has *already* refused, where there is no live session left to
 * revoke and no valid access token to authenticate a logout call with.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request): NextResponse {
  /*
   * 303, not 307: the browser must issue a plain GET for the login page. `new URL(..., request.url)`
   * resolves against this request's own origin, and the path is a constant — nothing from the
   * request contributes to the destination.
   */
  const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url), 303);

  /*
   * Set on the response directly rather than through `cookies()`. Both work in a Route Handler, but
   * Next merges `cookies()` mutations into a self-constructed `NextResponse` as *fallbacks* that
   * the response's own cookies override — so writing them here is the unambiguous half of that
   * merge rather than relying on it.
   */
  const options = clearedCookieOptions();

  for (const name of AUTH_COOKIES) {
    response.cookies.set(name, CLEARED_VALUE, options);
  }

  return response;
}
