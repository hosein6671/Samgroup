import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

/** A stored path, never a URL — matches `RedirectResponse`'s own contract. */
const PATH_PATTERN = /^\/\S*$/;

export class RedirectCreate {
  @IsString() @MaxLength(2000) @Matches(PATH_PATTERN) fromPath!: string;
  @IsString() @MaxLength(2000) @Matches(PATH_PATTERN) toPath!: string;
  @IsOptional() @IsIn([301, 302]) statusCode?: number;
  /** Omitted or `null` — a global rule. A real code narrows it to one locale. */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(10) locale?:
    string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class RedirectUpdate {
  @IsOptional() @IsString() @MaxLength(2000) @Matches(PATH_PATTERN) toPath?: string;
  @IsOptional() @IsIn([301, 302]) statusCode?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
