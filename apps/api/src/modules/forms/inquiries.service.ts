import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../catalog/products.service";

import { PRISMA_INQUIRY_TYPE } from "./dto/create-inquiry.dto";
import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { CreateInquiryDto } from "./dto/create-inquiry.dto";
import type { SubmissionResponse } from "./dto/submission.response";

const UNKNOWN_PRODUCT_MESSAGE = "The submission references a product that does not exist.";
const UNKNOWN_PRODUCT_ISSUE = "must be the id of an existing product";

/**
 * Writes to `inquiries` — the one entity behind General Inquiry, Request a Quote and Request a
 * Sample alike.
 *
 * ── The submitter supplies fields; the server supplies state ────────────────
 *
 * `id`, `createdAt` and `status` are set here and are not reachable from the request: the first two
 * by the database's own defaults, the third from `INITIAL_SUBMISSION_STATUS`. `userId`,
 * `assignedToId` and `attachmentMediaId` are never written — the first because these endpoints are
 * unauthenticated (DATA_MODEL.md §2 keeps `userId` optional precisely for the later authenticated
 * case), the second because lead assignment is an Admin action, the third because no upload
 * endpoint exists.
 *
 * `productsOfInterest` falls back to `[]` rather than being omitted. The column is a NOT NULL
 * `text[]`, and an absent multi-select means "none chosen", which is an empty array — not a null
 * the column could not hold anyway.
 *
 * ── The product reference is verified, not trusted ──────────────────────────
 *
 * `relatedProductId` arrives from a hidden field on a public form, so it is checked before the
 * insert rather than left to the foreign key. Two reasons the check is worth its round trip: a
 * violated FK surfaces as a Prisma error this layer would have to translate back into a field-level
 * message anyway, and a dangling reference on a lead is silently useless — the Sales Expert opening
 * it later has no idea which product the CTA was clicked from.
 *
 * The lookup goes through `ProductsService`, never through `this.prisma.product`. ARCHITECTURE.md's
 * modular-monolith rule is explicit that a module reaches another module's data through its service
 * interface; `Product` belongs to Catalog.
 *
 * A missing product answers **400 VALIDATION_ERROR** naming `relatedProductId`, not 404. The
 * request is not a request for that product — it is a submission carrying a field whose value is
 * unusable, which is what `details[].field` exists to say.
 */
@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async create(dto: CreateInquiryDto): Promise<SubmissionResponse> {
    if (dto.relatedProductId !== undefined) {
      const exists = await this.productsService.existsById(dto.relatedProductId);

      if (!exists) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.ValidationError,
          UNKNOWN_PRODUCT_MESSAGE,
          [{ field: "relatedProductId", issue: UNKNOWN_PRODUCT_ISSUE }],
        );
      }
    }

    const inquiry = await this.prisma.inquiry.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyName: dto.companyName,
        country: dto.country,
        email: dto.email,
        phone: dto.phone ?? null,
        industry: dto.industry,
        inquiryType: PRISMA_INQUIRY_TYPE[dto.inquiryType],
        productsOfInterest: dto.productsOfInterest ?? [],
        relatedProductId: dto.relatedProductId ?? null,
        requiredQuantity: dto.requiredQuantity ?? null,
        destinationCountryPort: dto.destinationCountryPort ?? null,
        preferredIncoterm: dto.preferredIncoterm ?? null,
        message: dto.message ?? null,
        consentGiven: dto.consentGiven,
        status: INITIAL_SUBMISSION_STATUS,
      },
      // Only what the response carries. A `create` without `select` returns every column,
      // including the lead's own contact details, to a caller that has no use for them.
      select: { id: true, createdAt: true },
    });

    return { id: inquiry.id, createdAt: inquiry.createdAt.toISOString() };
  }
}
