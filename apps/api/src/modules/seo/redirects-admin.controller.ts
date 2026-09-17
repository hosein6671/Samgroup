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
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "../../prisma/generated/client";
import type { AuthenticatedUser } from "../identity/authenticated-user";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { RedirectCreate, RedirectUpdate } from "./redirects-admin.dto";
import { RedirectsAdminService, type RedirectRow } from "./redirects-admin.service";

/** API_CONTRACT_FINAL.md §2.10 — Redirects, Admin only. */
@Controller("admin/redirects")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class RedirectsAdminController {
  constructor(private readonly redirects: RedirectsAdminService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<RedirectRow[]> {
    return this.redirects.list();
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: RedirectCreate,
  ): Promise<RedirectRow> {
    return this.redirects.create(actor.id, body);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: RedirectUpdate,
  ): Promise<RedirectRow> {
    return this.redirects.update(id, actor.id, body);
  }

  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.redirects.remove(id, actor.id);
    return { deleted: true };
  }
}
