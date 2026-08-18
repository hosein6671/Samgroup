import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createTransport } from "nodemailer";

import { MAIL_TIMEOUT_MS, MailTimeoutError, SmtpMailer } from "./smtp.mailer";

import type { MailConfig } from "../../../config/configuration";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

const createTransportMock = createTransport as unknown as jest.Mock;

/**
 * A password shaped so that any leak is unmistakable in an assertion failure. It is a literal in a
 * test file and authenticates against nothing.
 */
const PASSWORD = "spec-only-secret-9f3a";

const COMPLETE: MailConfig = {
  smtpHost: "smtp.relay.invalid",
  smtpPort: 587,
  smtpUser: "relay-user",
  smtpPassword: PASSWORD,
  smtpSecure: false,
  from: "SAM Group <noreply@example.invalid>",
  leadNotificationTo: "leads@example.invalid",
};

type Harness = {
  mailer: SmtpMailer;
  sendMail: jest.Mock;
};

async function createHarness(overrides: Partial<MailConfig> = {}): Promise<Harness> {
  const mail: MailConfig = { ...COMPLETE, ...overrides };
  const sendMail = jest.fn().mockResolvedValue({ messageId: "spec" });

  createTransportMock.mockReturnValue({ sendMail });

  const moduleRef = await Test.createTestingModule({
    providers: [
      SmtpMailer,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback: unknown): unknown => (key === "mail" ? mail : fallback),
        },
      },
    ],
  }).compile();

  return { mailer: moduleRef.get(SmtpMailer), sendMail };
}

function sentOptions(sendMail: jest.Mock): Record<string, unknown> {
  return sendMail.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  createTransportMock.mockReset();
});

describe("SmtpMailer configuration", () => {
  it("is configured when host, port, sender and recipient are all present", async () => {
    const { mailer } = await createHarness();

    expect(mailer.isConfigured()).toBe(true);
    expect(mailer.configurationIssue()).toBeUndefined();
  });

  it.each([
    ["SMTP_HOST", { smtpHost: "" }],
    ["SMTP_PORT", { smtpPort: 0 }],
    ["MAIL_FROM", { from: "" }],
    ["LEAD_NOTIFICATION_TO", { leadNotificationTo: "" }],
  ])("is unconfigured, naming %s, when it is missing", async (variable, overrides) => {
    const { mailer } = await createHarness(overrides as Partial<MailConfig>);

    expect(mailer.isConfigured()).toBe(false);
    expect(mailer.configurationIssue()).toContain(variable);
  });

  // The recipient is the one the client has not supplied yet, so it is the case that will actually
  // occur in this deployment — the notification is skipped, and nothing else changes.
  it("is unconfigured when only the recipient is missing, even with a working relay", async () => {
    const { mailer } = await createHarness({ leadNotificationTo: "" });

    expect(mailer.isConfigured()).toBe(false);
  });

  it("accepts an unauthenticated relay when neither credential is set", async () => {
    const { mailer } = await createHarness({ smtpUser: "", smtpPassword: "" });

    expect(mailer.isConfigured()).toBe(true);
  });

  it.each([
    ["a user with no password", { smtpPassword: "" }],
    ["a password with no user", { smtpUser: "" }],
  ])(
    "treats %s as unconfigured rather than attempting an ambiguous connection",
    async (_label, overrides) => {
      const { mailer } = await createHarness(overrides as Partial<MailConfig>);

      expect(mailer.isConfigured()).toBe(false);
      expect(mailer.configurationIssue()).toContain("SMTP_USER and SMTP_PASSWORD");
    },
  );

  it("names variables in the issue and never their values", async () => {
    const { mailer } = await createHarness({ smtpHost: "", smtpPassword: "" });

    const issue = mailer.configurationIssue() ?? "";

    expect(issue).toContain("SMTP_HOST");
    expect(issue).not.toContain(PASSWORD);
    expect(issue).not.toContain(COMPLETE.leadNotificationTo);
  });
});

describe("SmtpMailer transport", () => {
  it("bounds every phase of the connection at the approved budget", async () => {
    const { mailer } = await createHarness();

    await mailer.send({ subject: "s", text: "t" });

    const options = createTransportMock.mock.calls[0][0] as Record<string, unknown>;

    expect(options).toMatchObject({
      host: COMPLETE.smtpHost,
      port: COMPLETE.smtpPort,
      secure: false,
      connectionTimeout: MAIL_TIMEOUT_MS,
      greetingTimeout: MAIL_TIMEOUT_MS,
      socketTimeout: MAIL_TIMEOUT_MS,
    });
  });

  it("passes implicit TLS through as configured", async () => {
    const { mailer } = await createHarness({ smtpSecure: true, smtpPort: 465 });

    await mailer.send({ subject: "s", text: "t" });

    expect(createTransportMock.mock.calls[0][0]).toMatchObject({ secure: true, port: 465 });
  });

  it("omits auth entirely on an unauthenticated relay rather than sending an empty pair", async () => {
    const { mailer } = await createHarness({ smtpUser: "", smtpPassword: "" });

    await mailer.send({ subject: "s", text: "t" });

    expect((createTransportMock.mock.calls[0][0] as { auth?: unknown }).auth).toBeUndefined();
  });

  it("builds the transport once and reuses it across sends", async () => {
    const { mailer } = await createHarness();

    await mailer.send({ subject: "one", text: "t" });
    await mailer.send({ subject: "two", text: "t" });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
  });
});

