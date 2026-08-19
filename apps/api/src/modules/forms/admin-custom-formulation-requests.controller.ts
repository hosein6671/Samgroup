import { Controller, Get, Header, Param, Query, UseGuards } from "@nestjs/common";

import { withMeta } from "../../common/http/with-meta";
import { UserRole } from "../../prisma/generated/client";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";

import { CustomFormulationRequestsService } from "./custom-formulation-requests.service";
import { AdminCustomFormulationRequestListQuery } from "./dto/admin-custom-formulation-request-list.query";
import { LeadIdParam } from "./dto/lead-id.param";
import { resolveLeadScope } from "./lead-scope";

import type {
  AdminCustomFormulationRequestDetailResponse,
  AdminCustomFormulationRequestListItemResponse,
} from "./dto/admin-lead.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";
import type { AuthenticatedUser } from "../identity/authenticated-user";

/**
 * `GET /admin/custom-formulation-requests` and `.../:id` — API_CONTRACT_FINAL.md §2.10, Leads row.
 *
 * A separate controller rather than a mode of the inquiries one, because these are separate paths
 * over separate tables with different projections, and §2.10 lists them as two paths. Everything
 * the two share — read-only scope, the three roles, server-derived lead scoping, `no-store` — is
 * argued once in `admin-inquiries.controller.ts` and holds here unchanged.
 *
 * The one difference worth naming: this endpoint takes **no filter parameter at all**. There is no
 * enumerated column on `custom_formulation_requests` to filter by, and building a facet vocabulary
 * out of free-text `industry` values would be deciding search semantics inside a read-only gate.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER, UserRole.SALES_EXPERT)
@Controller("admin/custom-formulation-requests")
export class AdminCustomFormulationRequestsController {
  constructor(private readonly requests: CustomFormulationRequestsService) {}

  @Header("Cache-Control", "no-store")
  @Get()
  async list(
    @Query() query: AdminCustomFormulationRequestListQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseWithMeta<AdminCustomFormulationRequestListItemResponse[]>> {
    const { rows, total, page, limit } = await this.requests.findAllForAdmin(
      query,
      resolveLeadScope(user),
    );

    return withMeta(rows, { total, page, limit });
  }

  @Header("Cache-Control", "no-store")
  @Get(":id")
  async detail(
    @Param() params: LeadIdParam,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminCustomFormulationRequestDetailResponse> {
    return this.requests.findByIdForAdmin(params.id, resolveLeadScope(user));
  }
}
