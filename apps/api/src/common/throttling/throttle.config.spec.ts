import { APP_GUARD, Reflector } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerStorageService } from "@nestjs/throttler";
import { THROTTLER_SKIP } from "@nestjs/throttler/dist/throttler.constants";

import { CategoriesController } from "../../modules/catalog/categories.controller";
import { ProductsController } from "../../modules/catalog/products.controller";
import { AuthController } from "../../modules/identity/auth.controller";
import { CustomFormulationRequestsController } from "../../modules/forms/custom-formulation-requests.controller";
import { InquiriesController } from "../../modules/forms/inquiries.controller";
import { BlogPostsController } from "../../modules/blog/blog-posts.controller";
import { LocalesController } from "../../modules/localization/locales.controller";
import { AllExceptionsFilter } from "../filters/all-exceptions.filter";
import { ErrorCode } from "../http/error-code";

import {
  FORMS_LIMIT,
  FORMS_THROTTLER_NAME,
  FORMS_TTL_MS,
  LOGIN_LIMIT,
  LOGIN_TTL_MS,
  RATE_LIMIT_MESSAGE,
  THROTTLE_OPTIONS,
  generateThrottleKey,
} from "./throttle.config";

import type { ArgumentsHost, ExecutionContext } from "@nestjs/common";

/**
 * The rate limit is exercised against the **real** `ThrottlerGuard` and the **real**
 * `ThrottlerStorageService`, with only the HTTP request and response faked.
 *
 * A test that reimplemented the counting would prove nothing about the library that actually does
 * it. This one drives the guard exactly as Nest does — `canActivate` per request, the configured
 * options injected, one storage instance shared across the calls — so the numbers it asserts are
 * the numbers a real client would meet.
 */

/** A request from one client, and a response that records the headers the guard sets on it. */
function makeContext(
  ip: string,
  controller: new (...args: never[]) => object,
  handlerName: string,
): { context: ExecutionContext; headers: Record<string, unknown> } {
  const headers: Record<string, unknown> = {};

  const request = { ip, headers: { "user-agent": "jest" } };
  const response = {
    header: (name: string, value: unknown): void => {
      headers[name] = value;
    },
  };

  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getHandler: () => ({ name: handlerName }) as unknown as () => unknown,
    getClass: () => controller,
  } as unknown as ExecutionContext;

  return { context, headers };
}

/**
 * Every storage instance a test created, so its timers can be cleared afterwards.
 *
 * `ThrottlerStorageService` schedules one `setTimeout` per hit for the length of the window, and
 * this window is an hour — so without this, Jest holds the process open for an hour after the last
 * assertion. Measured: the first run of this file hung rather than failing. `onApplicationShutdown`
 * is the service's own cleanup, which is what Nest calls in production for the same reason.
 */
const storages: ThrottlerStorageService[] = [];

afterEach(() => {
  for (const storage of storages.splice(0)) {
    storage.onApplicationShutdown();
  }
});

async function createGuard(): Promise<ThrottlerGuard> {
  const storage = new ThrottlerStorageService();

  storages.push(storage);

  const guard = new ThrottlerGuard(THROTTLE_OPTIONS, storage, new Reflector());

  // Nest calls this during bootstrap; it is what normalizes the options into `this.throttlers`.
  await guard.onModuleInit();

  return guard;
}

/** Runs `count` submissions from one client and reports what each attempt answered. */
async function submit(
  guard: ThrottlerGuard,
  ip: string,
  count: number,
  controller: new (...args: never[]) => object = InquiriesController,
  handlerName = "create",
): Promise<("allowed" | "throttled")[]> {
  const outcomes: ("allowed" | "throttled")[] = [];

  for (let attempt = 0; attempt < count; attempt += 1) {
    const { context } = makeContext(ip, controller, handlerName);

    try {
      await guard.canActivate(context);
      outcomes.push("allowed");
    } catch {
      outcomes.push("throttled");
    }
  }

  return outcomes;
}

