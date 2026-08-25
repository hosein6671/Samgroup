import "reflect-metadata";

import { Reflector } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { AUTHENTICATED_USER } from "../../identity/authenticated-user";
import { ROLES_METADATA_KEY } from "../../identity/decorators/roles.decorator";
import { JwtAuthGuard } from "../../identity/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/guards/roles.guard";
import { UserRole } from "../../../prisma/generated/client";

import {
  CatalogReviewQueueController,
  ProductClaimReviewController,
  SpecificationReviewController,
} from "./catalog-review.controller";
import { CatalogReviewService } from "./catalog-review.service";
import { ReviewDecisionDto } from "./dto/review-decision.dto";
import { ReviewQueueQuery } from "./dto/review-queue.query";
import { ReviewSubjectIdParam } from "./dto/review-subject-id.param";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { ExecutionContext } from "@nestjs/common";

/**
 * Who reaches the review surface, and with what.
 *
 * ## The real guard, the real metadata
 *
 * Every RBAC assertion below runs the shipped `RolesGuard` against the decorators the shipped
 * controllers actually carry. A spec that overrode the guard would prove the handlers work and
 * nothing about who can call them — which on the one surface that can publish unreviewed technical
 * data is the only interesting question.
 */

const guard = new RolesGuard(new Reflector());
const ZERO_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";

function user(role: UserRole): AuthenticatedUser {
  return { id: "aaaa1111-0000-4000-8000-000000000001", email: "reviewer@samgp.test", role };
}

