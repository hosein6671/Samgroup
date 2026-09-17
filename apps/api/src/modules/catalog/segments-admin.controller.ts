import { Body, Controller, Get, Header, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "../../prisma/generated/client";
import type { AuthenticatedUser } from "../identity/authenticated-user";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { SegmentCreate } from "./segments-admin.dto";
import { SegmentsAdminService, type SegmentListItem } from "./segments-admin.service";

/**
 * ADR-026. Admin only — unlike `BlogAdminController`, Content Manager is not admitted here: a
 * Segment is taxonomy structure every future Product's filterability depends on, not the
 * "ordinary catalogue editorial content and SEO" ADR-024 opened to Content Manager.
 */
@Controller("admin/catalog/segments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SegmentsAdminController {
  constructor(private readonly segments: SegmentsAdminService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<SegmentListItem[]> {
    return this.segments.list();
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: SegmentCreate,
  ): Promise<SegmentListItem> {
    return this.segments.create(actor.id, body);
  }
}
