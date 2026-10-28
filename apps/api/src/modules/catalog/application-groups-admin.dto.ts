import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

/** ADR-029: a new group in one Product Family. The slug is derived from the name server-side. */
export class ApplicationGroupCreate {
  @IsUUID() categoryId!: string;
  @IsString() @MinLength(1) @MaxLength(80) @Matches(/\S/) name!: string;
}

/**
 * Rename or reorder. `name` is written in the locale given by `?locale=`: the default locale's
 * value is the row's own column, any other locale's is a `content_translations` row.
 */
export class ApplicationGroupUpdate {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) @Matches(/\S/) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) sortOrder?: number;
}

export class ApplicationGroupListQuery {
  @IsOptional() @IsUUID() categoryId?: string;
}

export class ApplicationGroupLocaleQuery {
  @IsOptional() @IsString() @MaxLength(10) locale?: string;
}

/** A product's group; null removes it (ADR-029 §3). */
export class ProductApplicationGroupEdit {
  @ValidateIf((_object, value) => value !== null) @IsUUID() groupId!: string | null;
}
