import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { TURNSTILE_MAX_TOKEN_LENGTH, TurnstileVerifier } from "./turnstile.verifier";

/**
 * Token verification, and above all its five outcomes.
 *
 * The tests that matter most are the ones that assert the control **fails closed**. Every way this
 * check can fail to produce a "yes" — no token, a spent token, a refused token, a network failure,
 * a timeout, a body that is not Cloudflare's envelope, Cloudflare's own `internal-error`, and a
 * production process with no secret — refuses the submission. That is exactly the behaviour a
 * well-meaning "do not lose leads during an outage" change would quietly reverse, so it is asserted
 * rather than described.
 *
 * The single exception is the development bypass, which is asserted to be impossible in production.
 */

const SECRET = "test-secret-key";

async function verifierWith(
  secretKey: string,
  nodeEnv = "development",
): Promise<TurnstileVerifier> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TurnstileVerifier,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string): unknown => (key === "nodeEnv" ? nodeEnv : { secretKey }),
        },
      },
    ],
  }).compile();

  return moduleRef.get(TurnstileVerifier);
}

/** Cloudflare's success/failure envelope, as `fetch` would deliver it. */
function siteverify(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function silenceLogger(): void {
  jest.spyOn(require("@nestjs/common").Logger.prototype, "error").mockImplementation();
  jest.spyOn(require("@nestjs/common").Logger.prototype, "warn").mockImplementation();
}

describe("when no secret is configured", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(["development", "test"])(
    "reports `disabled` outside production (%s) and never calls Cloudflare",
    async (nodeEnv) => {
      silenceLogger();

      const fetchSpy = jest.spyOn(globalThis, "fetch");
      const verifier = await verifierWith("", nodeEnv);

      await expect(verifier.verify("any-token")).resolves.toEqual({ outcome: "disabled" });
      expect(verifier.isConfigured()).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  /**
   * The bypass cannot reach production. `NODE_ENV` is validated at boot against a closed enum, so
   * this is the only other value it can hold, and it refuses rather than accepting unverified
   * submissions.
   */
  it("reports `misconfigured` in production, and refuses rather than accepting", async () => {
    silenceLogger();

    const fetchSpy = jest.spyOn(globalThis, "fetch");

    await expect((await verifierWith("", "production")).verify("any-token")).resolves.toEqual({
      outcome: "misconfigured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("announces the production misconfiguration at error level, once per process", async () => {
    jest.spyOn(require("@nestjs/common").Logger.prototype, "warn").mockImplementation();

    const error = jest
      .spyOn(require("@nestjs/common").Logger.prototype, "error")
      .mockImplementation();
    const verifier = await verifierWith("", "production");

    await verifier.verify(undefined);
    await verifier.verify(undefined);

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("REFUSED");
  });

  it("warns once per process outside production rather than once per submission", async () => {
    const warn = jest
      .spyOn(require("@nestjs/common").Logger.prototype, "warn")
      .mockImplementation();
    const verifier = await verifierWith("");

    await verifier.verify(undefined);
    await verifier.verify(undefined);
    await verifier.verify(undefined);

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("when a secret is configured", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("accepts a token Cloudflare confirms", async () => {
    fetchSpy.mockResolvedValue(siteverify({ success: true }));

    const verifier = await verifierWith(SECRET);

    await expect(verifier.verify("good-token")).resolves.toEqual({ outcome: "verified" });
  });

  it("sends the secret and the token, and nothing about the submitter", async () => {
    fetchSpy.mockResolvedValue(siteverify({ success: true }));

    await (await verifierWith(SECRET)).verify("  good-token  ");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sent = init.body as URLSearchParams;

    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(sent.get("secret")).toBe(SECRET);
    // Trimmed, matching what the header carried.
    expect(sent.get("response")).toBe("good-token");
    // `remoteip` is deliberately not sent — see the note on the verifier.
    expect(sent.get("remoteip")).toBeNull();
    expect([...sent.keys()].sort()).toEqual(["response", "secret"]);
  });

  /** A hung connection must not hold a lead form open until the browser gives up. */
  it("bounds the request with an abort signal", async () => {
    fetchSpy.mockResolvedValue(siteverify({ success: true }));

    await (await verifierWith(SECRET)).verify("good-token");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([undefined, "", "   "])(
    "rejects a missing token (%j) without a round trip",
    async (token) => {
      const verifier = await verifierWith(SECRET);

      await expect(verifier.verify(token)).resolves.toEqual({
        outcome: "rejected",
        errorCodes: ["missing-input-response"],
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  /**
   * Cloudflare documents the response token as at most 2048 characters, so a longer one cannot be
   * genuine. Refusing it here keeps an oversized header from becoming an outbound request billed to
   * our account.
   */
  it("rejects an over-long token without a round trip", async () => {
    const verifier = await verifierWith(SECRET);
    const oversized = "t".repeat(TURNSTILE_MAX_TOKEN_LENGTH + 1);

    await expect(verifier.verify(oversized)).resolves.toEqual({
      outcome: "rejected",
      errorCodes: ["invalid-input-response"],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still asks about a token of exactly the maximum length", async () => {
    fetchSpy.mockResolvedValue(siteverify({ success: true }));

    const verifier = await verifierWith(SECRET);

    await expect(verifier.verify("t".repeat(TURNSTILE_MAX_TOKEN_LENGTH))).resolves.toEqual({
      outcome: "verified",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects a token Cloudflare refuses, and keeps its error codes", async () => {
    fetchSpy.mockResolvedValue(
      siteverify({ success: false, "error-codes": ["invalid-input-response"] }),
    );

    await expect((await verifierWith(SECRET)).verify("bad")).resolves.toEqual({
      outcome: "rejected",
      errorCodes: ["invalid-input-response"],
    });
  });

  /** A token is single-use; a replayed one comes back as `timeout-or-duplicate`. */
  it.each(["timeout-or-duplicate", "invalid-input-secret", "bad-request"])(
    "rejects a token refused with %s",
    async (code) => {
      fetchSpy.mockResolvedValue(siteverify({ success: false, "error-codes": [code] }));

      const result = await (await verifierWith(SECRET)).verify("spent");

      expect(result.outcome).toBe("rejected");
    },
  );
});

/**
 * The control fails closed, asserted so it cannot be reversed by accident.
 *
 * Every row here is our server failing to reach Cloudflare, or Cloudflare answering something that
 * is not a verdict. None of them proves the submitter is human, so none of them accepts the lead.
 */
describe("when Cloudflare cannot answer, the submission is refused", () => {
  let fetchSpy: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
    error = jest.spyOn(require("@nestjs/common").Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refuses when the request throws — refused, DNS, or the 5s timeout", async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error("boom"), { name: "TimeoutError" }));

    await expect((await verifierWith(SECRET)).verify("token")).resolves.toEqual({
      outcome: "unavailable",
    });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("refuses when Cloudflare answers non-2xx", async () => {
    fetchSpy.mockResolvedValue(siteverify({}, 502));

    await expect((await verifierWith(SECRET)).verify("token")).resolves.toEqual({
      outcome: "unavailable",
    });
  });

  it("refuses when the response is not JSON", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect((await verifierWith(SECRET)).verify("token")).resolves.toEqual({
      outcome: "unavailable",
    });
  });

  it.each([{ result: "maybe" }, { success: "true" }, null, "a string"])(
    "refuses when the body carries no boolean `success` flag (%j)",
    async (body) => {
      fetchSpy.mockResolvedValue(siteverify(body));

      await expect((await verifierWith(SECRET)).verify("token")).resolves.toEqual({
        outcome: "unavailable",
      });
    },
  );

  /**
   * Cloudflare documents `internal-error` as its own fault and retryable. It is kept apart from a
   * rejection because it answers 503 rather than 403 — but it refuses either way.
   */
  it("refuses when Cloudflare reports `internal-error`", async () => {
    fetchSpy.mockResolvedValue(siteverify({ success: false, "error-codes": ["internal-error"] }));

    const result = await (await verifierWith(SECRET)).verify("token");

    expect(result.outcome).toBe("unavailable");
  });

  it("logs every occurrence, because the window refuses real leads", async () => {
    fetchSpy.mockRejectedValue(new Error("down"));

    const verifier = await verifierWith(SECRET);

    await verifier.verify("token");
    await verifier.verify("token");

    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0]?.[0])).toContain("REFUSED");
  });

  it("never throws, whatever happens", async () => {
    fetchSpy.mockImplementation(() => {
      throw new Error("synchronous explosion");
    });

    await expect((await verifierWith(SECRET)).verify("token")).resolves.toBeDefined();
  });
});

describe("nothing sensitive reaches a log", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs the failure class and neither the token nor the secret", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const error = jest
      .spyOn(require("@nestjs/common").Logger.prototype, "error")
      .mockImplementation();

    fetchSpy.mockRejectedValue(
      Object.assign(new Error(`connect to ${SECRET}`), { code: "ECONNREFUSED" }),
    );

    await (await verifierWith(SECRET)).verify("super-secret-token");

    const logged = String(error.mock.calls[0]?.[0]);

    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("super-secret-token");
  });

  it("keeps the secret out of the production misconfiguration message", async () => {
    const error = jest
      .spyOn(require("@nestjs/common").Logger.prototype, "error")
      .mockImplementation();

    await (await verifierWith("", "production")).verify("token");

    expect(String(error.mock.calls[0]?.[0])).not.toContain("token");
  });
});
