import { validateEnv } from "./env.validation";

const PASSWORD = "s3cr3t-must-never-be-logged";
const PLATFORM_URL = `postgresql://sam_platform_user:${PASSWORD}@localhost:5432/sam_platform?schema=public`;
const CMS_URL = `postgresql://sam_cms_user:${PASSWORD}@localhost:5432/sam_cms`;

/** Long enough to pass the length floor, and it signs nothing — no token is issued in this file. */
const JWT_SECRET = "test-placeholder-signing-secret-32-chars";

const base = {
  NODE_ENV: "development",
  API_PORT: "3001",
  DATABASE_URL: PLATFORM_URL,
  JWT_SECRET,
};

describe("validateEnv", () => {
  it("accepts a valid environment and coerces the port to a number", () => {
    expect(validateEnv(base)).toMatchObject({ API_PORT: 3001 });
  });

  it("throws when API_PORT is missing", () => {
    expect(() => validateEnv({ NODE_ENV: "development", DATABASE_URL: PLATFORM_URL })).toThrow();
  });

  it("throws when API_PORT is out of range", () => {
    expect(() => validateEnv({ ...base, API_PORT: "70000" })).toThrow();
  });

  // ADR-005: there is no staging environment, so this value must be rejected rather
  // than silently accepted.
  it("throws on an unrecognised NODE_ENV", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "staging" })).toThrow();
  });

  describe("DATABASE_URL", () => {
    it("accepts a sam_platform connection string", () => {
      expect(validateEnv(base)).toMatchObject({ DATABASE_URL: PLATFORM_URL });
    });

    it("accepts the postgres:// protocol alias", () => {
      const url = "postgres://sam_platform_user:pw@localhost:5432/sam_platform";

      expect(validateEnv({ ...base, DATABASE_URL: url })).toMatchObject({ DATABASE_URL: url });
    });

    it("throws when it is missing", () => {
      expect(() => validateEnv({ NODE_ENV: "development", API_PORT: "3001" })).toThrow();
    });

    // The ADR-002 guard: this is the exact misconfiguration it exists to stop.
    it("throws when it targets sam_cms", () => {
      expect(() => validateEnv({ ...base, DATABASE_URL: CMS_URL })).toThrow();
    });

    it("throws when it targets any other database", () => {
      const url = "postgresql://sam_platform_user:pw@localhost:5432/postgres";

      expect(() => validateEnv({ ...base, DATABASE_URL: url })).toThrow();
    });

    // sam_platform_extra must not pass a prefix-style check.
    it("throws on a database name that merely starts with sam_platform", () => {
      const url = "postgresql://sam_platform_user:pw@localhost:5432/sam_platform_extra";

      expect(() => validateEnv({ ...base, DATABASE_URL: url })).toThrow();
    });

    it("throws when no database is named at all", () => {
      const url = "postgresql://sam_platform_user:pw@localhost:5432";

      expect(() => validateEnv({ ...base, DATABASE_URL: url })).toThrow();
    });

    it("throws on a non-PostgreSQL protocol", () => {
      const url = "mysql://sam_platform_user:pw@localhost:3306/sam_platform";

      expect(() => validateEnv({ ...base, DATABASE_URL: url })).toThrow();
    });

    it("throws on a string that is not a URL", () => {
      expect(() => validateEnv({ ...base, DATABASE_URL: "sam_platform" })).toThrow();
    });

    // A boot failure prints to stdout and into container logs. If the password can reach
    // that output, the guard has traded one security problem for a worse one.
    it("never exposes the password or the URL in the failure message", () => {
      expect.assertions(3);

      try {
        validateEnv({ ...base, DATABASE_URL: CMS_URL });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        expect(message).not.toContain(PASSWORD);
        expect(message).not.toContain(CMS_URL);
        expect(message).toContain("DATABASE_URL");
      }
    });
  });
});

/**
 * The mail group.
 *
 * The property that matters most is the negative one: **an unconfigured or half-configured relay
 * must not stop the process.** A lead the platform could have persisted is worth more than a
 * notification it could have sent, so every one of these variables is optional and only its shape
 * is checked here — whether the group is complete enough to send is `SmtpMailer`'s decision.
 */
