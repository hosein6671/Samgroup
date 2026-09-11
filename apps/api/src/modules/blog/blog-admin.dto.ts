import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from "class-validator";

export class BlogSeoEdit {
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string;
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  canonicalUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) ogTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) ogDescription?: string;
  @IsOptional() @IsString() @MaxLength(200) twitterTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) twitterDescription?: string;
  @IsOptional() @IsIn(["summary", "summary_large_image"]) twitterCardType?:
    "summary" | "summary_large_image";
  @IsBoolean() robotsIndex!: boolean;
  @IsBoolean() robotsFollow!: boolean;
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords!: string[];
}

export class BlogEditorialContent {
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) title!: string;
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsString() @MinLength(1) @MaxLength(100000) @Matches(/\S/) content!: string;
  @IsUUID() categoryId!: string;
  @IsArray() @ArrayMaxSize(30) @IsUUID(undefined, { each: true }) tagIds!: string[];
  @IsDefined() @IsObject() @ValidateNested() @Type(() => BlogSeoEdit) seo!: BlogSeoEdit;
}

export class BlogEditorialEdit {
  @IsInt() @Min(0) revision!: number;
  @IsIn(["save-draft", "publish"]) action!: "save-draft" | "publish";
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BlogEditorialContent)
  content!: BlogEditorialContent;
}

export class BlogPostCreate {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BlogEditorialContent)
  content!: BlogEditorialContent;
}

export class BlogAdminQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsIn(["draft", "published"]) status?: "draft" | "published";
}

export class BlogReferenceCreate {
  @IsString() @MinLength(1) @MaxLength(100) @Matches(/\S/) name!: string;
  @IsString() @MinLength(1) @MaxLength(100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
}