function contextFor(
  controller: new (...args: never[]) => object,
  handler: object,
  role: UserRole | null,
): ExecutionContext {
  const request: Record<PropertyKey, unknown> = {};
  if (role !== null) request[AUTHENTICATED_USER] = user(role);

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function allows(
  controller: new (...args: never[]) => object,
  handler: object,
  role: UserRole,
): boolean {
  try {
    return guard.canActivate(contextFor(controller, handler, role));
  } catch {
    return false;
  }
}

const ROUTES = [
  ["queue", CatalogReviewQueueController, CatalogReviewQueueController.prototype.queue],
  [
    "specification detail",
    SpecificationReviewController,
    SpecificationReviewController.prototype.detail,
  ],
  [
    "specification decision",
    SpecificationReviewController,
    SpecificationReviewController.prototype.decide,
  ],
  [
    "product claim detail",
    ProductClaimReviewController,
    ProductClaimReviewController.prototype.detail,
  ],
  [
    "product claim decision",
    ProductClaimReviewController,
    ProductClaimReviewController.prototype.decide,
  ],
] as const;

describe.each(ROUTES)("%s — who gets in", (_name, Controller, handler) => {
  it("admits Admin", () => {
    expect(allows(Controller, handler, UserRole.ADMIN)).toBe(true);
  });

  /**
   * SECURITY.md gives Content Manager and Sales Expert `read` on Products/Catalog. This surface is
   * not catalog product data: it carries unapproved values, supplier provenance and the internal
   * `sourceRef`, and deciding on one is a catalog write. Narrower than the matrix, deliberately.
   */
  it.each([UserRole.CONTENT_MANAGER, UserRole.SALES_EXPERT, UserRole.CUSTOMER])(
    "refuses %s",
    (role) => {
      expect(allows(Controller, handler, role)).toBe(false);
    },
  );

  it("refuses an unauthenticated request", () => {
    expect(() => guard.canActivate(contextFor(Controller, handler, null))).toThrow();
  });
});

describe("the review controllers' guard wiring", () => {
  const CONTROLLERS = [
    CatalogReviewQueueController,
    SpecificationReviewController,
    ProductClaimReviewController,
  ];

  /**
   * A guard that silently does not run is the worst possible failure on this surface, and Nest
   * reads `__guards__` off the class it instantiates — metadata on the abstract base would not be
   * inherited. Asserted rather than assumed.
   */
  it("attaches JwtAuthGuard then RolesGuard to every controller, in that order", () => {
    for (const Controller of CONTROLLERS) {
      expect(Reflect.getMetadata("__guards__", Controller)).toEqual([JwtAuthGuard, RolesGuard]);
    }
  });

  it("declares Admin, and only Admin, on every controller", () => {
    const reflector = new Reflector();
    for (const Controller of CONTROLLERS) {
      expect(reflector.get(ROLES_METADATA_KEY, Controller)).toEqual([UserRole.ADMIN]);
    }
  });

  /**
   * `design:paramtypes` is emitted for a class's OWN constructor. A subclass that declares none
   * emits an empty array, Nest injects nothing, and the service is `undefined` at request time —
   * a failure invisible to `tsc` and to a hand-built unit test.
   */
  it("emits constructor metadata on both subject controllers", () => {
    for (const Controller of [SpecificationReviewController, ProductClaimReviewController]) {
      expect(Reflect.getMetadata("design:paramtypes", Controller)).toEqual([CatalogReviewService]);
    }
  });

  /** §2.10: admin responses are never cached at any layer. */
  it("sets Cache-Control: no-store on every handler", () => {
    const handlers = [
      CatalogReviewQueueController.prototype.queue,
      SpecificationReviewController.prototype.detail,
      SpecificationReviewController.prototype.decide,
      ProductClaimReviewController.prototype.detail,
      ProductClaimReviewController.prototype.decide,
    ];

    for (const handler of handlers) {
      expect(Reflect.getMetadata("__headers__", handler)).toEqual([
        { name: "Cache-Control", value: "no-store" },
      ]);
    }
  });
});

describe("what the review controllers pass on", () => {
  function build(): {
    specifications: SpecificationReviewController;
    claims: ProductClaimReviewController;
    detail: jest.Mock;
    decide: jest.Mock;
  } {
    const detail = jest.fn().mockResolvedValue({ id: SUBJECT_ID });
    const decide = jest.fn().mockResolvedValue({ id: SUBJECT_ID });
    const service = { detail, decide } as unknown as CatalogReviewService;

    return {
      specifications: new SpecificationReviewController(service),
      claims: new ProductClaimReviewController(service),
      detail,
      decide,
    };
  }

  const actor = user(UserRole.ADMIN);
  const dto: ReviewDecisionDto = {
    decision: "approve",
    expectedReviewStatus: "needs_review",
    expectedEvidenceSetHash: ZERO_HASH,
  };

  /** The subject type is the ROUTE, never the body. A body with two answers has one too many. */
  it("tags every call with its own subject type", async () => {
    const { specifications, claims, detail, decide } = build();

    await specifications.detail({ id: SUBJECT_ID });
    await claims.detail({ id: SUBJECT_ID });
    await specifications.decide({ id: SUBJECT_ID }, dto, actor);
    await claims.decide({ id: SUBJECT_ID }, dto, actor);

    expect(detail.mock.calls[0][0]).toBe("specification");
    expect(detail.mock.calls[1][0]).toBe("product_claim");
    expect(decide.mock.calls[0][0]).toBe("specification");
    expect(decide.mock.calls[1][0]).toBe("product_claim");
  });

  /** The actor is the guard's, off the request. Nothing the client sent can become an actor. */
  it("passes the authenticated caller through as the actor", async () => {
    const { specifications, decide } = build();

    await specifications.decide({ id: SUBJECT_ID }, dto, actor);

    expect(decide.mock.calls[0][3]).toBe(actor);
  });

  it("wraps a decision in the envelope with an empty meta", async () => {
    const { specifications } = build();

    const response = await specifications.decide({ id: SUBJECT_ID }, dto, actor);

    expect(response.data).toEqual({ id: SUBJECT_ID });
    expect(response.meta).toEqual({});
  });

  it("reports queue pagination in meta", async () => {
    const queue = jest.fn().mockResolvedValue({ items: [], total: 63, page: 2, limit: 25 });
    const controller = new CatalogReviewQueueController({
      queue,
    } as unknown as CatalogReviewService);

    const response = await controller.queue({ page: 2 });

    expect(response.meta).toEqual({ total: 63, page: 2, limit: 25 });
  });
});

/* -------------------------------------------------------------------------- */
/* DTO boundaries                                                              */
/* -------------------------------------------------------------------------- */

function violations(cls: new () => object, payload: Record<string, unknown>): string[] {
  const instance = plainToInstance(cls, payload, { enableImplicitConversion: false });
  // The same two options the global ValidationPipe runs with.
  return validateSync(instance as object, { whitelist: true, forbidNonWhitelisted: true }).map(
    (error) => error.property,
  );
}

describe("ReviewDecisionDto", () => {
  const valid = {
    decision: "approve",
    expectedReviewStatus: "needs_review",
    expectedEvidenceSetHash: ZERO_HASH,
  };

  it("accepts a well-formed decision", () => {
    expect(violations(ReviewDecisionDto, valid)).toEqual([]);
  });

  /**
   * The single most important assertion in this file. ADR-014 §8 requires that no endpoint ever
   * exposes `review_status` to a generic update; `forbidNonWhitelisted` is what makes sending one
   * a 400 rather than a silently ignored field.
   */
  it("refuses a body carrying reviewStatus", () => {
    expect(violations(ReviewDecisionDto, { ...valid, reviewStatus: "approved" })).toContain(
      "reviewStatus",
    );
  });

  it("refuses a body carrying an evidenceSetHash to store", () => {
    expect(violations(ReviewDecisionDto, { ...valid, evidenceSetHash: ZERO_HASH })).toContain(
      "evidenceSetHash",
    );
  });

  it("refuses a body naming its own subject", () => {
    expect(violations(ReviewDecisionDto, { ...valid, subjectId: SUBJECT_ID })).toContain(
      "subjectId",
    );
  });

  /**
   * The reviewer attribution boundary, expressed where it is actually enforceable.
   *
   * The database gate can verify that a review row EXISTS with a non-blank snapshot; it cannot
   * verify that the snapshot names the authenticated caller, because PostgreSQL has no knowledge
   * of the HTTP session (ADR-016 §16). What closes that gap is structural rather than a check:
   * the DTO declares no reviewer field at all, so there is nothing a client could send, and the
   * service writes `reviewerId`/`reviewerEmailSnapshot` from the guard-supplied
   * `AuthenticatedUser` only. These assertions are what keep the DTO that shape.
   */
  it.each(["reviewerId", "reviewerEmail", "reviewerEmailSnapshot", "reviewedAt", "reviewer"])(
    "refuses a body attempting to supply %s",
    (property) => {
      expect(violations(ReviewDecisionDto, { ...valid, [property]: "x" })).toContain(property);
    },
  );

  it.each([
    ["a decision outside the vocabulary", { ...valid, decision: "supersede" }, "decision"],
    [
      "a missing decision",
      { expectedReviewStatus: "needs_review", expectedEvidenceSetHash: ZERO_HASH },
      "decision",
    ],
    [
      "a missing expected status",
      { decision: "approve", expectedEvidenceSetHash: ZERO_HASH },
      "expectedReviewStatus",
    ],
    [
      "a missing expected hash",
      { decision: "approve", expectedReviewStatus: "needs_review" },
      "expectedEvidenceSetHash",
    ],
    [
      "an uppercase hash",
      { ...valid, expectedEvidenceSetHash: ZERO_HASH.toUpperCase() },
      "expectedEvidenceSetHash",
    ],
    ["a short hash", { ...valid, expectedEvidenceSetHash: "abc123" }, "expectedEvidenceSetHash"],
    ["an over-long note", { ...valid, note: "x".repeat(2001) }, "note"],
  ])("refuses %s", (_case, payload, property) => {
    expect(violations(ReviewDecisionDto, payload)).toContain(property);
  });

  /** `superseded` is a well-formed assertion about a row this API will not decide — 409, not 400. */
  it("accepts superseded as an expected status, so the service can answer 409", () => {
    expect(violations(ReviewDecisionDto, { ...valid, expectedReviewStatus: "superseded" })).toEqual(
      [],
    );
  });
});

describe("ReviewQueueQuery", () => {
  it("accepts an empty query", () => {
    expect(violations(ReviewQueueQuery, {})).toEqual([]);
  });

  it("accepts every documented filter", () => {
    expect(
      violations(ReviewQueueQuery, {
        subjectType: "specification",
        reviewStatus: "needs_review",
        sourceRef: "SAMCAT-W1-R003",
        productSlug: "a-product",
        family: "lubricants",
        productType: "engine-oil",
        propertyKey: "kv_100c",
        claimKind: "meets",
        documentLocator: "Catalog.xlsx",
        unresolvedFindings: "true",
        page: 2,
        limit: 50,
        sort: "-createdAt",
      }),
    ).toEqual([]);
  });

  it.each([
    ["an unknown subject type", { subjectType: "grade" }, "subjectType"],
    ["an unknown review status", { reviewStatus: "published" }, "reviewStatus"],
    ["an unknown claim kind", { claimKind: "endorsed_by" }, "claimKind"],
    ["an unknown sort column", { sort: "propertyKey" }, "sort"],
    ["a limit above the ceiling", { limit: 101 }, "limit"],
    ["a page below one", { page: 0 }, "page"],
    ["a non-boolean flag", { unresolvedFindings: "maybe" }, "unresolvedFindings"],
  ])("refuses %s", (_case, payload, property) => {
    expect(violations(ReviewQueueQuery, payload)).toContain(property);
  });

  /** A filter UI submits every control it owns; an untouched one must not become an empty filter. */
  it("treats a blank string filter as absent", () => {
    const query = plainToInstance(ReviewQueueQuery, { productSlug: "   ", sourceRef: "" });
    expect(query.productSlug).toBeUndefined();
    expect(query.sourceRef).toBeUndefined();
  });

  it("refuses an unknown parameter outright", () => {
    expect(violations(ReviewQueueQuery, { type: "specification" })).toContain("type");
  });
});

describe("ReviewSubjectIdParam", () => {
  it("accepts a uuid", () => {
    expect(violations(ReviewSubjectIdParam, { id: SUBJECT_ID })).toEqual([]);
  });

  it("refuses anything that is not one", () => {
    expect(violations(ReviewSubjectIdParam, { id: "not-a-uuid" })).toContain("id");
  });
});
