/**
 * The platform's one API client — `apps/web` → NestJS, server-side only.
 *
 * FRONTEND_ARCHITECTURE.md §11 specifies a single typed client parsing the `{ data, meta }` /
 * `{ error }` envelope exactly, with reads issued from Server Components and **writes issued from
 * Server Actions**. Both verbs now exist — `apiGet` for reads, `apiPost` for the public form
 * submissions. Auth headers, retries and revalidation still arrive with the gates that need them.
 *
 * ── Server-only, enforced at build time ────────────────────────────────────
 *
 * `apps/api` runs with `cors: false` on purpose — API_CONTRACT_FINAL.md §1 states that no
 * browser-originated call ever reaches NestJS, so a client-side import of this module would not
 * merely be untidy, it would be a request that cannot succeed and an internal origin leaked into
 * a browser bundle.
 *
 * `import "server-only"` is what prevents that, and it costs no dependency: Next ships the package
 * as `next/dist/compiled/server-only` and aliases the bare specifier to it in its own webpack
 * config, resolving to a module that throws in a client bundle and to an empty one on the server.
 * Importing this file from a Client Component therefore fails `next build` outright — verified, not
 * assumed — rather than failing at render.
 *
 * That replaced a `typeof window` module-load throw, which is redundant beside it: the build no
 * longer produces a bundle in which the runtime check could ever be reached. `API_INTERNAL_URL`
 * carries no `NEXT_PUBLIC_` prefix, so Next never inlines the origin into a browser bundle either.
 *
 * ── No caching, by decision ─────────────────────────────────────────────────
 *
 * Every request is `cache: "no-store"`. Next 15 does not cache `fetch` by default, but relying on
 * a framework default for this would leave the policy unstated; there is no approved cache
 * invalidation architecture yet (the publish-triggered revalidation path in
 * API_CONTRACT_FINAL.md §4 is contracted, not built), and a cached category that cannot be
 * invalidated is worse than an uncached one on a page that renders in milliseconds from a fixture.
 */

import "server-only";

import type { ApiErrorCode, ApiErrorDetail, ApiMeta } from "@sam-group/types";

/**
 * The frozen prefix from `main.ts`'s `setGlobalPrefix("api/v1")`.
 *
 * Held here rather than in `API_INTERNAL_URL` deliberately: the prefix is an architectural
 * constant and the environment variable is an origin. Folding one into the other would let a
 * mistyped `.env` silently move the whole API surface, and would make the version bump a
 * deployment edit in three places instead of a code change in one.
 */
const API_PREFIX = "/api/v1";

/**
 * Ten seconds. Long enough that a cold NestJS process answering its first Prisma query is not
 * cut off, short enough that a hung upstream cannot hold a server render open — the fallback
 * this gate falls back TO is a fixture that renders instantly, so waiting longer buys nothing.
 */
const TIMEOUT_MS = 10_000;

/**
 * What a request produced. Four outcomes, kept distinct on purpose: collapsing them into
 * `null` would make "this category does not exist" and "the API is down" indistinguishable at
 * the call site, and those two demand different handling the moment this stops being a proof.
 */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T; readonly meta: ApiMeta }
  /** A response arrived carrying a non-2xx status. `code`/`message` come from the `{ error }` body. */
  | {
      readonly ok: false;
      readonly reason: "http";
      readonly status: number;
      readonly code: ApiErrorCode | null;
      readonly message: string | null;
      readonly details: readonly ApiErrorDetail[] | null;
    }
  /** No response at all — DNS, connection refused, TLS, timeout, or no base URL configured. */
  | { readonly ok: false; readonly reason: "unreachable"; readonly detail: string }
  /** A 2xx response whose body is not the contracted envelope. */
  | { readonly ok: false; readonly reason: "malformed"; readonly status: number };

/**
 * The three failure branches of `ApiResult`, on their own.
 *
 * Extracted rather than restated so `ApiNoContentResult` below cannot drift from the taxonomy every
 * existing caller already switches on. `never` is safe as the payload type because not one of the
 * three branches mentions it.
 */
export type ApiFailure = Extract<ApiResult<never>, { readonly ok: false }>;

