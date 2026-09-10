import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
  IsUrl,
  ValidateIf,
} from "class-validator";

export class ProductSeoEdit {
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
export class ProductEditorialPoint {
  @IsString() @MaxLength(160) @Matches(/\S/) title!: string;
  @IsString() @MaxLength(2000) @Matches(/\S/) description!: string;
}
export class ProductEditorialQuestion {
  @IsString() @MaxLength(300) @Matches(/\S/) question!: string;
  @IsString() @MaxLength(4000) @Matches(/\S/) answer!: string;
}
export class ProductEditorialContent {
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProductEditorialPoint)
  applications?: ProductEditorialPoint[];
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProductEditorialPoint)
  features?: ProductEditorialPoint[];
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProductEditorialQuestion)
  faq?: ProductEditorialQuestion[];
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) name!: string;
  @IsString() @MaxLength(10000) description!: string;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ProductSeoEdit) seo!: ProductSeoEdit;
}
export class ProductEditorialEdit {
  @IsInt() @Min(0) revision!: number;
  @IsIn(["save-draft", "publish"]) action!: "save-draft" | "publish";
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ProductEditorialContent)
  content!: ProductEditorialContent;
}
export class ProductEditorQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() categoryId?: string;
}
