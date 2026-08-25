import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

import { Trim } from "../../../../common/validation/trim.transform";
import { EVIDENCE_SET_HASH_PATTERN } from "../evidence-set-hash";
import { REVIEW_DECISIONS, REVIEW_STATUSES, type ReviewDecisionInput } from "../review-subject";

/**
 * The maximum length of a reviewer note.
 *
 * The same 2,000 characters `ChangeLeadStatusDto` allows, and for the same reason: generous enough
 * for a paragraph explaining why a value was rejected, short enough that `technical_reviews.note`
 * cannot become a documents feature by accident.
 */
export const REVIEW_NOTE_MAX_LENGTH = 2000;

/**
 * `POST /admin/catalog/review/{subject}/:id/decisions`.
 *
 * ── Four required fields, and none of them is redundant ─────────────────────
 *
 * `decision` is what the reviewer chose. The other three are the caller's assertion about what
 * they were looking at when they chose it, and each one closes a different way a decision can be
 * wrong:
 *
 *   * `expectedReviewStatus` — the state they saw. A second reviewer who acted on a stale screen
 *     loses the race with **409**, instead of silently overwriting the first one's decision.
 *   * `expectedEvidenceSetHash` — the EVIDENCE they saw. Status alone cannot catch a corrected
 *     source: an evidence link replaced since the queue was loaded leaves the status untouched
 *     while changing what the row actually rests on, and approving that is approving something
 *     the reviewer never read.
 *   * `note` — required for anything other than an approval, see below.
 *
 * There is no shorthand form of this request, and there is deliberately no `reviewStatus` field
 * anywhere on it. ADR-014 §8 requires that no generic update endpoint ever expose that column;
 * this DTO cannot express one, and `forbidNonWhitelisted` answers **400 naming the property** if a
 * client sends it.
 *
 * ── The subject id is NOT in the body ───────────────────────────────────────
 *
 * It is the path parameter, validated by `ReviewSubjectIdParam`, and the subject TYPE is the
 * route. A body that could name a different subject than the URL is a body with two answers to
 * one question — and the one an authorization check reads is rarely the one the write uses.
 */
export class ReviewDecisionDto {
  @IsIn([...REVIEW_DECISIONS])
  decision!: ReviewDecisionInput;

  /**
   * The review status the caller believes the subject currently holds.
   *
   * Validated against the full status vocabulary rather than only the decidable subset: a caller
   * asserting `superseded` is making a well-formed statement that happens to be about a row this
   * API will not decide, and answering that with **409 (the row is not in a decidable state)** is
   * more accurate than **400 (your request is malformed)**.
   */
  @IsIn([...REVIEW_STATUSES])
  expectedReviewStatus!: string;

  /**
   * The evidence-set hash the caller was shown, echoed back unchanged.
   *
   * Never stored and never trusted — the row written to `technical_reviews` always carries the
   * value recomputed inside the transaction. This field exists only to be compared with it.
   */
  @Matches(EVIDENCE_SET_HASH_PATTERN, {
    message: "expectedEvidenceSetHash must be 64 lowercase hexadecimal characters",
  })
  expectedEvidenceSetHash!: string;

  /**
   * Required for `reject` and `return_to_needs_review`; optional for `approve`.
   *
   * Cross-field, so it is enforced in the service rather than by a decorator — a reviewer who
   * refuses a supplier's stated value owes the record a reason, and an approval's reason is the
   * evidence itself. The service answers 400 naming `note` when it is missing.
   */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(REVIEW_NOTE_MAX_LENGTH)
  note?: string;
}
