export type AppConfig = {
  nodeEnv: string;
  apiPort: number;
  databaseUrl: string;
  /**
   * Where Payload answers, on the internal network — ADR-003's server-to-server hop, and the only
   * place in the platform that knows Payload has an address at all.
   *
   * **Optional, deliberately.** Unlike `databaseUrl` this does not gate startup: every endpoint
   * outside the Content module works without a CMS, and making the whole API refuse to boot because
   * one module's upstream is unconfigured would take the catalog, blog and forms down with it. The
   * Content module reports the absence as UPSTREAM_UNAVAILABLE and logs it, which is the honest
   * description — from a caller's position an unconfigured CMS and a stopped one are the same
   * condition.
   *
   * Empty string when unset, so the module has one falsy check rather than two.
   */
  payloadInternalUrl: string;
  /** The Payload service account's API key. Optional for the same reason as the URL above. */
  payloadApiKey: string;
  /**
   * Outbound SMTP, and the internal mailbox lead notifications are sent to.
   *
   * **Every field is optional, and the group degrades as one.** The same principle as the Payload
   * pair above, applied to a weaker dependency: no page reads through this, and an API that refused
   * to boot without a mail relay would lose the leads it could otherwise have persisted. With the
   * group incomplete the Forms module still validates, still writes and still answers 201 — only
   * the internal notification is skipped, and SmtpMailer says so once at startup rather than
   * silently.
   */
  mail: MailConfig;
};

/**
 * SMTP is the approved Phase-1 lead-notification transport. Nothing here carries a default that
 * could send mail on its own: an unset value means unconfigured, never a guessed host or port.
 *
 * `smtpPassword` is a REAL SECRET. It is read here, handed to nodemailer, and never logged, never
 * put in an error message, and never returned by any endpoint.
 */
export type MailConfig = {
  smtpHost: string;
  /** `0` when unset — SmtpMailer reads that as unconfigured rather than assuming 25 or 587. */
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  /**
   * Implicit TLS from the first byte, which is port 465. `false` — the default when SMTP_SECURE is
   * unset — is a plain connection with nodemailer's opportunistic STARTTLS upgrade, which is what a
   * submission relay on 587 expects.
   */
  smtpSecure: boolean;
  /** The header sender. Free-form, so `Name <mailbox@example.com>` is accepted as written. */
  from: string;
  /** The one internal mailbox lead notifications go to. No default exists and none may be added. */
  leadNotificationTo: string;
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Validated by validateEnv before this runs, so no fallback is needed.
  apiPort: Number(process.env.API_PORT),
  databaseUrl: process.env.DATABASE_URL ?? "",
  payloadInternalUrl: process.env.PAYLOAD_INTERNAL_URL?.trim() ?? "",
  payloadApiKey: process.env.PAYLOAD_API_KEY?.trim() ?? "",
  mail: {
    smtpHost: process.env.SMTP_HOST?.trim() ?? "",
    // Number("") is 0 and so is the fallback, so one falsy check covers unset and blank alike.
    smtpPort: Number(process.env.SMTP_PORT?.trim() ?? "") || 0,
    smtpUser: process.env.SMTP_USER?.trim() ?? "",
    // Deliberately NOT trimmed. A password may legitimately start or end with a space, and
    // silently altering a credential produces an authentication failure nobody can explain.
    smtpPassword: process.env.SMTP_PASSWORD ?? "",
    // validateEnv has already rejected anything that is not "true", "false" or absent.
    smtpSecure: process.env.SMTP_SECURE?.trim() === "true",
    from: process.env.MAIL_FROM?.trim() ?? "",
    leadNotificationTo: process.env.LEAD_NOTIFICATION_TO?.trim() ?? "",
  },
});