describe("SmtpMailer.send", () => {
  it("sends from and to the configured mailboxes and nowhere else", async () => {
    const { mailer, sendMail } = await createHarness();

    await mailer.send({ subject: "New SAM Group inquiry — General inquiry", text: "body" });

    expect(sentOptions(sendMail)).toMatchObject({
      from: COMPLETE.from,
      to: COMPLETE.leadNotificationTo,
      subject: "New SAM Group inquiry — General inquiry",
      text: "body",
    });
  });

  /**
   * The structural half of the injection guarantee: `LeadNotification` has no `html` field, and
   * this asserts the transport never invents one. A `<script>` in a submitted message is therefore
   * inert wherever the notification is read.
   */
  it("never sets an html part, so no submitted value can become markup", async () => {
    const { mailer, sendMail } = await createHarness();

    await mailer.send({
      subject: "New SAM Group inquiry — General inquiry",
      text: "Message: <script>alert(1)</script>",
    });

    const options = sentOptions(sendMail);

    expect(options).not.toHaveProperty("html");
    expect(options).not.toHaveProperty("amp");
    expect(options.text).toBe("Message: <script>alert(1)</script>");
  });

  // No submitted value reaches the subject today. This keeps that from mattering.
  it("collapses CR and LF in the subject so a header cannot be split", async () => {
    const { mailer, sendMail } = await createHarness();

    await mailer.send({ subject: "New inquiry\r\nBcc: attacker@example.invalid", text: "t" });

    const subject = sentOptions(sendMail).subject as string;

    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe("New inquiry Bcc: attacker@example.invalid");
  });

  it("propagates a transport failure to its caller", async () => {
    const { mailer, sendMail } = await createHarness();
    sendMail.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );

    await expect(mailer.send({ subject: "s", text: "t" })).rejects.toThrow("ECONNREFUSED");
  });
});

describe("SmtpMailer.send — the 5-second budget", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * A relay that accepts the connection and then stalls is the failure nodemailer's per-phase
   * timeouts can miss, and it is the one that would hold a submitter's request open. The whole
   * attempt is capped, so it cannot.
   */
  it("gives up once the budget expires, whatever the relay is doing", async () => {
    const { mailer, sendMail } = await createHarness();
    sendMail.mockReturnValue(new Promise(() => undefined));

    const attempt = mailer.send({ subject: "s", text: "t" });
    const assertion = expect(attempt).rejects.toBeInstanceOf(MailTimeoutError);

    await jest.advanceTimersByTimeAsync(MAIL_TIMEOUT_MS);

    await assertion;
  });

  it("does not fire the timeout when the send completes in time", async () => {
    const { mailer } = await createHarness();

    const attempt = mailer.send({ subject: "s", text: "t" });

    await jest.advanceTimersByTimeAsync(MAIL_TIMEOUT_MS * 2);

    await expect(attempt).resolves.toBeUndefined();
  });
});

/**
 * **This class writes nothing to the log**, and that is the assertion rather than a redaction rule.
 *
 * Everything it could report is relay infrastructure — host, port, TLS mode, whether a credential
 * is in use, the recipient mailbox — with no operational value in a per-lead stream, and each line
 * of it is one more place a deployment detail can reach an aggregated log. It throws instead, and
 * `LeadNotificationService` writes the one line that matters. A leak here is therefore impossible
 * by construction rather than by careful wording, and these tests fail the moment that changes.
 *
 * The spies are installed **after** the harness is built, so Nest's own testing-module bootstrap
 * output is not mistaken for this class's.
 */
describe("SmtpMailer logging", () => {
  function captureLogs(): string[] {
    const written: string[] = [];

    for (const level of ["log", "error", "warn", "debug", "verbose"] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        written.push(args.map((argument) => String(argument)).join(" "));
      });
    }

    return written;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs nothing across configuration, transport creation and a successful send", async () => {
    const { mailer } = await createHarness();
    const written = captureLogs();

    mailer.isConfigured();
    mailer.configurationIssue();
    await mailer.send({ subject: "s", text: "t" });
    await mailer.send({ subject: "s", text: "t" });

    expect(written).toEqual([]);
  });

  it("logs nothing when a send fails, leaving the record to the boundary above", async () => {
    const { mailer, sendMail } = await createHarness();
    const written = captureLogs();

    sendMail.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );

    await expect(mailer.send({ subject: "s", text: "t" })).rejects.toThrow();

    expect(written).toEqual([]);
  });

  it("logs nothing when mail is unconfigured", async () => {
    const { mailer } = await createHarness({ smtpHost: "", leadNotificationTo: "" });
    const written = captureLogs();

    expect(mailer.isConfigured()).toBe(false);
    expect(written).toEqual([]);
  });

  /**
   * The same guarantee stated positively: with no output at all, no credential, relay address or
   * recipient can leave this class through a log.
   */
  it("therefore exposes no credential, relay address or recipient through logging", async () => {
    const { mailer, sendMail } = await createHarness();
    const written = captureLogs();

    sendMail.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH" }));

    await expect(mailer.send({ subject: "s", text: "t" })).rejects.toThrow();

    const stream = written.join("\n");

    expect(stream).not.toContain(PASSWORD);
    expect(stream).not.toContain(COMPLETE.smtpHost);
    expect(stream).not.toContain(COMPLETE.smtpUser);
    expect(stream).not.toContain(COMPLETE.from);
    expect(stream).not.toContain(COMPLETE.leadNotificationTo);
  });
});
