import { IsUUID, ValidateIf } from "class-validator";

export class ProductClassificationEdit {
  @IsUUID() categoryId!: string;
  @ValidateIf((_object, value) => value !== null) @IsUUID() productTypeId!: string | null;
}
