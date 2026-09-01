import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { PrismaService } from "../../../prisma/prisma.service";

import {
  productClaimEvidenceSetHash,
  productCopyEvidenceSetHash,
  reviewHashVersionFor,
  specificationEvidenceSetHash,
  type EvidenceHashClient,
} from "./evidence-set-hash";
import {
  PRODUCT_CLAIM_ELIGIBILITY_SQL,
  PRODUCT_CLAIM_UNRESOLVED_SQL,
  PRODUCT_COPY_ELIGIBILITY_SQL,
  PRODUCT_COPY_UNRESOLVED_SQL,
  SPECIFICATION_ELIGIBILITY_SQL,
  SPECIFICATION_UNRESOLVED_SQL,
  mappingMatchesFactSql,
  productClaimApprovalBlockers,
  productClaimApprovalWarnings,
  productCopyApprovalBlockers,
  productCopyApprovalWarnings,
  specificationApprovalBlockers,
  specificationApprovalWarnings,
  type ProductClaimEligibilityRow,
  type ProductCopyEligibilityRow,
  type ReviewBlocker,
  type SpecificationEligibilityRow,
} from "./review-eligibility";
import {
  DECIDABLE_FROM_STATUSES,
  DECISION_TARGET_STATUS,
  REVIEW_SUBJECT_TYPES,
  fromWireReviewStatus,
  toWireDecision,
  toWireReviewStatus,
} from "./review-subject";

import {
  DEFAULT_QUEUE_LIMIT,
  DEFAULT_QUEUE_PAGE,
  DEFAULT_QUEUE_SORT,
  type ReviewQueueQuery,
  type ReviewQueueSort,
} from "./dto/review-queue.query";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { ReviewDecisionDto } from "./dto/review-decision.dto";
import type { ReviewSubjectType } from "./review-subject";
import type { Prisma, TechnicalReviewStatus } from "../../../prisma/generated/client";
import type {
  ReviewDecisionResponse,
  ReviewDetailResponse,
  ReviewEvidenceEntry,
  ReviewHistoryEntry,
  ReviewInvalidationEntry,
  ReviewMappingRef,
  ReviewQueueItemResponse,
} from "./dto/review.response";

const NOT_FOUND_MESSAGE = "Review subject not found.";
const STALE_STATUS_MESSAGE =
  "This subject was decided by someone else. Reload the review and try again.";
const STALE_EVIDENCE_MESSAGE =
  "The evidence behind this subject changed since it was loaded. Reload the review and try again.";
const NOT_DECIDABLE_MESSAGE = "This subject is not in a state that can be decided.";
const NO_OP_ISSUE = "must move the subject to a different review status";
const HASH_UNAVAILABLE_MESSAGE = "The evidence set for this subject could not be fingerprinted.";

/**
 * The transaction's own guards.
 *
 * A lock timeout so a decision waiting behind another reviewer's row lock fails fast rather than
 * holding a request open, and a statement timeout so no single statement can pin the catalogue.
 * Both are `SET LOCAL`, so they end with the transaction and never leak into the pooled session —
 * the same discipline `beginGuardedTransaction` applies to the import writer.
 */
const DECISION_LOCK_TIMEOUT_MS = 5_000;
const DECISION_STATEMENT_TIMEOUT_MS = 15_000;

/**
 * Prisma's default interactive-transaction budget is 5 s, which is shorter than the statement
 * timeout above and would abort a slow-but-legal decision from the client side.
 */
const DECISION_TRANSACTION_TIMEOUT_MS = 20_000;

/** The four orderings, as fixed SQL. A caller never supplies a column name. */
const QUEUE_ORDER_BY: Readonly<Record<ReviewQueueSort, string>> = {
  createdAt: `q."createdAt" ASC, q."id" ASC`,
  "-createdAt": `q."createdAt" DESC, q."id" ASC`,
  updatedAt: `coalesce(q."lastReviewedAt", q."createdAt") ASC, q."id" ASC`,
  "-updatedAt": `coalesce(q."lastReviewedAt", q."createdAt") DESC, q."id" ASC`,
};

/**
 * The Admin catalog technical-review service — PRODUCT-REVIEW-1A, closing the limitation
 * ADR-014 §8 recorded deliberately.
 *
 * ## What this service is the only path to
 *
 * `specifications.review_status` and `product_claims.review_status` are the publication gate: a
 * row reaches `v_specification_public`, and therefore the public Product detail, when and only
 * when that column reads `approved`. ADR-014 §8 audited the database and found it does **not**
 * enforce how a row gets there — a caller with base-table write access could set it with zero
 * review rows and no evidence verification. This service is the answer to that, and its four
 * mandatory properties are ADR-014 §8's own list:
 *
 *   * approval transitions performed **only here**, never by a generic update path;
 *   * RBAC per SECURITY.md — Admin, enforced by the controller's guards;
 *   * the evidence-set hash recomputed and compared **inside the same transaction** as the write;
 *   * **no endpoint anywhere exposes `review_status` to a generic update**, and none can: the
 *     decision DTO has no such field and this file writes the column from a fixed table keyed by
 *     the decision, never from request data.
 *
 * ## One decision, one transaction, one history row
 *
 * `decide` opens one interactive transaction and does everything inside it: lock the subject, read
 * it back, recompute the hash, compare both expectations, check eligibility, insert the
 * `TechnicalReview`, update the status, and verify the resulting public visibility. A rejected
 * request — 400, 404, 409 — writes nothing at all, and there is no path that writes the status
 * without also writing the history row.
 *
 * ## Locking, not compare-and-set alone
 *
 * `LeadWorkflowService` uses a bare compare-and-set, and that is right for a lead: the predicate
 * the caller holds is the whole question. It is not enough here, because the second half of the
 * question — the evidence-set hash — is computed from four other tables and cannot be folded into
 * a `WHERE`. So the subject row is taken with `SELECT ... FOR UPDATE` first, and every check runs
 * against a row nobody else can move until this transaction ends. The compare-and-set is still
 * there underneath as the `updateMany` predicate; the lock is what makes the hash comparison mean
 * something.
 *
 * ## Identity is served as the snapshot, never as an id
 *
 * History carries `reviewerEmail` — `technical_reviews.reviewer_email_snapshot`, captured at write
 * time from the authenticated session and never from request data. `reviewerId` is served too, and
 * it is `ON DELETE SET NULL` by ADR-014 §7 so that deleting a user (ADR-012's strongest credential
 * revocation) cannot be blocked by an approved specification. The snapshot is what keeps the
 * record true afterwards.
 */
