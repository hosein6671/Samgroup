import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { UserRole } from "../../prisma/generated/client";
import type { AuthenticatedUser } from "../identity/authenticated-user";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { CategoriesAdminService, type CategoryAdminListItem } from "./categories-admin.service";

/**
 * Admin + Content Manager, mirroring `ProductEditorController` — a category's process
 * photograph is ordinary catalogue editorial content (ADR-024's carve-out), not taxonomy
 * structure, which is why this is **not** Admin-only like `SegmentsAdminController`.
 */
@Controller("admin/catalog/categories")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER)
export class CategoriesAdminController {
  constructor(private readonly categoriesAdmin: CategoriesAdminService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<CategoryAdminListItem[]> {
    return this.categoriesAdmin.list();
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadImage(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    @Body("altText") altText: unknown,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (!file || typeof altText !== "string")
      throw new BadRequestException("Choose an image and enter alt text.");
    return this.categoriesAdmin.uploadImage(id, file, altText, actor.id);
  }

  @Delete(":id/image/:imageId")
  async deleteImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.categoriesAdmin.deleteImage(id, imageId, actor.id);
    return { deleted: true };
  }
}
