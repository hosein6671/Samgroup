import { plainToInstance } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min, validateSync } from "class-validator";

export enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;
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

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.toString()).join("\n"));
  }

  return validated;
}
