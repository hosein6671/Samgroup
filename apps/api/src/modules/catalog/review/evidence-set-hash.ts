/**
 * The review hash — one implementation, and it is not in this file.
 *
 * ── Why this is a thin wrapper and must stay one ────────────────────────────
 *
 * ADR-017 fixes the definition and puts it in the DATABASE, as
 * `specification_review_hash_v2(uuid)` and `product_claim_review_hash_v2(uuid)`, installed by
 * migration `20260826120000_add_review_hash_v2_and_invalidation`. The reason it lives there rather
 * than in a service is the one ADR-014 §7 gave and this gate strengthened: putting the definition
 * in the database is what stops two callers from disagreeing about it — and the database is now
 * also the thing that ACTS on it, so a second definition would be a second answer to a question
 * only one answer may exist for.
 *
 * Re-implementing the payload in TypeScript would create exactly that second definition, and it
 * would be one that could drift from the values stored in `technical_reviews.evidence_set_hash`
 * and `review_invalidations`. So this module calls the functions and does nothing else. The queue,
 * the detail response, the decision transaction and the database's own approval gate all end up at
 * the same SQL function, which makes "identical everywhere" a structural property rather than a
 * convention. `review-hash-boundary.spec.ts` asserts that no TypeScript hash implementation exists
 * anywhere in the repository.
 *
 * ── What v2 covers, and why v1 was not enough ───────────────────────────────
 *
 * v1 hashed the EVIDENCE LINKS alone — a sorted list of `<sourceFactId>:<assetSha256>`. Everything
 * else an approval rests on was invisible to it: the Specification's own value, unit, method and
 * result basis; its soft-delete state; the dictionary entry behind its property; the raw-property
 * mapping that resolves it; the role of each evidence link; and, for a ProductClaim, its kind,
 * standard body, code, context and identity. Each of those could change after an approval without
 * moving the hash by a bit.
 *
 * v2 is a canonical JSONB payload covering all of it, digested as SHA-256 over its UTF-8 bytes,
 * with a SEPARATE domain per subject type so the two hash spaces cannot collide. The exact payload
 * is documented in the migration and in ADR-017 §4-5; it is deliberately not restated here, because
 * a restatement is a second definition waiting to go stale.
 *
 * ── The version travels with the value ──────────────────────────────────────
 *
 * A fingerprint is only comparable against one computed the same way, so every `TechnicalReview`
 * records `evidenceHashVersion` alongside `evidenceSetHash`, and both the database CHECK and the
 * approval gate refuse a mismatch. The two constants below are the API's copy of those labels; the
 * database is their authority and `catalog-review-integration.spec.ts` asserts the two agree.
 *
 * ── The client never computes it ────────────────────────────────────────────
 *
 * A decision request carries an `expectedEvidenceSetHash`, and that value is used for ONE thing:
 * comparison against the hash this module recomputes inside the decision transaction. It is never
 * stored, never trusted and never echoed into `technical_reviews.evidence_set_hash` — the row
 * written there always carries the recomputed value.
 */

import type { ReviewSubjectType } from "./review-subject";

/** A 64-character lowercase hex SHA-256, the only shape any of the three functions returns. */
export const EVIDENCE_SET_HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The hash definition identifiers, one per subject domain.
 *
 * These are LABELS, not algorithms: they name which definition produced a stored value so that a
 * future definition change is a detectable mismatch rather than a silent false match. Changing
 * either string is changing the contract, and requires the database CHECK, the approval gate and
 * every stored row to change with it.
 */
export const SPECIFICATION_REVIEW_HASH_VERSION = "spec-review-v2";
export const PRODUCT_CLAIM_REVIEW_HASH_VERSION = "claim-review-v2";

/**
 * The third domain (ADR-019).
 *
 * It starts at v2 rather than v1 so that one version vocabulary covers all three subjects: the
 * database CHECK accepts exactly these three strings, and a lone `copy-review-v1` beside two v2s
 * would read as an OLDER definition rather than a newer subject.
 */
export const PRODUCT_COPY_REVIEW_HASH_VERSION = "copy-review-v2";

const HASH_VERSION_BY_SUBJECT: Readonly<Record<ReviewSubjectType, string>> = {
  specification: SPECIFICATION_REVIEW_HASH_VERSION,
  product_claim: PRODUCT_CLAIM_REVIEW_HASH_VERSION,
  product_copy: PRODUCT_COPY_REVIEW_HASH_VERSION,
};

/**
 * The version a review of the given subject type must carry.
 *
 * A total record rather than a ternary chain: adding a fourth subject to `REVIEW_SUBJECT_TYPES`
 * now fails to compile here instead of silently falling through to whichever version the last
 * branch happened to return. The two-subject ternary this replaced would have handed a
 * `product_copy` review the claim version, and the database would have refused it — correctly, but
 * as a 500 rather than as a type error.
 */
export function reviewHashVersionFor(subjectType: ReviewSubjectType): string {
  return HASH_VERSION_BY_SUBJECT[subjectType];
}

/**
 * The narrow read surface this module needs.
 *
 * Structural rather than `PrismaService`, so the same function serves a plain client, an
 * interactive transaction client, and a test double — and so nothing here can reach a write
 * method it has no business having.
 */
export interface EvidenceHashClient {
  $queryRawUnsafe<T>(sql: string, ...values: unknown[]): Promise<T>;
}

async function scalar(
  client: EvidenceHashClient,
  sql: string,
  subjectId: string,
): Promise<string | null> {
  const rows = await client.$queryRawUnsafe<{ hash: string | null }[]>(sql, subjectId);
  return rows[0]?.hash ?? null;
}

/**
 * The `spec-review-v2` hash of one Specification.
 *
 * `null` only when the SQL function itself answered NULL, which it does for a subject that does
 * not exist. Callers treat `null` as "not computable" and refuse the decision rather than
 * substituting a value.
 */
export function specificationEvidenceSetHash(
  client: EvidenceHashClient,
  specificationId: string,
): Promise<string | null> {
  return scalar(client, `SELECT "specification_review_hash_v2"($1::uuid) AS hash`, specificationId);
}

/** The ProductClaim counterpart — `claim-review-v2`. */
export function productClaimEvidenceSetHash(
  client: EvidenceHashClient,
  productClaimId: string,
): Promise<string | null> {
  return scalar(client, `SELECT "product_claim_review_hash_v2"($1::uuid) AS hash`, productClaimId);
}

/**
 * The ProductCopy counterpart — `copy-review-v2`.
 *
 * Its payload covers the TEXT as well as the evidence, which the other two do not have to: for a
 * Specification the reviewed fact is a value with a unit and a method, and for a claim it is a
 * standard reference — both of which the subject half already carries. For copy the reviewed fact
 * IS the prose, so `summary` and `selectionNote` are inside the digest. A word changed on an
 * approved row moves the hash, and the row falls back to `needs_review` through the same
 * invalidation path a changed specification value takes.
 */
export function productCopyEvidenceSetHash(
  client: EvidenceHashClient,
  productCopyId: string,
): Promise<string | null> {
  return scalar(client, `SELECT "product_copy_review_hash_v2"($1::uuid) AS hash`, productCopyId);
}
