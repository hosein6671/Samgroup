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
import { UserRole } from "../../prisma/generated/client";
import { withMeta } from "../../common/http/with-meta";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import type { AuthenticatedUser } from "../identity/authenticated-user";
import { ProductEditorialEdit, ProductEditorQuery } from "./product-editor.dto";
import { ProductEditorService } from "./product-editor.service";

@Controller("admin/products")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER)
export class ProductEditorController {
  constructor(private readonly editor: ProductEditorService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Query() query: ProductEditorQuery): Promise<ReturnType<typeof withMeta>> {
    const result = await this.editor.list(query);
    return withMeta(result.items, { total: result.total, page: query.page, limit: 20 });
  }
  @Get(":id")
  @Header("Cache-Control", "no-store")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Record<string, unknown>> {
    return this.editor.get(id);
  }
  @Get(":id/images")
  @Header("Cache-Control", "no-store")
  images(@Param("id", ParseUUIDPipe) id: string): Promise<unknown[]> {
    return this.editor.images(id);
  }
  @Post(":id/images")
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
  @Patch(":id/images/:imageId/primary")
  async setPrimaryImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ updated: true }> {
    await this.editor.setPrimaryImage(id, imageId, actor.id);
    return { updated: true };
  }
  @Delete(":id/images/:imageId")
  async deleteImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.editor.deleteImage(id, imageId, actor.id);
    return { deleted: true };
  }
  @Patch(":id")
  @Header("Cache-Control", "no-store")
  save(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ProductEditorialEdit,
  ): Promise<{ revision: string; slug: string }> {
    return this.editor.save(id, actor.id, body);
  }
}
