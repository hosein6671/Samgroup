import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";

import { resolveLeadPage } from "./dto/admin-lead-list.query";
import { LeadNotificationService } from "./notification/lead-notification.service";
import { ACTIVE_PRIVACY_POLICY_REVISION } from "./privacy-policy-revision";
import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { AdminCustomFormulationRequestListQuery } from "./dto/admin-custom-formulation-request-list.query";
import type {
  AdminCustomFormulationRequestDetailResponse,
  AdminCustomFormulationRequestListItemResponse,
  AdminLeadPageResult,
} from "./dto/admin-lead.response";
import type { CreateCustomFormulationRequestDto } from "./dto/create-custom-formulation-request.dto";
import type { LeadScope } from "./lead-scope";
import type { SubmissionResponse } from "./dto/submission.response";
import type { Prisma } from "../../prisma/generated/client";

/** Worded exactly like its `Inquiry` counterpart: it distinguishes "no such row" from nothing. */
const NOT_FOUND_MESSAGE = "Custom formulation request not found.";

/**
 * Owns `custom_formulation_requests` — the Custom Product Request form on
 * `/customized-solutions`, its public write path, and the Admin read path behind
 * `/admin/custom-formulation-requests`.
 *
 * Same division as `InquiriesService`: the submitter supplies fields, the server supplies `id`,
 * `createdAt`, `status` and `privacyPolicyVersion`, and `userId` / `assignedToId` /
 * `attachmentMediaId` are never written. The consent-evidence field comes from the same
 * `ACTIVE_PRIVACY_POLICY_REVISION` constant both services share — see its own file for why it is
 * neither client-supplied nor read from Payload.
 *
 * **No product reference.** `custom_formulation_requests` has no `relatedProductId` column and this
 * service does not invent one — the form describes a product that does not exist yet, which is the
 * whole point of it. `productOrApplication` is free text on the request, not a catalog reference.
 */
