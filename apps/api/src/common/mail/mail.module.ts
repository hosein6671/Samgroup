import { Module } from "@nestjs/common";

import { SmtpMailer } from "./smtp.mailer";

/**
 * Outbound mail, shared: the forms module sends lead notifications through it and the audit module
 * sends security alerts. One transport, one 5-second budget, one rule that recipients come only
 * from the environment (`MailRecipient`).
 */
@Module({ providers: [SmtpMailer], exports: [SmtpMailer] })
export class MailModule {}
