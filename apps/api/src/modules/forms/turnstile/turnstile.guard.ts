import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";

import { TurnstileVerifier } from "./turnstile.verifier";

import type { Request } from "express";

/**
 * The anti-abuse gate on the two public write endpoints — SITE_STRUCTURE.md §10's "invisible
 * captcha (not a visible challenge)", enforced.
 *
 * ── Why this is a guard, and where it sits in the order ─────────────────────
 *
 * Guards run **before** the `ValidationPipe` in Nest's lifecycle, which is what makes this cheap
 * against exactly the traffic it exists to stop: a bot posting nonsense is refused before a DTO is
 * constructed and before anything touches Prisma.
 *
 * It is attached with `@UseGuards` on the two Forms controllers and **nowhere else** — the same
 * arrangement `ThrottlerGuard` has, and for the same reason. Registering it as an `APP_GUARD` would
 * put a captcha requirement in front of every public GET on the platform.
 *
 * The two guards compose in the order they are listed: throttling first, so a client already over
 * its 5/hour budget is answered 429 without a round trip to Cloudflare on our account.
 *
 * ── The token travels as a header, not as a body field ──────────────────────
 *
 * `CF-Turnstile-Response`, which is Cloudflare's own field name.
 *
 * Three reasons it is not a DTO property. **The body contract stays frozen** —
 * API_CONTRACT_FINAL.md §2.6 fixes what a submission is, and SITE_STRUCTURE.md §10 is explicit that
 * the captcha is "an implementation note, not a data-model change". **`forbidNonWhitelisted` stays
 * untouched** — no DTO gains a field, so nothing about what the API rejects changes. And **the
 * token can never be persisted**: it is not in the shape the services read, so there is no path by
 * which a single-use anti-abuse credential ends up in a lead row.
 *
 * It is the same category as the rate limiter's client address: transport-level metadata about the
 * request, not data about the enquiry.
 *
 * ── Two refusals, because they are two different facts ──────────────────────
 *
 * **403 `FORBIDDEN`** when the token was rejected — absent, malformed, expired, already redeemed,
 * or refused by Cloudflare. Deliberately not 400: a failed challenge is not a field the person
 * typed wrong, and reporting it as `VALIDATION_ERROR` would send `submit.ts` into its `invalid`
 * branch looking for a `details[].field` to draw a message beside, when there is no such field.
 *
 * **503 `UPSTREAM_UNAVAILABLE`** when the check could not be performed at all — Cloudflare
 * unreachable or answering nonsense, or no secret configured in a production process. Both refuse
 * the submission (`TurnstileVerifier` explains why the control fails closed), and both are our
 * problem rather than the visitor's, so the status says so: the form then shows "the service is not
 * responding", which is true, instead of telling someone who did nothing wrong that they were
 * refused.
 *
 * Neither message names a provider, an error code or any configuration. Cloudflare's `error-codes`
 * go to the log, where an operator can read them; a bot learns nothing it can act on.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly verifier: TurnstileVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers["cf-turnstile-response"];
    const token = Array.isArray(header) ? header[0] : header;

    const result = await this.verifier.verify(token);

    if (result.outcome === "rejected") {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.Forbidden, REJECTION_MESSAGE);
    }

    if (result.outcome === "unavailable" || result.outcome === "misconfigured") {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.UpstreamUnavailable,
        UNAVAILABLE_MESSAGE,
      );
    }

    /*
     * `verified` and `disabled` continue, and they are the only two that do. `disabled` requires
     * both an unset secret and a non-production process — the verifier owns that rule, and owns
     * every line this feature logs, so one file explains the whole control.
     */
    return true;
  }
}

/**
 * What a refused submission is told.
 *
 * It describes the outcome and the recovery, and names nothing internal — no provider, no token, no
 * limit, no error code. The same discipline `RATE_LIMIT_MESSAGE` keeps.
 */
export const REJECTION_MESSAGE =
  "This submission could not be verified. Please reload the page and try again.";

/**
 * What a submission refused for our own reasons is told.
 *
 * It says the check could not be completed rather than that the person failed it, because they did
 * not — and it offers the one route that does not depend on this control working.
 */
export const UNAVAILABLE_MESSAGE =
  "This submission could not be verified right now. Nothing has been stored. " +
  "Please try again shortly, or contact us directly.";
