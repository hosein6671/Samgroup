/**
 * Everything about Cloudflare Turnstile that is not React — the script loader, the widget
 * lifecycle, the state machine, and the wording each state shows.
 *
 * ── Why this is separate from the component ─────────────────────────────────
 *
 * The runner is `environment: "node"` with no DOM and no React Testing Library, and neither may be
 * added here without approval. A challenge whose lifecycle is only expressible inside a hook is a
 * challenge nothing can test — and the failures that matter (a token reused after a failed attempt,
 * a widget that never re-renders after a client-side navigation, a submit button that unlocks
 * before a token exists) are lifecycle failures, not rendering ones.
 *
 * So the lifecycle lives here as plain functions over injected primitives, and
 * `turnstile-widget.tsx` is a thin shell that wires them to React. Everything below is tested
 * against fakes; nothing below imports React.
 */

/**
 * Cloudflare's script, loaded with `render=explicit`.
 *
 * **The `render=explicit` parameter is load-bearing, not a preference.** In implicit mode `api.js`
 * scans the document for `.cf-turnstile` once, when it loads, and never again. This is a Next.js
 * App Router application: a visitor who lands anywhere else and navigates to a form page arrives
 * after that scan, so the widget is never initialised, no token is ever produced, and every
 * submission is refused — with nothing visibly wrong. The same happens on every remount, which is
 * exactly what a failed attempt does (`formKey` remounts the form to restore the typed values).
 *
 * Explicit rendering removes the whole class: this application renders each widget itself, on every
 * mount, and knows when it did.
 */
export const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** The attribute the loader marks its own tag with, so a second mount finds it rather than adding one. */
export const TURNSTILE_SCRIPT_MARKER = "data-turnstile-loader";

/**
 * The field name the token travels under.
 *
 * Cloudflare's own name, kept so `submit.ts` reads the same key whether the token came from the
 * widget's injected field or from ours. See `TurnstileGate` for why this application writes the
 * field itself rather than letting Turnstile inject it.
 */
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

/**
 * Where a challenge is, from the form's point of view.
 *
 * `unconfigured` is the only one that does not block submission, and it exists **only outside
 * production**. An unset site key is the development default and standing the challenge down there
 * is deliberate; the same absence in a production build is a misconfiguration, and letting a form
 * send under it would offer a submission the API is going to refuse — costing the visitor a
 * filled-in form for a mistake they did not make.
 */
export type TurnstileStatus =
  /**
   * No site key, outside production. No script is loaded, no widget is rendered, nothing is
   * blocked, and nothing is announced — the form behaves as it did before the challenge existed.
   */
  | "unconfigured"
  /**
   * No site key **in production**. No script is loaded and no widget is rendered, exactly as
   * above — but the form is blocked and says so, because the deployment is incomplete and a
   * submission cannot succeed.
   */
  | "misconfigured"
  /** Loading or solving. Nothing is wrong; there is simply no token yet. */
  | "verifying"
  /** A token is held and the form may be submitted. */
  | "ready"
  /** The token aged out or the challenge timed out. Turnstile refreshes it; the form waits. */
  | "expired"
  /** The script could not load, or Turnstile reported an error. No token will arrive. */
  | "unavailable";

/**
 * Whether the submit control must stay disabled.
 *
 * `unconfigured` is the single exception, and every other state blocks — including
 * `misconfigured`, which is what closes the production gap this rule used to have. That is the
 * client half of the API's rule: the server is the boundary and refuses an unverified submission
 * whatever the browser does, and this exists so a person is stopped **before** losing a form's
 * worth of typing to a 403, rather than after.
 */
export function isSubmitBlocked(status: TurnstileStatus): boolean {
  return status !== "unconfigured" && status !== "ready";
}

/**
 * Whether this bundle was built for production.
 *
 * A named function rather than an inline `process.env` read for one reason: it is the seam a spec
 * exercises. Next inlines `process.env.NODE_ENV` into the client bundle at build time, so it cannot
 * be varied at runtime and a test that tried would be mutating global state to prove a branch. Both
 * this and `TurnstileWidget` therefore take the answer as an argument, with this as the default —
 * the same shape `siteKey` already has.
 */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Which state a form starts in, given how it is configured and where it is running.
 *
 * The whole of the configuration rule, in one pure function:
 *
 * | Site key | Production | Status          | Submission |
 * | -------- | ---------- | --------------- | ---------- |
 * | present  | either     | `verifying`     | blocked until a token arrives |
 * | absent   | no         | `unconfigured`  | allowed — the development default |
 * | absent   | yes        | `misconfigured` | **blocked** |
 *
 * The third row is the correction. A production deployment with no site key produces no token, so
 * the API refuses every submission — 403 when its secret is set, 503 when it is not. Leaving the
 * control enabled there would let someone fill in a form and lose it to a message about
 * verification, having done nothing wrong.
 */