describe("form submission rate limit", () => {
  it("is the 5 per hour API_CONTRACT_FINAL §Rate limits specifies", () => {
    expect(FORMS_LIMIT).toBe(5);
    expect(FORMS_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("allows five submissions and rejects the sixth", async () => {
    const guard = await createGuard();

    const outcomes = await submit(guard, "203.0.113.10", 6);

    expect(outcomes).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed", "throttled"]);
  });

  it("keeps rejecting after the limit is passed, rather than letting the next one through", async () => {
    const guard = await createGuard();

    const outcomes = await submit(guard, "203.0.113.11", 8);

    expect(outcomes.slice(5)).toEqual(["throttled", "throttled", "throttled"]);
  });

  /**
   * The reason `generateThrottleKey` drops the class and handler. With the library's default key a
   * client could spend five on each path; §Rate limits budgets the endpoint *group*.
   */
  it("shares one budget across both form endpoints", async () => {
    const guard = await createGuard();

    const inquiries = await submit(guard, "203.0.113.12", 3, InquiriesController);
    const formulation = await submit(guard, "203.0.113.12", 3, CustomFormulationRequestsController);

    expect(inquiries).toEqual(["allowed", "allowed", "allowed"]);
    expect(formulation).toEqual(["allowed", "allowed", "throttled"]);
  });

  it("counts each client separately", async () => {
    const guard = await createGuard();

    await submit(guard, "203.0.113.13", 6);
    const other = await submit(guard, "203.0.113.14", 1);

    expect(other).toEqual(["allowed"]);
  });

  it("reports the remaining budget and, once blocked, a Retry-After", async () => {
    const guard = await createGuard();

    const first = makeContext("203.0.113.15", InquiriesController, "create");
    await guard.canActivate(first.context);

    expect(first.headers["X-RateLimit-Limit-forms"]).toBe(FORMS_LIMIT);
    expect(first.headers["X-RateLimit-Remaining-forms"]).toBe(FORMS_LIMIT - 1);
    expect(first.headers["Retry-After-forms"]).toBeUndefined();

    await submit(guard, "203.0.113.15", 4);

    const blocked = makeContext("203.0.113.15", InquiriesController, "create");
    await expect(guard.canActivate(blocked.context)).rejects.toBeDefined();

    expect(blocked.headers["Retry-After-forms"]).toBeGreaterThan(0);
  });

  /**
   * The message on the wire. The library's own default is `"ThrottlerException: Too Many Requests"`,
   * which would name an internal class in a public response.
   */
  it("answers 429 RATE_LIMITED with a message naming nothing internal", async () => {
    const guard = await createGuard();

    await submit(guard, "203.0.113.16", 5);

    const { context } = makeContext("203.0.113.16", InquiriesController, "create");
    const thrown = await guard.canActivate(context).then(
      () => null,
      (error: unknown) => error,
    );

    expect(thrown).not.toBeNull();

    // Rendered through the real filter, so this is the body a client actually receives.
    let status: number | undefined;
    let body: unknown;

    const filter = new AllExceptionsFilter({
      httpAdapter: {
        reply: (_res: unknown, sentBody: unknown, sentStatus: number) => {
          body = sentBody;
          status = sentStatus;
        },
        getRequestMethod: () => "POST",
        getRequestUrl: () => "/api/v1/inquiries",
      },
    } as never);

    filter.catch(thrown, {
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    } as unknown as ArgumentsHost);

    expect(status).toBe(429);
    expect(body).toEqual({ error: { code: ErrorCode.RateLimited, message: RATE_LIMIT_MESSAGE } });
    expect(JSON.stringify(body)).not.toContain("ThrottlerException");
    expect(JSON.stringify(body)).not.toContain(String(FORMS_LIMIT));
  });

  it("hashes the tracker rather than keying on the raw address", () => {
    const key = generateThrottleKey(null, "203.0.113.17", FORMS_THROTTLER_NAME);

    expect(key).not.toContain("203.0.113.17");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

/**
 * The other half of the requirement: the limit must not reach the read endpoints.
 *
 * Asserted on the guard *metadata* rather than by counting requests, because that is where the
 * mistake would actually be made — an `APP_GUARD` registration in `AppModule`, or a stray
 * `@UseGuards` on a read controller. Both would be invisible to a test that only drove the two
 * write paths.
 */
describe("rate limiting is scoped to the write endpoints", () => {
  const guardsOn = (target: object): unknown[] =>
    (Reflect.getMetadata("__guards__", target) as unknown[] | undefined) ?? [];

  it.each([
    ["InquiriesController", InquiriesController],
    ["CustomFormulationRequestsController", CustomFormulationRequestsController],
  ])("%s is guarded", (_name, controller) => {
    expect(guardsOn(controller)).toContain(ThrottlerGuard);
  });

  it.each([
    ["ProductsController", ProductsController],
    ["CategoriesController", CategoriesController],
    ["BlogPostsController", BlogPostsController],
    ["LocalesController", LocalesController],
  ])("%s is not throttled", (_name, controller) => {
    expect(guardsOn(controller)).not.toContain(ThrottlerGuard);
  });

  /**
   * A global registration would throttle every public GET at 5/hour — the failure this whole
   * arrangement exists to avoid. `AppModule` must register the module and never the guard.
   */
  it("registers no global guard", () => {
    /*
     * Loaded with `require` inside the test rather than imported at the top, and given an
     * environment first. `ConfigModule.forRoot` validates eagerly — it runs while `AppModule`'s
     * decorator is evaluated, not at Nest bootstrap — so a top-level import of this module throws
     * `API_PORT has failed the following constraints` before a single assertion runs. Measured, not
     * assumed. The values below are placeholders that satisfy `env.validation.ts` and reach nothing:
     * no Nest application is created here and no connection is opened.
     */
    process.env.API_PORT ??= "3001";
    process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:5432/sam_platform";
    // Required since the Identity module: long enough to satisfy the length floor, and a
    // placeholder that signs nothing — no token is issued anywhere in this file.
    process.env.JWT_SECRET ??= "test-placeholder-signing-secret-32-chars";

    const { AppModule } = require("../../app.module") as { AppModule: object };

    const providers =
      (Reflect.getMetadata("providers", AppModule) as { provide?: unknown }[] | undefined) ?? [];

    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((provider) => provider.provide === APP_GUARD)).toBe(false);
  });
});

/**
 * The login limit, and — more importantly — the isolation between the two budgets.
 *
 * These run against the same real `ThrottlerGuard` and real storage as the block above, with the
 * real controllers, so the `@SkipThrottle` decorators on those controllers are the ones being
 * exercised. That is the point: the guard evaluates **every** named throttler on every route it
 * guards, so adding the login policy silently narrows the form endpoints unless each side skips the
 * other — a regression no functional test of either endpoint on its own would catch.
 */
describe("login rate limit", () => {
  it("is the 5 per 15 minutes API_CONTRACT_FINAL §Rate limits specifies", () => {
    expect(LOGIN_LIMIT).toBe(5);
    expect(LOGIN_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("allows five login attempts and rejects the sixth", async () => {
    const guard = await createGuard();

    const outcomes = await submit(guard, "203.0.113.20", 6, AuthController, "login");

    expect(outcomes).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed", "throttled"]);
  });

  it("does not spend the form-submission budget", async () => {
    const guard = await createGuard();

    // Exhaust login for this client, then submit a form as the same client.
    await submit(guard, "203.0.113.21", 6, AuthController, "login");
    const forms = await submit(guard, "203.0.113.21", 5, InquiriesController);

    expect(forms).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed"]);
  });

  it("is not spent by form submissions", async () => {
    const guard = await createGuard();

    await submit(guard, "203.0.113.22", 6, InquiriesController);
    const logins = await submit(guard, "203.0.113.22", 5, AuthController, "login");

    expect(logins).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed"]);
  });

  it("reports only its own budget in the response headers", async () => {
    const guard = await createGuard();

    const { context, headers } = makeContext("203.0.113.23", AuthController, "login");
    await guard.canActivate(context);

    expect(headers["X-RateLimit-Limit-login"]).toBe(LOGIN_LIMIT);
    // The forms throttler is skipped on this controller, so it sets no header and counts nothing.
    expect(headers["X-RateLimit-Limit-forms"]).toBeUndefined();
  });

  it("leaves the form endpoints reporting only theirs", async () => {
    const guard = await createGuard();

    const { context, headers } = makeContext("203.0.113.24", InquiriesController, "create");
    await guard.canActivate(context);

    expect(headers["X-RateLimit-Limit-forms"]).toBe(FORMS_LIMIT);
    expect(headers["X-RateLimit-Limit-login"]).toBeUndefined();
  });

  it("keys the two budgets separately even for one client", () => {
    const formsKey = generateThrottleKey(null, "203.0.113.25", FORMS_THROTTLER_NAME);
    const loginKey = generateThrottleKey(null, "203.0.113.25", "login");

    expect(formsKey).not.toBe(loginKey);
  });
});

/**
 * The two session endpoints ADR-012 added, and the reason neither is throttled.
 *
 * §Rate limits budgets seven endpoint groups and refresh is in none of them, so there is no
 * documented policy to transcribe. Attaching login's 5-per-15-minutes would cap a legitimate
 * session at five renewals per quarter hour across every tab a user has open — a limit on ordinary
 * use rather than on abuse — and inventing a separate budget would be inventing contract. Neither
 * endpoint is a guessing surface the way login is: there is no account to enumerate and no password
 * to try, only a 256-bit random value that request volume does not bring within reach.
 *
 * Asserted rather than described, because "we chose not to" and "we forgot" look identical in a
 * diff, and because attaching a guard here would silently narrow the two form endpoints too.
 */
describe("the session endpoints are outside both budgets", () => {
  const handlerGuards = (handler: unknown): unknown[] =>
    (Reflect.getMetadata("__guards__", handler as object) as unknown[] | undefined) ?? [];

  it.each([
    ["refresh", AuthController.prototype.refresh],
    ["logout", AuthController.prototype.logout],
  ])("POST /auth/%s carries no throttler", (_name, handler) => {
    expect(handlerGuards(handler)).not.toContain(ThrottlerGuard);
  });

  it("leaves the login limit where it is — on login alone", () => {
    expect(handlerGuards(AuthController.prototype.login)).toContain(ThrottlerGuard);
  });

  /**
   * The class-level skip still applies to every handler on the controller, so neither new endpoint
   * can reach the forms bucket even if a throttler were attached to it later.
   */
  it("keeps the whole auth controller out of the forms bucket", () => {
    // `@SkipThrottle({ forms: true })` writes one key per throttler name, `THROTTLER:SKIP` with the
    // name appended — read from the library's own constant rather than restated, so a rename
    // upstream breaks this test instead of silently making it vacuous.
    const skipped = Reflect.getMetadata(
      `${THROTTLER_SKIP}${FORMS_THROTTLER_NAME}`,
      AuthController,
    ) as boolean | undefined;

    expect(skipped).toBe(true);
  });
});
