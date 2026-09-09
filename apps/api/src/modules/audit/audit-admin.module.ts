import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Module,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { withMeta } from "../../common/http/with-meta";
import { UserRole } from "../../prisma/generated/client";
import { IdentityModule } from "../identity/identity.module";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { AuditModule } from "./audit.module";
import { AuditService } from "./audit.service";
import type { AuditEventName } from "./audit.service";

export class AuditQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional()
  @IsIn([
    "product.draft_saved",
    "product.published",
    "auth.login",
    "auth.refresh",
    "auth.logout",
    "access.denied",
    "user.created",
    "user.role_changed",
    "user.status_changed",
  ])
  event?: AuditEventName;
  @IsOptional() @IsIn(["success", "failure"]) outcome?: "success" | "failure";
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
}
@Controller("admin/audit-events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Query() query: AuditQuery): Promise<ReturnType<typeof withMeta>> {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException("Start time must not be after end time.");
    }
    const result = await this.audit.list(query.page, query);
    return withMeta(result.items, { total: result.total, page: query.page, limit: 50 });
  }
}
@Module({ imports: [IdentityModule, AuditModule], controllers: [AuditController] })
export class AuditAdminModule {}
