import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";

import type { MailConfig } from "../../../config/configuration";
import type { LeadNotification } from "./lead-notification.message";
import type { Transporter } from "nodemailer";

/**
 * The only file in the platform that knows nodemailer exists.
 *
 * ── Why the boundary is here ────────────────────────────────────────────────
 *
 * `LeadNotificationService` decides *whether* and *what* to notify; this decides *how* it leaves
 * the process. Nothing above it names SMTP, a transport option, or a nodemailer type, so replacing
 * the relay with an HTTP transactional provider later is this file plus its spec — the Forms
 * services, the controllers and the API contract are untouched by that change. The same shape
 * `PayloadClient` has for the CMS hop, for the same reason.
 *
 * ── The 5-second budget ─────────────────────────────────────────────────────
 *
 * Approved: a mail attempt is bounded at 5 seconds, and the notification is awaited inside the
 * request. So a dead relay adds **up to ~5 seconds** to a form submission's response and never more
 * — the lead is already committed by the time this is called, so the only thing at risk is latency.
 *
 * The bound is enforced twice, deliberately. nodemailer's own `connectionTimeout` /
 * `greetingTimeout` / `socketTimeout` each cap one *phase*, and a relay that answers every phase
 * slowly can exceed their sum; `withTimeout` below caps the **whole** attempt, which is the number
 * that was actually approved.
 *
 * ── This class writes nothing to the log ────────────────────────────────────
 *
 * Not an omission. Everything it could report — host, port, TLS mode, whether a credential is in
 * use, the recipient — is relay infrastructure detail with no operational value in a per-lead
 * stream, and each line of it is one more place a deployment detail can end up in an aggregated
 * log. It **throws** instead, and `LeadNotificationService` writes the one line that matters:
 * submission id, notification kind, mechanism, outcome, and the failure's class and code.
 */
export const MAIL_TIMEOUT_MS = 5_000;

/** Raised when the 5-second budget expires. Named so the log can report a class, not a message. */
export class MailTimeoutError extends Error {
  constructor() {
    super(`Mail delivery exceeded ${MAIL_TIMEOUT_MS}ms`);
    this.name = "MailTimeoutError";
  }
}

/**
 * Why the configuration is incomplete, in terms of variable names only.
 *
 * **Names, never values.** `LeadNotificationService` puts this string in the log line it writes
 * when a notification is skipped, and SECURITY.md §Secrets Management treats container logs as a
 * place secrets must not appear. `SMTP_PASSWORD` as a *name* is safe to print; its value is never
 * read into this string, never interpolated into an error, and never compared in a message.
 */
function describeIncompleteConfig(mail: MailConfig): string | undefined {
  const missing: string[] = [];

  if (mail.smtpHost === "") {
    missing.push("SMTP_HOST");
  }

  if (mail.smtpPort === 0) {
    missing.push("SMTP_PORT");
  }

  if (mail.from === "") {
    missing.push("MAIL_FROM");
  }

  if (mail.leadNotificationTo === "") {
    missing.push("LEAD_NOTIFICATION_TO");
  }

  if (missing.length > 0) {
    return `missing ${missing.join(", ")}`;
  }

  /*
   * Authentication is optional as a pair — an internal relay that accepts unauthenticated
   * submission from the application network is a legitimate deployment. Half a pair is not: it is
   * a half-finished configuration, and attempting the connection anyway would produce an
   * authentication failure per submission instead of one clear line at boot.
   */
  const hasUser = mail.smtpUser !== "";
  const hasPassword = mail.smtpPassword !== "";

  if (hasUser !== hasPassword) {
    return "SMTP_USER and SMTP_PASSWORD must be set together, or both left unset";
  }

  return undefined;
}

/**
 * Caps an operation at `ms`, whatever it is doing.
 *
 * `Promise.race` attaches handlers to both promises, so a rejection arriving from the losing side
 * afterwards is already handled and can never surface as an unhandled rejection. The timer is
 * cleared on every exit path, and `unref` keeps a pending one from holding the process open during
 * shutdown.
 */
async function withTimeout<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new MailTimeoutError()), ms);
    timer.unref();
  });

  try {
    return await Promise.race([operation, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class SmtpMailer {
  /**
   * Created on first use, then reused. `createTransport` opens no socket — it builds a pool
   * definition — so a configured-but-never-used relay costs nothing, and an unconfigured one is
   * never constructed at all.
   */
  private transporter: Transporter | undefined;

  constructor(private readonly config: ConfigService) {}

  /**
   * Whether a send can be attempted at all.
   *
   * Called per notification rather than cached, so a deployment that fixes its environment and
   * restarts is the only thing that changes behaviour — and so a test can vary configuration
   * without rebuilding the provider.
   */
  isConfigured(): boolean {
    return describeIncompleteConfig(this.mail()) === undefined;
  }

  /**
   * The reason `isConfigured()` is false, for logging. `undefined` when it is true.
   *
   * Variable names only — see `describeIncompleteConfig`.
   */
  configurationIssue(): string | undefined {
    return describeIncompleteConfig(this.mail());
  }

  /**
   * Sends one notification, or throws.
   *
   * **Throwing is correct here and is the whole point of the split**: this class reports what
   * happened on the wire, and `LeadNotificationService` — which knows a lead is already committed —
   * is the one that decides a failure is survivable. Callers other than that service do not exist.
   *
   * @throws MailTimeoutError when the 5-second budget expires.
   * @throws Error whatever nodemailer raises for a refused connection, a rejected credential, an
   *   unknown recipient, or a TLS failure.
   */
  async send(notification: LeadNotification): Promise<void> {
    const mail = this.mail();

    await withTimeout(
      this.transport(mail).sendMail({
        from: mail.from,
        to: mail.leadNotificationTo,
        /*
         * CR and LF removed, and nothing else. No submitted value reaches the subject today — it is
         * built from a closed label map — but a header is the one field where a newline is an
         * injection rather than a formatting artefact, and this makes that structural instead of
         * something a future edit has to remember.
         */
        subject: notification.subject.replace(/[\r\n]+/g, " "),
        /*
         * `text` only. No `html` key is set here and `LeadNotification` has no field to supply one,
         * so the message cannot carry an executable part built from public input.
         */
        text: notification.text,
      }),
      MAIL_TIMEOUT_MS,
    );
  }

  private transport(mail: MailConfig): Transporter {
    if (this.transporter === undefined) {
      this.transporter = createTransport({
        host: mail.smtpHost,
        port: mail.smtpPort,
        // Implicit TLS (465). False is a plain connection that STARTTLS-upgrades opportunistically,
        // which is what a submission relay on 587 expects.
        secure: mail.smtpSecure,
        // Undefined rather than an empty pair, so nodemailer skips AUTH entirely on a relay that
        // does not want it. `describeIncompleteConfig` has already rejected a half-set pair.
        auth: mail.smtpUser === "" ? undefined : { user: mail.smtpUser, pass: mail.smtpPassword },
        connectionTimeout: MAIL_TIMEOUT_MS,
        greetingTimeout: MAIL_TIMEOUT_MS,
        socketTimeout: MAIL_TIMEOUT_MS,
      });
    }

    return this.transporter;
  }

  private mail(): MailConfig {
    return this.config.get<MailConfig>("mail", {
      smtpHost: "",
      smtpPort: 0,
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      from: "",
      leadNotificationTo: "",
    });
  }
}
