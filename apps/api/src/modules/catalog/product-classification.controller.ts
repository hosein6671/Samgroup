import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";

import { UserRole } from "../../prisma/generated/client";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";

import { ProductClassificationEdit } from "./product-classification.dto";
import {
  ProductClassificationService,
  type ProductClassification,
} from "./product-classification.service";

import type { AuthenticatedUser } from "../identity/authenticated-user";

/**
 * ADR-030: Product Family and Product Type are classification structure — Admin only, like
 * application-group and Segment structure (ADR-029, ADR-026). Content Manager keeps Segment and
 * group assignment.
 */
@Controller("admin/products")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ProductClassificationController {
  constructor(private readonly classification: ProductClassificationService) {}

  @Get(":id/classification")
  @Header("Cache-Control", "no-store")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<ProductClassification> {
    return this.classification.get(id);
  }

  @Patch(":id/classification")
  set(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ProductClassificationEdit,
  ): Promise<{ categoryId: string; productTypeId: string | null; groupCleared: boolean }> {
    return this.classification.set(actor.id, id, body);
  }
}
