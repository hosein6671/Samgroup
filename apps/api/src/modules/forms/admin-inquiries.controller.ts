import { Controller, Get, Header, Param, Query, UseGuards } from "@nestjs/common";

import { withMeta } from "../../common/http/with-meta";
import { UserRole } from "../../prisma/generated/client";
import { CurrentUser } from "../identity/decorators/current-user.decorator";
import { Roles } from "../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";

import { AdminInquiryListQuery } from "./dto/admin-inquiry-list.query";
import { LeadIdParam } from "./dto/lead-id.param";
import { InquiriesService } from "./inquiries.service";
import { resolveLeadScope } from "./lead-scope";

import type {
  AdminInquiryDetailResponse,
  AdminInquiryListItemResponse,
} from "./dto/admin-lead.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";
import type { AuthenticatedUser } from "../identity/authenticated-user";

/**
 * `GET /admin/inquiries` and `GET /admin/inquiries/:id` — API_CONTRACT_FINAL.md §2.10, Leads row.
 *
 * ── Read-only, and the omission is the decision ─────────────────────────────
 *
 * §2.10 contracts the group as "list, read, **assign, status**". This implements the first two and
 * nothing else. There is no `PATCH`, no `POST`, no `DELETE`, and no status transition — because
 * there is no status vocabulary to transition through: `submission-status.ts` records that `new`
 * is the initial ingestion state with **no authorized transition and no second value**, and
 * DATA_MODEL.md §2 anchors a `StatusHistory` audit trail that does not exist yet. Assignment and
 * lifecycle are one gate, this inbox is another, and building half of the first inside the second
 * is how an unaudited workflow gets shipped.
 *
 * ── Three roles, straight off the matrix ────────────────────────────────────
 *
 * SECURITY.md's RBAC matrix, "Forms & Leads": Admin **full**, Content Manager **read**, Sales
 * Expert **full (own leads)**. §2.10 says the same in its own words — "Admin (all) · Sales Expert
 * (own leads only) · Content Manager (read)". All three appear in `@Roles()`; `Customer` does not,
 * and its cell in that column ("create (own)") is the public submission endpoint, not this one.
 *
 * **What separates the three is not the guard.** `RolesGuard` decides who may call the endpoint;
 * `resolveLeadScope` decides which rows they see, derived from the authenticated caller and never
 * from the request. That split is SECURITY.md §RBAC integration rule 2, and it is why no list DTO
 * here declares `assignedToId`.
 *
 * ── Never cached ────────────────────────────────────────────────────────────
 *
 * `Cache-Control: no-store` on every handler — §2.10's first rule, and the reason the admin
 * namespace exists at all: "public is cacheable, admin is not" is meant to be structural. These
 * responses carry named people's contact details, so an intermediary holding one is the failure
 * this header exists to prevent. `@Header` is per-handler in Nest and does not inherit from the
 * controller, so it is written on both.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTENT_MANAGER, UserRole.SALES_EXPERT)
@Controller("admin/inquiries")
export class AdminInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  /**
   * `meta.total/page/limit` are always present, per API_DESIGN.md §Pagination & Filtering. No
   * `localeFallback`: a submission is stored in the words the submitter typed and is not a
   * translated entity, so there is nothing here that could fall back.
   *
   * **`AdminInquiryListQuery` is imported as a value, never with `import type`.** The global
   * ValidationPipe finds the class through `design:paramtypes`; a type-only import erases it, the
   * emitted metatype becomes `Function`, and the pipe then answers 400 with every legitimate
   * parameter reported as "should not exist". That is not hypothetical — it happened on the public
   * Forms controllers, and it is guarded by test there and here.
   */
  @Header("Cache-Control", "no-store")
  @Get()
  async list(
    @Query() query: AdminInquiryListQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseWithMeta<AdminInquiryListItemResponse[]>> {
    const { rows, total, page, limit } = await this.inquiries.findAllForAdmin(
      query,
      resolveLeadScope(user),
    );

    return withMeta(rows, { total, page, limit });
  }

  /**
   * `:id` is a UUID, validated by `LeadIdParam` before any query runs — a malformed segment is 400
   * naming `id`, not a 500 raised by the driver. An id that names no row the caller may see is
   * 404; the service explains why that stays 404 rather than 403 even when the row exists.
   */
  @Header("Cache-Control", "no-store")
  @Get(":id")
  async detail(
    @Param() params: LeadIdParam,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminInquiryDetailResponse> {
    return this.inquiries.findByIdForAdmin(params.id, resolveLeadScope(user));
  }
}
