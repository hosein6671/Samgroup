import "server-only";

import { apiPost } from "@/lib/api-client";

import { FAILURE_MESSAGE, type SubmissionState } from "./submission-state";
import { TURNSTILE_RESPONSE_FIELD } from "./turnstile";

import type { ApiErrorDetail } from "@sam-group/types";

/**
 * The half of every form submission that is identical across forms: read the `FormData`, POST it,
 * turn the four `ApiResult` outcomes into the five `SubmissionState` ones.
 *
 * This is the module FRONTEND_ARCHITECTURE §`forms/` describes — organized by capability rather
 * than by page, "because every submission form shares submission/validation/error-display logic
 * regardless of which page embeds it". Each form contributes only its own field list.
 *
 * Server-only, and `import "server-only"` makes that a build error rather than a convention: these
 * functions run inside Server Actions and reach `API_INTERNAL_URL`, an origin that must never be
 * inlined into a browser bundle.
 */

/** What a submission answers with. Only the id is read; see `SubmissionResponse` in `apps/api`. */
type SubmissionResponse = { id?: unknown };

/**
 * One text field, as it should appear in the request body.
 *
 * `FormData.get` returns `null` for an absent control and a `File` for a file input; both become
 * `undefined`, which `buildBody` then drops. An empty or whitespace-only value is also dropped
 * rather than sent as `""` — the API trims and treats blank optional values as absent anyway, so
 * sending them would only make the request larger and the intent less clear.
 */
export function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

/** A checkbox, as a real boolean. An unchecked box submits nothing at all, which is `false`. */
export function checked(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}

/** Every value of a multi-select, non-empty entries only. Absent when nothing was chosen. */
export function textList(form: FormData, name: string): string[] | undefined {
  const values = form
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value !== "");

  return values.length === 0 ? undefined : values;
}

/**
 * Drops every `undefined` property so an untouched optional input is **absent** from the JSON
 * rather than present as `null`.
 *
 * The distinction is not cosmetic: the DTOs mark those fields `@IsOptional()`, which
 * class-validator satisfies for `undefined` and for a missing key — and rejects for an explicit
 * `null`. A body built without this would fail validation on every field the buyer left blank.
 */
export function buildBody(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/**
 * The Cloudflare Turnstile token the widget wrote into the form, if it wrote one.
 *
 * `cf-turnstile-response` is Cloudflare's own field name, shared with the widget through one
 * constant so the writer and the reader cannot drift apart.
 *
 * It is read here and **never put in `body`**: it travels as a header (see `RequestOptions`), which
 * is what keeps it out of the submission contract and out of the lead row. It is also excluded from
 * the resubmittable values below — a token is single-use, so echoing a spent one back into a
 * redrawn form would guarantee the retry fails.
 */
export function turnstileToken(form: FormData): string | undefined {
  return text(form, TURNSTILE_RESPONSE_FIELD);
}

/**
 * The string-valued entries of a submitted body, for redrawing the form with what was typed.
 *
 * Strings only, so `consentGiven` — the one boolean either form submits — is left out. That is
 * deliberate rather than incidental: see the note on `SubmissionState.values`.
 */
function textValues(body: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/** `details[]` → `{ field: [issue, ...] }`, preserving every issue reported for a field. */
function groupByField(details: readonly ApiErrorDetail[]): Record<string, readonly string[]> {
  const grouped: Record<string, string[]> = {};

  for (const detail of details) {
    (grouped[detail.field] ??= []).push(detail.issue);
  }

  return grouped;
}

/**
 * POST one submission and describe the outcome.
 *
 * ── Which failures are the buyer's, and which are ours ──────────────────────
 *
 * **400 only** becomes `invalid`, because it is the only answer that names something the person
 * typed — a 500 is not a field they got wrong, and telling them it is would send them editing
 * correct data. A 400 that somehow carries no `details` still becomes `invalid`, with the API's own
 * `message` as `formError`, so the response is never silently downgraded to a generic failure.
 *
 * Two statuses are then separated out because the generic failure would say the wrong thing to
 * them: **429**, where the budget is spent and retrying now cannot work, and **503**, where a
 * dependency the API needs did not answer and nothing was stored. Everything else is `error`.
 *
 * ── What is logged, and what is not ─────────────────────────────────────────
 *
 * The transport failure code (`ECONNREFUSED`, `TimeoutError`) and the HTTP status, and nothing
 * else. **Never the body**: it is a named individual's contact details, and a server log is not
 * where those belong. `describeTransportFailure` in the client already guarantees the detail string
 * carries no URL.
 */
export async function submitTo(
  path: string,
  body: Record<string, unknown>,
  previous: SubmissionState,
  turnstileToken?: string,
): Promise<SubmissionState> {
  const result = await apiPost<SubmissionResponse>(
    path,
    body,
    turnstileToken === undefined ? undefined : { turnstileToken },
  );

  if (result.ok) {
    return {
      status: "success",
      reference: typeof result.data.id === "string" ? result.data.id : "",
    };
  }

  /*
   * Attached to every failure, not just the validation one. See `Resubmittable` — an emptied form
   * under "please try again shortly" is the worst of the three outcomes, not the least important.
   */
  const resubmittable = {
    values: textValues(body),
    attempt:
      (previous.status === "idle" || previous.status === "success" ? 0 : previous.attempt) + 1,
  };

  if (result.reason === "unreachable") {
    console.error(`[forms] POST ${path} did not reach the API (${result.detail})`);

    return { status: "unavailable", ...resubmittable };
  }

  if (result.reason === "malformed") {
    console.error(`[forms] POST ${path} answered ${result.status} with a non-envelope body`);

    return { status: "error", ...resubmittable };
  }

  if (result.status === 400) {
    return {
      status: "invalid",
      fieldErrors: result.details === null ? {} : groupByField(result.details),
      formError: result.details === null || result.details.length === 0 ? result.message : null,
      ...resubmittable,
    };
  }

  /*
   * The submission budget for this connection is spent — API_CONTRACT_FINAL §Rate limits, 5/hour.
   * Kept apart from `error` because the two need different things said to them: this one is not a
   * fault, and telling the person to try again is wrong when the block outlasts their patience.
   * Not logged as an error either — a throttled request is the limit working.
   */
  if (result.status === 429) {
    return { status: "throttled", ...resubmittable };
  }

  /*
   * The API could not complete a check it depends on and stored nothing — today that is the
   * Turnstile verification, which answers 503 `UPSTREAM_UNAVAILABLE` when Cloudflare cannot be
   * reached or no secret is configured in production (see `TurnstileGuard`).
   *
   * Reported as `unavailable` rather than `error` because that is what it is: the person did
   * nothing wrong, nothing was stored, and the condition is transient. `error`'s wording — "please
   * try again, or contact us directly" — invites an immediate retry of something that is still
   * down, and does not say the service is the part that is not responding.
   *
   * Deliberately NOT a separate `SubmissionState`. A 503 from a dependency and an API that did not
   * answer at all are the same fact to the person filling in the form, and a sixth state would be a
   * second sentence saying the same thing.
   */
  if (result.status === 503) {
    console.error(`[forms] POST ${path} answered 503 (${result.code ?? "no code"})`);

    return { status: "unavailable", ...resubmittable };
  }

  console.error(`[forms] POST ${path} answered ${result.status} (${result.code ?? "no code"})`);

  return { status: "error", ...resubmittable };
}

export { FAILURE_MESSAGE };