@Injectable()
export class CustomFormulationRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadNotifications: LeadNotificationService,
  ) {}

  async create(dto: CreateCustomFormulationRequestDto): Promise<SubmissionResponse> {
    const request = await this.prisma.customFormulationRequest.create({
      data: {
        companyName: dto.companyName,
        country: dto.country,
        industry: dto.industry,
        email: dto.email,
        phone: dto.phone ?? null,
        productOrApplication: dto.productOrApplication,
        requiredSpecifications: dto.requiredSpecifications,
        estimatedQuantity: dto.estimatedQuantity ?? null,
        packagingRequirements: dto.packagingRequirements ?? null,
        additionalInformation: dto.additionalInformation ?? null,
        destinationCountry: dto.destinationCountry ?? null,
        preferredIncoterm: dto.preferredIncoterm ?? null,
        consentGiven: dto.consentGiven,
        privacyPolicyVersion: ACTIVE_PRIVACY_POLICY_REVISION,
        status: INITIAL_SUBMISSION_STATUS,
      },
      select: { id: true, createdAt: true },
    });

    const response: SubmissionResponse = {
      id: request.id,
      createdAt: request.createdAt.toISOString(),
    };

    /*
     * Same division as `InquiriesService`, and the same guarantees: the row is committed above,
     * `LeadNotificationService` never throws, and this `await` can only delay the response — by
     * at most the 5-second mail budget — never change it. See that service for why the attempt is
     * awaited rather than detached.
     *
     * No `relatedProductId` is passed because the entity has no such column; the notification for
     * this form carries no product reference at all.
     */
    await this.leadNotifications.notifyCustomFormulationRequest({
      id: response.id,
      createdAt: response.createdAt,
      privacyPolicyVersion: ACTIVE_PRIVACY_POLICY_REVISION,
      companyName: dto.companyName,
      country: dto.country,
      industry: dto.industry,
      email: dto.email,
      phone: dto.phone,
      productOrApplication: dto.productOrApplication,
      requiredSpecifications: dto.requiredSpecifications,
      estimatedQuantity: dto.estimatedQuantity,
      packagingRequirements: dto.packagingRequirements,
      destinationCountry: dto.destinationCountry,
      preferredIncoterm: dto.preferredIncoterm,
      additionalInformation: dto.additionalInformation,
    });

    return response;
  }

  /**
   * `GET /admin/custom-formulation-requests` — one page, newest first by default.
   *
   * The reasoning is `InquiriesService.findAllForAdmin`'s throughout and is not restated: the read
   * lives in the owning module because `/admin/*` is a URL namespace rather than a module; `scope`
   * is derived from the authenticated caller and never from the request; count and page share one
   * transaction so `meta.total` describes the snapshot the rows came from; and `id` breaks
   * `createdAt` ties so page boundaries are deterministic.
   *
   * The one difference is that `where` has no filter term at all. This DTO declares none — the
   * entity has no enumerated column to filter on — so `where` is the scope or nothing.
   */
  async findAllForAdmin(
    query: AdminCustomFormulationRequestListQuery,
    scope: LeadScope,
  ): Promise<AdminLeadPageResult<AdminCustomFormulationRequestListItemResponse>> {
    const { page, limit, skip, direction } = resolveLeadPage(query);
    const where: Prisma.CustomFormulationRequestWhereInput = { ...(scope ?? {}) };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customFormulationRequest.count({ where }),
      this.prisma.customFormulationRequest.findMany({
        where,
        select: ADMIN_FORMULATION_LIST_SELECT,
        orderBy: [{ createdAt: direction }, { id: direction }],
        skip,
        take: limit,
      }),
    ]);

    return { rows: rows.map(toAdminFormulationListItem), total, page, limit };
  }

  /**
   * `GET /admin/custom-formulation-requests/:id`.
   *
   * A row outside the caller's scope is **404, not 403**, for the reason `InquiriesService`
   * records: a 403 would confirm that a record with that id exists.
   */
  async findByIdForAdmin(
    id: string,
    scope: LeadScope,
  ): Promise<AdminCustomFormulationRequestDetailResponse> {
    const row = await this.prisma.customFormulationRequest.findFirst({
      where: { id, ...(scope ?? {}) },
      select: ADMIN_FORMULATION_DETAIL_SELECT,
    });

    if (row === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    return {
      ...toAdminFormulationListItem(row),
      phone: row.phone,
      requiredSpecifications: row.requiredSpecifications,
      estimatedQuantity: row.estimatedQuantity,
      packagingRequirements: row.packagingRequirements,
      additionalInformation: row.additionalInformation,
      destinationCountry: row.destinationCountry,
      preferredIncoterm: row.preferredIncoterm,
      consentGiven: row.consentGiven,
      privacyPolicyVersion: row.privacyPolicyVersion,
    };
  }
}

/** The list projection, as a Prisma `select` — declared once so query and response cannot drift. */
const ADMIN_FORMULATION_LIST_SELECT = {
  id: true,
  createdAt: true,
  companyName: true,
  country: true,
  industry: true,
  email: true,
  productOrApplication: true,
  status: true,
} as const satisfies Prisma.CustomFormulationRequestSelect;

/**
 * The detail projection. `requiredSpecifications` is the heaviest free-text field either entity
 * carries — a formulation brief — and it appears only here, never in a page of 25.
 */
const ADMIN_FORMULATION_DETAIL_SELECT = {
  ...ADMIN_FORMULATION_LIST_SELECT,
  phone: true,
  requiredSpecifications: true,
  estimatedQuantity: true,
  packagingRequirements: true,
  additionalInformation: true,
  destinationCountry: true,
  preferredIncoterm: true,
  consentGiven: true,
  privacyPolicyVersion: true,
} as const satisfies Prisma.CustomFormulationRequestSelect;

type AdminFormulationListRow = Prisma.CustomFormulationRequestGetPayload<{
  select: typeof ADMIN_FORMULATION_LIST_SELECT;
}>;

function toAdminFormulationListItem(
  row: AdminFormulationListRow,
): AdminCustomFormulationRequestListItemResponse {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    companyName: row.companyName,
    country: row.country,
    industry: row.industry,
    email: row.email,
    productOrApplication: row.productOrApplication,
    status: row.status,
  };
}