export function turnstileInitialStatus(siteKey: string, production: boolean): TurnstileStatus {
  if (siteKey.trim() !== "") {
    return "verifying";
  }

  return production ? "misconfigured" : "unconfigured";
}

/**
 * Whether Cloudflare's script should be fetched at all.
 *
 * Only when there is a site key to render with. **Neither unconfigured state loads it** — a
 * production deployment missing its key must not contact a third party to display an error it
 * already knows about, and an unconfigured development environment must make no third-party request
 * whatsoever.
 */
export function turnstileNeedsScript(siteKey: string): boolean {
  return siteKey.trim() !== "";
}

/** What a state says, and how urgently. `null` when there is nothing to say. */
export type TurnstileNotice = {
  readonly text: string;
  /** `alert` interrupts; `status` waits for a pause. Only a dead end interrupts. */
  readonly role: "status" | "alert";
};

/**
 * What a visitor is told when the security check cannot be completed at all.
 *
 * **One sentence for two different causes**, and that is the point. `unavailable` is Cloudflare
 * failing; `misconfigured` is this deployment missing its site key. Wording them apart would tell a
 * visitor — and anyone probing the form — which of the two it is, and the second is a fact about
 * our configuration that no visitor has any use for.
 *
 * So it describes only what the person can observe (the form cannot be sent) and gives the one
 * route that does not depend on this control working. It names no provider, no key, no variable and
 * no environment.
 */
export const SECURITY_CHECK_UNAVAILABLE =
  "This form could not complete its security check, so it cannot be sent. " +
  "Please contact us by email instead, or try again later.";

/**
 * The sentence each state shows beside the submit control.
 *
 * `ready` and `unconfigured` say nothing: a control that announces success every time it works is
 * noise, and in the unconfigured case there is no control to explain — nothing is blocked.
 * `verifying` and `expired` are polite — they resolve on their own in a moment, and interrupting
 * someone mid-sentence to say "please wait" is worse than the wait. `unavailable` and
 * `misconfigured` are assertive, because neither resolves on its own and the person needs to know
 * before they finish typing rather than after they press a button.
 *
 * None of them names Cloudflare, a token, a captcha, or anything about how this application is
 * configured.
 */
export function turnstileNotice(status: TurnstileStatus): TurnstileNotice | null {
  switch (status) {
    case "verifying":
      return {
        text: "Checking your browser before the form can be sent. This usually takes a moment.",
        role: "status",
      };
    case "expired":
      return {
        text: "That check has expired and is being renewed. Sending will be available again in a moment.",
        role: "status",
      };
    case "unavailable":
    case "misconfigured":
      return { text: SECURITY_CHECK_UNAVAILABLE, role: "alert" };
    case "ready":
    case "unconfigured":
      return null;
  }
}

