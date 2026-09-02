"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  TURNSTILE_RESPONSE_FIELD,
  isProductionRuntime,
  isSubmitBlocked,
  loadTurnstileScript,
  mountTurnstile,
  turnstileInitialStatus,
  turnstileNeedsScript,
  turnstileNotice,
} from "./turnstile";

import type { TurnstileMount, TurnstileStatus, TurnstileWindow } from "./turnstile";
import { ChallengeErrorIcon } from "./wizard/icons";
import type { ReactNode } from "react";

/**
 * The Cloudflare Turnstile challenge, as it appears inside a submission form.
 *
 * Everything that is not React lives in `./turnstile` — the script loader, the widget lifecycle,
 * the state machine and the wording. This file wires those to a component and to the submit
 * control; read that file first.
 *
 * ── It wraps the submit control rather than sitting beside it ───────────────
 *
 * The component takes a render prop and hands it `blocked`. That shape exists because the one thing
 * a challenge has to do to a form is **stop it being sent before a token exists**, and the submit
 * control is the only place that can be done. An earlier arrangement rendered the widget as a
 * sibling of the button and left the button alone: the form could be submitted immediately, with no
 * token, and the API answered 403 — so the visitor lost a filled-in form to a message telling them
 * to reload the page, having done nothing wrong.
 *
 * The fragment keeps the surrounding markup exactly as it was: the container, then the notice, then
 * whatever the form already rendered around its button.
 *
 * ── Invisible, which is the requirement rather than a preference ────────────
 *
 * SITE_STRUCTURE.md §10 specifies "anti-spam via invisible captcha (not a visible challenge)", and
 * ROADMAP.md repeats it as a launch requirement. `appearance: "interaction-only"` is the half of
 * that this component controls. **The other half is dashboard configuration and cannot be set from
 * here**: a widget's mode — Managed, Non-Interactive or Invisible — belongs to the site key, so the
 * key must be created in a mode that does not present a challenge to ordinary visitors. See the
 * deployment notes in `.env.example`.
 *
 * ── This application writes the token field, not Turnstile ──────────────────
 *
 * `"response-field": false` suppresses the hidden input Turnstile would inject, and the token is
 * rendered from state instead. That is what makes the lifecycle deterministic: the field exists
 * exactly while a token is held, disappears the moment one is spent or expires, and cannot be a
 * stale value left in the DOM by a widget this application did not ask to reset.
 *
 * It is not a weakening. The token is proven against Cloudflare by `apps/api`, which is the
 * security boundary; where the browser put it changes nothing about that check, and a token this
 * side invented would simply be refused.
 *
 * ── Progressive enhancement, and what happens without JavaScript ────────────
 *
 * Turnstile is a script; with JavaScript disabled it produces no token, and the API then refuses
 * the submission. That is a real and deliberate narrowing of the forms' previous behaviour — they
 * worked before hydration — and it is the cost of the control: a challenge a client can skip by not
 * running it is not a challenge. It is why the `<noscript>` line exists, and why the submit control
 * starts blocked rather than inviting a submission that cannot succeed.
 *
 * ── Not configured means two different things ───────────────────────────────
 *
 * **Outside production**, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset renders no widget, loads no script
 * and blocks nothing, so both forms behave exactly as they did before this component existed. That
 * mirrors the API side, where an unset secret outside production stands the check down.
 *
 * **In production it is a misconfiguration, and the form is blocked.** No script is loaded and no
 * widget is rendered there either — but the submit control is disabled and says the security check
 * could not be completed. Without that, a production deployment missing its site key would offer a
 * working-looking form that produces no token, so the API refuses every submission: 403 when its
 * secret is configured, 503 when it is not. Either way the visitor fills in a form and loses it to
 * a message about verification, for a mistake that is entirely ours.
 *
 * The two keys are therefore a **matching production pair**, not two independent switches. A site
 * key with no secret renders a widget nothing verifies; a secret with no site key refuses every
 * submission at the API. Both halves are listed in the deployment notes.
 *
 * ── It is a third-party request, and that is new for this site ──────────────
 *
 * Every other asset on this platform is self-hosted — `next/font` exists in this repository
 * precisely so no page contacts a font CDN. This component is the first and only exception: it
 * loads a script from `challenges.cloudflare.com` and that host sees the visitor's IP address.
 * **The Privacy Policy draft has to say so** before it is published; the draft currently states the
 * site embeds no third-party content, and publishing it unchanged alongside this component would
 * make it untrue.
 */

/** What the render prop is handed. */
export type TurnstileGateState = {
  /** True while no usable token exists. The submit control must be disabled. */
  readonly blocked: boolean;
  /**
   * The id of the sentence explaining why, or `undefined` when nothing is blocked.
   *
   * A disabled control with no explanation is the failure mode of every "disabled until valid"
   * button; pointing the control's `aria-describedby` here is what turns it into a stated reason.
   */
  readonly describedBy: string | undefined;
};

