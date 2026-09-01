import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";

import { CustomFormulationRequestsController } from "./custom-formulation-requests.controller";
import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { CreateCustomFormulationRequestDto } from "./dto/create-custom-formulation-request.dto";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { InquiriesController } from "./inquiries.controller";
import { InquiriesService } from "./inquiries.service";
import { TurnstileGuard } from "./turnstile/turnstile.guard";

const RESULT = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-15T09:30:00.000Z",
};

/**
 * Both controllers carry `@UseGuards(ThrottlerGuard)`, so the testing module would otherwise have
 * to resolve the guard's own dependencies — `THROTTLER_OPTIONS` and `ThrottlerStorage` — which
 * these tests neither provide nor care about.
 *
 * Overridden with a permissive stub rather than by supplying the real module: **this file is about
 * the controller handing its body to its service**, and nothing here should pass or fail because of
 * a rate limit. The limit itself is tested against the real guard and the real storage in
 * `common/throttling/throttle.config.spec.ts`, including that these two controllers are the ones
 * carrying it.
 *
 * `TurnstileGuard` is overridden for exactly the same reason and with the same stub: it would
 * otherwise need `TurnstileVerifier`, which needs `ConfigService`, none of which this file is about.
 * The challenge is tested against the real guard and a stubbed verifier in
 * `turnstile/turnstile.guard.spec.ts`, and the verifier against a stubbed `fetch` beside it.
 */
const ALLOW_ALL = { canActivate: (): boolean => true };

describe("Forms controllers", () => {
  it("passes the inquiry body to the service and returns its result unwrapped", async () => {
    const create = jest.fn().mockResolvedValue(RESULT);
    const moduleRef = await Test.createTestingModule({
      controllers: [InquiriesController],
      providers: [{ provide: InquiriesService, useValue: { create } }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(ALLOW_ALL)
      .overrideGuard(TurnstileGuard)
      .useValue(ALLOW_ALL)
      .compile();

    const body = { consentGiven: true } as unknown as CreateInquiryDto;

    await expect(moduleRef.get(InquiriesController).create(body)).resolves.toBe(RESULT);
    expect(create).toHaveBeenCalledWith(body);
  });

  it("passes the formulation body to its own service", async () => {
    const create = jest.fn().mockResolvedValue(RESULT);
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomFormulationRequestsController],
      providers: [{ provide: CustomFormulationRequestsService, useValue: { create } }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(ALLOW_ALL)
      .overrideGuard(TurnstileGuard)
      .useValue(ALLOW_ALL)
      .compile();

    const body = { consentGiven: true } as unknown as CreateCustomFormulationRequestDto;

    await expect(moduleRef.get(CustomFormulationRequestsController).create(body)).resolves.toBe(
      RESULT,
    );
    expect(create).toHaveBeenCalledWith(body);
  });
});

/**
 * A regression guard for a failure that is invisible in review and silent in the type checker.
 *
 * The global ValidationPipe finds the DTO through the `design:paramtypes` metadata TypeScript emits
 * for the handler's parameter annotation. Import the DTO with `import type` and the class is erased:
 * the emitted metatype becomes `Function`, which is not in Nest's skip list, so the pipe validates
 * every body against a class carrying no `class-validator` metadata and answers 400 with each
 * legitimate field reported as "property X should not exist".
 *
 * That is exactly what happened while this gate was being built, and nothing caught it — `tsc`
 * accepts the type-only import, the DTO's own tests still pass because they instantiate the pipe
 * directly, and the service tests never see a request. Only a live POST showed it. These two
 * assertions are the cheapest place to catch it if a later edit reintroduces it.
 */
describe("Forms controllers — DTO metadata reaches the ValidationPipe", () => {
  it.each([
    ["InquiriesController", InquiriesController, CreateInquiryDto],
    [
      "CustomFormulationRequestsController",
      CustomFormulationRequestsController,
      CreateCustomFormulationRequestDto,
    ],
  ])("%s.create declares its DTO class as the runtime metatype", (_name, controller, dto) => {
    const paramTypes: unknown = Reflect.getMetadata(
      "design:paramtypes",
      (controller as { prototype: object }).prototype,
      "create",
    );

    expect(paramTypes).toEqual([dto]);
  });
});
