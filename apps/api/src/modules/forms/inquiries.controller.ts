import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler";

import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { InquiriesService } from "./inquiries.service";

import type { SubmissionResponse } from "./dto/submission.response";

/**
 * `POST /inquiries` — API_CONTRACT_FINAL.md §2.6, public and unauthenticated.
 *
 * ── One path, three of this gate's four flows ───────────────────────────────
 *
 * General Contact, Request a Quote and Request a Sample are the same submission with a different
 * `inquiryType`; §2.6 states it directly ("covers all 7 `inquiryType` values **including Sample
 * Request**") and adds that there is no `/sample-requests` endpoint. Adding a path per flow would
 * rebuild the entity the approved merge removed.
 *
 * ── No GET, and no `:id` ────────────────────────────────────────────────────
 *
 * Reading inquiries is `/admin/inquiries` (§2.10), role-scoped so a Sales Expert sees only their
 * own leads — an Admin surface with no implementation in this gate. A public read of any shape,
 * even by opaque id, would put lead data on an unauthenticated path.
 *
 * ── 201, and no envelope work ───────────────────────────────────────────────
 *
 * Nest answers a POST with 201 by default and that is the correct status for a created submission.
 * The handler returns its payload directly rather than through `withMeta`: there is nothing to put
 * in `meta` — no pagination, no locale fallback, because nothing in the response is localized — and
 * `ResponseEnvelopeInterceptor` supplies `meta: {}` for exactly this case.
 *
 * ── Rate limited, at the controller and not globally ────────────────────────
 *
 * §Rate limits' 5/hour for form submissions, enforced by `ThrottlerGuard` attached here rather than
 * as an `APP_GUARD` — the policy applies to this endpoint and its sibling, and to nothing else on
 * the platform. The budget is **shared** with `/custom-formulation-requests`: the key generator in
 * `throttle.config.ts` drops the handler identity, so a client cannot alternate between the two
 * paths for ten submissions an hour.
 *
 * The guard runs before the ValidationPipe, so a flood of malformed bodies is throttled on the same
 * budget as valid ones. That is the intent — an abusive client should not get unlimited attempts by
 * sending nonsense — and it is the natural consequence of guards preceding pipes in Nest's
 * lifecycle rather than something arranged here.
 *
 * A rejected request answers **429 `RATE_LIMITED`** in the standard envelope with a `Retry-After`
 * header, and its message names no limit, window or counter.
 *
 * **`@SkipThrottle({ login: true })` is not optional.** `ThrottlerGuard` evaluates every named
 * throttler on every route it guards, and the login policy sharing this configuration is 5 per 15
 * MINUTES — a stricter budget over a shorter window than this endpoint's 5 per hour. Without the
 * skip, a legitimate burst of form submissions would be blocked by a limit that exists to slow
 * credential stuffing. See throttle.config.ts.
 */
@SkipThrottle({ login: true })
@UseGuards(ThrottlerGuard)
@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  /**
   * Validation is the global `ValidationPipe`'s, not this handler's: `whitelist` +
   * `forbidNonWhitelisted` reject unknown properties before the body reaches the service, and
   * `validationExceptionFactory` renders the failures as the `details: [{field, issue}]` the
   * contract's §8 requires. Nothing is re-checked here.
   *
   * **`CreateInquiryDto` is imported as a value, never with `import type`.** The pipe finds the
   * class through `design:paramtypes`, which TypeScript emits from the annotation below; a
   * type-only import erases the class and emits `Function` instead. `Function` is not in Nest's
   * skip list, so the pipe validates the body against a class carrying no metadata and answers 400
   * with every legitimate property reported as "should not exist" — measured here, not theorized.
   */
  @Post()
  async create(@Body() dto: CreateInquiryDto): Promise<SubmissionResponse> {
    return this.inquiriesService.create(dto);
  }
}
