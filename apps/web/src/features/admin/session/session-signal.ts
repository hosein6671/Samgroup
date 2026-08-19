/**
 * The one request header middleware uses to tell a render something it could not otherwise know.
 *
 * ── The problem it solves ───────────────────────────────────────────────────
 *
 * Middleware refreshes when the access cookie is gone. If that refresh fails because NestJS is
 * unreachable — not because the credential was refused — it must **not** clear the refresh cookie
 * (an outage is not a statement about anyone's session) and must not redirect to `/login` (that
 * would tell a signed-in operator they had been signed out because a container restarted).
 *
 * So the request continues to the render. But from inside the render the situation is
 * indistinguishable from "never signed in": both look like an absent access cookie. Without a
 * signal the page would send an authenticated operator to the login screen during every outage,
 * which is precisely the false-unauthenticated behaviour this gate forbids.
 *
 * ── Why a request header ────────────────────────────────────────────────────
 *
 * It is the only channel middleware has into the same request's render — `NextResponse.next({
 * request: { headers } })` is the framework's supported mechanism, and it is the same one that
 * carries the freshly rotated access token. A cookie would leak the state to the browser and
 * outlive the request; a query parameter would change the URL and be forgeable by anyone typing
 * one.
 *
 * ── It is not a credential and grants nothing ───────────────────────────────
 *
 * A forged `x-sam-admin-session: unavailable` from outside makes a page render "temporarily
 * unavailable" instead of redirecting to a login form. That is the entire blast radius: the header
 * is only ever read on a path where **no access cookie is present**, so it cannot cause anything to
 * be shown to anybody. It is a downgrade signal, never an upgrade one, and no authorization
 * decision reads it.
 *
 * Nginx does not strip unknown inbound headers by default, so the property that makes this safe is
 * that it is worthless to forge — not that it cannot be forged.
 */

/** Lower-case: `headers()` normalizes, and matching the wire form keeps the two comparable. */
export const SESSION_SIGNAL_HEADER = "x-sam-admin-session";

/** Set when a refresh attempt failed for infrastructure reasons rather than an auth rejection. */
export const SESSION_SIGNAL_UNAVAILABLE = "unavailable";
