import "server-only";

import { apiPost } from "@/lib/api-client";

import { FAILURE_MESSAGE, type SubmissionState } from "./submission-state";

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
 * **400 only** becomes `invalid`. Every other status becomes `error`, because nothing else the API
 * can answer with is something the person filling in the form can act on — a 500 is not a field
 * they typed wrong, and telling them it is would send them editing correct data. A 400 that somehow
 * carries no `details` still becomes `invalid`, with the API's own `message` as `formError`, so the
 * response is never silently downgraded to a generic failure.
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
): Promise<SubmissionState> {
  const result = await apiPost<SubmissionResponse>(path, body);

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

  console.error(`[forms] POST ${path} answered ${result.status} (${result.code ?? "no code"})`);

  return { status: "error", ...resubmittable };
}

export { FAILURE_MESSAGE };
