import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { CreateCustomFormulationRequestDto } from "./dto/create-custom-formulation-request.dto";
import type { SubmissionResponse } from "./dto/submission.response";

/**
 * Writes to `custom_formulation_requests` — the Custom Product Request form on
 * `/customized-solutions`, and nothing else.
 *
 * Same division as `InquiriesService`: the submitter supplies fields, the server supplies `id`,
 * `createdAt` and `status`, and `userId` / `assignedToId` / `attachmentMediaId` are never written.
 *
 * **No product reference.** `custom_formulation_requests` has no `relatedProductId` column and this
 * service does not invent one — the form describes a product that does not exist yet, which is the
 * whole point of it. `productOrApplication` is free text on the request, not a catalog reference.
 */
@Injectable()
export class CustomFormulationRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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
        status: INITIAL_SUBMISSION_STATUS,
      },
      select: { id: true, createdAt: true },
    });

    return { id: request.id, createdAt: request.createdAt.toISOString() };
  }
}
