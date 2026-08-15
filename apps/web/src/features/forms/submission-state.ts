/**
 * What a submission attempt produced, as the form renders it.
 *
 * ── Six states, kept distinct on purpose ────────────────────────────────────
 *
 * FRONTEND_ARCHITECTURE §`forms/` puts submission and error-display logic in one place precisely so
 * every form on the platform answers the same questions the same way. Collapsing "the field is
 * wrong" and "the API is down" into one `error` would make the interface tell a buyer to correct
 * something they did not get wrong — and collapsing "you have submitted too many times" into it
 * would tell them to retry during an hour they cannot retry in.
 *
 * `submitting` is deliberately **not** a member. It is `useActionState`'s `isPending`, which React
 * derives from the action's own lifetime — a state we set ourselves would be a second answer to the
 * same question and could disagree with the first.
 *
 * ── `invalid` carries the API's own field paths ─────────────────────────────
 *
 * `fieldErrors` is keyed by `details[].field` exactly as API_CONTRACT_FINAL §8 sends it, which is
 * the DTO property name and therefore the `name` of the input that produced it. That is the whole
 * mechanism: no mapping table, no client-side schema, and no possibility of the two drifting.
 * `formError` holds anything the API reported that names no field.
 */
/**
 * What every failed attempt carries so the form can be redrawn with what was typed.
 *
 * ── Why this is on all three failures and not just on `invalid` ─────────────
 *
 * **React 19 resets an uncontrolled form once its action completes** — including when the action
 * failed. Without a remount, every field the buyer filled in is blank the moment anything comes
 * back. Measured in the browser, not theorized: it is what the first end-to-end submission of these
 * forms did.
 *
 * The first fix covered `invalid` only, and the outage test showed why that was the wrong shape: a
 * banner that says "please try again shortly" above a form the platform has just emptied is the
 * worst of the three cases, not the least important one. The buyer did nothing wrong there and has
 * the least reason to expect to retype anything.
 *
 * `attempt` is the React `key`. A changing key discards the reset DOM nodes and builds new ones,
 * and the new ones read `defaultValue` from `values`. The alternative — making every control
 * controlled — buys the same behaviour at the cost of the form working before hydration.
 *
 * `values` holds **text only**, which is why the consent checkbox is not in it. Consent is re-given
 * on every attempt rather than carried forward by the server: a checkbox the server re-ticks is not
 * consent. It is otherwise the buyer's own data going straight back to the buyer's own browser, and
 * nothing about it is stored.
 */
type Resubmittable = {
  readonly values: Readonly<Record<string, string>>;
  /** How many attempts have failed, counting from 1. */
  readonly attempt: number;
};

export type SubmissionState =
  /** Nothing submitted yet. The initial value passed to `useActionState`. */
  | { readonly status: "idle" }
  /** Written. `reference` is the server-generated submission id — a receipt, not a lookup key. */
  | { readonly status: "success"; readonly reference: string }
  /** 400 from the API. At least one of `fieldErrors` / `formError` is populated. */
  | ({
      readonly status: "invalid";
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly formError: string | null;
    } & Resubmittable)
  /** 429 from the API — the submission budget for this connection is spent. Nothing was stored. */
  | ({ readonly status: "throttled" } & Resubmittable)
  /** No response at all — the API is unreachable, or its origin is unconfigured. */
  | ({ readonly status: "unavailable" } & Resubmittable)
  /** A response arrived and was not a success the form can explain. Nothing was stored. */
  | ({ readonly status: "error" } & Resubmittable);

export const IDLE: SubmissionState = { status: "idle" };

/** The messages the non-field failures show. Written once so both forms say the same thing. */
export const FAILURE_MESSAGE = {
  /**
   * Names no provider and promises no timeline. It says what is true — the submission did not
   * reach us — and offers the one alternative that does not depend on this form working.
   */
  unavailable:
    "Your inquiry could not be sent — the service is not responding. Nothing has been submitted. Please try again shortly.",
  /**
   * A rate limit is its own message, not the generic failure.
   *
   * It shared `error` at first, and the browser check showed why that was wrong: the copy read
   * "Please try again", while the block lasts an hour — so the interface was inviting a retry it
   * knew would fail, and doing it to someone who has done nothing wrong. This says what actually
   * happened and asks for the one thing that helps.
   *
   * **No number.** The API's `Retry-After` says 3600 today, and printing "wait an hour" here would
   * be this file asserting a policy that lives in `throttle.config.ts` and would go stale the day
   * it is tuned.
   */
  throttled:
    "Too many submissions have been sent from this connection. Nothing has been stored. Please wait a while before trying again.",
  error:
    "Your inquiry could not be submitted. Nothing has been stored. Please try again, or contact us directly.",
} as const;

/**
 * The confirmation, and the reason it is worded this way.
 *
 * It states receipt and stops. **It does not say an email was sent**, because no email
 * infrastructure exists — API_CONTRACT_FINAL's Remaining Blockers §4 records that no provider,
 * sender domain or deliverability plan is specified anywhere. **It does not say a colleague was
 * notified**, because nothing notifies anyone: the submission writes one row. **It promises no
 * response time**, because none is approved — SITE_STRUCTURE's Outstanding Confirmations still
 * lists response time among the unconfirmed items.
 *
 * Every one of those sentences would be the easy thing to write and each would be a claim the
 * platform cannot honour.
 */
export const SUCCESS_MESSAGE = "Your inquiry has been received.";