@Injectable()
export class CatalogReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------------ */
  /* Queue                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * `GET /admin/catalog/review/queue`.
   *
   * One statement over both subject tables, so a mixed queue is paginated as one list rather than
   * two lists stitched together in JavaScript — which would make `meta.total` a lie and put rows
   * on two pages at once.
   *
   * Every filter is a bound parameter compared against a fixed predicate; nothing a caller sends
   * reaches SQL text. The ordering is a lookup into `QUEUE_ORDER_BY`, whose keys are the closed
   * `REVIEW_QUEUE_SORTS` vocabulary the DTO already validated.
   */
  async queue(query: ReviewQueueQuery): Promise<{
    items: ReviewQueueItemResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? DEFAULT_QUEUE_PAGE;
    const limit = query.limit ?? DEFAULT_QUEUE_LIMIT;
    const sort = query.sort ?? DEFAULT_QUEUE_SORT;

    const filters: unknown[] = [
      query.subjectType ?? null,
      query.reviewStatus ?? null,
      query.sourceRef ?? null,
      query.productSlug ?? null,
      query.family ?? null,
      query.productType ?? null,
      query.propertyKey ?? null,
      query.claimKind ?? null,
      query.documentLocator ?? null,
      query.unresolvedFindings ?? null,
    ];

    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
        `${QUEUE_CTE} SELECT count(*)::int AS "total" FROM ranked q`,
        ...filters,
      ),
      this.prisma.$queryRawUnsafe<QueueRow[]>(
        `${QUEUE_CTE} SELECT q.* FROM ranked q ORDER BY ${QUEUE_ORDER_BY[sort]} LIMIT $11 OFFSET $12`,
        ...filters,
        limit,
        (page - 1) * limit,
      ),
    ]);

    return {
      items: rows.map(toQueueItem),
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Detail                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * `GET /admin/catalog/review/{subject}/:id`.
   *
   * Reads outside a transaction on purpose: this is a read, and the `evidenceSetHash` it returns
   * is explicitly a value that may be stale by the time the reviewer acts on it. Making it
   * authoritative here would be false comfort — the comparison that matters happens inside the
   * decision transaction, against a locked row, and nothing this method returns is trusted there.
   */
  async detail(subjectType: ReviewSubjectType, id: string): Promise<ReviewDetailResponse> {
    switch (subjectType) {
      case "specification":
        return this.specificationDetail(id);
      case "product_claim":
        return this.productClaimDetail(id);
      case "product_copy":
        return this.productCopyDetail(id);
    }
  }

  private async specificationDetail(id: string): Promise<ReviewDetailResponse> {
    const row = await this.prisma.specification.findUnique({
      where: { id },
      select: SPECIFICATION_DETAIL_SELECT,
    });

    if (row === null) throw notFound();

    const [hash, eligibility, evidence, mappings, history, invalidations] = await Promise.all([
      specificationEvidenceSetHash(this.prisma, id),
      this.specificationEligibility(this.prisma, id),
      this.evidenceEntries("specification", id),
      this.mappingRefs(id, row.propertyKey),
      this.history("specification", id),
      this.invalidations("specification", id),
    ]);

    const currentHash = hash ?? "";
    /*
     * Computed ONCE and reused for both fields. `eligibleForApproval` was previously derived by
     * calling the builder a second time, which made the two fields two evaluations of the same
     * rules rather than one — a shape that can only ever be equal by luck.
     */
    const blockers = specificationApprovalBlockers(eligibility);

    return {
      subjectType: "specification",
      id: row.id,
      reviewStatus: toWireReviewStatus(row.reviewStatus),
      createdAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      product: toProductRef(row.product),
      grade: toGradeRef(row.productGrade),
      specification: {
        propertyKey: row.propertyKey,
        displayValue: row.displayValue,
        valueType: row.valueType === null ? null : String(row.valueType).toLowerCase(),
        numericMin: decimalString(row.numericMin),
        numericMax: decimalString(row.numericMax),
        pairFirst: decimalString(row.pairFirst),
        pairSecond: decimalString(row.pairSecond),
        unit: row.unit,
        method: row.method,
        qualifier: row.qualifier,
        resultBasis: String(row.resultBasis).toLowerCase(),
        /*
         * The dictionary metadata, projected from the `SpecProperty` relation.
         *
         * `specProperty` is a LEFT relation: a Specification whose `propertyKey` names no
         * dictionary row reads `null`, and both axes are served as null rather than as a guessed
         * default. Neither is derived from the other, and `valueType` above is left exactly as it
         * was — the shape axis and the kind axis travel separately, and a mismatch between them is
         * informational in this gate rather than a rule.
         */
        valueKind: row.property === null ? null : String(row.property.valueKind).toLowerCase(),
        methodRequirement:
          row.property === null ? null : String(row.property.methodRequirement).toLowerCase(),
      },
      claim: null,
      copy: null,
      evidenceSetHash: currentHash,
      evidence,
      mappings,
      approvalBlockers: blockers,
      eligibleForApproval: blockers.length === 0,
      warnings: specificationApprovalWarnings(eligibility),
      history: history.map((entry) => ({
        ...entry,
        evidenceCurrent: entry.evidenceSetHash === currentHash,
      })),
      invalidations,
    };
  }

  private async productClaimDetail(id: string): Promise<ReviewDetailResponse> {
    const row = await this.prisma.productClaim.findUnique({
      where: { id },
      select: PRODUCT_CLAIM_DETAIL_SELECT,
    });

    if (row === null) throw notFound();

    const [hash, eligibility, evidence, history, invalidations] = await Promise.all([
      productClaimEvidenceSetHash(this.prisma, id),
      this.productClaimEligibility(this.prisma, id),
      this.evidenceEntries("product_claim", id),
      this.history("product_claim", id),
      this.invalidations("product_claim", id),
    ]);

    const currentHash = hash ?? "";
    const blockers = productClaimApprovalBlockers(eligibility);

    return {
      subjectType: "product_claim",
      id: row.id,
      reviewStatus: toWireReviewStatus(row.reviewStatus),
      createdAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      product: toProductRef(row.product),
      grade: toGradeRef(row.productGrade),
      specification: null,
      /*
       * A claim carries its own four fields and NOTHING from the property dictionary. There is no
       * `valueKind` and no `methodRequirement` here, because a claim has no property key and
       * therefore no `SpecProperty` row — inventing either would be serving a measurement of
       * nothing.
       */
      claim: {
        kind: String(row.kind).toLowerCase(),
        standardBody: row.standardBody,
        standardCode: row.standardCode,
        contextNote: row.contextNote,
      },
      copy: null,
      evidenceSetHash: currentHash,
      evidence,
      // A claim has no property key, so no mapping applies to it. An empty array rather than an
      // omitted field: the shape of the two subject types stays identical for the client.
      mappings: [],
      approvalBlockers: blockers,
      eligibleForApproval: blockers.length === 0,
      warnings: productClaimApprovalWarnings(eligibility),
      history: history.map((entry) => ({
        ...entry,
        evidenceCurrent: entry.evidenceSetHash === currentHash,
      })),
      invalidations,
    };
  }

  /**
   * The ProductCopy detail (ADR-019).
   *
   * Shorter than the other two because copy has less to project, not because less was checked:
   * there is no grade (copy is written about a Product), no mapping (no property key) and no
   * dictionary record. Each of those is served as the same empty shape the claim branch uses, so
   * the response shape stays identical across all three subject types and a client never has to
   * branch on which fields exist.
   */
  private async productCopyDetail(id: string): Promise<ReviewDetailResponse> {
    const row = await this.prisma.productCopy.findUnique({
      where: { id },
      select: PRODUCT_COPY_DETAIL_SELECT,
    });

    if (row === null) throw notFound();

    const [hash, eligibility, evidence, history, invalidations] = await Promise.all([
      productCopyEvidenceSetHash(this.prisma, id),
      this.productCopyEligibility(this.prisma, id),
      this.evidenceEntries("product_copy", id),
      this.history("product_copy", id),
      this.invalidations("product_copy", id),
    ]);

    const currentHash = hash ?? "";
    const blockers = productCopyApprovalBlockers(eligibility);

    return {
      subjectType: "product_copy",
      id: row.id,
      reviewStatus: toWireReviewStatus(row.reviewStatus),
      createdAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      product: toProductRef(row.product),
      // Copy is written about a Product, never about one grade of it — `product_copy` has no
      // `product_grade_id` column to project.
      grade: null,
      specification: null,
      claim: null,
      copy: {
        locale: row.locale,
        // From the same probe the blockers are built from, so the screen and the gate cannot
        // disagree about it. It is a fact on the row, never a blocker (ADR-019).
        localeActive: eligibility.localeActive,
        summary: row.summary,
        selectionNote: row.selectionNote,
      },
      evidenceSetHash: currentHash,
      evidence,
      mappings: [],
      approvalBlockers: blockers,
      eligibleForApproval: blockers.length === 0,
      warnings: productCopyApprovalWarnings(eligibility),
      history: history.map((entry) => ({
        ...entry,
        evidenceCurrent: entry.evidenceSetHash === currentHash,
      })),
      invalidations,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Decision                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * `POST /admin/catalog/review/{subject}/:id/decisions` — one subject, one decision.
   *
   * There is no bulk form of this method and none may be added without its own gate: a bulk
   * approval is a single click that publishes an unbounded number of unread technical values, and
   * the per-subject evidence-hash check is exactly the guarantee it would have to discard.
   *
   * The order inside the transaction is deliberate and each step depends on the one before it:
   *
   *  1. `SET LOCAL` the lock and statement timeouts.
   *  2. `SELECT ... FOR UPDATE` the subject — nobody else may move it from here on.
   *  3. Recompute the evidence-set hash **against the locked row**, through the canonical database
   *     function. The client's value is never used for anything but comparison.
   *  4. Compare the expected status. Mismatch → **409**, nothing written.
   *  5. Compare the expected hash. Mismatch → **409**, nothing written.
   *  6. Check that the CURRENT status is decidable at all, that the decision would actually CHANGE
   *     it, and that a rejection carries a note.
   *  7. For an approval only: run the eligibility probe. Any blocker → **409** listing them, and
   *     the subject keeps the status it had.
   *  8. Insert the immutable `TechnicalReview`, carrying the RECOMPUTED hash and the reviewer
   *     snapshot taken from the authenticated session.
   *  9. Compare-and-set the subject's status. Zero rows → **409** (belt and braces behind the
   *     lock; it cannot normally happen, and if it ever does the transaction aborts rather than
   *     leaving a review row describing a status that was never set).
   * 10. Verify the public view now agrees with the decision, and abort the whole transaction if
   *     it does not.
   */
  async decide(
    subjectType: ReviewSubjectType,
    id: string,
    dto: ReviewDecisionDto,
    actor: AuthenticatedUser,
  ): Promise<ReviewDecisionResponse> {
    const expected = fromWireReviewStatus(dto.expectedReviewStatus);
    if (expected === undefined) {
      // Unreachable through the DTO, which validates against the same vocabulary. Kept because
      // this function is also reachable from a test that constructs the DTO by hand.
      throw validationError("expectedReviewStatus", "is not a known review status");
    }

    const target = DECISION_TARGET_STATUS[dto.decision];

    if (dto.decision !== "approve" && (dto.note === undefined || dto.note.length === 0)) {
      throw validationError("note", "is required for this decision");
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL lock_timeout = '${String(DECISION_LOCK_TIMEOUT_MS)}ms'`,
        );
        await tx.$executeRawUnsafe(
          `SET LOCAL statement_timeout = '${String(DECISION_STATEMENT_TIMEOUT_MS)}ms'`,
        );

        // ── 2. lock ───────────────────────────────────────────────────────
        const locked = await lockSubject(tx, subjectType, id);
        if (locked === null) throw notFound();

        // ── 3. recompute ──────────────────────────────────────────────────
        const currentHash = await evidenceSetHashFor(tx, subjectType, id);

        if (currentHash === null) {
          throw new ApiException(HttpStatus.CONFLICT, ErrorCode.Conflict, HASH_UNAVAILABLE_MESSAGE);
        }

        // ── 4. expected status ────────────────────────────────────────────
        if (locked.reviewStatus !== expected) {
          throw conflict(STALE_STATUS_MESSAGE);
        }

        // ── 5. expected evidence ──────────────────────────────────────────
        if (currentHash !== dto.expectedEvidenceSetHash) {
          throw conflict(STALE_EVIDENCE_MESSAGE);
        }

        // ── 6. decidable at all ───────────────────────────────────────────
        if (!DECIDABLE_FROM_STATUSES.includes(locked.reviewStatus)) {
          throw conflict(NOT_DECIDABLE_MESSAGE);
        }

        /*
         * ── 6b. a decision is a CHANGE ────────────────────────────────────
         *
         * The same rule `LeadWorkflowService` applies to a lead transition, and for the same
         * reason: a no-op is not a change and must not write an audit row saying nothing happened.
         *
         * **400, not 409, and the distinction is load-bearing.** The caller's `expectedReviewStatus`
         * matched the locked row, so they were not looking at a stale screen — they saw the true
         * state and asked to move it to where it already is. That is a malformed intent, not a lost
         * race.
         *
         * It is also what makes "two reviewers, one winner" hold in EVERY case rather than most of
         * them. Without it, two concurrent approvals of an already-approved row would both succeed:
         * the second would find its expectation satisfied, `updateMany` would match one row and
         * change nothing, and the audit trail would gain a decision that decided nothing. Found by
         * the concurrency test, which is why the rule is stated here rather than assumed.
         */
        if (locked.reviewStatus === target.status) {
          throw validationError("decision", NO_OP_ISSUE);
        }

        // ── 7. eligibility, for an approval only ──────────────────────────
        //
        // A rejection and a return-to-review are always permitted on a decidable row: refusing to
        // let a reviewer REJECT something ineligible would trap the worst rows in the queue.
        if (dto.decision === "approve") {
          const blockers: ReviewBlocker[] = await this.approvalBlockers(tx, subjectType, id);

          /*
           * The refusal carries the CODES, not only the sentences.
           *
           * This is the point at which "frontend wording is never the enforcement boundary" stops
           * being an aspiration. A caller that never rendered a detail page — a script, a retry, a
           * second tab — reaches this branch with no knowledge of what the UI would have shown, and
           * what it gets back is the same closed vocabulary the UI renders. Nothing is written: the
           * throw leaves the transaction with no `TechnicalReview` row, the subject's status
           * untouched, and the optimistic-concurrency checks above already passed on their own
           * terms rather than being skipped.
           *
           * `message` is the reviewer's sentence and never a locator, a document title, an asset
           * hash or any other provenance — `SOURCE_ASSET_ABSENT` in particular says that a source
           * is uncaptured and says nothing about where that source lives.
           */
          if (blockers.length > 0) {
            throw new ApiException(
              HttpStatus.CONFLICT,
              ErrorCode.Conflict,
              "This subject is not eligible for approval.",
              blockers.map(({ code, message }) => ({
                field: "decision",
                code,
                issue: message,
              })),
            );
          }
        }

        // ── 8. immutable history ──────────────────────────────────────────
        const review = await tx.technicalReview.create({
          data: {
            specificationId: subjectType === "specification" ? id : null,
            productClaimId: subjectType === "product_claim" ? id : null,
            productCopyId: subjectType === "product_copy" ? id : null,
            reviewerId: actor.id,
            // The authenticated session's own email, re-read from `sam_platform` by the guard on
            // this request. Never client-supplied, and captured now so the row still names them
            // after the account is deleted.
            reviewerEmailSnapshot: actor.email,
            decision: target.decision,
            note: dto.note ?? null,
            // The RECOMPUTED hash, never `dto.expectedEvidenceSetHash`. The two are equal at this
            // point; taking the recomputed one makes that a property of the code rather than a
            // consequence of a check someone could later move.
            evidenceSetHash: currentHash,
            /*
             * WHICH definition produced that hash, stated rather than defaulted (ADR-017).
             *
             * Derived from `subjectType`, which is also what chose the hash function three steps
             * above, so the two cannot disagree here. The database checks it twice regardless —
             * `technical_reviews_hash_version_matches_subject` against the row's own subject, and
             * the approval gate against the definition it just used — and both refuse rather than
             * comparing a value computed one way against a value computed another.
             */
            evidenceHashVersion: reviewHashVersionFor(subjectType),
          },
          select: { id: true, reviewedAt: true, decision: true },
        });

        // ── 9. compare-and-set ────────────────────────────────────────────
        const changed = await updateSubjectStatus(tx, subjectType, id, expected, target.status);
        if (changed !== 1) throw conflict(STALE_STATUS_MESSAGE);

        // ── 10. public transition ─────────────────────────────────────────
        await assertPublicTransition(tx, subjectType, id, target.status);

        return {
          subjectType,
          id,
          reviewStatus: toWireReviewStatus(target.status),
          decision: toWireDecision(review.decision),
          reviewId: review.id,
          reviewedAt: review.reviewedAt.toISOString(),
          evidenceSetHash: currentHash,
          reviewerEmail: actor.email,
        };
      },
      { timeout: DECISION_TRANSACTION_TIMEOUT_MS },
    );
  }

  /* ------------------------------------------------------------------ */
  /* Shared reads                                                        */
  /* ------------------------------------------------------------------ */

  private async specificationEligibility(
    client: EvidenceHashClient,
    id: string,
  ): Promise<SpecificationEligibilityRow> {
    const rows = await client.$queryRawUnsafe<SpecificationEligibilityRow[]>(
      SPECIFICATION_ELIGIBILITY_SQL,
      id,
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return {
      ...row,
      evidenceLinks: Number(row.evidenceLinks),
      evidenceOrphans: Number(row.evidenceOrphans),
    };
  }

  private async productClaimEligibility(
    client: EvidenceHashClient,
    id: string,
  ): Promise<ProductClaimEligibilityRow> {
    const rows = await client.$queryRawUnsafe<ProductClaimEligibilityRow[]>(
      PRODUCT_CLAIM_ELIGIBILITY_SQL,
      id,
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return {
      ...row,
      evidenceLinks: Number(row.evidenceLinks),
      evidenceOrphans: Number(row.evidenceOrphans),
    };
  }

  private async productCopyEligibility(
    client: EvidenceHashClient,
    id: string,
  ): Promise<ProductCopyEligibilityRow> {
    const rows = await client.$queryRawUnsafe<ProductCopyEligibilityRow[]>(
      PRODUCT_COPY_ELIGIBILITY_SQL,
      id,
    );
    const row = rows[0];
    if (row === undefined) throw notFound();
    return {
      ...row,
      evidenceLinks: Number(row.evidenceLinks),
      evidenceOrphans: Number(row.evidenceOrphans),
    };
  }

  /**
   * The blockers for whichever subject this is — one dispatch, three probes.
   *
   * Written as a switch rather than a ternary chain for the reason `reviewHashVersionFor` is:
   * a fourth subject must fail to compile here rather than silently receive the last branch's
   * rules. Each arm pairs its OWN probe with its OWN builder, and the row shapes make crossing
   * them impossible — `ProductCopyEligibilityRow` has no method facts for the specification
   * builder to read, and no claim identity for the claim builder.
   */
  private async approvalBlockers(
    tx: Prisma.TransactionClient,
    subjectType: ReviewSubjectType,
    id: string,
  ): Promise<ReviewBlocker[]> {
    switch (subjectType) {
      case "specification":
        return specificationApprovalBlockers(await this.specificationEligibility(tx, id));
      case "product_claim":
        return productClaimApprovalBlockers(await this.productClaimEligibility(tx, id));
      case "product_copy":
        return productCopyApprovalBlockers(await this.productCopyEligibility(tx, id));
    }
  }

  /**
   * The evidence behind one subject, with its documents.
   *
   * `source_fact_result_basis` is the installed function that applies the precedence the schema
   * fixes — the fact's override, else the document's default, else UNSPECIFIED. Calling it rather
   * than re-deriving it in TypeScript is the same rule the evidence-set hash follows.
   */
  private async evidenceEntries(
    subjectType: ReviewSubjectType,
    id: string,
  ): Promise<ReviewEvidenceEntry[]> {
    const sql = EVIDENCE_SQL_BY_SUBJECT[subjectType];
    const rows = await this.prisma.$queryRawUnsafe<EvidenceRow[]>(sql, id);

    return rows.map((row) => ({
      sourceFactId: row.sourceFactId,
      role: row.role,
      note: row.note,
      rawProperty: row.rawProperty,
      rawValue: row.rawValue,
      rawUnit: row.rawUnit,
      rawMethod: row.rawMethod,
      rawGrade: row.rawGrade,
      extractionMethod: row.extractionMethod,
      unitClassification: row.unitClassification,
      resultBasis: row.resultBasis,
      pageNumber: numberOrNull(row.pageNumber),
      sheetName: row.sheetName,
      rowNumber: numberOrNull(row.rowNumber),
      columnLabel: row.columnLabel,
      document: {
        id: row.documentId,
        title: row.documentTitle,
        publisher: row.documentPublisher,
        locatorType: row.locatorType,
        locatorValue: row.locatorValue,
        revisionLabel: row.revisionLabel,
        documentDate: row.documentDate?.toISOString().slice(0, 10) ?? null,
        retrievedAt: row.retrievedAt.toISOString(),
        assetSha256: row.assetSha256,
        assetMediaType: row.assetMediaType,
        assetByteSize: numberOrNull(row.assetByteSize),
        supersededById: row.supersededById,
      },
    }));
  }

  /** The mappings that bear on one Specification's property key, one per distinct raw label. */
  private async mappingRefs(id: string, propertyKey: string | null): Promise<ReviewMappingRef[]> {
    const rows = await this.prisma.$queryRawUnsafe<MappingRow[]>(SPECIFICATION_MAPPING_SQL, id);

    return rows.map((row) => ({
      rawProperty: row.rawProperty,
      rawUnit: row.rawUnit,
      specPropertyKey: row.specPropertyKey,
      confidence: row.confidence,
      reviewStatus: row.reviewStatus,
      note: row.note,
      resolvesSubjectProperty:
        propertyKey !== null &&
        row.specPropertyKey === propertyKey &&
        row.confidence === "high" &&
        row.reviewStatus !== "rejected" &&
        row.reviewStatus !== "superseded",
    }));
  }

  /** Prior decisions, newest first. Never filtered, never trimmed — this is the audit trail. */
  private async history(
    subjectType: ReviewSubjectType,
    id: string,
  ): Promise<Omit<ReviewHistoryEntry, "evidenceCurrent">[]> {
    const rows = await this.prisma.technicalReview.findMany({
      where: subjectKey(subjectType, id),
      // `reviewedAt` then `id`: two decisions can share a timestamp, and without the tiebreaker
      // their order would differ between two requests for the same subject.
      orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        decision: true,
        reviewerId: true,
        reviewerEmailSnapshot: true,
        reviewedAt: true,
        note: true,
        evidenceSetHash: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      decision: toWireDecision(row.decision),
      reviewerEmail: row.reviewerEmailSnapshot,
      reviewerId: row.reviewerId,
      reviewedAt: row.reviewedAt.toISOString(),
      note: row.note,
      evidenceSetHash: row.evidenceSetHash,
    }));
  }

  /**
   * The SYSTEM events on this subject — approvals the database retired because what they rested on
   * moved (ADR-017).
   *
   * ── Why this is a separate read and not part of `history()` ─────────────────
   *
   * They are different KINDS of record and the response keeps them apart, so that a client cannot
   * render one as the other. A `TechnicalReview` says a named person decided something. A
   * `ReviewInvalidation` says a hash stopped matching, and nobody decided anything. Merging them
   * into one array would put the burden of telling them apart on whoever renders it, and the first
   * renderer that forgot would be attributing a machine's arithmetic to a person.
   *
   * ── What is deliberately NOT projected ──────────────────────────────────────
   *
   * The table has no reviewer id, no reviewer email and no note to serve — but it does hold two
   * hashes, and neither is served here. A hash is an internal fingerprint, it tells a reviewer
   * nothing they can act on, and putting one on the wire would invite a client to compare or echo
   * it. What a reviewer needs is WHICH approval was retired, WHY, and WHEN; that is exactly the
   * projection below.
   *
   * `technicalReviewId` is served so the Admin screen can tie the event to the decision it retired,
   * which is the one relationship that makes the entry readable at all.
   */
  private async invalidations(
    subjectType: ReviewSubjectType,
    id: string,
  ): Promise<ReviewInvalidationEntry[]> {
    const rows = await this.prisma.reviewInvalidation.findMany({
      where: subjectKey(subjectType, id),
      // Newest first, matching `history()`. `createdAt` then `id`: two events written by one
      // statement share a timestamp, and without the tiebreaker their order would differ between
      // two requests for the same subject.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        technicalReviewId: true,
        reasonCode: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      technicalReviewId: row.technicalReviewId,
      reasonCode: String(row.reasonCode).toUpperCase(),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

/* -------------------------------------------------------------------------- */
/* Transaction helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Which physical table each subject lives in.
 *
 * A total record, so a fourth subject fails to compile rather than falling through to whichever
 * table the last branch named — which, for a row-lock and a compare-and-set, would mean locking
 * one table and updating another.
 */
const SUBJECT_TABLE: Readonly<Record<ReviewSubjectType, string>> = {
  specification: "specifications",
  product_claim: "product_claims",
  product_copy: "product_copy",
};

/** The sanctioned public read model per subject (ADR-014 §8, ADR-019 §5). */
const SUBJECT_PUBLIC_VIEW: Readonly<Record<ReviewSubjectType, string>> = {
  specification: "v_specification_public",
  product_claim: "v_product_claim_public",
  product_copy: "v_product_copy_public",
};

/**
 * The audit tables' subject key, as a Prisma `where` fragment.
 *
 * One function serves both `technical_reviews` and `review_invalidations` because the two carry
 * the same three nullable columns under the same "exactly one is non-null" constraint. A history
 * read that named the wrong column would answer an empty array rather than an error, which is the
 * failure mode this exists to make impossible.
 */
function subjectKey(
  subjectType: ReviewSubjectType,
  id: string,
): { specificationId: string } | { productClaimId: string } | { productCopyId: string } {
  switch (subjectType) {
    case "specification":
      return { specificationId: id };
    case "product_claim":
      return { productClaimId: id };
    case "product_copy":
      return { productCopyId: id };
  }
}

/** The canonical hash for whichever subject this is — always the database's own function. */
function evidenceSetHashFor(
  client: EvidenceHashClient,
  subjectType: ReviewSubjectType,
  id: string,
): Promise<string | null> {
  switch (subjectType) {
    case "specification":
      return specificationEvidenceSetHash(client, id);
    case "product_claim":
      return productClaimEvidenceSetHash(client, id);
    case "product_copy":
      return productCopyEvidenceSetHash(client, id);
  }
}

interface LockedSubject {
  readonly id: string;
  readonly reviewStatus: TechnicalReviewStatus;
}

/**
 * `SELECT ... FOR UPDATE` on the one subject row.
 *
 * Raw because Prisma's query API has no row-lock clause. A second concurrent decision on the same
 * subject blocks here until the first commits, then reads the row the first one wrote and answers
 * 409 on the status comparison — which is exactly "one success and one conflict" rather than two
 * successes or a lost update.
 *
 * `deleted_at` is NOT filtered: a retired subject must be found so it can be reported as
 * ineligible, rather than reported as missing.
 */
async function lockSubject(
  tx: Prisma.TransactionClient,
  subjectType: ReviewSubjectType,
  id: string,
): Promise<LockedSubject | null> {
  const table = SUBJECT_TABLE[subjectType];
  const rows = await tx.$queryRawUnsafe<{ id: string; reviewStatus: string }[]>(
    `SELECT "id", "review_status"::text AS "reviewStatus" FROM "${table}" WHERE "id" = $1::uuid FOR UPDATE`,
    id,
  );
  const row = rows[0];
  if (row === undefined) return null;

  const status = fromWireReviewStatus(row.reviewStatus);
  if (status === undefined) {
    // A label the enum has that this build does not know. Failing loudly beats deciding on it.
    throw new Error(`Unknown review status "${row.reviewStatus}" on ${table} ${id}.`);
  }
  return { id: row.id, reviewStatus: status };
}

/**
 * The compare-and-set. `reviewStatus: expected` in the `WHERE` is the second lock behind the row
 * lock; `updateMany` is used instead of `update` precisely because it reports a **count**.
 */
async function updateSubjectStatus(
  tx: Prisma.TransactionClient,
  subjectType: ReviewSubjectType,
  id: string,
  expected: TechnicalReviewStatus,
  next: TechnicalReviewStatus,
): Promise<number> {
  const where = { id, reviewStatus: expected };
  const data = { reviewStatus: next };

  const result = await updateManyFor(tx, subjectType, where, data);

  return result.count;
}

function updateManyFor(
  tx: Prisma.TransactionClient,
  subjectType: ReviewSubjectType,
  where: { id: string; reviewStatus: TechnicalReviewStatus },
  data: { reviewStatus: TechnicalReviewStatus },
): Promise<{ count: number }> {
  switch (subjectType) {
    case "specification":
      return tx.specification.updateMany({ where, data });
    case "product_claim":
      return tx.productClaim.updateMany({ where, data });
    case "product_copy":
      return tx.productCopy.updateMany({ where, data });
  }
}

/**
 * Step 10 — the public view must agree with the decision, inside the same transaction.
 *
 * `v_specification_public` and `v_product_claim_public` are the sanctioned public read models
 * (ADR-014 §8). Asking them directly, before the commit, is the difference between "the service
 * believes this row is now public" and "the surface that publishes it says so". If the two ever
 * disagree — a view redefined, a CHECK dropped, a claim kind that should never publish — the whole
 * transaction aborts and nothing was written.
 */
async function assertPublicTransition(
  tx: Prisma.TransactionClient,
  subjectType: ReviewSubjectType,
  id: string,
  status: TechnicalReviewStatus,
): Promise<void> {
  const view = SUBJECT_PUBLIC_VIEW[subjectType];
  const rows = await tx.$queryRawUnsafe<{ visible: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM "${view}" WHERE "id" = $1::uuid) AS "visible"`,
    id,
  );
  const visible = rows[0]?.visible ?? false;

  /*
   * The expectation is asymmetric, and deliberately.
   *
   * An APPROVED Specification MUST be visible: that is what approval means, and a silent failure
   * to publish would leave the catalogue saying a value was approved while no reader could ever
   * see it. Anything else MUST NOT be visible, in both directions.
   *
   * An APPROVED ProductClaim is the exception in one direction only. `v_product_claim_public`
   * additionally excludes `LICENSED_BY` and `REFERENCE_ONLY`, and this API refuses to approve
   * either — so an approved claim that is not visible cannot arise from here. It is still not
   * asserted, because ProductClaims have **no public contract at all** in this gate: nothing
   * reads that view yet, and asserting a publication requirement for a surface that does not
   * exist would be inventing one.
   */
  if (subjectType === "specification") {
    const expectedVisible = status === "APPROVED";
    if (visible !== expectedVisible) {
      throw new Error(
        `Public transition check failed: specification ${id} is ${status} but ` +
          `${visible ? "IS" : "is NOT"} in ${view}. Rolling back.`,
      );
    }
    return;
  }

  /*
   * ProductCopy is asserted in both directions like a Specification, but against a second
   * condition neither of the other subjects has: its locale.
   *
   * `v_product_copy_public` publishes an approved, live row only while its locale is ACTIVE, and
   * approval is deliberately independent of that — `localeActive` is a fact on the eligibility
   * probe and never a blocker. So approving copy in a deactivated locale is a normal, successful
   * decision whose row is legitimately absent from the view. It is not a failure to publish, and
   * it must not be turned into a rolled-back 500.
   *
   * That case is reachable rather than theoretical: **there is no locale filter on the review
   * queue**, so a reviewer can open and approve such a row. Reactivating the locale publishes it
   * again through the view's own rule, with no second decision.
   *
   *   APPROVED + active locale   → must be visible
   *   APPROVED + inactive locale → must NOT be visible
   *   any other status           → must NOT be visible
   *
   * The locale's activity is read from `locales` inside THIS transaction, for the reason the hash
   * is recomputed in the database: a value supplied from outside could disagree with the view this
   * check exists to agree with.
   */
  if (subjectType === "product_copy") {
    if (status !== "APPROVED") {
      if (visible) {
        throw new Error(
          `Public transition check failed: product copy ${id} is ${status} but is in ${view}. ` +
            `Rolling back.`,
        );
      }
      return;
    }

    const localeActive = await productCopyLocaleActive(tx, id);

    if (localeActive && !visible) {
      throw new Error(
        `Public transition check failed: product copy ${id} is APPROVED in an active locale but ` +
          `is NOT in ${view}. Rolling back.`,
      );
    }

    if (!localeActive && visible) {
      throw new Error(
        `Public transition check failed: product copy ${id} is APPROVED in an INACTIVE locale ` +
          `but IS in ${view}. Rolling back.`,
      );
    }

    return;
  }

  if (status !== "APPROVED" && visible) {
    throw new Error(
      `Public transition check failed: product claim ${id} is ${status} but is in ${view}. ` +
        `Rolling back.`,
    );
  }
}

/**
 * Whether this copy row's locale is active, read inside the decision transaction.
 *
 * This is not a second publication rule. It is the ONE term of `v_product_copy_public` that
 * decides whether an approved row's absence from that view is correct, and it is asked of the same
 * `locales` table the view joins. Everything else the view applies — approved, not deleted — is
 * left to the view, which is why this check cannot drift into a competing definition of public.
 *
 * A LEFT JOIN, so a `locale` value with no row at all reads as inactive: `product_copy.locale` is
 * text rather than a foreign key (PROJECT_HANDOFF §6.9), and the view's inner join would exclude
 * such a row exactly as it excludes a deactivated one.
 */
async function productCopyLocaleActive(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<{ active: boolean }[]>(
    `SELECT coalesce(l."is_active", false) AS "active"
       FROM "product_copy" pc
       LEFT JOIN "locales" l ON l."code" = pc."locale"
      WHERE pc."id" = $1::uuid`,
    id,
  );

  return rows[0]?.active ?? false;
}

/* -------------------------------------------------------------------------- */
/* SQL                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The queue, as one statement over both subject tables.
 *
 * Twelve bound parameters, ten of them filters compared with the `($n IS NULL OR ...)` idiom so
 * that one fixed SQL string serves every combination. No fragment is concatenated per request,
 * which is what makes the statement auditable by reading it once.
 *
 * `$8` (claim kind) has no counterpart on a Specification, so the specification branch requires it
 * to be absent rather than ignoring it: asking for `claimKind=meets` returns claims only, which is
 * the truthful answer. `$7` (property key) does the same in the other direction.
 */
const QUEUE_CTE = `
WITH ranked AS (
  SELECT
    'specification'::text                  AS "subjectType",
    s."id"                                 AS "id",
    s."review_status"::text                AS "reviewStatus",
    s."created_at"                         AS "createdAt",
    (SELECT max(tr."reviewed_at") FROM "technical_reviews" tr WHERE tr."specification_id" = s."id")
                                           AS "lastReviewedAt",
    (SELECT count(*)::int FROM "technical_reviews" tr WHERE tr."specification_id" = s."id")
                                           AS "reviewCount",
    (SELECT count(*)::int FROM "specification_evidence" se WHERE se."specification_id" = s."id")
                                           AS "evidenceCount",
    s."property_key"                       AS "propertyKey",
    NULL::text                             AS "claimKind",
    NULL::text                             AS "locale",
    btrim(concat_ws(' ',
      coalesce(s."property_key", s."key"),
      coalesce(s."display_value", s."value"),
      s."unit"))                           AS "summary",
    p."slug"                               AS "productSlug",
    p."name"                               AS "productName",
    p."source_ref"                         AS "sourceRef",
    cat."slug"                             AS "family",
    pt."slug"                              AS "productType",
    gr."id"                                AS "gradeId",
    gr."label"                             AS "gradeLabel",
    gr."grade_system"::text                AS "gradeSystem",
    (${SPECIFICATION_UNRESOLVED_SQL})      AS "hasUnresolvedFindings"
  FROM "specifications" s
  JOIN "products" p            ON p."id" = s."product_id"
  LEFT JOIN "categories" cat   ON cat."id" = p."category_id"
  LEFT JOIN "product_types" pt ON pt."id" = p."product_type_id"
  LEFT JOIN "product_grades" gr ON gr."id" = s."product_grade_id"
  WHERE ($1::text IS NULL OR $1::text = 'specification')
    AND ($2::text IS NULL OR s."review_status"::text = $2::text)
    AND ($3::text IS NULL OR p."source_ref" = $3::text)
    AND ($4::text IS NULL OR p."slug" = $4::text)
    AND ($5::text IS NULL OR cat."slug" = $5::text)
    AND ($6::text IS NULL OR pt."slug" = $6::text)
    AND ($7::text IS NULL OR s."property_key" = $7::text)
    AND ($8::text IS NULL)
    AND ($9::text IS NULL OR EXISTS (
          SELECT 1 FROM "specification_evidence" se
            JOIN "source_facts" sf     ON sf."id" = se."source_fact_id"
            JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
           WHERE se."specification_id" = s."id" AND sd."locator_value" = $9::text))
    AND ($10::boolean IS NULL OR (${SPECIFICATION_UNRESOLVED_SQL}) = $10::boolean)

  UNION ALL

  SELECT
    'product_claim'::text,
    c."id",
    c."review_status"::text,
    c."created_at",
    (SELECT max(tr."reviewed_at") FROM "technical_reviews" tr WHERE tr."product_claim_id" = c."id"),
    (SELECT count(*)::int FROM "technical_reviews" tr WHERE tr."product_claim_id" = c."id"),
    (SELECT count(*)::int FROM "claim_evidence" ce WHERE ce."product_claim_id" = c."id"),
    NULL::text,
    c."kind"::text,
    NULL::text,
    btrim(concat_ws(' ', c."kind"::text, c."standard_body", c."standard_code", c."context_note")),
    p."slug",
    p."name",
    p."source_ref",
    cat."slug",
    pt."slug",
    gr."id",
    gr."label",
    gr."grade_system"::text,
    (${PRODUCT_CLAIM_UNRESOLVED_SQL})
  FROM "product_claims" c
  JOIN "products" p            ON p."id" = c."product_id"
  LEFT JOIN "categories" cat   ON cat."id" = p."category_id"
  LEFT JOIN "product_types" pt ON pt."id" = p."product_type_id"
  LEFT JOIN "product_grades" gr ON gr."id" = c."product_grade_id"
  WHERE ($1::text IS NULL OR $1::text = 'product_claim')
    AND ($2::text IS NULL OR c."review_status"::text = $2::text)
    AND ($3::text IS NULL OR p."source_ref" = $3::text)
    AND ($4::text IS NULL OR p."slug" = $4::text)
    AND ($5::text IS NULL OR cat."slug" = $5::text)
    AND ($6::text IS NULL OR pt."slug" = $6::text)
    AND ($7::text IS NULL)
    AND ($8::text IS NULL OR c."kind"::text = $8::text)
    AND ($9::text IS NULL OR EXISTS (
          SELECT 1 FROM "claim_evidence" ce
            JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
            JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
           WHERE ce."product_claim_id" = c."id" AND sd."locator_value" = $9::text))
    AND ($10::boolean IS NULL OR (${PRODUCT_CLAIM_UNRESOLVED_SQL}) = $10::boolean)

  UNION ALL

  /*
   * ProductCopy. Parameters 7 (property key) and 8 (claim kind) are both required to be ABSENT,
   * for the reason the other two arms exclude each other's field: asking for a property key
   * returns specifications only, and that is the truthful answer rather than a filter silently
   * ignored.
   *
   * The summary column is the copy's own first line rather than a concatenation of columns,
   * because for this subject the text IS what a reviewer picks out of a work list. It is truncated
   * here and not in TypeScript so the queue never carries a full paragraph per row.
   */
  SELECT
    'product_copy'::text,
    pc."id",
    pc."review_status"::text,
    pc."created_at",
    (SELECT max(tr."reviewed_at") FROM "technical_reviews" tr WHERE tr."product_copy_id" = pc."id"),
    (SELECT count(*)::int FROM "technical_reviews" tr WHERE tr."product_copy_id" = pc."id"),
    (SELECT count(*)::int FROM "copy_evidence" ce WHERE ce."product_copy_id" = pc."id"),
    NULL::text,
    NULL::text,
    pc."locale",
    left(btrim(pc."summary"), 160),
    p."slug",
    p."name",
    p."source_ref",
    cat."slug",
    pt."slug",
    NULL::uuid,
    NULL::text,
    NULL::text,
    (${PRODUCT_COPY_UNRESOLVED_SQL})
  FROM "product_copy" pc
  JOIN "products" p            ON p."id" = pc."product_id"
  LEFT JOIN "categories" cat   ON cat."id" = p."category_id"
  LEFT JOIN "product_types" pt ON pt."id" = p."product_type_id"
  WHERE ($1::text IS NULL OR $1::text = 'product_copy')
    AND ($2::text IS NULL OR pc."review_status"::text = $2::text)
    AND ($3::text IS NULL OR p."source_ref" = $3::text)
    AND ($4::text IS NULL OR p."slug" = $4::text)
    AND ($5::text IS NULL OR cat."slug" = $5::text)
    AND ($6::text IS NULL OR pt."slug" = $6::text)
    AND ($7::text IS NULL)
    AND ($8::text IS NULL)
    AND ($9::text IS NULL OR EXISTS (
          SELECT 1 FROM "copy_evidence" ce
            JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
            JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
           WHERE ce."product_copy_id" = pc."id" AND sd."locator_value" = $9::text))
    AND ($10::boolean IS NULL OR (${PRODUCT_COPY_UNRESOLVED_SQL}) = $10::boolean)
)`;

const EVIDENCE_COLUMNS = `
    link."source_fact_id"          AS "sourceFactId",
    link."role"::text              AS "role",
    link."note"                    AS "note",
    sf."raw_property"              AS "rawProperty",
    sf."raw_value"                 AS "rawValue",
    sf."raw_unit"                  AS "rawUnit",
    sf."raw_method"                AS "rawMethod",
    sf."raw_grade"                 AS "rawGrade",
    sf."extraction_method"::text   AS "extractionMethod",
    sf."unit_classification"::text AS "unitClassification",
    "source_fact_result_basis"(sf."id")::text AS "resultBasis",
    sf."page_number"               AS "pageNumber",
    sf."sheet_name"                AS "sheetName",
    sf."row_number"                AS "rowNumber",
    sf."column_label"              AS "columnLabel",
    sd."id"                        AS "documentId",
    sd."title"                     AS "documentTitle",
    sd."publisher"                 AS "documentPublisher",
    sd."locator_type"::text        AS "locatorType",
    sd."locator_value"             AS "locatorValue",
    sd."revision_label"            AS "revisionLabel",
    sd."document_date"             AS "documentDate",
    sd."retrieved_at"              AS "retrievedAt",
    sa."sha256"                    AS "assetSha256",
    sa."media_type"                AS "assetMediaType",
    sa."byte_size"                 AS "assetByteSize",
    sd."superseded_by_id"          AS "supersededById"`;

const SPECIFICATION_EVIDENCE_SQL = `
SELECT ${EVIDENCE_COLUMNS}
FROM "specification_evidence" link
JOIN "source_facts" sf       ON sf."id" = link."source_fact_id"
JOIN "source_documents" sd   ON sd."id" = sf."source_document_id"
LEFT JOIN "source_assets" sa ON sa."id" = sd."source_asset_id"
WHERE link."specification_id" = $1::uuid
ORDER BY link."role", link."source_fact_id"`;

const PRODUCT_CLAIM_EVIDENCE_SQL = `
SELECT ${EVIDENCE_COLUMNS}
FROM "claim_evidence" link
JOIN "source_facts" sf       ON sf."id" = link."source_fact_id"
JOIN "source_documents" sd   ON sd."id" = sf."source_document_id"
LEFT JOIN "source_assets" sa ON sa."id" = sd."source_asset_id"
WHERE link."product_claim_id" = $1::uuid
ORDER BY link."role", link."source_fact_id"`;

/**
 * Every `SourceFact` a ProductCopy draft was transcribed from, with the document that stated it
 * (ADR-019).
 *
 * The same projection as the other two evidence queries, differing only in the link table and its
 * subject column — a reviewer reads the same source record whichever subject brought them here.
 */
const PRODUCT_COPY_EVIDENCE_SQL = `
SELECT ${EVIDENCE_COLUMNS}
FROM "copy_evidence" link
JOIN "source_facts" sf       ON sf."id" = link."source_fact_id"
JOIN "source_documents" sd   ON sd."id" = sf."source_document_id"
LEFT JOIN "source_assets" sa ON sa."id" = sd."source_asset_id"
WHERE link."product_copy_id" = $1::uuid
ORDER BY link."role", link."source_fact_id"`;

/**
 * One statement per subject, all three projecting ${EVIDENCE_COLUMNS} unchanged.
 *
 * The columns are shared rather than repeated because a reviewer reads the SAME source record
 * whichever subject brought them there — the three tables differ only in which link column names
 * the subject.
 */
const EVIDENCE_SQL_BY_SUBJECT: Readonly<Record<ReviewSubjectType, string>> = {
  specification: SPECIFICATION_EVIDENCE_SQL,
  product_claim: PRODUCT_CLAIM_EVIDENCE_SQL,
  product_copy: PRODUCT_COPY_EVIDENCE_SQL,
};

/**
 * Every mapping that bears on the raw labels this Specification's evidence carries.
 *
 * **The match is `mappingMatchesFactSql` — literally the same string the approval gate joins on**,
 * imported rather than restated. This query is what a reviewer SEES as the mappings behind a
 * specification; `RESOLVED_MAPPING` in `review-eligibility.ts` decides whether it may be approved.
 * Were the two to match differently, a reviewer could be shown a resolving mapping for a subject
 * the gate then refused as unresolved — or the reverse, which is worse. Sharing the constant makes
 * that impossible rather than merely discouraged; `mapping-normalization.spec.ts` asserts both
 * consumers still use it.
 *
 * What is deliberately NOT shared is the filtering. The gate demands HIGH confidence and excludes
 * rejected and superseded rows; this list applies neither, because a reviewer deciding a blocked
 * subject needs to see the MEDIUM or rejected mapping that explains why it is blocked. Only the
 * question "does this mapping bear on this fact" is common to both.
 */
const SPECIFICATION_MAPPING_SQL = `
SELECT DISTINCT
    m."raw_property"        AS "rawProperty",
    m."raw_unit"            AS "rawUnit",
    m."spec_property_key"   AS "specPropertyKey",
    m."confidence"::text    AS "confidence",
    m."review_status"::text AS "reviewStatus",
    m."note"                AS "note"
FROM "specification_evidence" se
JOIN "source_facts" sf ON sf."id" = se."source_fact_id"
JOIN "spec_property_mappings" m
  ON ${mappingMatchesFactSql("m", "sf")}
WHERE se."specification_id" = $1::uuid
ORDER BY 1, 2`;

/* -------------------------------------------------------------------------- */
/* Row shapes and mappers                                                      */
/* -------------------------------------------------------------------------- */

interface QueueRow {
  subjectType: string;
  id: string;
  reviewStatus: string;
  createdAt: Date;
  lastReviewedAt: Date | null;
  reviewCount: number;
  evidenceCount: number;
  propertyKey: string | null;
  claimKind: string | null;
  locale: string | null;
  summary: string;
  productSlug: string;
  productName: string;
  sourceRef: string | null;
  family: string | null;
  productType: string | null;
  gradeId: string | null;
  gradeLabel: string | null;
  gradeSystem: string | null;
  hasUnresolvedFindings: boolean;
}

interface EvidenceRow {
  sourceFactId: string;
  role: string;
  note: string | null;
  rawProperty: string | null;
  rawValue: string;
  rawUnit: string | null;
  rawMethod: string | null;
  rawGrade: string | null;
  extractionMethod: string;
  unitClassification: string;
  resultBasis: string;
  pageNumber: number | null;
  sheetName: string | null;
  rowNumber: number | null;
  columnLabel: string | null;
  documentId: string;
  documentTitle: string;
  documentPublisher: string | null;
  locatorType: string;
  locatorValue: string;
  revisionLabel: string | null;
  documentDate: Date | null;
  retrievedAt: Date;
  assetSha256: string | null;
  assetMediaType: string | null;
  assetByteSize: number | null;
  supersededById: string | null;
}

interface MappingRow {
  rawProperty: string;
  rawUnit: string | null;
  specPropertyKey: string | null;
  confidence: string;
  reviewStatus: string;
  note: string | null;
}

/**
 * The queue's `subjectType` column back into the wire union.
 *
 * The SQL emits one of three literals it wrote itself, so this is a narrowing rather than a
 * parse — but it throws on anything else rather than defaulting. The two-subject version defaulted
 * to `product_claim`, which would have relabelled every copy row as a claim the moment the third
 * arm was added, and the response would have looked well-formed while being wrong.
 */
function toWireSubjectType(value: string): ReviewSubjectType {
  const match = REVIEW_SUBJECT_TYPES.find((subject) => subject === value);
  if (match === undefined) {
    throw new Error(`Unknown review subject type "${value}" from the queue statement.`);
  }
  return match;
}

function toQueueItem(row: QueueRow): ReviewQueueItemResponse {
  return {
    subjectType: toWireSubjectType(row.subjectType),
    id: row.id,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt.toISOString(),
    product: {
      slug: row.productSlug,
      name: row.productName,
      sourceRef: row.sourceRef,
      family: row.family,
      productType: row.productType,
    },
    grade:
      row.gradeId === null || row.gradeLabel === null
        ? null
        : { id: row.gradeId, label: row.gradeLabel, gradeSystem: row.gradeSystem },
    propertyKey: row.propertyKey,
    claimKind: row.claimKind,
    locale: row.locale,
    summary: row.summary,
    evidenceCount: Number(row.evidenceCount),
    hasUnresolvedFindings: row.hasUnresolvedFindings,
    reviewCount: Number(row.reviewCount),
  };
}

/** The columns the Specification detail reads. An allow-list; there is no spread anywhere. */
const SPECIFICATION_DETAIL_SELECT = {
  id: true,
  reviewStatus: true,
  createdAt: true,
  deletedAt: true,
  propertyKey: true,
  displayValue: true,
  valueType: true,
  numericMin: true,
  numericMax: true,
  pairFirst: true,
  pairSecond: true,
  unit: true,
  method: true,
  qualifier: true,
  resultBasis: true,
  /*
   * The controlled-dictionary entry behind `propertyKey`, and exactly two of its columns.
   *
   * An allow-list like every other select here: `canonicalMeaning`, `quantity` and `allowedUnits`
   * are dictionary content this response was not asked for and does not serve. The relation is
   * optional in the schema (a legacy row predates the dictionary), so this is `null` for exactly
   * the rows `PROPERTY_NOT_IN_DICTIONARY` already blocks.
   */
  property: { select: { valueKind: true, methodRequirement: true } },
  product: {
    select: {
      name: true,
      slug: true,
      sourceRef: true,
      category: { select: { slug: true } },
      productType: { select: { slug: true } },
    },
  },
  productGrade: { select: { id: true, label: true, gradeSystem: true } },
} as const satisfies Prisma.SpecificationSelect;

const PRODUCT_CLAIM_DETAIL_SELECT = {
  id: true,
  reviewStatus: true,
  createdAt: true,
  deletedAt: true,
  kind: true,
  standardBody: true,
  standardCode: true,
  contextNote: true,
  product: {
    select: {
      name: true,
      slug: true,
      sourceRef: true,
      category: { select: { slug: true } },
      productType: { select: { slug: true } },
    },
  },
  productGrade: { select: { id: true, label: true, gradeSystem: true } },
} as const satisfies Prisma.ProductClaimSelect;

const PRODUCT_COPY_DETAIL_SELECT = {
  id: true,
  reviewStatus: true,
  createdAt: true,
  deletedAt: true,
  locale: true,
  summary: true,
  selectionNote: true,
  product: {
    select: {
      name: true,
      slug: true,
      sourceRef: true,
      category: { select: { slug: true } },
      productType: { select: { slug: true } },
    },
  },
} as const satisfies Prisma.ProductCopySelect;

interface ProductRow {
  name: string;
  slug: string;
  sourceRef: string | null;
  category: { slug: string } | null;
  productType: { slug: string } | null;
}

function toProductRef(product: ProductRow): {
  slug: string;
  name: string;
  sourceRef: string | null;
  family: string | null;
  productType: string | null;
} {
  return {
    slug: product.slug,
    name: product.name,
    sourceRef: product.sourceRef,
    family: product.category?.slug ?? null,
    productType: product.productType?.slug ?? null,
  };
}

function toGradeRef(
  grade: { id: string; label: string; gradeSystem: unknown } | null,
): { id: string; label: string; gradeSystem: string | null } | null {
  if (grade === null) return null;
  return {
    id: grade.id,
    label: grade.label,
    gradeSystem: grade.gradeSystem === null ? null : String(grade.gradeSystem).toLowerCase(),
  };
}

/**
 * A `Decimal` as text, never as a JavaScript number.
 *
 * `numeric(20,6)` does not fit in a double, and a specification limit that changes when it is
 * round-tripped is not a limit — the schema says so about the column, and it is just as true on
 * the way out.
 */
function decimalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** `bigint` and `int` both arrive from raw SQL; neither is served as-is. */
function numberOrNull(value: number | bigint | null): number | null {
  return value === null ? null : Number(value);
}

function notFound(): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
}

function conflict(message: string): ApiException {
  return new ApiException(HttpStatus.CONFLICT, ErrorCode.Conflict, message);
}

function validationError(field: string, issue: string): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.ValidationError,
    "The request could not be applied.",
    [{ field, issue }],
  );
}