/**
 * What a request against an endpoint that answers **204 No Content** produced.
 *
 * `POST /auth/logout` is the only such endpoint today (API_CONTRACT_FINAL §2.2a: "answers 204 with
 * an empty body"). It needs its own result type because the envelope check `apiGet`/`apiPost` apply
 * — a 2xx must carry `data` — is exactly wrong for it: a correct 204 has no body at all, and
 * reporting that as `malformed` would make success indistinguishable from a contract violation.
 *
 * The success branch carries nothing, deliberately. There is no `data` to assert and no `meta` to
 * read; a caller that wants either is calling the wrong function.
 */
export type ApiNoContentResult = { readonly ok: true } | ApiFailure;

/**
 * Per-request options. One field today, and it is the reason this type exists.
 *
 * `accessToken` becomes `Authorization: Bearer <token>` on the internal hop. It is supplied by the
 * caller rather than read from a cookie in here, because this module is the platform's transport
 * and knows nothing about sessions — `features/admin/session` owns the cookie, decides whether a
 * credential is usable, and hands the raw value down. Inverting that would put cookie knowledge in
 * the one module every public page already depends on.
 *
 * **This is not a general header escape hatch.** It is one named credential field, so no caller can
 * use it to set `Cookie`, `Host`, or anything else on a server-to-server request, and there is no
 * shape here that a browser-originated proxy could be built out of.
 */
export type RequestOptions = {
  readonly accessToken?: string;
};

/**
 * The configured API origin, or `null` when it is unusable.
 *
 * **A missing variable is not thrown.** Before this gate, `apps/web` read no environment at all
 * and rendered on a fresh clone with no configuration; making six approved design-proof pages
 * crash for anyone who has not written a `.env` would be exactly the regression this gate is
 * required not to introduce. It degrades to `unreachable` — loudly logged, fixture rendered —
 * which is the same path a stopped API takes, and is the honest description of the situation.
 */
