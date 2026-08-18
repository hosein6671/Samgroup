import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { LeadNotificationService } from "./lead-notification.service";
import { MailTimeoutError, SmtpMailer } from "./smtp.mailer";

import type {
  CustomFormulationNotificationInput,
  InquiryNotificationInput,
} from "./lead-notification.message";

const ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = "2026-08-15T09:30:00.000Z";

const INQUIRY: InquiryNotificationInput = {
  id: ID,
  createdAt: CREATED_AT,
  privacyPolicyVersion: null,
  inquiryType: "general_inquiry",
  firstName: "Ada",
  lastName: "Lovelace",
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  email: "ada@example.com",
  industry: "Manufacturing",
};

const FORMULATION: CustomFormulationNotificationInput = {
  id: ID,
  createdAt: CREATED_AT,
  privacyPolicyVersion: null,
  companyName: "Analytical Engines Ltd",
  country: "United Kingdom",
  industry: "Manufacturing",
  email: "ada@example.com",
  productOrApplication: "Hydraulic fluid for a high-pressure test rig",
  requiredSpecifications: "ISO VG 46, low pour point, zinc-free",
};

type Harness = {
  service: LeadNotificationService;
  send: jest.Mock;
  logged: string[];
};

/**
 * @param configurationIssue `undefined` for a configured relay, or the reason it is not.
 */
async function createHarness(configurationIssue?: string): Promise<Harness> {
  const send = jest.fn().mockResolvedValue(undefined);
  const logged: string[] = [];

  for (const level of ["log", "error", "warn"] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      logged.push(String(args[0]));
    });
  }

  const moduleRef = await Test.createTestingModule({
    providers: [
      LeadNotificationService,
      {
        provide: SmtpMailer,
        useValue: {
          send,
          isConfigured: (): boolean => configurationIssue === undefined,
          configurationIssue: (): string | undefined => configurationIssue,
        },
      },
    ],
  }).compile();

  return { service: moduleRef.get(LeadNotificationService), send, logged };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("LeadNotificationService — the delivery path", () => {
  it("sends one notification for a persisted inquiry", async () => {
    const { service, send } = await createHarness();

    await service.notifyInquiry(INQUIRY);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      subject: "New SAM Group inquiry — General inquiry",
    });
  });

  it("sends one notification for a persisted custom formulation request", async () => {
    const { service, send } = await createHarness();

    await service.notifyCustomFormulationRequest(FORMULATION);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      subject: "New SAM Group custom formulation request",
    });
  });

  // Phase 1 sends once. No retry, no backoff, no queue — a failure is a log line, and the lead is
  // already in the database.
  it("makes exactly one attempt, and does not retry a failure", async () => {
    const { service, send } = await createHarness();
    send.mockRejectedValue(new Error("nope"));

    await service.notifyInquiry(INQUIRY);

    expect(send).toHaveBeenCalledTimes(1);
  });
});

/**
 * The contract the whole gate rests on: by the time this service is called the lead is committed,
 * so **nothing it does may reject**. Each case below is a real failure mode of an SMTP relay.
 */
describe("LeadNotificationService — never throws", () => {
  it.each([
    [
      "a refused connection",
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    ],
    [
      "a rejected credential",
      Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 }),
    ],
    [
      "a rejected recipient",
      Object.assign(new Error("Mailbox unavailable"), { responseCode: 550 }),
    ],
    ["a TLS failure", Object.assign(new Error("self signed certificate"), { code: "ESOCKET" })],
    ["the 5-second budget expiring", new MailTimeoutError()],
    ["something that is not an Error at all", "a string thrown from a library"],
  ])("survives %s", async (_label, failure) => {
    const { service, send } = await createHarness();
    send.mockRejectedValue(failure);

    await expect(service.notifyInquiry(INQUIRY)).resolves.toBeUndefined();
    await expect(service.notifyCustomFormulationRequest(FORMULATION)).resolves.toBeUndefined();
  });

  /**
   * The message builder is called inside the try for this case. A template bug is still not a
   * reason to fail a submission that succeeded.
   */
  it("survives a failure to build the message itself", async () => {
    const { service, send } = await createHarness();

    // The builder calls .trim() on each entry, so a non-string reaching it throws where the message
    // is composed rather than where it is sent. Unreachable through the API — the DTO validates
    // `@IsString({ each: true })` — and the point is that even so it costs no lead.
    const malformed = {
      ...INQUIRY,
      productsOfInterest: [42] as unknown as readonly string[],
    };

    await expect(service.notifyInquiry(malformed)).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
  });
});

