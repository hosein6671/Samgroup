import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import type { EmailAdapter, Payload } from "payload";

/**
 * Outbound mail for Payload: its own messages (an admin's password reset) and the owner's alert
 * when a page is published from /admin. It uses the same relay and sender as `apps/api` — the
 * `SMTP_*` and `MAIL_FROM` variables — so there is one mail configuration for the platform.
 *
 * With the relay unconfigured, Payload keeps its default (messages are written to the log, which is
 * the warning seen at startup) and no alert is attempted. A relay that is down or slow never stops
 * a save: alerts are sent after the fact and their failures are only logged.
 */

type MailEnv = {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  from: string;
};

function mailEnv(): MailEnv | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT?.trim() ?? "") || 0;
  const from = process.env.MAIL_FROM?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  // Not trimmed: a password may legitimately begin or end with a space.
  const password = process.env.SMTP_PASSWORD ?? "";
  if (!host || !port || !from || (user === "") !== (password === "")) return null;
  return { host, port, user, password, secure: process.env.SMTP_SECURE?.trim() === "true", from };
}

/** `Name <mailbox@example.com>` or a bare address, split the way Payload wants it. */
export function parseSender(from: string): { name: string; address: string } {
  const match = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/.exec(from);
  if (match) return { name: match[1]?.replace(/^"|"$/g, "") || "SAM Group", address: match[2]! };
  return { name: "SAM Group", address: from.trim() };
}

/** Payload's email adapter for the configured relay, or `undefined` to keep Payload's default. */
export function emailAdapter(): Promise<EmailAdapter> | undefined {
  const env = mailEnv();
  if (!env) return undefined;
  const sender = parseSender(env.from);
  return nodemailerAdapter({
    defaultFromAddress: sender.address,
    defaultFromName: sender.name,
    skipVerify: true,
    transportOptions: {
      host: env.host,
      port: env.port,
      secure: env.secure,
      auth: env.user ? { user: env.user, pass: env.password } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    },
  });
}

/** The owner's mailbox for alerts (`SECURITY_ALERT_TO`), when alerts can be sent at all. */
function ownerAddress(): string | null {
  const to = process.env.SECURITY_ALERT_TO?.trim() ?? "";
  return to && mailEnv() ? to : null;
}

/** Plain text only, and nothing that could carry a header newline into the subject. */
export function publishAlert(
  resource: string,
  actorId: string,
  at: Date,
): { subject: string; text: string } {
  const page = resource.replace(/[\r\n]+/g, " ").replaceAll("-", " ");
  return {
    subject: `[SAM Admin] Page published: ${page}`,
    text: [
      `The "${page}" content was published to the website from the Admin Dashboard.`,
      "",
      `When: ${at.toISOString().replace("T", " ").slice(0, 19)} UTC`,
      `By account: ${actorId}`,
      "",
      "This is an automatic message from SAM Group Platform.",
    ].join("\n"),
  };
}

/** Tells the owner a page was published. Never throws and never delays the save. */
export function notifyPublished(payload: Payload, resource: string, actorId: string): void {
  const to = ownerAddress();
  if (!to) return;
  const message = publishAlert(resource, actorId, new Date());
  void Promise.resolve()
    .then(() => payload.sendEmail({ to, subject: message.subject, text: message.text }))
    .catch((error: unknown) => {
      payload.logger.warn(
        `Publish alert not delivered (${error instanceof Error ? error.name : "unknown"}).`,
      );
    });
}
