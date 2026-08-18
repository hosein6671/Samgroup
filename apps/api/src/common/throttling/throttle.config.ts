import { createHash } from "node:crypto";

import type { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * The rate-limit policy, in one place — API_CONTRACT_FINAL.md §Rate limits.
 *
 * ── What is enforced, and what is only contracted ───────────────────────────
 *
 * §Rate limits names seven endpoint groups. **Two are enforced**: form submissions at 5 per hour,
 * and login at 5 per 15 minutes. The other five — newsletter, uploads, downloads, public GETs, the
 * RAG export — have no throttler here because four of the endpoints behind them do not exist yet,
 * and the public GET group is deliberately left alone.
 *
 * ── Where this is applied — and where it deliberately is not ────────────────
 *
 * `ThrottlerModule.forRoot` is registered in `AppModule`, but **`ThrottlerGuard` is never
 * registered as an `APP_GUARD`**. The guard is attached with `@UseGuards` on the two Forms
 * controllers and nowhere else, so `GET /products`, `GET /categories`, `GET /blog/posts`,
 * `GET /locales`, `GET /health` and the SEO endpoints are completely untouched by it — they never
 * enter the guard, never increment a counter, and never receive an `X-RateLimit-*` header. That is
 * checked by a test rather than left as an intention.
 *
 * The guard is now also attached to `AuthController`, for the login limit. **The guard evaluates
 * every named throttler on every route it guards**, so the two policies would stack without
 * `@SkipThrottle`: `AuthController` carries `@SkipThrottle({ forms: true })` and both Forms
 * controllers carry `@SkipThrottle({ login: true })`. Any third named throttler needs the same
 * treatment on every existing throttled route, or it silently narrows them.
 */

/** One hour, in milliseconds — the unit `ThrottlerStorageService` takes (verified in its source). */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * The submission budget: five per hour, per client.
 *
 * Transcribed from §Rate limits' table row "Form submissions (all others) | 5 / hour | Generous for
 * humans, hostile to bots". Not chosen here, and not tuned here.
 *
 * `blockDuration` is left unset, so it falls back to `ttl`: the request that exceeds the budget
 * blocks the client for the remainder of a full hour rather than letting them retry as soon as the
 * oldest hit ages out. That is the library's default and it is the stricter reading of "5 / hour".
 */
export const FORMS_THROTTLER_NAME = "forms";
export const FORMS_LIMIT = 5;
export const FORMS_TTL_MS = ONE_HOUR_MS;

/**
 * The login budget: five attempts per fifteen minutes, per client.
 *
 * Transcribed from §Rate limits' row "`GET /auth/login` | 5 / 15 min, then backoff | Credential
 * stuffing" — the method there is a typo for the `POST /auth/login` §2.2 contracts, and the numbers
 * are what is being read. Not chosen here, and not tuned here.
 *
 * **"then backoff" is not implemented as escalation.** `blockDuration` is left unset, so it falls
 * back to `ttl`: the sixth attempt blocks the client for the remainder of the fifteen minutes
 * rather than for a period that grows with each violation. That is the library's default and the
 * stricter reading of "5 / 15 min"; a genuinely escalating backoff needs per-client violation
 * history, which this in-process storage does not keep.
 *
 * ── Why its own name, and the cost of that ──────────────────────────────────
 *
 * The note above is explicit that `ThrottlerGuard` evaluates **every** named throttler on every
 * route it guards. Adding this one therefore has a consequence that must be handled rather than
 * discovered: without `@SkipThrottle`, the two Forms controllers would silently acquire the 5/15min
 * login budget on top of their 5/hour one, and login would acquire the forms budget. Both
 * controllers now skip the throttler they are not subject to, and a test asserts each budget is
 * reached only from its own endpoint.
 *
 * Sharing the `forms` bucket instead was the alternative, and it is wrong twice over: the numbers
 * differ (5/hour vs 5/15min), and a shared bucket would let form-submission volume lock staff out
 * of the Admin surface — and let login attempts consume a lead's ability to submit.
 */
export const LOGIN_THROTTLER_NAME = "login";
export const LOGIN_LIMIT = 5;
export const LOGIN_TTL_MS = 15 * 60 * 1000;

/**
 * The 429 message.
 *
 * The library's own default is the string `"ThrottlerException: Too Many Requests"`, which would
 * put an internal class name on the wire through the error envelope's `message` field. This
 * replaces it with something a person can act on and that names nothing internal — no limit, no
 * window, no counter, no tracker. The `Retry-After` header the guard sets alongside it is the
 * machine-readable half, exactly as §8 specifies for `RATE_LIMITED`.
 */
export const RATE_LIMIT_MESSAGE =
  "Too many submissions from this connection. Please wait before trying again.";

/**
 * The storage key for one client.
 *
 * ── Why this replaces the library's default ─────────────────────────────────
 *
 * The default key is `sha256(ClassName-handlerName-throttlerName-tracker)` — **per handler**, which
 * would give `/inquiries` and `/custom-formulation-requests` a separate budget of five each and let
 * a client alternate between them for ten submissions an hour. §Rate limits states the limit for an
 * endpoint *group* ("Form submissions (all others)"), not per path, so the class and handler are
 * dropped and the two endpoints share one bucket. Stricter, and it matches what the contract says.
 *
 * The tracker is still hashed rather than stored raw. It is a client IP, the storage is an
 * in-process `Map`, and there is no reason for the address itself to be the key when a digest works
 * identically — SECURITY.md's line on keeping personal data out of incidental storage.
 */
export function generateThrottleKey(_context: unknown, tracker: string, name: string): string {
  return createHash("sha256").update(`${name}-${tracker}`).digest("hex");
}

/**
 * ── In-memory storage, and the deployment condition on it ───────────────────
 *
 * `ThrottlerModule` with no `storage` option uses `ThrottlerStorageService`, a plain `Map` in the
 * application process. That is correct for the approved topology and only for it: ADR-005 deploys
 * **one** Docker container per service on **one** VPS, and there is no horizontal scaling and no
 * staging environment. One process means one counter.
 *
 * **It stops being correct the moment a second `apps/api` instance exists** — two processes would
 * mean two independent budgets and an effective limit of 10/hour, and a rolling restart resets the
 * counter to zero. A multi-instance deployment needs a shared store (the library's Redis storage
 * being the usual answer), and that is a new infrastructure dependency requiring its own decision.
 * Recorded in DEVOPS/ROADMAP rather than pre-built here: no Redis is introduced by this gate.
 *
 * ── The tracker behind a reverse proxy ──────────────────────────────────────
 *
 * `ThrottlerGuard.getTracker` returns `req.ip`. Express resolves that to the socket peer unless
 * `trust proxy` is set, and ADR-005 puts nginx in front of `apps/api` — so in the deployed topology
 * every request would arrive with nginx's address and **all clients would share one bucket**.
 *
 * `trust proxy` is deliberately NOT enabled here. Enabling it without knowing exactly how many
 * proxies sit in front makes `X-Forwarded-For` client-writable, which turns the limit from
 * over-strict into trivially bypassable — strictly the worse failure. It is a deployment
 * configuration decision that belongs with the VPS work, and the VPS does not exist yet.
 */
export const THROTTLE_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [
    { name: FORMS_THROTTLER_NAME, ttl: FORMS_TTL_MS, limit: FORMS_LIMIT },
    { name: LOGIN_THROTTLER_NAME, ttl: LOGIN_TTL_MS, limit: LOGIN_LIMIT },
  ],
  errorMessage: RATE_LIMIT_MESSAGE,
  generateKey: generateThrottleKey,
};
