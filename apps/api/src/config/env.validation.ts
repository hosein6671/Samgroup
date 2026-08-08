import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  validateSync,
} from "class-validator";

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