describe("LeadNotificationService — unconfigured mail", () => {
  it("skips the attempt entirely rather than failing it", async () => {
    const { service, send } = await createHarness("missing LEAD_NOTIFICATION_TO");

    await expect(service.notifyInquiry(INQUIRY)).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
  });

  it("skips the custom formulation notification the same way", async () => {
    const { service, send } = await createHarness("missing SMTP_HOST, SMTP_PORT");

    await service.notifyCustomFormulationRequest(FORMULATION);

    expect(send).not.toHaveBeenCalled();
  });

  it("says which variables are missing, and says it once per submission", async () => {
    const { service, logged } = await createHarness("missing LEAD_NOTIFICATION_TO");

    await service.notifyInquiry(INQUIRY);

    const skipped = logged.filter((entry) => entry.includes("skipped"));

    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain("LEAD_NOTIFICATION_TO");
    expect(skipped[0]).toContain(`submissionId=${ID}`);
  });
});

describe("LeadNotificationService — logging", () => {
  it("records the submission id, kind and mechanism on success", async () => {
    const { service, logged } = await createHarness();

    await service.notifyInquiry(INQUIRY);

    expect(logged.join("\n")).toContain(`submissionId=${ID} kind=inquiry mechanism=smtp`);
  });

  it("distinguishes the two submission kinds", async () => {
    const { service, logged } = await createHarness();

    await service.notifyCustomFormulationRequest(FORMULATION);

    expect(logged.join("\n")).toContain("kind=custom_formulation_request");
  });

  it("records the error class and code on failure, and says the lead survived", async () => {
    const { service, send, logged } = await createHarness();
    send.mockRejectedValue(
      Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 }),
    );

    await service.notifyInquiry(INQUIRY);

    const failure = logged.find((entry) => entry.includes("failed")) ?? "";

    expect(failure).toContain("Error EAUTH 535");
    expect(failure).toContain("persisted and unaffected");
  });

  /**
   * An SMTP error's own message routinely quotes the envelope back — the recipient mailbox, and on
   * some relays the authenticating user. Only the stable machine-readable parts are logged.
   */
  it("never logs the provider's error message, which can quote the envelope", async () => {
    const { service, send, logged } = await createHarness();
    send.mockRejectedValue(
      Object.assign(new Error("550 5.1.1 <leads@example.invalid>: Recipient address rejected"), {
        responseCode: 550,
      }),
    );

    await service.notifyInquiry(INQUIRY);

    expect(logged.join("\n")).not.toContain("leads@example.invalid");
    expect(logged.join("\n")).not.toContain("Recipient address rejected");
  });

  it("logs no part of the submission except its id", async () => {
    const { service, logged } = await createHarness();

    await service.notifyInquiry({
      ...INQUIRY,
      phone: "+44 20 7946 0000",
      message: "Confidential: our current supplier is Example Petrochemicals.",
    });

    const stream = logged.join("\n");

    expect(stream).toContain(ID);
    expect(stream).not.toContain("Ada");
    expect(stream).not.toContain("Lovelace");
    expect(stream).not.toContain("ada@example.com");
    expect(stream).not.toContain("Analytical Engines Ltd");
    expect(stream).not.toContain("+44 20 7946 0000");
    expect(stream).not.toContain("Example Petrochemicals");
  });

  it("logs no part of the custom formulation submission except its id", async () => {
    const { service, logged } = await createHarness();

    await service.notifyCustomFormulationRequest(FORMULATION);

    const stream = logged.join("\n");

    expect(stream).toContain(ID);
    expect(stream).not.toContain("ada@example.com");
    expect(stream).not.toContain("ISO VG 46");
    expect(stream).not.toContain("Analytical Engines Ltd");
  });
});
