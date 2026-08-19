import { Body, Controller, Get, Header, Param, Patch, UseGuards } from "@nestjs/common";

import { withMeta } from "../../../common/http/with-meta";
import { CurrentUser } from "../../identity/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../identity/guards/jwt-auth.guard";
import { Roles } from "../../identity/decorators/roles.decorator";
import { RolesGuard } from "../../identity/guards/roles.guard";
import { UserRole } from "../../../prisma/generated/client";
import { LeadIdParam } from "../dto/lead-id.param";
import { ChangeLeadAssignmentDto } from "./dto/change-lead-assignment.dto";
import { ChangeLeadStatusDto } from "./dto/change-lead-status.dto";
import { LeadWorkflowService } from "./lead-workflow.service";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { LeadHistoryEntryResponse, LeadWorkflowStateResponse } from "./lead-workflow.service";
import type { ResponseWithMeta } from "../../../common/http/with-meta";

/**
 * The workflow surface for both lead kinds — API_CONTRACT_FINAL.md §2.10, the "assign, status"
 * half of the Leads group that the read gate deliberately left unbuilt.
 *
 * ## Narrow commands, not a generic PATCH
 *
 * `PATCH /:id/assignment` and `PATCH /:id/status` are separate sub-resources rather than one
 * `PATCH /:id` accepting both. Three reasons, and the first is decisive:
 *
 * 1. **They have different role lists.** Admin may do either; a Sales Expert may change status on
 *    their own lead and may not touch assignment at all. One handler would have to authorize
 *    per-field inside the body, which is where per-field authorization bugs live. Two handlers put
 *    the rule in a decorator the guard reads.
 * 2. **They write different audit tables.** One row per command, decided by the route.
 * 3. **They validate differently** — a transition graph versus an eligibility check — and
 *    `forbidNonWhitelisted` can then reject an assignment field on a status request outright.
 *
 * There is no `POST`, no `DELETE`, and no bulk endpoint. Nothing here deletes a lead.
 *
 * ## Two controllers would have been two copies
 *
 * One controller serves both kinds through a base path that ends in the kind's segment, because
 * the handlers are identical and only the `LeadKind` differs. It is registered twice in
 * `FormsModule` — once per path — via the two thin subclasses at the bottom of this file, which is
 * how Nest binds one implementation to two routes without duplicating it.
 *
 * ## Never cached
 *
 * `Cache-Control: no-store` on every response, as §2.10 requires of the whole admin namespace.
 * A mutation response carries authoritative post-state; an intermediary holding it would serve a
 * stale answer to the next operator.
 */
abstract class LeadWorkflowControllerBase {
  protected abstract readonly kind: "Inquiry" | "CustomFormulationRequest";

  constructor(protected readonly workflow: LeadWorkflowService) {}

  /**
   * Change ownership. **Admin only** — the narrower `@Roles` on this handler overrides the
   * controller's, which is exactly what `getAllAndOverride` in `RolesGuard` is for.
   *
   * A Sales Expert reaching this receives **403**: they may work their leads, not redistribute
   * them. A Content Manager receives 403 for everything on this controller.
   */
  @Roles(UserRole.ADMIN)
  @Header("Cache-Control", "no-store")
  @Patch(":id/assignment")
  async changeAssignment(
    @Param() params: LeadIdParam,
    @Body() dto: ChangeLeadAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseWithMeta<LeadWorkflowStateResponse>> {
    return withMeta(await this.workflow.changeAssignment(this.kind, params.id, dto, actor), {});
  }

  /**
   * Move the lead through the workflow. **Admin on any readable lead; Sales Expert on their own.**
   *
   * The role list admits both; which *rows* a Sales Expert may act on is the same server-derived
   * scope the read endpoints use, applied inside the service. A Sales Expert transitioning a lead
   * that is not theirs gets 404, not 403 — the scope answers before the capability does.
   */
  @Roles(UserRole.ADMIN, UserRole.SALES_EXPERT)
  @Header("Cache-Control", "no-store")
  @Patch(":id/status")
  async changeStatus(
    @Param() params: LeadIdParam,
    @Body() dto: ChangeLeadStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseWithMeta<LeadWorkflowStateResponse>> {
    return withMeta(await this.workflow.changeStatus(this.kind, params.id, dto, actor), {});
  }

  /**
   * The lead's combined history, newest first.
   *
   * **Admin and Sales Expert only — Content Manager is excluded, deliberately.** They may read
   * leads; history is a record of which member of staff did what and when, which is employee
   * activity data rather than lead data, and the RBAC matrix gives them no operational reason to
   * see it. That exclusion is a decision of this gate and is recorded in SECURITY.md.
   *
   * Nested under the lead so it cannot be reached without one, and scoped identically: this is not
   * a global audit-log API and must not become one.
   */
  @Roles(UserRole.ADMIN, UserRole.SALES_EXPERT)
  @Header("Cache-Control", "no-store")
  @Get(":id/history")
  async readHistory(
    @Param() params: LeadIdParam,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseWithMeta<LeadHistoryEntryResponse[]>> {
    const entries = await this.workflow.readHistory(this.kind, params.id, actor);

    return withMeta(entries, { total: entries.length });
  }
}

/**
 * `/admin/inquiries/:id/{assignment,status,history}`.
 *
 * `@UseGuards` and the controller-level `@Roles` are declared on the concrete classes rather than
 * the base: Nest reads metadata from the class it instantiates, and metadata on an abstract base is
 * not inherited by `getAllAndOverride` unless the base itself is the resolved class. Declaring them
 * here is what makes the guard actually run — asserted by test rather than assumed, because a guard
 * that silently does not run is the worst possible failure on this surface.
 *
 * **The constructor is re-declared on each subclass for the same class of reason, and it is
 * load-bearing.** TypeScript emits `design:paramtypes` for a class's *own* constructor; a derived
 * class that declares none emits an **empty** array, so Nest injects nothing and `this.workflow` is
 * `undefined` at request time. Nothing catches that statically — the class type-checks, and a unit
 * test that constructs the controller by hand passes — so it surfaces only as a 500 on a live
 * PATCH, which is exactly how it was found. The spec now asserts the emitted metadata directly.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SALES_EXPERT)
@Controller("admin/inquiries")
export class AdminInquiryWorkflowController extends LeadWorkflowControllerBase {
  protected readonly kind = "Inquiry" as const;

  constructor(workflow: LeadWorkflowService) {
    super(workflow);
  }
}

/** `/admin/custom-formulation-requests/:id/{assignment,status,history}`. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SALES_EXPERT)
@Controller("admin/custom-formulation-requests")
export class AdminCustomFormulationWorkflowController extends LeadWorkflowControllerBase {
  protected readonly kind = "CustomFormulationRequest" as const;

  constructor(workflow: LeadWorkflowService) {
    super(workflow);
  }
}
