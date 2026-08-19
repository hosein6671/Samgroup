/**
 * The two Admin session cookies, and every attribute they carry.
 *
 * ── This tier owns these cookies, and it is the only tier that does ─────────
 *
 * [ADR-012](../../../../../../docs/ADR/ADR-012-application-session-and-account-status.md) §2 splits
 * the session across two hops: the browser holds an **HttpOnly cookie owned by `apps/web`**, and
 * `apps/web` forwards the raw token to NestJS as a request value. NestJS "sets no cookie, reads no
 * cookie, and clears no cookie", and `apps/api` has no cookie parser. So the cookie name, `Path`,
 * `SameSite`, `Secure` behaviour and `Max-Age` were left deliberately unfixed by every backend
 * document — they belong to this gate, because this is the tier that issues them. This file is
 * where they are fixed.
 *
 * ── Why two cookies rather than one ─────────────────────────────────────────
 *
 * SECURITY.md §Token handling already concluded it — _"both tokens live in httpOnly cookies, read
 * server-side per request and attached to the outbound NestJS call"_ — and Next 15 makes it the
 * only workable shape. `cookies().set()` is rejected outside the action phase (verified in
 * `next/dist/server/web/spec-extension/adapters/request-cookies.js`: `areCookiesMutableInCurrent
 * Phase` returns `requestStore.phase === 'action'`), so a Server Component cannot persist a rotated
 * refresh token. Refreshing during a render would therefore revoke the browser's only credential —
 * rotation is transactional and immediate on the API side — and be unable to store the
 * replacement, ending the session on the first protected page view.
 *
 * The access cookie is what avoids that. Middleware refreshes only when the access cookie is gone,
 * which is roughly every fifteen minutes rather than on every navigation, and the render then reads
 * a credential it does not have to mint.
 *
 * ── The access cookie is a carrier, never an authority ──────────────────────
 *
 * It exists so a server-side render has a Bearer token to attach. **Nothing is ever decided from
 * it** — not identity, not role, not account status. Those come from `GET /auth/me`, which re-reads
 * `sam_platform` on every request, which is the whole reason a disabled account fails its very next
 * request rather than fifteen minutes later. This module deliberately contains no JWT decoding: the
 * cookie's own `Max-Age` is aligned to the token's TTL, so the browser dropping the cookie *is*
 * expiry, and there is nothing to parse.
 *
 * ── Neither cookie is readable by JavaScript ────────────────────────────────
 *
 * `httpOnly` on both, and no value is ever written to `localStorage`, `sessionStorage`, a client
 * component prop, or the rendered HTML. SECURITY.md's claim that "an XSS bug in the admin UI cannot
 * exfiltrate a token it has no way to read" is only true while that holds.
 *
 * ── Pure by design ──────────────────────────────────────────────────────────
 *
 * No `server-only`, no `next/headers`, no transport. Middleware (Edge runtime), Server Actions and
 * the Route Handler all need these attributes and all reach them through different framework APIs
 * that happen to take the same options object; keeping the contract free of every one of them is
 * what lets a test assert the attributes directly instead of through a framework harness.
 */

/** The refresh credential. Seven days, rotated on every use, opaque to this tier. */
export const REFRESH_COOKIE = "sam_admin_refresh";

/** The short-lived Bearer carrier. Fifteen minutes, replaced rather than rotated. */
export const ACCESS_COOKIE = "sam_admin_access";

/**
 * Seven days, matching `refreshExpiresIn` in API_CONTRACT_FINAL §2.2a.
 *
 * A constant rather than the server's own `refreshExpiresIn`: the backend TTLs are frozen, and
 * taking the cookie lifetime from a response would let an upstream change silently extend how long
 * a browser retains a credential. If the two ever disagree the cookie is the shorter-lived half by
 * intent — a cookie that outlives its token produces a request the API refuses, which is handled,
 * whereas a cookie that outlives nothing is a credential nobody expected to still exist.
 */
export const REFRESH_MAX_AGE_SECONDS = 604_800;

