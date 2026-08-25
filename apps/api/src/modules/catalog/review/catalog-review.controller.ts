import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { withMeta } from "../../../common/http/with-meta";
import { CurrentUser } from "../../identity/decorators/current-user.decorator";
import { Roles } from "../../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/guards/roles.guard";
import { UserRole } from "../../../prisma/generated/client";

import { CatalogReviewService } from "./catalog-review.service";
import { ReviewDecisionDto } from "./dto/review-decision.dto";
import { ReviewQueueQuery } from "./dto/review-queue.query";
import { ReviewSubjectIdParam } from "./dto/review-subject-id.param";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { ResponseWithMeta } from "../../../common/http/with-meta";
import type { ReviewSubjectType } from "./review-subject";
import type {
  ReviewDecisionResponse,
  ReviewDetailResponse,
  ReviewQueueItemResponse,
} from "./dto/review.response";

/**
 * The Admin catalog technical-review surface — `/admin/catalog/review/*`.
 *
 * ## Admin only, and there is no second authentication system
 *
 * `JwtAuthGuard` then `RolesGuard`, the two guards every protected route on this platform uses,
 * with `@Roles(UserRole.ADMIN)` on the class. Nothing new was invented: the token is the one
 * NestJS issues (ADR-003), the role is the one `sam_platform` holds on the `users` row, and the
 * guard is the one `AdminUsersController` and the lead workflow already run behind.
 *
 * The resulting matrix, and each answer is a consequence of that stack rather than a rule written
 * here:
 *
 *   * **no token, bad token, expired token, deleted user** → **401**, one message for all of them
 *     (`JwtAuthGuard`);
 *   * **Content Manager, Sales Expert, Customer** → **403**, naming no role (`RolesGuard`);
 *   * **a service account** → whatever its `users.role` says. This platform has four roles and no
 *     machine role; a service identity is denied unless somebody deliberately made it an Admin
 *     user, in which case it *is* an explicitly authorized Admin identity. Payload's own `service`
 *     role lives in `sam_cms` and is unrelated (ADR-006) — no value here is compared against it;
 *   * **Admin** → allowed.
 *
 * SECURITY.md's matrix gives Content Manager and Sales Expert `read` on Products/Catalog. That
 * column is about catalog product data — the rows the public API serves. This surface is not that:
 * it exposes unapproved technical values, supplier provenance and internal `sourceRef`, and the
 * decision half of it is a catalog **write**, which the matrix gives to Admin alone. Narrower than
 * the matrix is always safe; widening it would need the matrix changed first.
 *
 * ## What is deliberately absent
 *
 * * **No public route.** Nothing in this file is reachable without a token, and no public
 *   controller imports anything from this module.
 * * **No generic status endpoint.** There is no `PATCH`, no `PUT`, and no handler anywhere that
 *   accepts a `reviewStatus`. ADR-014 §8 requires that, and the absence is the enforcement.
 * * **No bulk decision.** One subject per request, by construction: the subject id is in the path.
 * * **No document proxy.** No handler streams, redirects to, or signs a URL for a source document.
 *   The review DTO carries a document's identity — title, publisher, locator, hash — and a
 *   reviewer opens the source through whatever channel they already have. Adding a download route
 *   here would put TDS bytes on an HTTP surface, which ADR-014 refuses on republication grounds.
 *
 * ## Never cached
 *
 * `Cache-Control: no-store` on every response, as API_CONTRACT_FINAL.md §2.10 requires of the
 * whole admin namespace. Set on the handlers rather than left to a proxy: these responses carry
 * unapproved technical data and internal identities, and an intermediary holding one is the exact
 * cache-poisoning shape §2.10's separate namespace exists to prevent.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/catalog/review")
export class CatalogReviewQueueController {
  constructor(private readonly review: CatalogReviewService) {}

  /**
   * `GET /admin/catalog/review/queue` — both subject types in one paginated list.
   *
   * `meta.total/page/limit` are always present, per API_DESIGN.md §Pagination & Filtering. There
   * is no `localeFallback`: nothing on this surface is translated, and technical review is done
   * against the source's own wording.
   */
  @Header("Cache-Control", "no-store")
  @Get("queue")
  async queue(
    @Query() query: ReviewQueueQuery,
  ): Promise<ResponseWithMeta<ReviewQueueItemResponse[]>> {
    const { items, total, page, limit } = await this.review.queue(query);

    return withMeta(items, { total, page, limit });
  }
}

/**
 * One subject type's review routes.
 *
 * Registered twice through the two thin subclasses below, following the precedent
 * `LeadWorkflowControllerBase` sets: the handlers are identical and only the `ReviewSubjectType`
 * differs, so one implementation is bound to two base paths rather than copied.
 *
 * **`@UseGuards` and `@Roles` are declared on the concrete classes, not here**, and **each
 * subclass re-declares its constructor**. Both are load-bearing for the same reason and both are
 * asserted by test: Nest reads metadata from the class it instantiates, and TypeScript emits
 * `design:paramtypes` for a class's *own* constructor — a derived class that declares none emits
 * an empty array, Nest injects nothing, and the service is `undefined` at request time. That
 * failure is invisible to `tsc` and to a unit test that constructs the controller by hand.
 */
abstract class ReviewSubjectControllerBase {
  protected abstract readonly subjectType: ReviewSubjectType;

  constructor(protected readonly review: CatalogReviewService) {}

  /** `GET /admin/catalog/review/{subject}/:id` — the full review context for one subject. */
  @Header("Cache-Control", "no-store")
  @Get(":id")
  async detail(
    @Param() params: ReviewSubjectIdParam,
  ): Promise<ResponseWithMeta<ReviewDetailResponse>> {
    return withMeta(await this.review.detail(this.subjectType, params.id), {});
  }

  /**
   * `POST /admin/catalog/review/{subject}/:id/decisions` — record one decision.
   *
   * **`POST` to a sub-collection, not `PATCH` on the subject.** A decision is an event that is
   * appended to an immutable history; the subject's status moving is a consequence of it, not the
   * request. Spelling it as a `PATCH` on the subject would make the status the thing being
   * written, which is exactly the generic-update shape ADR-014 §8 forbids — and it would suggest
   * a decision can be edited, which it cannot.
   *
   * **201, not 200.** A `TechnicalReview` row is created, and it is addressable by the id the
   * response carries.
   */
  @Header("Cache-Control", "no-store")
  @HttpCode(HttpStatus.CREATED)
  @Post(":id/decisions")
  async decide(
    @Param() params: ReviewSubjectIdParam,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseWithMeta<ReviewDecisionResponse>> {
    return withMeta(await this.review.decide(this.subjectType, params.id, dto, actor), {});
  }
}

/** `/admin/catalog/review/specifications/:id` and its `decisions` sub-collection. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/catalog/review/specifications")
export class SpecificationReviewController extends ReviewSubjectControllerBase {
  protected readonly subjectType = "specification" as const;

  constructor(review: CatalogReviewService) {
    super(review);
  }
}

/** `/admin/catalog/review/product-claims/:id` and its `decisions` sub-collection. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/catalog/review/product-claims")
export class ProductClaimReviewController extends ReviewSubjectControllerBase {
  protected readonly subjectType = "product_claim" as const;

  constructor(review: CatalogReviewService) {
    super(review);
  }
}
