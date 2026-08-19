import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../catalog/products.service";

import { resolveLeadPage } from "./dto/admin-lead-list.query";
import { PRISMA_INQUIRY_TYPE } from "./dto/create-inquiry.dto";
import { toWireInquiryType } from "./inquiry-type-wire";
import { LeadNotificationService } from "./notification/lead-notification.service";
import { ACTIVE_PRIVACY_POLICY_REVISION } from "./privacy-policy-revision";
import { INITIAL_SUBMISSION_STATUS } from "./submission-status";

import type { AdminInquiryListQuery } from "./dto/admin-inquiry-list.query";
import type {
  AdminInquiryDetailResponse,
  AdminInquiryListItemResponse,
  AdminLeadPageResult,
} from "./dto/admin-lead.response";
import type { CreateInquiryDto } from "./dto/create-inquiry.dto";
import type { LeadScope } from "./lead-scope";
import type { SubmissionResponse } from "./dto/submission.response";
import type { Prisma } from "../../prisma/generated/client";

const UNKNOWN_PRODUCT_MESSAGE = "The submission references a product that does not exist.";
const UNKNOWN_PRODUCT_ISSUE = "must be the id of an existing product";

/**
 * The 404 message. It names nothing about the record and reads identically whether the id was
 * never issued or belongs to a lead assigned to somebody else — see `findByIdForAdmin`.
 */
const NOT_FOUND_MESSAGE = "Inquiry not found.";

/**
 * Owns `inquiries` — the one entity behind General Inquiry, Request a Quote and Request a Sample
 * alike. This module holds both the public write path and the Admin read path behind
 * `/admin/inquiries`, because the table has exactly one owning module.
 *
 * ── The submitter supplies fields; the server supplies state ────────────────
 *
 * `id`, `createdAt`, `status` and `privacyPolicyVersion` are set here and are not reachable from the
 * request: the first two by the database's own defaults, the third from `INITIAL_SUBMISSION_STATUS`,
 * the fourth from `ACTIVE_PRIVACY_POLICY_REVISION` — the consent evidence SECURITY.md ratified, a
 * stored literal rather than a lookup, so no CMS outage can block this write and no later edit
 * anywhere can rewrite what a submitter agreed to.
 *
 * `userId`, `assignedToId` and `attachmentMediaId` are never written — the first because these
 * endpoints are unauthenticated (DATA_MODEL.md §2 keeps `userId` optional precisely for the later
 * authenticated case), the second because lead assignment is an Admin action, the third because no
 * upload endpoint exists.
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
    private readonly leadNotifications: LeadNotificationService,
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
        privacyPolicyVersion: ACTIVE_PRIVACY_POLICY_REVISION,
        status: INITIAL_SUBMISSION_STATUS,
      },
      // Only what the response carries. A `create` without `select` returns every column,
      // including the lead's own contact details, to a caller that has no use for them.
      select: { id: true, createdAt: true },
    });

    const response: SubmissionResponse = {
      id: inquiry.id,
      createdAt: inquiry.createdAt.toISOString(),
    };

    /*
     * ── After the write, and outside its success condition ─────────────────
     *
     * The row is committed by the line above; this cannot undo it, and by contract
     * `LeadNotificationService` never throws — a refused relay, a rejected credential and the
     * 5-second timeout are all caught, logged and swallowed inside it. So the `await` here
     * delays the response by at most the mail budget and can never change it.
     *
     * It is awaited rather than detached deliberately. A floating promise would return sooner and
     * would be silently dropped whenever the process is replaced mid-request; doing it properly
     * asynchronously needs a queue and a durable delivery record, which is a separate architecture
     * gate. See the note on LeadNotificationService.
     *
     * The values passed are the ones just written — the persisted `id` and `createdAt`, the
     * validated DTO, and the same `ACTIVE_PRIVACY_POLICY_REVISION` the row carries. Nothing is
     * re-read, and `relatedProductId` is passed as the id it is: resolving a product name would
     * add a Catalog read to a path whose failure is defined not to matter.
     */
    await this.leadNotifications.notifyInquiry({
      id: response.id,
      createdAt: response.createdAt,
      privacyPolicyVersion: ACTIVE_PRIVACY_POLICY_REVISION,
      inquiryType: dto.inquiryType,
      firstName: dto.firstName,
      lastName: dto.lastName,
      companyName: dto.companyName,
      country: dto.country,
      email: dto.email,
      industry: dto.industry,
      phone: dto.phone,
      relatedProductId: dto.relatedProductId,
      productsOfInterest: dto.productsOfInterest,
      requiredQuantity: dto.requiredQuantity,
      destinationCountryPort: dto.destinationCountryPort,
      preferredIncoterm: dto.preferredIncoterm,
      message: dto.message,
    });

    return response;
  }

  /**
   * `GET /admin/inquiries` — one page of leads, newest first by default.
   *
   * ── Why this read lives here rather than in an Admin module ─────────────
   *
   * `Inquiry` is the Forms module's entity (ARCHITECTURE.md §Modules), and the modular-monolith
   * rule is that a module never reaches another module's repository or model. `/admin/*` is a URL
   * namespace, not a module — the same reading `admin-users.controller.ts` records for
   * `GET /admin/users`, which sits inside Identity because `User` is Identity's. An "Admin" module
   * querying `inquiries` itself would be the exact cross-module repository access the rule forbids,
   * and would give this table two owners.
   *
   * ── `scope` is authorization, and it is applied here ────────────────────
   *
   * It arrives already derived from the authenticated caller (`lead-scope.ts`) and is spread into
   * `where` before anything else. Nothing the client sent can reach that object: `inquiryType` is
   * the only caller-controlled term, it is validated against a closed list, and the DTO declares no
   * `assignedToId` at all.
   *
   * ── Count and page in one transaction ───────────────────────────────────
   *
   * `$transaction` so `meta.total` describes the same snapshot the rows came from. Without it a
   * submission arriving between the two queries makes a page report a total no page boundary
   * agrees with — the same shape `ProductsService.findAll` uses, for the same reason.
   *
   * A page beyond the end returns an empty array with the real `total`, not a 404. There is no
   * "page not found" in this contract, and a client that lands on `?page=9` after rows were read
   * should see an empty inbox page, not an error.
   */
  async findAllForAdmin(
    query: AdminInquiryListQuery,
    scope: LeadScope,
  ): Promise<AdminLeadPageResult<AdminInquiryListItemResponse>> {
    const { page, limit, skip, direction } = resolveLeadPage(query);

    const where: Prisma.InquiryWhereInput = {
      ...(scope ?? {}),
      ...(query.inquiryType === undefined
        ? {}
        : { inquiryType: PRISMA_INQUIRY_TYPE[query.inquiryType] }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inquiry.count({ where }),
      this.prisma.inquiry.findMany({
        where,
        select: ADMIN_INQUIRY_LIST_SELECT,
        // `id` breaks ties in the same direction — `created_at` alone is not a unique key, and a
        // non-deterministic order is how a row shows on two pages or on none.
        orderBy: [{ createdAt: direction }, { id: direction }],
        skip,
        take: limit,
      }),
    ]);

    return { rows: rows.map(toAdminInquiryListItem), total, page, limit };
  }

  /**
   * `GET /admin/inquiries/:id`.
   *
   * **A row outside the caller's scope is 404, not 403.** `findFirst` with the scope in `where`
   * means an unassigned lead is simply not found for a Sales Expert, which is the answer that
   * discloses least: a 403 here would confirm that a record with that id exists, turning the
   * endpoint into an existence oracle for anyone who can guess or harvest an id. 403 remains the
   * answer to "your role may not use this endpoint at all", which `RolesGuard` decides before this
   * method runs.
   */
  async findByIdForAdmin(id: string, scope: LeadScope): Promise<AdminInquiryDetailResponse> {
    const row = await this.prisma.inquiry.findFirst({
      where: { id, ...(scope ?? {}) },
      select: ADMIN_INQUIRY_DETAIL_SELECT,
    });

    if (row === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    return {
      ...toAdminInquiryListItem(row),
      phone: row.phone,
      industry: row.industry,
      productsOfInterest: row.productsOfInterest,
      requiredQuantity: row.requiredQuantity,
      destinationCountryPort: row.destinationCountryPort,
      preferredIncoterm: row.preferredIncoterm,
      message: row.message,
      consentGiven: row.consentGiven,
      privacyPolicyVersion: row.privacyPolicyVersion,
    };
  }
}

