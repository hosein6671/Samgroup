import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { withMeta } from "../../common/http/with-meta";
import { UserRole } from "../../prisma/generated/client";
import type { AuthenticatedUser } from "../identity/authenticated-user";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import {
  BlogAdminQuery,
  BlogEditorialEdit,
  BlogPostCreate,
  BlogReferenceCreate,
} from "./blog-admin.dto";
import { BlogAdminService } from "./blog-admin.service";

@Controller("admin/blog")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER)
export class BlogAdminController {
  constructor(private readonly editor: BlogAdminService) {}

  @Get("categories") @Header("Cache-Control", "no-store") categories(): Promise<unknown[]> {
    return this.editor.categories();
  }
  @Get("tags") @Header("Cache-Control", "no-store") tags(): Promise<unknown[]> {
    return this.editor.tags();
  }
  @Post("categories") createCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: BlogReferenceCreate,
  ): Promise<Record<string, unknown>> {
    return this.editor.createCategory(actor.id, body);
  }
  @Post("tags") createTag(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: BlogReferenceCreate,
  ): Promise<Record<string, unknown>> {
    return this.editor.createTag(actor.id, body);
  }

  @Get("posts")
  @Header("Cache-Control", "no-store")
  async list(@Query() query: BlogAdminQuery): Promise<ReturnType<typeof withMeta>> {
    const result = await this.editor.list(query);
    return withMeta(result.items, { total: result.total, page: query.page, limit: 20 });
  }

  @Post("posts")
  @Header("Cache-Control", "no-store")
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: BlogPostCreate,
  ): Promise<{ id: string; revision: string }> {
    return this.editor.create(actor.id, body);
  }

  @Get("posts/:id")
  @Header("Cache-Control", "no-store")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Record<string, unknown>> {
    return this.editor.get(id);
  }

  @Get("posts/:id/images")
  @Header("Cache-Control", "no-store")
  images(@Param("id", ParseUUIDPipe) id: string): Promise<unknown[]> {
    return this.editor.images(id);
  }

  @Post("posts/:id/images")
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
    return this.editor.uploadImage(id, file, altText, actor.id);
  }

  @Patch("posts/:id/images/:imageId/primary")
  async setPrimaryImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ updated: true }> {
    await this.editor.setPrimaryImage(id, imageId, actor.id);
    return { updated: true };
  }

  @Delete("posts/:id/images/:imageId")
  async deleteImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.editor.deleteImage(id, imageId, actor.id);
    return { deleted: true };
  }

  @Patch("posts/:id")
  @Header("Cache-Control", "no-store")
  save(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: BlogEditorialEdit,
  ): Promise<{ revision: string; slug: string }> {
    return this.editor.save(id, actor.id, body);
  }
}
