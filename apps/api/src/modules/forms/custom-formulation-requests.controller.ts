import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler";

import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { TurnstileGuard } from "./turnstile/turnstile.guard";
import { CreateCustomFormulationRequestDto } from "./dto/create-custom-formulation-request.dto";

import type { SubmissionResponse } from "./dto/submission.response";

/**
 * `POST /custom-formulation-requests` — API_CONTRACT_FINAL.md §2.6, public and unauthenticated.
 *
 * A second controller rather than a second route on `InquiriesController`, because Nest fixes one
 * path prefix per controller and the contract fixes two sibling paths. They share a module, which
 * is the boundary ARCHITECTURE.md's **Forms** module actually draws.
 *
 * Same shape as `/inquiries` in every other respect: 201, no envelope work, and no read path — the
 * Admin queue at `/admin/custom-formulation-requests` (§2.10) is not in this gate. The DTO is
 * imported as a value for the reason `inquiries.controller.ts` records at length: a type-only
 * import erases the class the ValidationPipe resolves through `design:paramtypes`.
 *
 * Rate limited on the **same 5/hour budget** as `/inquiries`, not a second one of its own — see
 * that controller's note and `generateThrottleKey` in `throttle.config.ts`.
 *
 * **`@SkipThrottle({ login: true })` is not optional.** `ThrottlerGuard` evaluates every named
 * throttler on every route it guards, and the login policy sharing this configuration is 5 per 15
 * MINUTES — a stricter budget over a shorter window than this endpoint's 5 per hour. Without the
 * skip, a legitimate burst of form submissions would be blocked by a limit that exists to slow
 * credential stuffing. See throttle.config.ts.
 *
 * ── The invisible challenge runs beside the rate limit ─────────────────────
 *
 * `TurnstileGuard` is listed **after** `ThrottlerGuard`, and the order is load-bearing: guards run
 * left to right, so a client already over its 5/hour budget is answered 429 without this endpoint
 * spending a verification round trip on our Cloudflare account.
 *
 * Like the throttler it is attached here rather than globally — SITE_STRUCTURE.md §10 asks for an
 * invisible captcha on the public submission forms, not on every read the platform serves. A
 * refused challenge answers **403 `FORBIDDEN`**; see `turnstile.guard.ts` for why it is not a 400.
 */
@SkipThrottle({ login: true })
@UseGuards(ThrottlerGuard, TurnstileGuard)
@Controller("custom-formulation-requests")
export class CustomFormulationRequestsController {
  constructor(
    private readonly customFormulationRequestsService: CustomFormulationRequestsService,
  ) {}

  @Post()
  async create(@Body() dto: CreateCustomFormulationRequestDto): Promise<SubmissionResponse> {
    return this.customFormulationRequestsService.create(dto);
  }
}
