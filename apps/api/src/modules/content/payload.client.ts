import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";

/**
 * The only place in the platform that knows Payload exists.
 *
 * ── The boundary this class is ──────────────────────────────────────────────
 *
 * ADR-003 and API_CONTRACT_FINAL.md §4 put NestJS in front of Payload: `apps/web` never calls it,
 * the browser never reaches it, and Payload's response shapes are an internal detail. Everything
 * Payload-specific — its origin, its authentication header, its query-string dialect, its
 * `{ docs, totalDocs }` wrapper — is contained here. Nothing above this file imports it, references
 * `PAYLOAD_INTERNAL_URL`, or is written against a Payload shape.
 *
 * ── Two failure kinds, kept apart from the start ────────────────────────────
 *
 * This class never decides that content is absent. It answers with documents or it throws
 * UPSTREAM_UNAVAILABLE; whether "no documents" means a canonical 404 is the service's decision,
 * one level up. That split is the same principle ADR-010 §7 fixes for Product Detail —
 * infrastructure failure must never become a canonical-content 404 — applied at the seam where the
 * two conditions are still distinguishable.
 */

/** Ten seconds, matching `apps/web`'s client. Long enough for a cold Payload process, short enough
 * that a hung CMS cannot hold a request open. */
const TIMEOUT_MS = 10_000;

const UNAVAILABLE_MESSAGE = "The content service is unavailable.";

/** What a Payload collection read returns, reduced to the two fields this application relies on. */
export type PayloadFindResult = {
  readonly docs: readonly Record<string, unknown>[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class PayloadClient {
  private readonly logger = new Logger(PayloadClient.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Whether the CMS is configured at all.
   *
   * Exposed so the service can report the same UPSTREAM_UNAVAILABLE for an unconfigured CMS as for
   * an unreachable one without this class having to guess what the caller wants to do about it.
   */
  isConfigured(): boolean {
    return this.origin() !== "" && this.apiKey() !== "";
  }

  /**
   * One `find` against a Payload collection.
   *
   * @param collection the collection slug, e.g. `pages`.
   * @param query already-decoded query parameters; encoding happens here.
   *
   * @throws ApiException UPSTREAM_UNAVAILABLE (503) for an unconfigured CMS, a transport failure, a
   *   timeout, any non-2xx status, or a 2xx body that is not a Payload find result. **Never throws
   *   NOT_FOUND** — an empty `docs` array is a successful answer and is returned as one.
   */
  async find(
    collection: string,
    query: Readonly<Record<string, string>>,
  ): Promise<PayloadFindResult> {
    if (!this.isConfigured()) {
      this.logger.error(
        "PAYLOAD_INTERNAL_URL and PAYLOAD_API_KEY are not both set; the Content module cannot reach the CMS.",
      );

      throw this.unavailable();
    }

    const url = `${this.origin()}/api/${encodeURIComponent(collection)}?${new URLSearchParams(query).toString()}`;

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          /*
           * Payload's API-key scheme: `<collection slug> API-Key <key>`. This is the "service
           * credential" API_CONTRACT_FINAL.md §4 requires — an identity of its own, never an
           * editor's session and never an end user's JWT, which does not reach this hop at all.
           */
          authorization: `users API-Key ${this.apiKey()}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error: unknown) {
      // Only the stable machine-readable part is logged. A failed fetch's message embeds the full
      // request URL, and the URL carries the CMS origin.
      this.logger.error(`Payload request failed: ${describeTransportFailure(error)}`);

      throw this.unavailable();
    }

    if (!response.ok) {
      /*
       * Every non-2xx is infrastructure, including 401 and 403. A rejected API key is a
       * misconfiguration of this application, not a statement that the page does not exist, and
       * mapping it to 404 would publish "removed" for content that is merely unreachable.
       */
      this.logger.error(`Payload answered ${response.status} for collection "${collection}".`);

      throw this.unavailable();
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      this.logger.error(`Payload answered ${response.status} with a body that is not JSON.`);

      throw this.unavailable();
    }

    if (!isRecord(body) || !Array.isArray(body.docs)) {
      this.logger.error("Payload answered 2xx with a body that is not a find result.");

      throw this.unavailable();
    }

    return { docs: body.docs.filter(isRecord) };
  }

  /** Trailing slashes stripped so composition cannot produce `//api/...`. */
  private origin(): string {
    return this.config.get<string>("payloadInternalUrl", "").replace(/\/+$/, "");
  }

  private apiKey(): string {
    return this.config.get<string>("payloadApiKey", "");
  }

  /**
   * 503 UPSTREAM_UNAVAILABLE — the code API_CONTRACT_FINAL.md §8 already reserves for exactly this,
   * and until now had no thrower. The message names no host, no status and no cause: §8 contracts
   * `message` as safe to display, and the diagnosis belongs in the log above, not on the wire.
   */
  private unavailable(): ApiException {
    return new ApiException(
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorCode.UpstreamUnavailable,
      UNAVAILABLE_MESSAGE,
    );
  }
}

function describeTransportFailure(error: unknown): string {
  if (error instanceof Error) {
    const cause: unknown = error.cause;

    if (isRecord(cause) && typeof cause.code === "string") {
      return cause.code;
    }

    return error.name;
  }

  return "UnknownError";
}