export function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  production = isProductionRuntime(),
  children,
}: {
  /**
   * The public site key. Read from the environment by default; accepted as a prop so a spec can
   * render every state without touching `process.env`.
   */
  readonly siteKey?: string | undefined;
  /**
   * Whether this is a production build. Defaults to `isProductionRuntime()`.
   *
   * Accepted as a prop for the same reason `siteKey` is: Next inlines `process.env.NODE_ENV` into
   * the client bundle at build time, so a spec cannot vary it at runtime, and one that tried would
   * be mutating global state to prove a branch.
   */
  readonly production?: boolean;
  /** Renders the form's submit control, told whether it may be enabled. */
  readonly children: (gate: TurnstileGateState) => ReactNode;
}): ReactNode {
  const configured = siteKey?.trim() ?? "";

  /*
   * The one case that renders nothing at all: no site key, outside production. It is the
   * development default, and standing the challenge down there is deliberate.
   *
   * Every other case goes to `TurnstileGate` — including a production build with no site key, which
   * renders no widget and loads no script but must still block the form and explain why.
   *
   * The branch is deliberately here rather than as an early return inside the gate. Configuration
   * is process-level so branching on it before any hook is safe, but a hook behind a condition is a
   * rule this codebase should not have to reason about per file — and keeping this component
   * hookless is also what lets a spec call it directly.
   */
  if (configured === "" && !production) {
    return <>{children({ blocked: false, describedBy: undefined })}</>;
  }

  return (
    <TurnstileGate siteKey={configured} production={production}>
      {children}
    </TurnstileGate>
  );
}

/**
 * The blocking cases: a configured challenge, and a production build with no site key.
 *
 * Both block the form until something changes, both draw the same markup, and both are here rather
 * than in two components because the difference between them is one status value —
 * `turnstileInitialStatus` decides it, and `turnstileNeedsScript` decides whether Cloudflare is
 * contacted at all. **A missing site key never loads the script**, in either environment.
 *
 * ── Two effects, doing two different jobs ───────────────────────────────────
 *
 * The first owns the widget's life: it loads the script once per document, renders one widget into
 * this container, and removes it on unmount. Removal is what keeps Turnstile's own widget registry
 * in step with the DOM — both forms remount their whole subtree after every failed attempt (see
 * `formKey`), so a container is discarded and rebuilt on the ordinary path, not a rare one.
 *
 * The second owns the token's life. A token is **single-use**: once a submission has carried it, it
 * is spent, and Cloudflare answers `timeout-or-duplicate` to anyone who sends it again. The remount
 * after a failed attempt already produces a fresh widget, but a remount is not something this
 * component should depend on for correctness — so when a submission finishes it discards the token
 * and asks for another regardless. Without that, the first validation error would make every
 * subsequent attempt fail on a spent token, with a message about verification pointing at a form
 * whose real problem was a missing field.
 *
 * Both effects stand down when there is no site key: there is no widget to build and no token to
 * replace, and `misconfigured` must not be quietly overwritten by either of them.
 */
function TurnstileGate({
  siteKey,
  production,
  children,
}: {
  readonly siteKey: string;
  readonly production: boolean;
  readonly children: (gate: TurnstileGateState) => ReactNode;
}): ReactNode {
  const [status, setStatus] = useState<TurnstileStatus>(() =>
    turnstileInitialStatus(siteKey, production),
  );
  const [token, setToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<TurnstileMount | null>(null);
  const noticeId = useId();

  // The pending state of the `<form>` this sits inside — React's own answer, and the same source
  // `SubmitButton` reads, so the two cannot disagree about whether a submission is in flight.
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    const container = containerRef.current;

    if (container === null || !turnstileNeedsScript(siteKey)) return undefined;

    let cancelled = false;

    void loadTurnstileScript(document, window as unknown as TurnstileWindow)
      .then((api) => {
        if (cancelled) return;

        mountRef.current = mountTurnstile(api, container, siteKey, {
          onToken: (value: string): void => {
            setToken(value);
            setStatus("ready");
          },
          onExpired: (): void => {
            setToken(null);
            setStatus("expired");
          },
          onUnavailable: (): void => {
            setToken(null);
            setStatus("unavailable");
          },
        });
      })
      .catch(() => {
        if (cancelled) return;

        setToken(null);
        setStatus("unavailable");
      });

    return (): void => {
      cancelled = true;
      mountRef.current?.remove();
      mountRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (turnstileNeedsScript(siteKey) && wasPending.current && !pending) {
      setToken(null);
      setStatus("verifying");
      mountRef.current?.reset();
    }

    wasPending.current = pending;
  }, [pending, siteKey]);

  const blocked = isSubmitBlocked(status);
  const notice = turnstileNotice(status);

  return (
    <>
      {/*
       * Normally empty: `interaction-only` draws nothing unless an interaction is required. Absent
       * altogether when there is no site key, because there is then nothing that could ever render
       * into it — a `misconfigured` form carries the notice and the disabled control, and no
       * container waiting for a widget that is never coming.
       */}
      {turnstileNeedsScript(siteKey) && <div className="fm-turnstile" ref={containerRef} />}

      {/*
       * Present exactly while a token is held, which is what keeps a spent token from being
       * resubmitted: the field is gone the moment the token is discarded.
       */}
      {token !== null && <input type="hidden" name={TURNSTILE_RESPONSE_FIELD} value={token} />}

      {notice !== null && (
        <p
          className={
            notice.role === "alert"
              ? "fm-turnstile-note fm-turnstile-note--alert"
              : "fm-turnstile-note"
          }
          id={noticeId}
          role={notice.role}
        >
          {/*
           * The dead-end variant gains a shield mark; the two self-resolving states stay plain
           * text. The icon is decorative — the sentence is the message, and `role="alert"` is what
           * announces it — so it distinguishes the state a visitor must act on from the two they
           * can wait out, without becoming the only thing that says so.
           */}
          {notice.role === "alert" && <ChallengeErrorIcon />}
          {notice.text}
        </p>
      )}

      <noscript>
        <p className="fm-turnstile-note">
          This form requires JavaScript to verify your submission. Please enable it, or contact us
          by email instead.
        </p>
      </noscript>

      {children({ blocked, describedBy: blocked ? noticeId : undefined })}
    </>
  );
}
