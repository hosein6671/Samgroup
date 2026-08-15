import { Transform } from "class-transformer";

/**
 * Whitespace normalization for DTO string properties, applied before validation runs.
 *
 * `plainToInstance` executes every `@Transform` while building the DTO and the global
 * ValidationPipe validates the built instance, so a value trimmed here is the value both the
 * validators and the service see. That ordering is what makes `"  "` fail `@IsNotEmpty` instead of
 * being stored as a two-space company name.
 *
 * Non-string input is passed through untouched rather than coerced — a `@IsString` violation
 * should be reported as one, not silently turned into `"[object Object]"`.
 */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  );
}

/**
 * `Trim()`, plus: a value that is empty once trimmed becomes `undefined`.
 *
 * For optional fields only, and it is the difference between a nullable column holding `NULL` and
 * holding `""`. A browser submits every control it owns, so an untouched optional input arrives as
 * an empty string on every submission; without this, "phone not given" and "phone given as empty"
 * would be two different rows for the same fact, and the first non-null check written against that
 * column later would be wrong.
 */
export function TrimToUndefined(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    return trimmed === "" ? undefined : trimmed;
  });
}
