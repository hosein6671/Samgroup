import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  validateSync,
} from "class-validator";

import { JWT_SECRET_MIN_LENGTH } from "../modules/identity/jwt.config";

export enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

/** The only database this application may ever open a connection to (ADR-002). */
const PLATFORM_DATABASE = "sam_platform";

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);

/**
 * Defense-in-depth for ADR-002: refuses a connection string that points anywhere other
 * than sam_platform, so a copy-pasted sam_cms URL fails at boot rather than at the first
 * query. This does not replace the PostgreSQL grants — those remain the real boundary,
 * asserted by scripts/verify-db-isolation.sh — it only removes the misconfiguration that
 * would make the application try in the first place.
 */
@ValidatorConstraint({ name: "isPlatformDatabaseUrl" })
export class IsPlatformDatabaseUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch {
      return false;
    }

    if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
      return false;
    }

    // `pathname` is "/sam_platform"; query parameters such as ?schema=public are not part
    // of it and are deliberately ignored.
    return url.pathname.replace(/^\//, "") === PLATFORM_DATABASE;
  }

  /**
   * The message never quotes the offending value. DATABASE_URL carries the database
   * password, and a boot failure prints straight to stdout and into container logs
   * (SECURITY.md "Secrets Management").
   */
  defaultMessage(): string {
    return `DATABASE_URL must be a postgresql:// connection string targeting the ${PLATFORM_DATABASE} database (ADR-002)`;
  }
}

/**
 * An http(s) origin, or nothing at all.
 *
 * Deliberately not `@IsUrl()`: that accepts `mailto:` and `ftp:` among others, and would let a
 * scheme this application can never fetch through startup validation and into a runtime failure.
 */
@ValidatorConstraint({ name: "isOptionalHttpOrigin" })
export class IsOptionalHttpOrigin implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    if (typeof value !== "string") {
      return false;
    }

    try {
      const url = new URL(value);

      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return "PAYLOAD_INTERNAL_URL must be an http:// or https:// origin, or be left unset";
  }
}

/**
 * A TCP port, or nothing at all.
 *
 * Deliberately not `@IsInt() @Min(1) @Max(65535)` on a number field: `SMTP_PORT=` — a variable
 * present but blank, which is exactly what a copied `.env.example` produces — converts to `0` and
 * fails the range check, so the API would refuse to boot over an unconfigured optional capability.
 * An empty value means "not set", the same as an absent one.
 */
@ValidatorConstraint({ name: "isOptionalPort" })
export class IsOptionalPort implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    const port = Number(value);

    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  defaultMessage(): string {
    return "SMTP_PORT must be a TCP port between 1 and 65535, or be left unset";
  }
}

/**
 * A literal `"true"` or `"false"`, or nothing at all.
 *
 * Deliberately not `@IsBoolean()`: environment variables are strings, and class-transformer's
 * implicit boolean conversion reads `"false"` as truthy — the one misreading that would silently
 * turn implicit TLS off while the configuration file says it is on. Anything else, `"TRUE"`
 * included, fails at boot rather than being guessed at.
 */
@ValidatorConstraint({ name: "isOptionalBooleanFlag" })
export class IsOptionalBooleanFlag implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      value === undefined || value === null || value === "" || value === "true" || value === "false"
    );
  }

  defaultMessage(): string {
    return 'SMTP_SECURE must be exactly "true" or "false", or be left unset';
  }
}

/**
 * A signing key long enough that it is not the weakest part of the construction.
 *
 * **The message never quotes the value, and never reports the actual length.** JWT_SECRET is a real
 * secret, a boot failure prints straight to stdout and into container logs (SECURITY.md §Secrets
 * Management), and even "got 12 characters" narrows a search. This follows exactly the rule
 * IsPlatformDatabaseUrl already applies to the DATABASE_URL password.
 */
@ValidatorConstraint({ name: "isJwtSigningSecret" })
export class IsJwtSigningSecret implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && value.length >= JWT_SECRET_MIN_LENGTH;
  }

  defaultMessage(): string {
    return (
      `JWT_SECRET must be set and at least ${String(JWT_SECRET_MIN_LENGTH)} characters long. ` +
      "Generate one (for example `openssl rand -base64 48`) and provide it through the process " +
      "environment; it is never committed to this repository."
    );
  }
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @Validate(IsPlatformDatabaseUrl)
  DATABASE_URL!: string;

  /**
   * The access-token signing key.
   *
   * **Required, unlike every other optional group in this file.** PAYLOAD_INTERNAL_URL and the SMTP
   * seven are optional because an unconfigured upstream degrades one capability and must not stop
   * the process. A missing signing key is not that: there is no safe degraded behaviour for an
   * identity system, and the two alternatives to failing here — a generated per-boot secret, or a
   * committed default — are respectively "every restart logs everyone out and nobody knows why" and
   * "anyone who has read this repository can mint an Admin token". So the process refuses to start,
   * exactly as it does for a DATABASE_URL pointing at the wrong database.
   */
  @Validate(IsJwtSigningSecret)
  JWT_SECRET!: string;

  /**
   * Payload's internal origin. **Optional** — see the note on `payloadInternalUrl` in
   * `configuration.ts` for why an unconfigured CMS degrades one module rather than the process.
   * Its *shape* is still checked, so a typo fails at boot rather than as a confusing fetch error.
   */
  @IsOptional()
  @Validate(IsOptionalHttpOrigin)
  PAYLOAD_INTERNAL_URL?: string;

  /**
   * The Payload service account's API key. Optional, and deliberately unvalidated beyond being a
   * string: its format is Payload's to define, and a shape rule here would be this application
   * asserting something it does not own.
   */
  @IsOptional()
  @IsString()
  PAYLOAD_API_KEY?: string;

  /*
   * ── Outbound SMTP ─────────────────────────────────────────────────────────
   *
   * All seven are OPTIONAL, for the same reason PAYLOAD_INTERNAL_URL is: a missing mail relay
   * degrades one capability — the internal lead notification — and must never stop the process
   * that persists the lead. What is validated here is only *shape*, so a typo fails at boot rather
   * than as a confusing runtime send failure; whether the group is complete enough to send at all
   * is `SmtpMailer`'s decision, made once at startup and logged there.
   *
   * Nothing is validated for content: no host is checked for reachability and no address against a
   * domain. Both are deployment facts this application does not own.
   */

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  /** Typed as a string, and validated as a port. See `IsOptionalPort` for why it is not a number. */
  @IsOptional()
  @Validate(IsOptionalPort)
  SMTP_PORT?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  /**
   * The relay credential. **Never validated beyond being a string, and never quoted in any
   * message** — a boot failure prints to stdout and into container logs (SECURITY.md §Secrets
   * Management), so a length or complexity rule here would be a rule whose violation leaks it.
   */
  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  /** Implicit TLS on/off, as a literal string. See `IsOptionalBooleanFlag`. */
  @IsOptional()
  @Validate(IsOptionalBooleanFlag)
  SMTP_SECURE?: string;

  /** Free-form, so `Name <mailbox@example.com>` passes. The relay is the authority on it. */
  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  /** One internal mailbox. Never defaulted — unset means "notify nobody", and that is honoured. */
  @IsOptional()
  @IsString()
  LEAD_NOTIFICATION_TO?: string;
}

/**
 * Refuses to start on a bad environment rather than failing later at first use. A
 * misconfigured process that boots successfully is far harder to diagnose than one
 * that does not boot at all.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    // Keeps the rejected value and the whole environment object out of the ValidationError,
    // so no formatting of it downstream can ever print the DATABASE_URL password.
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.toString()).join("\n"));
  }

  return validated;
}
