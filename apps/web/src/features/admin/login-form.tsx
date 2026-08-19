"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn } from "./actions";
import { LOGIN_IDLE, LOGIN_MESSAGE, type LoginState } from "./login-state";

import type { ReactNode } from "react";

/**
 * The Admin sign-in form.
 *
 * ── The client boundary is this file, and it holds no credential ────────────
 *
 * `useActionState` posts to `signIn`, a Server Action — the browser never calls NestJS, and the
 * tokens the API returns are written into HttpOnly cookies inside that action and never travel
 * back. `LoginState` has no field that could carry one, so there is nothing for this component to
 * accidentally render, put in React state, or hand to a child. The password lives in an
 * uncontrolled `<input>` for the duration of one submission and is never read into JavaScript here.
 *
 * It is a Client Component only so the outcome can be shown without a navigation. The form works
 * **before hydration**: React posts the same `FormData` the platform would have, so a slow
 * connection does not produce a dead login form.
 *
 * ── Nothing is echoed back on failure ───────────────────────────────────────
 *
 * The public submission forms carry submitted values back so a rejected buyer does not retype
 * twelve fields (`features/forms/submission-state.ts` explains the React 19 reset behaviour behind
 * that). This form does the opposite on purpose: one of its two fields is a password, and putting
 * it in a `defaultValue` would write a credential into the rendered HTML. Retyping an email is the
 * cheaper cost.
 *
 * ── What this form deliberately does not offer ──────────────────────────────
 *
 * No "remember me" — the session length is the refresh token's seven days and is not a per-login
 * choice. No "forgot password" — password reset is explicitly deferred (API_CONTRACT_FINAL §2.2a:
 * the only accounts are internal staff, reset by an Admin directly), and a link to a flow that does
 * not exist is worse than no link. No social sign-in, no self-registration: neither is contracted,
 * and the first Admin is created outside the request path by `pnpm seed:admin`.
 */
export function LoginForm(): ReactNode {
  const [state, action] = useActionState<LoginState, FormData>(signIn, LOGIN_IDLE);

  return (
    <form action={action} noValidate>
      <LoginStatus state={state} />

      <div className="ad-field">
        <label className="ad-label" htmlFor="admin-email">
          Email address
        </label>
        <input
          className="ad-input"
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          /*
           * The one autofocus on the surface. It is the first control on a single-purpose page, so
           * it does not steal focus from anything a person was reading.
           */
          autoFocus
          required
        />
      </div>

      <div className="ad-field">
        <label className="ad-label" htmlFor="admin-password">
          Password
        </label>
        <input
          className="ad-input"
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}

/**
 * The outcome banner.
 *
 * `role="alert"` on every failure: the form is still in front of the person and something has to be
 * done about it. It is rendered as an element the state produces rather than toggled with `hidden`,
 * so the live region announces on insertion.
 *
 * All three failures share one presentation and differ only in words, which is the point — the
 * interface must not make "wrong password" and "the API is down" look like different classes of
 * problem to the eye while being the same to the reader, or vice versa.
 */
function LoginStatus({ state }: { readonly state: LoginState }): ReactNode {
  if (state.status === "idle") {
    return null;
  }

  return (
    <p className="ad-banner" role="alert">
      {LOGIN_MESSAGE[state.status]}
    </p>
  );
}

/**
 * The submit control, disabled while the action is in flight.
 *
 * `useFormStatus` rather than a prop, following `features/forms/form-feedback.tsx`: it reads the
 * pending state of the `<form>` it sits inside, which is React's own answer and cannot disagree
 * with reality. That requires it to be a descendant of the form rather than of the component that
 * renders it, which is why it is a separate component.
 *
 * The label changes with the disabled state — a disabled button with unchanged text reads as broken
 * rather than as busy.
 */
function SubmitButton(): ReactNode {
  const { pending } = useFormStatus();

  return (
    <button className="ad-submit" type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