describe("validateEnv — outbound SMTP", () => {
  const SMTP_PASSWORD = "smtp-secret-must-never-be-logged";

  const configured = {
    ...base,
    SMTP_HOST: "smtp.relay.invalid",
    SMTP_PORT: "587",
    SMTP_USER: "relay-user",
    SMTP_PASSWORD,
    SMTP_SECURE: "false",
    MAIL_FROM: "SAM Group <noreply@example.invalid>",
    LEAD_NOTIFICATION_TO: "leads@example.invalid",
  };

  it("accepts an environment with no mail configuration at all", () => {
    expect(validateEnv(base)).toMatchObject({ API_PORT: 3001 });
  });

  it("accepts a fully configured relay", () => {
    expect(validateEnv(configured)).toMatchObject({ SMTP_HOST: "smtp.relay.invalid" });
  });

  /*
   * A copied `.env.example` produces present-but-blank variables. Rejecting those would make the
   * documentation file itself unbootable, which is the opposite of what it is for.
   */
  it.each([
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_SECURE",
    "MAIL_FROM",
    "LEAD_NOTIFICATION_TO",
  ])("accepts a blank %s rather than refusing to boot", (variable) => {
    expect(() => validateEnv({ ...configured, [variable]: "" })).not.toThrow();
  });

  it("accepts every variable blank at once, which is a copied example file", () => {
    const blank = Object.fromEntries(Object.keys(configured).map((key) => [key, ""]));

    expect(() => validateEnv({ ...blank, ...base })).not.toThrow();
  });

  it.each(["0", "70000", "not-a-port", "587.5"])("throws on SMTP_PORT %s", (port) => {
    expect(() => validateEnv({ ...configured, SMTP_PORT: port })).toThrow();
  });

  it("coerces a valid SMTP_PORT without altering it", () => {
    expect(validateEnv({ ...configured, SMTP_PORT: "465" })).toMatchObject({ SMTP_PORT: "465" });
  });

  /*
   * The one misreading that would matter: implicit boolean conversion treats the string "false" as
   * truthy, which would turn implicit TLS on while the configuration says it is off.
   */
  it.each(["true", "false"])("accepts SMTP_SECURE %s", (value) => {
    expect(() => validateEnv({ ...configured, SMTP_SECURE: value })).not.toThrow();
  });

  it.each(["TRUE", "False", "1", "yes", "on"])("throws on SMTP_SECURE %s", (value) => {
    expect(() => validateEnv({ ...configured, SMTP_SECURE: value })).toThrow();
  });

  // Same rule as DATABASE_URL: a boot failure goes to stdout and into container logs.
  it("never exposes the SMTP password in a failure message", () => {
    expect.assertions(2);

    try {
      validateEnv({ ...configured, SMTP_PORT: "70000" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      expect(message).not.toContain(SMTP_PASSWORD);
      expect(message).toContain("SMTP_PORT");
    }
  });
});

/**
 * The access-token signing key. Required, unlike every optional group in this file — an identity
 * system with no key does not degrade, it forges.
 */
describe("JWT_SECRET", () => {
  const withSecret = (JWT_SECRET: unknown): Record<string, unknown> => ({ ...base, JWT_SECRET });

  it("accepts a secret at the minimum length", () => {
    const secret = "x".repeat(32);

    expect(validateEnv(withSecret(secret))).toMatchObject({ JWT_SECRET: secret });
  });

  it("throws when it is missing", () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = base;

    expect(() => validateEnv(withoutSecret)).toThrow();
  });

  it("throws when it is empty or blank", () => {
    expect(() => validateEnv(withSecret(""))).toThrow();
    expect(() => validateEnv(withSecret("   "))).toThrow();
  });

  it("throws when it is shorter than the floor", () => {
    expect(() => validateEnv(withSecret("x".repeat(31)))).toThrow();
    expect(() => validateEnv(withSecret("short"))).toThrow();
  });

  /**
   * The secret is a credential and a boot failure prints to stdout and into container logs
   * (SECURITY.md §Secrets Management). The message must not quote it — and must not report its
   * actual length either, which would narrow a search.
   */
  it("never quotes the value or its length in the failure message", () => {
    const secret = "too-short-but-recognisable";

    try {
      validateEnv(withSecret(secret));
    } catch (error) {
      const message = (error as Error).message;

      expect(message).not.toContain(secret);
      expect(message).not.toContain("recognisable");
      expect(message).not.toContain(String(secret.length));

      return;
    }

    throw new Error("expected validateEnv to throw");
  });

  it("keeps the DATABASE_URL password out of the message when both are wrong", () => {
    try {
      validateEnv({ ...base, DATABASE_URL: CMS_URL, JWT_SECRET: "short" });
    } catch (error) {
      expect((error as Error).message).not.toContain(PASSWORD);

      return;
    }

    throw new Error("expected validateEnv to throw");
  });
});