/** The subset of Cloudflare's widget API this application calls. */
export type TurnstileApi = {
  render: (container: unknown, options: TurnstileRenderOptions) => string | undefined;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

/**
 * The options passed to `turnstile.render`.
 *
 * `appearance: "interaction-only"` is SITE_STRUCTURE.md §10's "invisible captcha (not a visible
 * challenge)", as far as this side can enforce it — the widget draws nothing unless Cloudflare
 * decides an interaction is needed. The other half is the site key's mode in the Cloudflare
 * dashboard and cannot be set from here.
 *
 * `"response-field": false` suppresses the hidden input Turnstile would otherwise inject into the
 * enclosing form. This application writes that field itself, from the token it was handed — see
 * `TurnstileGate` for why.
 */
export type TurnstileRenderOptions = {
  readonly sitekey: string;
  readonly appearance: "interaction-only";
  readonly "response-field": false;
  readonly "refresh-expired": "auto";
  readonly retry: "auto";
  readonly callback: (token: string) => void;
  readonly "error-callback": () => void;
  readonly "expired-callback": () => void;
  readonly "timeout-callback": () => void;
};

/** The window object, as far as this file is concerned. */
export type TurnstileWindow = { turnstile?: TurnstileApi };

/**
 * A loader that fetches `api.js` **at most once per document**, however many widgets ask for it.
 *
 * ── Why a factory and not a bare module-level singleton ─────────────────────
 *
 * The memo has to be module-level to do its job — two forms on one page, or a second page reached
 * by client-side navigation, must not each append a script tag. A bare singleton would also be
 * shared across every test in a file, so the second test would observe the first one's cached
 * promise and assert nothing. The factory gives each spec its own loader while production uses the
 * one exported below.
 *
 * ── What counts as failure ──────────────────────────────────────────────────
 *
 * A load error, and a load that succeeds without leaving `window.turnstile` behind — a blocked or
 * rewritten script that answers 200 with something else. Both reject, and both clear the memo so a
 * later mount may try again rather than inheriting a permanent failure from one bad moment.
 */
export function createTurnstileScriptLoader(): (
  doc: Document,
  win: TurnstileWindow,
) => Promise<TurnstileApi> {
  let pending: Promise<TurnstileApi> | null = null;

  return (doc: Document, win: TurnstileWindow): Promise<TurnstileApi> => {
    const loaded = win.turnstile;

    if (loaded !== undefined) {
      return Promise.resolve(loaded);
    }

    if (pending !== null) {
      return pending;
    }

    pending = new Promise<TurnstileApi>((resolve, reject) => {
      /**
       * Give up on this attempt, and take the tag with it.
       *
       * Removing the element is not tidiness. The memo is cleared so a later mount may try again —
       * and a retry looks for an existing tag first, so leaving a dead one behind would make every
       * subsequent attempt attach listeners to a script that has already failed and will never fire
       * again. The form would then wait for a token forever instead of reporting that verification
       * is unavailable.
       */
      const abandon = (node: Element): void => {
        pending = null;
        node.remove();
        reject(new Error(TURNSTILE_LOAD_FAILED));
      };

      const listen = (node: Element): void => {
        node.addEventListener("load", () => {
          const api = win.turnstile;

          if (api === undefined) {
            // A 200 that left no API behind — a blocked, rewritten or proxied script.
            abandon(node);

            return;
          }

          resolve(api);
        });

        node.addEventListener("error", () => {
          abandon(node);
        });
      };

      // A tag from an earlier mount that has not finished loading: wait on it rather than adding a
      // second one, which would run Cloudflare's script twice against the same page.
      const existing = doc.querySelector(`script[${TURNSTILE_SCRIPT_MARKER}]`);

      if (existing !== null) {
        listen(existing);

        return;
      }

      const script = doc.createElement("script");

      script.src = `${TURNSTILE_SCRIPT_SRC}?render=explicit`;
      script.async = true;
      script.defer = true;
      script.setAttribute(TURNSTILE_SCRIPT_MARKER, "");
      listen(script);

      doc.head.appendChild(script);
    });

    return pending;
  };
}

/** The rejection reason. A constant so a caller matches on it rather than on prose. */
export const TURNSTILE_LOAD_FAILED = "turnstile-script-unavailable";

/** The one loader the application uses. */
export const loadTurnstileScript = createTurnstileScriptLoader();

/** What a mounted widget reports back. */
export type TurnstileEvents = {
  /** A token was issued. It is single-use and expires. */
  readonly onToken: (token: string) => void;
  /** The token aged out or the challenge timed out; Turnstile is renewing it. */
  readonly onExpired: () => void;
  /** Turnstile reported an error, or the widget could not be created. No token is coming. */
  readonly onUnavailable: () => void;
};

/** A mounted widget's handle. Both operations are safe to call after the widget is gone. */
export type TurnstileMount = {
  /** Discard the current token and ask for a new one. Used when a token has been spent. */
  readonly reset: () => void;
  /** Remove the widget from the page. Must be called when the container unmounts. */
  readonly remove: () => void;
};

/**
 * Render one widget into one container and wire its callbacks.
 *
 * ── Cleanup is not optional ─────────────────────────────────────────────────
 *
 * Turnstile keeps its own registry of rendered widgets keyed by an id, independent of the DOM. A
 * container removed from the page without `remove()` leaves that entry behind, and the next
 * `render()` into a recycled container can be refused. Both forms remount on every failed attempt,
 * so this is the ordinary path rather than an edge case.
 *
 * `remove()` is idempotent and swallows Turnstile's own error if the widget is already gone —
 * unmount cleanup must never throw, and there is nothing a caller could do about it if it did.
 */
export function mountTurnstile(
  api: TurnstileApi,
  container: unknown,
  siteKey: string,
  events: TurnstileEvents,
): TurnstileMount {
  let widgetId: string | undefined;

  try {
    widgetId = api.render(container, {
      sitekey: siteKey,
      appearance: "interaction-only",
      "response-field": false,
      "refresh-expired": "auto",
      retry: "auto",
      callback: events.onToken,
      "error-callback": events.onUnavailable,
      "expired-callback": events.onExpired,
      "timeout-callback": events.onExpired,
    });
  } catch {
    events.onUnavailable();
  }

  if (widgetId === undefined) {
    // `render` can answer `undefined` for a container it has already claimed. There is no widget to
    // reset or remove, and no token will arrive, so the form is told rather than left waiting.
    events.onUnavailable();

    return { reset: (): void => undefined, remove: (): void => undefined };
  }

  const id = widgetId;
  let removed = false;

  return {
    reset: (): void => {
      if (removed) return;

      try {
        api.reset(id);
      } catch {
        events.onUnavailable();
      }
    },
    remove: (): void => {
      if (removed) return;

      removed = true;

      try {
        api.remove(id);
      } catch {
        // Already gone. Nothing to clean up, and unmount cleanup must not throw.
      }
    },
  };
}
