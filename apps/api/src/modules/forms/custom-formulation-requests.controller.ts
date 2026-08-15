import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
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
 */
@UseGuards(ThrottlerGuard)
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
