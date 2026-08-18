import { Injectable, Logger } from "@nestjs/common";

import {
  buildCustomFormulationNotification,
  buildInquiryNotification,
} from "./lead-notification.message";
import { SmtpMailer } from "./smtp.mailer";

import type {
  CustomFormulationNotificationInput,
  InquiryNotificationInput,
  LeadNotification,
} from "./lead-notification.message";

/**
 * Which form a notification came from. Appears in the log line and nowhere else — it is not a
 * status, not persisted, and no column corresponds to it.
 */
export type LeadNotificationKind = "inquiry" | "custom_formulation_request";

/** Named in every log line so a future second mechanism is distinguishable in the same stream. */
const MECHANISM = "smtp";

/**
 * The class and code of a failure, and never its message.
 *
 * A nodemailer error's `message` embeds the server's own response text, which routinely echoes the
 * envelope — the recipient mailbox, sometimes the authenticating user. `name`, `code` and
 * `responseCode` are the stable machine-readable parts and carry none of it. Same reasoning as
 * `describeTransportFailure` in `payload.client.ts`.
 */
function describeMailFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const parts: string[] = [error.name];
  const candidate = error as Error & { code?: unknown; responseCode?: unknown };

  if (typeof candidate.code === "string") {
    parts.push(candidate.code);
  }

  if (typeof candidate.responseCode === "number") {
    parts.push(String(candidate.responseCode));
  }

  return parts.join(" ");
}

/**
 * The lead-notification boundary — **the only class permitted to decide that a mail failure does
 * not matter.**
 *
 * ── The contract, and why it is absolute ────────────────────────────────────
 *
 * **No method here ever throws.** By the time one is called the lead is already committed: the row
 * exists, the id it returns is real, and the submitter is owed a 201 whatever happens next. A
 * rejection escaping this class would turn a delivery problem into a lost lead, which is the single
 * outcome every document covering this gate forbids (API_CONTRACT_FINAL.md §5, "a delivery failure
 * must never invalidate, reject or lose an already-persisted inquiry").
 *
 * So `deliver` catches everything — a refused connection, a rejected credential, the 5-second
 * timeout, and a bug in the template builder alike. The builder is called **inside** the try for
 * exactly that last case: a message this module fails to render is still not a reason to fail a
 * submission that succeeded.
 *
 * ── Awaited, not detached ───────────────────────────────────────────────────
 *
 * The Forms service awaits this, so the attempt finishes before the response is written and no
 * promise is left running against a process that may be shutting down. The cost is latency —
 * bounded at `MAIL_TIMEOUT_MS`, ~5 seconds worst case — and the benefit is that "notified" is not a
 * claim the platform makes and then silently drops on deploy. A detached promise would trade a
 * measurable delay for an unmeasurable loss.
 *
 * Making that asynchronous properly needs a queue and a durable delivery record, which is a
 * separate architecture gate and is deliberately not started here.
 *
 * ── One attempt, no retries ─────────────────────────────────────────────────
 *
 * Phase 1 sends once. There is no retry, no backoff, no queue, no scheduler and no delivery state
 * in the database — so a failed notification is a log line and nothing else, and the lead is
 * recovered from `inquiries` / `custom_formulation_requests`, which is where it already is.
 */
@Injectable()
export class LeadNotificationService {
  private readonly logger = new Logger(LeadNotificationService.name);

  constructor(private readonly mailer: SmtpMailer) {}

  /** Never throws. See the class note. */
  async notifyInquiry(input: InquiryNotificationInput): Promise<void> {
    await this.deliver("inquiry", input.id, () => buildInquiryNotification(input));
  }

  /** Never throws. See the class note. */
  async notifyCustomFormulationRequest(input: CustomFormulationNotificationInput): Promise<void> {
    await this.deliver("custom_formulation_request", input.id, () =>
      buildCustomFormulationNotification(input),
    );
  }

  /**
   * Every log line carries the submission id, so an operator reading a failure can find the lead
   * that survived it. Nothing else about the submission is logged: no name, no company, no email
   * address, no recipient mailbox and no part of the message body. The id is enough to retrieve all
   * of it from the database, which is the access-controlled place it belongs.
   */
  private async deliver(
    kind: LeadNotificationKind,
    submissionId: string,
    build: () => LeadNotification,
  ): Promise<void> {
    const context = `submissionId=${submissionId} kind=${kind} mechanism=${MECHANISM}`;
    const issue = this.mailer.configurationIssue();

    if (issue !== undefined) {
      /*
       * Not a warning, and not an error. An unconfigured relay is the platform's own current state
       * — no mailbox has been supplied yet — and logging every submission at error level would
       * train operators to ignore the one that matters.
       */
      this.logger.log(`Lead notification skipped: mail unconfigured (${issue}). ${context}`);

      return;
    }

    try {
      await this.mailer.send(build());

      this.logger.log(`Lead notification sent. ${context}`);
    } catch (error: unknown) {
      /*
       * Error level, and it stops here. The submission is already persisted and already answered;
       * this line is the operational record that a real lead exists which nobody was told about.
       */
      this.logger.error(
        `Lead notification failed: ${describeMailFailure(error)}. ${context} — the submission is persisted and unaffected.`,
      );
    }
  }
}
