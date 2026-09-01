import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { TurnstileConfig } from "../../../config/configuration";

/**
 * Cloudflare Turnstile token verification — the only file in the platform that knows Turnstile
 * exists as a service.
 *
 * ── Why the check lives in `apps/api` and not in `apps/web` ─────────────────
 *
 * `POST /inquiries` and `POST /custom-formulation-requests` are **public and unauthenticated**.
 * A check that ran only inside the Next.js Server Action would protect the form and nothing else:
 * anyone who knows the endpoint could post directly to NestJS and never encounter it. The API is
 * the security boundary — it is where rate limiting already lives, and ADR-003 makes it the only
 * public surface — so this is where the token has to be proven.
 *
 * ── The five outcomes ───────────────────────────────────────────────────────
 *
 * | Condition                                                 | Result          | Submission  |
 * | --------------------------------------------------------- | --------------- | ----------- |
 * | Token accepted by Cloudflare                               | `verified`      | accepted    |
 * | Token absent, empty, over-long, or refused by Cloudflare    | `rejected`      | **refused** |
 * | Cloudflare unreachable, timed out, non-2xx, or unreadable   | `unavailable`   | **refused** |
 * | `TURNSTILE_SECRET_KEY` unset **in production**              | `misconfigured` | **refused** |
 * | `TURNSTILE_SECRET_KEY` unset **outside production**         | `disabled`      | accepted    |
 *
 * **The control fails closed.** Only two paths let a submission past this file: Cloudflare said
 * yes, or the process is not a production process and no secret is configured. Everything else —
 * a missing token, a replayed token, a network failure, a timeout, a body that is not the envelope
 * Cloudflare documents, Cloudflare reporting its own `internal-error` — refuses.
 *
 * That is a deliberate trade with a cost worth naming: **while Cloudflare is unreachable, lead
 * capture through the two public forms stops.** The alternative — accepting unverified submissions
 * for the duration of a third party's incident — is a control an attacker can aim at, because the
 * state that switches it off is a network condition rather than a token they have to solve. A
 * control that a bad enough day turns off is not a control. Every occurrence is logged at error
 * level so the window is visible rather than silent, and the API answers 503 (see `TurnstileGuard`)
 * so the form can tell the visitor the service is not responding rather than that they were
 * refused.
 *
 * ── The development bypass, and why it cannot reach production ──────────────
 *
 * `disabled` is the one outcome that accepts a submission without a verified token, and it needs
 * **both** an unset secret **and** a `NODE_ENV` that is not `production`. `NODE_ENV` is validated at
 * boot against a closed enum (`env.validation.ts`), so the value is `development`, `production` or
 * `test` and nothing else — there is no third state a deployment can drift into. A production
 * process with no secret produces `misconfigured` and refuses every submission.
 *
 * There is deliberately **no environment variable that switches the check off**. One would be a
 * switch an operator could set in production, which is exactly what this arrangement removes.
 *
 * The API still **boots** without the secret, on purpose: refusing to start would take the catalog,
 * the blog and every read endpoint down over an anti-spam control. Failing safe here means refusing
 * the two protected writes, not refusing to serve the site.
 *
 * ── Nothing about the submitter is sent, and nothing is logged ──────────────
 *
 * The request body is the secret and the token. **The remote IP is deliberately not sent**, even
 * though Turnstile accepts it: `trust proxy` is not configured (see `throttle.config.ts`), so
 * behind ADR-005's nginx `req.ip` is the proxy's address — sending it would either be a useless
 * constant or, once `trust proxy` is enabled, a client-writable value. It adds nothing to a check
 * whose token is already single-use.
 *
 * No log line here carries the token, the secret, the submitter's address or any field of the
 * submission — the same rule `SmtpMailer` and `PayloadClient` keep. Cloudflare's `error-codes` are
 * machine-readable and safe to print, and they are the only detail that reaches a log.
 */

/** What the verifier concluded. Five states, kept apart because they mean different things. */
export type TurnstileOutcome =
  "verified" | "rejected" | "unavailable" | "misconfigured" | "disabled";

export type TurnstileResult = {
  readonly outcome: TurnstileOutcome;
  /** Cloudflare's own `error-codes`, when it answered with any. Safe to log; never shown publicly. */
  readonly errorCodes?: readonly string[];
};

/**
 * Cloudflare's verification endpoint. A constant rather than configuration: it is Cloudflare's
 * address, not ours, and an environment able to redirect it would be an environment able to
 * disable the check by pointing it at something that always says yes.
 */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Five seconds, the same budget `SmtpMailer` uses and for the same reason.
 *
 * Unlike mail, this one is **in front of** the write rather than after it, so it is latency a
 * submitter actually waits through. Cloudflare answers in tens of milliseconds in practice; the cap
 * exists so a hung connection is abandoned in five seconds rather than holding the request open
 * until the client gives up.
 */
export const TURNSTILE_TIMEOUT_MS = 5_000;

