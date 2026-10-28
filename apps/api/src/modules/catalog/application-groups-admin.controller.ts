import {
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
} from "@nestjs/common";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { UserRole } from "../../prisma/generated/client";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";

import {
  ApplicationGroupCreate,
  ApplicationGroupListQuery,
  ApplicationGroupLocaleQuery,
  ApplicationGroupUpdate,
  ProductApplicationGroupEdit,
} from "./application-groups-admin.dto";
import {
  ApplicationGroupsAdminService,
  type ApplicationGroupListItem,
} from "./application-groups-admin.service";

import type { AuthenticatedUser } from "../identity/authenticated-user";

/**
 * ADR-029 §3: a family's application groups are taxonomy structure — Admin only, as for
 * Segments (ADR-026).
 */
@Controller("admin/catalog/application-groups")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ApplicationGroupsAdminController {
  constructor(
    private readonly groups: ApplicationGroupsAdminService,
    private readonly locales: LocaleResolutionService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: ApplicationGroupListQuery): Promise<ApplicationGroupListItem[]> {
    return this.groups.list(query.categoryId);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ApplicationGroupCreate,
  ): Promise<ApplicationGroupListItem> {
    return this.groups.create(actor.id, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ApplicationGroupUpdate,
    @Query() query: ApplicationGroupLocaleQuery,
  ): Promise<{ updated: true }> {
    const locale = await this.locales.resolve(query.locale);
    await this.groups.update(actor.id, id, body, locale);
    return { updated: true };
  }

  @Delete(":id")
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    await this.groups.remove(actor.id, id);
    return { deleted: true };
  }
}

/** ADR-029 §3: assigning a product to a group is open to Content Manager, like Segments. */
@Controller("admin/products")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER)
export class ProductApplicationGroupController {
  constructor(private readonly groups: ApplicationGroupsAdminService) {}

  @Get(":id/application-group")
  @Header("Cache-Control", "no-store")
  get(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ assigned: string | null; available: { id: string; name: string; slug: string }[] }> {
    return this.groups.forProduct(id);
  }

  @Patch(":id/application-group")
  async set(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ProductApplicationGroupEdit,
  ): Promise<{ assigned: string | null }> {
    await this.groups.assign(actor.id, id, body.groupId);
    return { assigned: body.groupId };
  }
}
