import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { SmtpMailer, type MailMessage } from "../../common/mail/smtp.mailer";
import { PrismaService } from "../../prisma/prisma.service";
import {
  alertFor,
  dailySummary,
  FailedSignInMonitor,
  HOURLY_ALERT_LIMIT,
  nextSummaryAt,
  type AlertContext,
} from "./security-alerts";

import type { AuditEntry } from "./audit.service";

/**
 * Emails the owner (`SECURITY_ALERT_TO`) about what happens in the Admin Dashboard: every sign-in,
 * repeated failed sign-ins, admin account changes, publishing, and a daily summary.
 *
 * **It never gets in the way.** `observe` returns at once and nothing it does can throw into the
 * caller: a sign-in, a role change or a publish succeeds whether the relay is up, down, slow or
 * unconfigured. A failure is logged by class name only — never a message, which can carry an
 * address or a server response. With `SECURITY_ALERT_TO` (or the SMTP group) unset, nothing is sent
 * and this is said once at startup.
 *
 * An event recorded inside a database transaction is alerted when it is recorded, so a transaction
 * that later rolls back can still produce an alert. That is the safe direction for a security
 * notice — a false alarm, never a missed change.
 */
@Injectable()
export class SecurityAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecurityAlertService.name);
  private readonly failures = new FailedSignInMonitor();
  private sent: number[] = [];
  private limitLogged = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly mailer: SmtpMailer,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const issue = this.mailer.configurationIssue("security");
    if (issue !== undefined) {
      this.logger.log(`Security alerts are off (${issue}).`);
      return;
    }
    this.schedule();
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Called for every audit event. Returns at once; never throws. */
  observe(entry: AuditEntry, context?: AlertContext): void {
    try {
      if (!this.mailer.isConfigured("security")) return;
      const now = new Date();
      const message =
        entry.event === "auth.login" && entry.outcome === "failure"
          ? this.failures.record(now, context)
          : alertFor(entry, now, context);
      if (message) void this.deliver(message);
    } catch {
      this.logger.warn("Security alert skipped (could not be prepared).");
    }
  }

  private async deliver(message: MailMessage): Promise<void> {
    const now = Date.now();
    this.sent = this.sent.filter((t) => now - t < 60 * 60 * 1000);
    if (this.sent.length >= HOURLY_ALERT_LIMIT) {
      if (!this.limitLogged) this.logger.warn("Security alerts paused: hourly limit reached.");
      this.limitLogged = true;
      return;
    }
    this.limitLogged = false;
    this.sent.push(now);
    try {
      await this.mailer.send(message, "security");
    } catch (error) {
      this.logger.warn(
        `Security alert not delivered (${error instanceof Error ? error.name : "unknown"}).`,
      );
    }
  }

  private schedule(): void {
    const delay = nextSummaryAt(new Date()).getTime() - Date.now();
    this.timer = setTimeout(() => {
      void this.sendSummary().finally(() => this.schedule());
    }, delay);
    this.timer.unref();
  }

  private async sendSummary(): Promise<void> {
    try {
      const until = new Date();
      const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
      const grouped = await this.prisma.adminAuditEvent.groupBy({
        by: ["event", "outcome"],
        where: { occurredAt: { gte: since, lt: until } },
        _count: { _all: true },
      });
      const message = dailySummary(
        grouped.map((row) => ({ event: row.event, outcome: row.outcome, count: row._count._all })),
        until,
      );
      if (message) await this.deliver(message);
    } catch (error) {
      this.logger.warn(
        `Daily security summary skipped (${error instanceof Error ? error.name : "unknown"}).`,
      );
    }
  }
}
