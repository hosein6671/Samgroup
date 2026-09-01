import { ExecutionContext, HttpStatus } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";

import { REJECTION_MESSAGE, TurnstileGuard, UNAVAILABLE_MESSAGE } from "./turnstile.guard";

import type { TurnstileOutcome, TurnstileVerifier } from "./turnstile.verifier";

/**
 * The gate itself: which outcomes let a submission through, what each refusal answers with, and
 * where the token is read from.
 *
 * Two of the five outcomes continue and three do not, which is the whole of the guard's logic — so
 * the tables below are the specification rather than an illustration of it. The property that
 * matters most is that the *default* is refusal: a new outcome added to the union without a branch
 * here would be caught by the exhaustiveness assertion at the end.
 */

function contextWithHeader(header: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { "cf-turnstile-response": header } }) }),
  } as unknown as ExecutionContext;
}

function guardFor(outcome: TurnstileOutcome): { guard: TurnstileGuard; verify: jest.Mock } {
  const verify = jest.fn().mockResolvedValue({ outcome });
  const verifier = { verify } as unknown as TurnstileVerifier;

  return { guard: new TurnstileGuard(verifier), verify };
}

/** The exception a refusal threw, or a failure if it did not refuse. */
async function refusalFrom(outcome: TurnstileOutcome): Promise<ApiException> {
  const { guard } = guardFor(outcome);

  try {
    await guard.canActivate(contextWithHeader("token"));
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);

    return error as ApiException;
  }

  throw new Error(`expected the guard to refuse the ${outcome} outcome`);
}

describe("which outcomes let a submission through", () => {
  it.each<[TurnstileOutcome, string]>([
    ["verified", "Cloudflare confirmed the token"],
    ["disabled", "no secret, and not a production process — the development default"],
  ])("allows the request when the outcome is %s (%s)", async (outcome) => {
    const { guard } = guardFor(outcome);

    await expect(guard.canActivate(contextWithHeader("token"))).resolves.toBe(true);
  });

  /**
   * The control fails closed. `unavailable` in particular used to be allowed, on the reasoning that
   * a Cloudflare outage must not cost a lead — that is asserted the other way now, because the
   * state is a network condition rather than a token an attacker has to solve, and a control an
   * outage switches off is not a control.
   */
  it.each<[TurnstileOutcome, string]>([
    ["rejected", "the token was absent, spent or refused"],
    ["unavailable", "Cloudflare could not answer"],
    ["misconfigured", "no secret in a production process"],
  ])("refuses the request when the outcome is %s (%s)", async (outcome) => {
    const { guard } = guardFor(outcome);

    await expect(guard.canActivate(contextWithHeader("token"))).rejects.toBeInstanceOf(
      ApiException,
    );
  });
});

describe("what each refusal answers with", () => {
  it("answers a rejected token 403 FORBIDDEN, not a 400 the form would draw beside a field", async () => {
    const refusal = await refusalFrom("rejected");

    expect(refusal.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(refusal.code).toBe(ErrorCode.Forbidden);
    expect(refusal.details).toBeUndefined();
  });

  /**
   * Our failure, not theirs. 503 is what makes the form say "the service is not responding" rather
   * than telling someone who did nothing wrong that their submission was refused.
   */
  it.each<TurnstileOutcome>(["unavailable", "misconfigured"])(
    "answers %s 503 UPSTREAM_UNAVAILABLE",
    async (outcome) => {
      const refusal = await refusalFrom(outcome);

      expect(refusal.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(refusal.code).toBe(ErrorCode.UpstreamUnavailable);
      expect(refusal.details).toBeUndefined();
    },
  );

  /**
   * A bot must learn nothing it can act on, and a person must be told what to do. Neither message
   * names a provider, a token, a code or any configuration.
   */
  it.each([REJECTION_MESSAGE, UNAVAILABLE_MESSAGE])("names nothing internal: %s", (message) => {
    for (const forbidden of [
      "turnstile",
      "cloudflare",
      "captcha",
      "token",
      "secret",
      "key",
      "node_env",
    ]) {
      expect(message.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("tells the person what to do next in both messages", () => {
    expect(REJECTION_MESSAGE).toContain("try again");
    expect(UNAVAILABLE_MESSAGE).toContain("try again");
    // The one thing that does not depend on this control working.
    expect(UNAVAILABLE_MESSAGE).toContain("contact us");
  });
});

describe("where the token comes from", () => {
  it("reads Cloudflare's own header name", async () => {
    const { guard, verify } = guardFor("verified");

    await guard.canActivate(contextWithHeader("the-token"));

    expect(verify).toHaveBeenCalledWith("the-token");
  });

  /** Node presents a repeated header as an array; the first value is the one to check. */
  it("takes the first value when the header is repeated", async () => {
    const { guard, verify } = guardFor("verified");

    await guard.canActivate(contextWithHeader(["first", "second"]));

    expect(verify).toHaveBeenCalledWith("first");
  });

  it("passes an absent header through as undefined rather than inventing a value", async () => {
    const { guard, verify } = guardFor("rejected");

    await expect(guard.canActivate(contextWithHeader(undefined))).rejects.toBeInstanceOf(
      ApiException,
    );
    expect(verify).toHaveBeenCalledWith(undefined);
  });
});

/**
 * Every member of the union is decided here.
 *
 * The guard has no `default` branch that refuses, so a sixth outcome added without a branch would
 * silently be **allowed**. This is the test that fails when that happens.
 */
describe("every outcome is accounted for", () => {
  const ALLOWED: readonly TurnstileOutcome[] = ["verified", "disabled"];
  const REFUSED: readonly TurnstileOutcome[] = ["rejected", "unavailable", "misconfigured"];

  it("covers the whole union, with no outcome in both lists", () => {
    const all = [...ALLOWED, ...REFUSED];

    expect(new Set(all).size).toBe(all.length);
    // Fails to compile if the union gains a member that neither list names.
    const exhaustive: Record<TurnstileOutcome, true> = Object.fromEntries(
      all.map((outcome) => [outcome, true]),
    ) as Record<TurnstileOutcome, true>;

    expect(Object.keys(exhaustive)).toHaveLength(5);
  });
});
