import {
  alertFor,
  dailySummary,
  FAILURE_ALERT_COOLDOWN_MS,
  FAILURE_THRESHOLD,
  FAILURE_WINDOW_MS,
  FailedSignInMonitor,
  nextSummaryAt,
} from "./security-alerts";
import { SecurityAlertService } from "./security-alert.service";

const AT = new Date("2026-10-12T17:30:00Z");
const ACTOR = "11111111-1111-4111-8111-111111111111";

describe("alertFor", () => {
  it("tells the owner about every successful sign-in, with the address", () => {
    const message = alertFor({ event: "auth.login", outcome: "success", actorId: ACTOR }, AT, {
      ip: "203.0.113.7",
    });
    expect(message?.subject).toBe("[SAM Admin] New sign-in to the Admin Dashboard");
    expect(message?.text).toContain("2026-10-12 17:30:00 UTC");
    expect(message?.text).toContain(ACTOR);
    expect(message?.text).toContain("203.0.113.7");
  });

  it("covers admin account changes and publishing", () => {
    expect(alertFor({ event: "user.created", outcome: "success" }, AT)?.subject).toContain(
      "Security: A new admin account was created",
    );
    expect(alertFor({ event: "user.role_changed", outcome: "success" }, AT)).not.toBeNull();
    expect(alertFor({ event: "user.status_changed", outcome: "success" }, AT)).not.toBeNull();
    expect(alertFor({ event: "blog.published", outcome: "success" }, AT)?.subject).toContain(
      "A blog article was published",
    );
    expect(alertFor({ event: "product.published", outcome: "success" }, AT)).not.toBeNull();
  });

  it("leaves routine and failed events to the summary", () => {
    expect(alertFor({ event: "auth.refresh", outcome: "success" }, AT)).toBeNull();
    expect(alertFor({ event: "access.denied", outcome: "failure" }, AT)).toBeNull();
    expect(alertFor({ event: "user.created", outcome: "failure" }, AT)).toBeNull();
    expect(alertFor({ event: "auth.login", outcome: "failure" }, AT)).toBeNull();
  });
});

describe("FailedSignInMonitor", () => {
  it("alerts once at the threshold inside the window, then waits an hour", () => {
    const monitor = new FailedSignInMonitor();
    const at = (ms: number): Date => new Date(AT.getTime() + ms);
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) expect(monitor.record(at(i * 1000))).toBeNull();
    const alert = monitor.record(at(FAILURE_THRESHOLD * 1000), { ip: "198.51.100.2" });
    expect(alert?.subject).toBe("[SAM Admin] Security: repeated failed sign-ins");
    expect(alert?.text).toContain("198.51.100.2");
    // More failures within the hour: no second alert.
    for (let i = 0; i < 10; i++) expect(monitor.record(at(60_000 + i * 1000))).toBeNull();
    // After the cooldown, a fresh burst alerts again.
    const later = FAILURE_ALERT_COOLDOWN_MS + 10_000;
    let again = null;
    for (let i = 0; i < FAILURE_THRESHOLD; i++) again = monitor.record(at(later + i * 1000));
    expect(again).not.toBeNull();
  });

  it("forgets failures older than the window", () => {
    const monitor = new FailedSignInMonitor();
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) monitor.record(new Date(AT.getTime() + i));
    expect(monitor.record(new Date(AT.getTime() + FAILURE_WINDOW_MS + 1))).toBeNull();
  });
});

describe("dailySummary and its schedule", () => {
  it("lists the last day's events, busiest first, and flags failures in the subject", () => {
    const message = dailySummary(
      [
        { event: "auth.login", outcome: "success", count: 3 },
        { event: "auth.login", outcome: "failure", count: 12 },
        { event: "blog.published", outcome: "success", count: 1 },
      ],
      AT,
    );
    expect(message?.subject).toBe("[SAM Admin] Daily security summary — 12 failed");
    const body = message?.text.split("\n") ?? [];
    expect(body.findIndex((l) => l.startsWith("auth.login (failure)"))).toBeLessThan(
      body.findIndex((l) => l.startsWith("auth.login (success)")),
    );
  });

  it("sends nothing for a quiet day", () => {
    expect(dailySummary([], AT)).toBeNull();
  });

  it("runs at 05:00 UTC, today or tomorrow", () => {
    expect(nextSummaryAt(new Date("2026-10-12T04:00:00Z")).toISOString()).toBe(
      "2026-10-12T05:00:00.000Z",
    );
    expect(nextSummaryAt(new Date("2026-10-12T05:00:00Z")).toISOString()).toBe(
      "2026-10-13T05:00:00.000Z",
    );
  });
});

describe("SecurityAlertService", () => {
  const mailer = (configured: boolean, send: jest.Mock): never =>
    ({
      isConfigured: () => configured,
      configurationIssue: () => (configured ? undefined : "missing SECURITY_ALERT_TO"),
      send,
    }) as never;
  const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

  it("sends to the security recipient only", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const service = new SecurityAlertService(mailer(true, send), {} as never);
    service.observe({ event: "user.created", outcome: "success", actorId: ACTOR });
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toBe("security");
  });

  it("sends nothing when alerts are not configured", async () => {
    const send = jest.fn();
    const service = new SecurityAlertService(mailer(false, send), {} as never);
    service.observe({ event: "user.created", outcome: "success" });
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("never lets a mail failure reach the caller", async () => {
    const send = jest.fn().mockRejectedValue(new Error("relay down"));
    const service = new SecurityAlertService(mailer(true, send), {} as never);
    expect(() =>
      service.observe({ event: "auth.login", outcome: "success", actorId: ACTOR }),
    ).not.toThrow();
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops at the hourly limit", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const service = new SecurityAlertService(mailer(true, send), {} as never);
    for (let i = 0; i < 30; i++) service.observe({ event: "auth.login", outcome: "success" });
    await flush();
    expect(send).toHaveBeenCalledTimes(20);
  });
});
