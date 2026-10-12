import type { AuditEntry } from "./audit.service";
import type { MailMessage } from "../../common/mail/smtp.mailer";

/**
 * What an audit event says to the owner, as a plain-text email — or nothing, for the events that
 * only belong in the daily summary.
 *
 * Pure functions, so the wording and the thresholds are tested without a relay. The service around
 * them (`SecurityAlertService`) decides when to send and never lets a failure reach the caller.
 *
 * **What goes in a message:** the event, the time, the account ids involved and, for a sign-in,
 * the address it came from. **Never** a password, a token, a request body or the email address
 * someone typed into a failed sign-in — the audit trail itself does not keep those, and an alert
 * must not become the place they leak.
 */

/** Context the request had, passed alongside the audit entry and never stored. */
export type AlertContext = { readonly ip?: string };

const SUBJECT_PREFIX = "[SAM Admin]";

/** Failed sign-ins within this window count towards one alert. */
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** This many failures inside the window raise an alert. */
export const FAILURE_THRESHOLD = 5;
/** After an alert about failures, the next one waits at least this long. */
export const FAILURE_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

const ACCOUNT_EVENTS: Partial<Record<AuditEntry["event"], string>> = {
  "user.created": "A new admin account was created",
  "user.role_changed": "An admin account's role was changed",
  "user.status_changed": "An admin account was enabled or disabled",
};

const ACTIVITY_EVENTS: Partial<Record<AuditEntry["event"], string>> = {
  "blog.post_created": "A blog article was created",
  "blog.published": "A blog article was published",
  "product.published": "A product page was published",
};

function lines(entry: AuditEntry, at: Date, context?: AlertContext): string[] {
  return [
    `When: ${at.toISOString().replace("T", " ").slice(0, 19)} UTC`,
    ...(entry.actorId ? [`By account: ${entry.actorId}`] : []),
    ...(entry.subjectId ? [`Affected item: ${entry.subjectId}`] : []),
    ...(context?.ip ? [`From address: ${context.ip}`] : []),
  ];
}

const FOOTER = [
  "",
  "Details are in the Admin Dashboard under Audit log.",
  "This is an automatic message from SAM Group Platform.",
];

/**
 * The immediate alert for one event, or `null` when the event is not one the owner is told about
 * as it happens. Failed sign-ins are handled by `FailedSignInMonitor`, not here.
 */
export function alertFor(entry: AuditEntry, at: Date, context?: AlertContext): MailMessage | null {
  if (entry.event === "auth.login" && entry.outcome === "success")
    return {
      subject: `${SUBJECT_PREFIX} New sign-in to the Admin Dashboard`,
      text: [
        "Someone signed in to the SAM Group Admin Dashboard.",
        "",
        ...lines(entry, at, context),
        "",
        "If this was not you or a colleague, change the password and disable the account.",
        ...FOOTER,
      ].join("\n"),
    };
  if (entry.outcome !== "success") return null;
  const account = ACCOUNT_EVENTS[entry.event];
  if (account)
    return {
      subject: `${SUBJECT_PREFIX} Security: ${account}`,
      text: [`${account}.`, "", ...lines(entry, at, context), ...FOOTER].join("\n"),
    };
  const activity = ACTIVITY_EVENTS[entry.event];
  if (activity)
    return {
      subject: `${SUBJECT_PREFIX} ${activity}`,
      text: [`${activity}.`, "", ...lines(entry, at, context), ...FOOTER].join("\n"),
    };
  return null;
}

/**
 * Counts failed sign-ins and says when there have been enough to tell the owner.
 *
 * Bots try passwords all day; an email per attempt would bury the one that matters. So failures
 * are counted in a sliding 15-minute window, five of them raise one alert, and the next alert waits
 * an hour however many more arrive. The count is per process and in memory: a restart starts it
 * again, which errs towards one extra alert, never towards a missed one.
 */
export class FailedSignInMonitor {
  private failures: number[] = [];
  private lastAlertAt = Number.NEGATIVE_INFINITY;

  /** Records one failure; returns the alert to send, if this one crosses the threshold. */
  record(at: Date, context?: AlertContext): MailMessage | null {
    const now = at.getTime();
    this.failures = [...this.failures.filter((t) => now - t < FAILURE_WINDOW_MS), now];
    if (this.failures.length < FAILURE_THRESHOLD) return null;
    if (now - this.lastAlertAt < FAILURE_ALERT_COOLDOWN_MS) return null;
    this.lastAlertAt = now;
    return {
      subject: `${SUBJECT_PREFIX} Security: repeated failed sign-ins`,
      text: [
        `There have been ${this.failures.length} failed sign-in attempts to the Admin Dashboard in the last 15 minutes.`,
        "",
        `Latest attempt: ${at.toISOString().replace("T", " ").slice(0, 19)} UTC`,
        ...(context?.ip ? [`Latest address: ${context.ip}`] : []),
        "",
        "Sign-in is rate limited, so this is usually an automated password guess. If it keeps",
        "happening, check that every admin uses a strong, unique password.",
        "You will not get another alert about failed sign-ins for an hour.",
        ...FOOTER,
      ].join("\n"),
    };
  }
}

/** Never more than this many alert emails in one hour, whatever happens. */
export const HOURLY_ALERT_LIMIT = 20;

/** One row of the daily summary: an event, its outcome, and how many times it happened. */
export type SummaryRow = {
  readonly event: string;
  readonly outcome: string;
  readonly count: number;
};

/** The daily summary of the last 24 hours, or `null` when nothing happened. */
export function dailySummary(rows: readonly SummaryRow[], until: Date): MailMessage | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) =>
      b.count - a.count || a.event.localeCompare(b.event) || a.outcome.localeCompare(b.outcome),
  );
  const width = Math.max(...sorted.map((row) => `${row.event} (${row.outcome})`.length));
  const failures = rows
    .filter((row) => row.outcome === "failure")
    .reduce((sum, row) => sum + row.count, 0);
  return {
    subject: `${SUBJECT_PREFIX} Daily security summary${failures > 0 ? ` — ${failures} failed` : ""}`,
    text: [
      `Admin activity in the 24 hours up to ${until.toISOString().replace("T", " ").slice(0, 16)} UTC:`,
      "",
      ...sorted.map((row) => `${`${row.event} (${row.outcome})`.padEnd(width)}  ${row.count}`),
      ...FOOTER,
    ].join("\n"),
  };
}

/** The next run of the daily summary: 05:00 UTC (08:30 in Tehran), today or tomorrow. */
export function nextSummaryAt(now: Date): Date {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 5, 0, 0),
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