/** Fifteen minutes, matching `expiresIn`. Same reasoning as `REFRESH_MAX_AGE_SECONDS`. */
export const ACCESS_MAX_AGE_SECONDS = 900;

/**
 * The attribute set both cookies share, and the one that differs.
 *
 * Modelled as the exact literal types rather than as `string`, so a call site cannot pass
 * `sameSite: "lax"` and typecheck. The three invariant attributes are not parameters anywhere in
 * this module — there is no code path that can produce a non-`HttpOnly`, non-`Strict`, non-`/`
 * Admin auth cookie.
 */
export type AuthCookieOptions = {
  readonly httpOnly: true;
  readonly sameSite: "strict";
  readonly path: "/";
  readonly secure: boolean;
  readonly maxAge: number;
};

/**
 * Whether these cookies carry `Secure`.
 *
 * `true` everywhere except a local non-HTTPS development server, because a `Secure` cookie is never
 * stored over plain `http://localhost` and the Admin surface would be unusable in development. In
 * production the platform is HTTPS-only behind nginx (ADR-005), and `NODE_ENV` is `production` for
 * both `next build` and `next start`.
 *
 * Deliberately **not** derived from the request's protocol or `X-Forwarded-Proto`. A header a
 * client controls must not decide whether a credential is transport-protected, and behind nginx the
 * inner hop is plain HTTP anyway, so protocol sniffing would drop `Secure` in production — the
 * exact failure this is written to prevent.
 *
 * The parameter exists so a test can assert both branches without mutating global state.
 */
export function isSecureCookieEnvironment(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "production";
}

/**
 * `Domain` is absent from every options object in this file, which makes both cookies **host-only**.
 *
 * Stated as a comment rather than as `domain: undefined` because the two are not the same to every
 * cookie serializer, and the attribute's absence is the decision. A host-only cookie is not sent to
 * any sibling subdomain — notably not to `cms.samgp.com`, where Payload keeps an entirely separate
 * authentication realm (ADR-006, "authentication cookies are never shared"). Setting a parent
 * domain would hand the platform's Admin credential to a host that must never see it.
 */
export function refreshCookieOptions(
  secure: boolean = isSecureCookieEnvironment(),
): AuthCookieOptions {
  return { httpOnly: true, sameSite: "strict", path: "/", secure, maxAge: REFRESH_MAX_AGE_SECONDS };
}

export function accessCookieOptions(
  secure: boolean = isSecureCookieEnvironment(),
): AuthCookieOptions {
  return { httpOnly: true, sameSite: "strict", path: "/", secure, maxAge: ACCESS_MAX_AGE_SECONDS };
}

/**
 * The options a cookie is cleared with — identical to the ones it was set with, except `Max-Age: 0`.
 *
 * The name, `Path` and `Domain` semantics **must** match the original exactly. A browser keys a
 * cookie on that triple, so clearing `sam_admin_access` at `/admin` would not remove the one set at
 * `/` — it would create a second, narrower cookie that shadows the first at exactly the paths the
 * Admin surface uses, leaving a credential behind while appearing to have removed it. Both cookies
 * are issued at `Path=/` for this reason and cleared at `Path=/` for the same one.
 *
 * `maxAge: 0` rather than `expires: new Date(0)`: both work, and expressing the clear in the same
 * field the set uses keeps the two paths comparable by eye and by test.
 */
export function clearedCookieOptions(
  secure: boolean = isSecureCookieEnvironment(),
): AuthCookieOptions {
  return { httpOnly: true, sameSite: "strict", path: "/", secure, maxAge: 0 };
}

/**
 * The name/value/options triple for clearing one auth cookie.
 *
 * Both the Server Action (`cookies()`) and the middleware/route-handler (`response.cookies`) APIs
 * accept this shape, which is why clearing is expressed once here and applied by each caller
 * through its own framework API rather than being reimplemented per surface.
 */
export const CLEARED_VALUE = "";

/** Both cookie names, for the callers that clear or inspect the pair rather than one of them. */
export const AUTH_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE] as const;
