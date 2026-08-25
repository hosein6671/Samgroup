/**
 * The evidence-set hash — one implementation, and it is not in this file.
 *
 * ── Why this is a thin wrapper and must stay one ────────────────────────────
 *
 * ADR-014 §7 fixes the definition and puts it in the DATABASE, as
 * `specification_evidence_set_hash(uuid)` and `product_claim_evidence_set_hash(uuid)`, installed
 * by migration `20260822120000_add_catalog_technical_data`. The reason it lives there rather than
 * in a service is stated in the migration itself: putting the definition in the database is what
 * stops two callers from disagreeing about it.
 *
 * Re-implementing the five steps in TypeScript would create exactly the second definition that
 * decision exists to prevent — and it would be a definition that could drift from the one the
 * stored `technical_reviews.evidence_set_hash` values were computed with. So this module calls
 * the functions and does nothing else. The queue, the detail response and the decision
 * transaction all come through here, which is what makes "identical between queue/detail/decision
 * code" a structural property rather than a convention.
 *
 * The definition, for a reader who should not have to open the migration:
 *
 *   1. every evidence link for the subject
 *   2. per link, `<source_fact_id>:<sha256 of the SourceAsset behind that fact's SourceDocument>`,
 *      with the empty string where no asset was captured
 *   3. sorted by byte value ascending — so insertion order cannot change it
 *   4. joined with newline, encoded UTF-8, SHA-256, lowercase hex
 *
 * An empty evidence set hashes the empty string
 * (`e3b0c442…b855`), which is a real, stable value rather than NULL.
 *
 * ── The client never computes it ────────────────────────────────────────────
 *
 * A decision request carries an `expectedEvidenceSetHash`, and that value is used for ONE thing:
 * comparison against the hash this module recomputes inside the decision transaction. It is never
 * stored, never trusted and never echoed into `technical_reviews.evidence_set_hash` — the row
 * written there always carries the recomputed value.
 */

/** A 64-character lowercase hex SHA-256, the only shape either function returns. */
export const EVIDENCE_SET_HASH_PATTERN = /^[0-9a-f]{64}$/;

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
 * The evidence-set hash of one Specification.
 *
 * `null` only when the SQL function itself answered NULL, which it cannot for a well-formed
 * subject — an empty evidence set still hashes. Callers treat `null` as "not computable" and
 * refuse the decision rather than substituting a value.
 */
export function specificationEvidenceSetHash(
  client: EvidenceHashClient,
  specificationId: string,
): Promise<string | null> {
  return scalar(
    client,
    `SELECT "specification_evidence_set_hash"($1::uuid) AS hash`,
    specificationId,
  );
}

/** The ProductClaim counterpart, over `claim_evidence`. */
export function productClaimEvidenceSetHash(
  client: EvidenceHashClient,
  productClaimId: string,
): Promise<string | null> {
  return scalar(
    client,
    `SELECT "product_claim_evidence_set_hash"($1::uuid) AS hash`,
    productClaimId,
  );
}
