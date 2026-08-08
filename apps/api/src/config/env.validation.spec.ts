import { validateEnv } from "./env.validation";

const PASSWORD = "s3cr3t-must-never-be-logged";
const PLATFORM_URL = `postgresql://sam_platform_user:${PASSWORD}@localhost:5432/sam_platform?schema=public`;
const CMS_URL = `postgresql://sam_cms_user:${PASSWORD}@localhost:5432/sam_cms`;

const base = { NODE_ENV: "development", API_PORT: "3001", DATABASE_URL: PLATFORM_URL };

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
