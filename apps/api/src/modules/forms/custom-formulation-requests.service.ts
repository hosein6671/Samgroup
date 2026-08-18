import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

import { LeadNotificationService } from "./notification/lead-notification.service";
import { ACTIVE_PRIVACY_POLICY_REVISION } from "./privacy-policy-revision";
import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { CreateCustomFormulationRequestDto } from "./dto/create-custom-formulation-request.dto";
import type { SubmissionResponse } from "./dto/submission.response";

/**
 * Writes to `custom_formulation_requests` — the Custom Product Request form on
 * `/customized-solutions`, and nothing else.
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
}