/**
 * The longest token this file will spend a round trip on.
 *
 * Cloudflare documents the response token as at most 2048 characters, so anything longer cannot be
 * one of its tokens. Refusing it here keeps an oversized header from becoming an outbound request
 * on our account — the same reason an absent token is refused without asking.
 */
export const TURNSTILE_MAX_TOKEN_LENGTH = 2048;

@Injectable()
export class TurnstileVerifier {
  private readonly logger = new Logger(TurnstileVerifier.name);

  /** Announced once per process rather than per submission — an unset secret is a state, not an event. */
  private announcedUnconfigured = false;

  constructor(private readonly config: ConfigService) {}

  /** True when a secret is configured. */
  isConfigured(): boolean {
    return this.secret() !== "";
  }

  private secret(): string {
    return this.config.get<TurnstileConfig>("turnstile")?.secretKey ?? "";
  }

  /**
   * True when this is a production process.
   *
   * Read through configuration rather than from `process.env` directly, so it is the same value the
   * rest of the application sees and the one `env.validation.ts` has already checked.
   */
  private isProduction(): boolean {
    return this.config.get<string>("nodeEnv") === "production";
  }

  /**
   * Verify one token. **Never throws** — every failure is one of the five outcomes above, because a
   * thrown error here would become a 500 on a lead form rather than the answer the guard maps.
   */
  async verify(token: string | undefined): Promise<TurnstileResult> {
    const secret = this.secret();

    if (secret === "") {
      return this.unconfigured();
    }

    if (token === undefined || token.trim() === "") {
      // No round trip: an absent token cannot be valid, and asking Cloudflare would turn every
      // unprotected bot request into an outbound request of our own.
      return { outcome: "rejected", errorCodes: ["missing-input-response"] };
    }

    const candidate = token.trim();

    if (candidate.length > TURNSTILE_MAX_TOKEN_LENGTH) {
      return { outcome: "rejected", errorCodes: ["invalid-input-response"] };
    }

    let response: Response;

    try {
      response = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: candidate }),
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      return this.unavailable(`the request failed (${describeFailure(error)})`);
    }

    if (!response.ok) {
      return this.unavailable(`Cloudflare answered HTTP ${String(response.status)}`);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      return this.unavailable("the response was not JSON");
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { success?: unknown }).success !== "boolean"
    ) {
      return this.unavailable("the response carried no `success` flag");
    }

    const { success, "error-codes": rawCodes } = body as {
      success: boolean;
      "error-codes"?: unknown;
    };

    const errorCodes = Array.isArray(rawCodes)
      ? rawCodes.filter((code): code is string => typeof code === "string")
      : [];

    if (success) {
      return { outcome: "verified" };
    }

    /*
     * `internal-error` is Cloudflare documenting its own fault as retryable rather than reporting a
     * bad token, so it is the provider being unavailable rather than the submitter being refused.
     * Both outcomes refuse the submission; they stay apart because they answer with different
     * statuses and because only one of them is an incident worth investigating.
     *
     * Everything else — an invalid, expired or already-redeemed (`timeout-or-duplicate`) token, or
     * a secret that does not match the site key — is a genuine rejection.
     */
    if (errorCodes.includes("internal-error")) {
      return { ...this.unavailable("Cloudflare answered `internal-error`"), errorCodes };
    }

    return { outcome: "rejected", errorCodes };
  }

  /**
   * No secret configured. Outside production that is the developer default and the check stands
   * down; in production it is a misconfiguration, and every submission is refused rather than
   * quietly accepted unverified.
   */
  private unconfigured(): TurnstileResult {
    if (this.isProduction()) {
      if (!this.announcedUnconfigured) {
        this.announcedUnconfigured = true;
        this.logger.error(
          "TURNSTILE_SECRET_KEY is not set in a production process — every public form submission " +
            "is being REFUSED. Configure it, together with the matching site key in apps/web.",
        );
      }

      return { outcome: "misconfigured" };
    }

    if (!this.announcedUnconfigured) {
      this.announcedUnconfigured = true;
      this.logger.warn(
        "Turnstile verification is DISABLED — TURNSTILE_SECRET_KEY is not set and this is not a " +
          "production process. Public form submissions are protected by rate limiting alone. " +
          "A production process without the secret refuses them instead.",
      );
    }

    return { outcome: "disabled" };
  }

  /** Logged on every occurrence: this window refuses real leads, so it is an incident, not a state. */
  private unavailable(reason: string): TurnstileResult {
    this.logger.error(
      `Turnstile verification unavailable (${reason}) — the submission was REFUSED. ` +
        "Public form submissions fail while this persists.",
    );

    return { outcome: "unavailable" };
  }
}

/**
 * The class and code of a transport failure, never its message.
 *
 * Same reasoning as `describeMailFailure` and `describeTransportFailure`: a fetch error's message
 * can embed the request URL, and the stable machine-readable parts carry none of it.
 */
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";

  const parts: string[] = [error.name];
  const candidate = error as Error & { code?: unknown };

  if (typeof candidate.code === "string") parts.push(candidate.code);

  return parts.join(" ");
}
