/**
 * What a login attempt produced, as the form renders it.
 *
 * ── Four states, and three of them are failures that must stay apart ────────
 *
 * `features/forms/submission-state.ts` established the pattern on the public forms and the argument
 * is the same here, with more at stake: collapsing these would tell an operator to check a password
 * that was never wrong.
 *
 * - `invalid` — NestJS refused the credentials. **One message for every cause.** §2.2a is explicit
 *   that an unknown email, a wrong password and a `disabled` account all answer the same 401 with
 *   the same text, and that all three do the same amount of argon2 work so they are not separable
 *   by timing either. Saying anything more specific here would hand back the account-enumeration
 *   oracle the API went to trouble to deny.
 * - `throttled` — the login budget is spent (§Rate limits: 5 per 15 minutes, on its own bucket).
 *   Not a fault and not a wrong password; telling someone to try again during a window they cannot
 *   try again in is the mistake the public forms already corrected once.
 * - `unavailable` — the API did not answer, or answered something unusable. **Never shown as
 *   "invalid credentials".** An outage misreported as a rejection sends an operator to reset a
 *   password that works.
 *
 * There is no `submitting` member: that is `useActionState`'s `isPending`, and a second answer to
 * the same question could disagree with the first.
 *
 * ── No `values`, deliberately ───────────────────────────────────────────────
 *
 * The public forms carry submitted values back so a rejected buyer does not retype twelve fields.
 * This form has two, one of which is a password — echoing it into a `defaultValue` would put a
 * credential into the rendered HTML, which is exactly what this gate exists to prevent. The email
 * alone is not worth the shape, so a failed attempt re-renders empty.
 */
export type LoginState =
  | { readonly status: "idle" }
  | { readonly status: "invalid" }
  | { readonly status: "throttled" }
  | { readonly status: "unavailable" };

export const LOGIN_IDLE: LoginState = { status: "idle" };

/**
 * The messages, written once.
 *
 * `invalid` mirrors the API's own wording rather than inventing a second phrasing of the same
 * refusal. None of the three claims anything the platform cannot honour — no timeline, no "contact
 * your administrator" pointing at a surface that does not exist, and no hint about which half of a
 * credential was wrong.
 */
export const LOGIN_MESSAGE = {
  invalid: "Invalid email or password.",
  throttled:
    "Too many sign-in attempts from this connection. Please wait a while before trying again.",
  unavailable: "Sign-in is unavailable — the service is not responding. Please try again shortly.",
} as const;
