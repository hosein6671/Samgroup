import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
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