function resolveBaseUrl(): string | null {
  const raw = process.env.API_INTERNAL_URL?.trim();

  if (raw === undefined || raw === "") {
    return null;
  }

  try {
    // Parsed rather than pattern-matched, so a value missing its scheme is rejected here instead
    // of producing a confusing fetch failure later.
    const parsed = new URL(raw);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Trailing slashes are stripped so composition below cannot produce `//api/v1`.
    return raw.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * `${API_INTERNAL_URL}${API_PREFIX}${path}`, with the query string appended.
 *
 * `path` is expected to be already-encoded by the caller — `encodeURIComponent` belongs where the
 * segment's meaning is known, not in a string join that cannot tell a slug from a sub-path.
 */
function composeUrl(
  baseUrl: string,
  path: string,
  query?: Readonly<Record<string, string>>,
): string {
  const search = new URLSearchParams(query ?? {}).toString();

  return `${baseUrl}${API_PREFIX}${path}${search === "" ? "" : `?${search}`}`;
}

/**
 * Whether a thrown value is Next.js signalling control flow rather than reporting a fault.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Next uses thrown errors as signals, tagging each with a `digest` string. `notFound()` throws
 * `NEXT_NOT_FOUND`, `redirect()` throws `NEXT_REDIRECT`, and — the one that surfaced here — a
 * `no-store` fetch during `next build`'s prerender pass throws `DYNAMIC_SERVER_USAGE`, which is
 * how the framework discovers a route cannot be static.
 *
 * A blanket `catch` around `fetch` swallows all three. The first version of this file did, and the
 * build printed six lines claiming the API had not responded while it was demonstrably serving
 * the same URL — the request had not failed at all. The route still came out dynamic, because Next
 * records the dynamic usage before throwing, but the diagnosis was wrong and the next caller to
 * wrap a `notFound()` in this client would have found it silently disabled.
 *
 * Matched on `digest` rather than by importing Next's own predicate: `isDynamicServerError` lives
 * at `next/dist/client/components/hooks-server-context`, a deep path into build output that is not
 * a public entry point and moves between releases. `digest` is what Next puts on the wire and what
 * its own boundaries match on. An unrecognised throw is still treated as a transport failure —
 * this widens nothing.
 */
function isFrameworkControlFlow(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string"
  );
}

/**
 * A short, safe description of a transport failure.
 *
 * `Error.message` on a failed `fetch` frequently embeds the full request URL, and Node nests the
 * real cause one level down. Only the stable machine-readable parts are kept: the syscall code
 * (`ECONNREFUSED`, `ENOTFOUND`, ...) or the error's name. Nothing derived from the URL is
 * returned, so this string is safe to log without leaking the internal origin.
 */
function describeTransportFailure(error: unknown): string {
  if (error instanceof Error) {
    const cause: unknown = error.cause;

    if (typeof cause === "object" && cause !== null && "code" in cause) {
      const code: unknown = (cause as { code: unknown }).code;

      if (typeof code === "string") {
        return code;
      }
    }

    // `AbortSignal.timeout` rejects with a TimeoutError DOMException; its name is the signal.
    return error.name;
  }

  return "UnknownError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The `{ error: { code, message, details? } }` half of the envelope, read defensively. */
function readErrorBody(body: unknown): {
  code: ApiErrorCode | null;
  message: string | null;
  details: readonly ApiErrorDetail[] | null;
} {
  if (!isRecord(body) || !isRecord(body.error)) {
    return { code: null, message: null, details: null };
  }

  const { code, message, details } = body.error;

  return {
    // Not validated against the closed union: an unknown code is a contract violation, and
    // narrowing it here would be asserting agreement this gate does not enforce. It is carried
    // as-is for logging and never rendered.
    code: typeof code === "string" ? (code as ApiErrorCode) : null,
    message: typeof message === "string" ? message : null,
    details: Array.isArray(details) ? (details as ApiErrorDetail[]) : null,
  };
}

/**
 * One GET against the API.
 *
 * `T` is asserted, not validated — the envelope's shape is checked, its payload is not. Callers
 * that render a field are expected to narrow it themselves; `catalog.ts` does exactly that for
 * the four Category fields it uses.
 */
export async function apiGet<T>(
  path: string,
  query?: Readonly<Record<string, string>>,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  return requestEnvelope<T>("GET", path, query, undefined, options);
}

/**
 * One POST against the API — the write half of §11, used only from Server Actions.
 *
 * `body` is serialized as JSON and sent as-is: **this client validates nothing.** The DTOs behind
 * `POST /inquiries` and `POST /custom-formulation-requests` run with `whitelist` +
 * `forbidNonWhitelisted`, so the API is the authority on what a valid submission is, and a second
 * copy of those rules here would be a second thing to keep in step — one that could reject a
 * submission the API would have accepted.
 *
 * The failure taxonomy is `apiGet`'s, unchanged, and the `http` branch carries `details` — which is
 * what makes a 400 renderable as per-field messages beside the inputs that caused it.
 *
 * **Not retried.** A POST that creates a lead is not idempotent, and a retry on a timeout is how
 * one buyer becomes two rows in the sales queue. The caller reports the failure and the person
 * decides whether to submit again.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  return requestEnvelope<T>("POST", path, undefined, body, options);
}

/**
 * One PATCH against the API — the workflow mutations, issued only from Server Actions.
 *
 * Separate from `apiPost` because the verb is part of the contract rather than an implementation
 * detail: `PATCH /admin/{leads}/:id/status` and `.../assignment` are narrow sub-resource commands
 * (ADR-013), and a client that could reach them with POST would be reaching a route that does not
 * exist. Everything else is `apiPost`'s — same origin, same timeout, same `no-store`, same failure
 * taxonomy — so a 409 arrives as `{ reason: "http", status: 409 }` a caller already knows how to
 * read, and `details` still carries the field-level issue behind a 400.
 *
 * **Not retried, and the reason is sharper here than for a POST.** These mutations are
 * compare-and-set: a retry after a timeout would resend a `from` the first attempt may already
 * have consumed, and the second attempt would report a conflict for a change that succeeded. The
 * operator reloads and sees the truth.
 */
export async function apiPatch<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  return requestEnvelope<T>("PATCH", path, undefined, body, options);
}

/**
 * One POST against an endpoint contracted to answer **204 No Content**.
 *
 * Separate from `apiPost` rather than a flag on it, because the two disagree about what a valid
 * success looks like and a boolean parameter would hide that at every call site. Everything else is
 * identical — same origin, same timeout, same `no-store`, same failure taxonomy — so a 401 from
 * `POST /auth/logout` is the same `{ reason: "http", status: 401 }` a caller already knows how to
 * read.
 *
 * A 2xx carrying a body is still accepted as success and the body ignored: this function's contract
 * is "nothing to read", not "the server must send zero bytes", and turning an unexpected body into
 * a failure would break a logout over a detail the caller cannot act on.
 */
export async function apiPostNoContent(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<ApiNoContentResult> {
  const transport = await send("POST", path, undefined, body, options);

  if (transport.kind === "unreachable") {
    return { ok: false, reason: "unreachable", detail: transport.detail };
  }

  const { response } = transport;

  if (!response.ok) {
    const { code, message, details } = readErrorBody(await readJsonBody(response));

    return { ok: false, reason: "http", status: response.status, code, message, details };
  }

  return { ok: true };
}

/** The verbs this client issues. No DELETE: nothing in `apps/web` deletes through the API. */
type HttpMethod = "GET" | "POST" | "PATCH";

/**
 * What one attempt at reaching the API produced, before anything is read from it.
 *
 * The split exists so the envelope readers and the no-content reader share the origin resolution,
 * the header assembly, the `no-store` policy, the timeout and the framework-control-flow rethrow
 * without sharing the body expectation, which is the one thing they disagree about.
 */
type Transport =
  | { readonly kind: "response"; readonly response: Response }
  | { readonly kind: "unreachable"; readonly detail: string };

/** The request headers, assembled per call. `Authorization` appears only when a token was passed. */
function composeHeaders(method: HttpMethod, options: RequestOptions | undefined): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };

  if (method !== "GET") {
    headers["content-type"] = "application/json";
  }

  /*
   * The scheme is hard-coded rather than read from the login response's `tokenType`. §2.2a
   * contracts that field as always `"Bearer"`, and taking a scheme from a response would mean a
   * compromised or confused upstream could choose how its own credential is presented.
   */
  if (options?.accessToken !== undefined && options.accessToken !== "") {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  return headers;
}

async function send(
  method: HttpMethod,
  path: string,
  query: Readonly<Record<string, string>> | undefined,
  body: unknown,
  options: RequestOptions | undefined,
): Promise<Transport> {
  const baseUrl = resolveBaseUrl();

  if (baseUrl === null) {
    return { kind: "unreachable", detail: "API_INTERNAL_URL is unset or invalid" };
  }

  try {
    const response = await fetch(composeUrl(baseUrl, path, query), {
      method,
      // Stated rather than inherited — see the module note. Next 15's default is already
      // uncached, and this gate does not rely on that remaining true. An authenticated request
      // must never be cached at all, so this is now load-bearing rather than merely explicit.
      cache: "no-store",
      headers: composeHeaders(method, options),
      body: method === "GET" ? undefined : JSON.stringify(body),
      // Node 18+ and every runtime this app targets; it needs no AbortController plumbing.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return { kind: "response", response };
  } catch (error: unknown) {
    if (isFrameworkControlFlow(error)) throw error;

    return { kind: "unreachable", detail: describeTransportFailure(error) };
  }
}

/** The parsed body, or `null` when there is none or it is not JSON. Never throws. */
async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestEnvelope<T>(
  method: HttpMethod,
  path: string,
  query: Readonly<Record<string, string>> | undefined,
  body: unknown,
  options: RequestOptions | undefined,
): Promise<ApiResult<T>> {
  const transport = await send(method, path, query, body, options);

  if (transport.kind === "unreachable") {
    return { ok: false, reason: "unreachable", detail: transport.detail };
  }

  const { response } = transport;
  const responseBody = await readJsonBody(response);

  if (!response.ok) {
    const { code, message, details } = readErrorBody(responseBody);

    return { ok: false, reason: "http", status: response.status, code, message, details };
  }

  // §8 contracts `meta` as always present on success. A 2xx body without `data` is not the
  // envelope, whatever else it is, and is reported as malformed rather than rendered.
  if (!isRecord(responseBody) || !("data" in responseBody)) {
    return { ok: false, reason: "malformed", status: response.status };
  }

  return {
    ok: true,
    data: responseBody.data as T,
    meta: isRecord(responseBody.meta) ? (responseBody.meta as ApiMeta) : {},
  };
}