/**
 * The list projection, as a Prisma `select`. Declared once so the query and the response type
 * cannot drift: a field added to one without the other is a compile error rather than a silent
 * omission or a silently over-selected column.
 */
const ADMIN_INQUIRY_LIST_SELECT = {
  id: true,
  createdAt: true,
  inquiryType: true,
  firstName: true,
  lastName: true,
  companyName: true,
  country: true,
  email: true,
  relatedProductId: true,
  status: true,
} as const satisfies Prisma.InquirySelect;

/** The detail projection — the list's columns plus the submission body. */
const ADMIN_INQUIRY_DETAIL_SELECT = {
  ...ADMIN_INQUIRY_LIST_SELECT,
  phone: true,
  industry: true,
  productsOfInterest: true,
  requiredQuantity: true,
  destinationCountryPort: true,
  preferredIncoterm: true,
  message: true,
  consentGiven: true,
  privacyPolicyVersion: true,
} as const satisfies Prisma.InquirySelect;

type AdminInquiryListRow = Prisma.InquiryGetPayload<{ select: typeof ADMIN_INQUIRY_LIST_SELECT }>;

/**
 * Row → wire. `createdAt` is serialised here rather than left to the JSON encoder: `Date` is
 * `Date` to a mapper and an unspecified string to a consumer, and the response type says ISO 8601.
 */
function toAdminInquiryListItem(row: AdminInquiryListRow): AdminInquiryListItemResponse {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    inquiryType: toWireInquiryType(row.inquiryType),
    firstName: row.firstName,
    lastName: row.lastName,
    companyName: row.companyName,
    country: row.country,
    email: row.email,
    relatedProductId: row.relatedProductId,
    status: row.status,
  };
}
