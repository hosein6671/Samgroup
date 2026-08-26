import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { PrismaService } from "../../../prisma/prisma.service";

import {
  productClaimEvidenceSetHash,
  specificationEvidenceSetHash,
  type EvidenceHashClient,
} from "./evidence-set-hash";
import {
  PRODUCT_CLAIM_ELIGIBILITY_SQL,
  PRODUCT_CLAIM_UNRESOLVED_SQL,
  SPECIFICATION_ELIGIBILITY_SQL,
  SPECIFICATION_UNRESOLVED_SQL,
  productClaimApprovalBlockers,
  productClaimApprovalWarnings,
  specificationApprovalBlockers,
  specificationApprovalWarnings,
  type ProductClaimEligibilityRow,
  type ReviewBlocker,
  type SpecificationEligibilityRow,
} from "./review-eligibility";
import {
  DECIDABLE_FROM_STATUSES,
  DECISION_TARGET_STATUS,
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
    return subjectType === "specification"
      ? this.specificationDetail(id)
      : this.productClaimDetail(id);
  }

  private async specificationDetail(id: string): Promise<ReviewDetailResponse> {
    const row = await this.prisma.specification.findUnique({
      where: { id },
      select: SPECIFICATION_DETAIL_SELECT,
    });

    if (row === null) throw notFound();

    const [hash, eligibility, evidence, mappings, history] = await Promise.all([
      specificationEvidenceSetHash(this.prisma, id),
      this.specificationEligibility(this.prisma, id),
      this.evidenceEntries("specification", id),
      this.mappingRefs(id, row.propertyKey),
      this.history("specification", id),
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
    };
  }

  private async productClaimDetail(id: string): Promise<ReviewDetailResponse> {
    const row = await this.prisma.productClaim.findUnique({
      where: { id },
      select: PRODUCT_CLAIM_DETAIL_SELECT,
    });

    if (row === null) throw notFound();

    const [hash, eligibility, evidence, history] = await Promise.all([
      productClaimEvidenceSetHash(this.prisma, id),
      this.productClaimEligibility(this.prisma, id),
      this.evidenceEntries("product_claim", id),
      this.history("product_claim", id),
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
        const currentHash =
          subjectType === "specification"
            ? await specificationEvidenceSetHash(tx, id)
            : await productClaimEvidenceSetHash(tx, id);

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
          const blockers: ReviewBlocker[] =
            subjectType === "specification"
              ? specificationApprovalBlockers(await this.specificationEligibility(tx, id))
              : productClaimApprovalBlockers(await this.productClaimEligibility(tx, id));

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
    const sql =
      subjectType === "specification" ? SPECIFICATION_EVIDENCE_SQL : PRODUCT_CLAIM_EVIDENCE_SQL;
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
      where: subjectType === "specification" ? { specificationId: id } : { productClaimId: id },
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
}

/* -------------------------------------------------------------------------- */
/* Transaction helpers                                                         */
/* -------------------------------------------------------------------------- */

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
  const table = subjectType === "specification" ? "specifications" : "product_claims";
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

  const result =
    subjectType === "specification"
      ? await tx.specification.updateMany({ where, data })
      : await tx.productClaim.updateMany({ where, data });

  return result.count;
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
  const view =
    subjectType === "specification" ? "v_specification_public" : "v_product_claim_public";
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

  if (status !== "APPROVED" && visible) {
    throw new Error(
      `Public transition check failed: product claim ${id} is ${status} but is in ${view}. ` +
        `Rolling back.`,
    );
  }
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

/** Every mapping that bears on the raw labels this Specification's evidence carries. */
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
  ON m."raw_property" = sf."raw_property"
 AND (m."raw_unit" = sf."raw_unit" OR m."raw_unit" IS NULL)
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

function toQueueItem(row: QueueRow): ReviewQueueItemResponse {
  return {
    subjectType: row.subjectType === "specification" ? "specification" : "product_claim",
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
