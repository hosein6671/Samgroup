/**
 * Approval eligibility — the rules a subject must satisfy before a reviewer may approve it.
 *
 * ── Why this is SQL and not a Prisma query builder ──────────────────────────
 *
 * Every rule below is a statement about rows in five or six tables at once, several of them
 * expressed as "for EVERY evidence link, ..." rather than "for SOME". Prisma's relation filters
 * answer the second well and the first badly, and the difference between them is the difference
 * between "one link resolves" and "all links resolve" — which on an approval gate is the whole
 * question. One statement, evaluated by PostgreSQL in the caller's transaction, is both correct
 * and atomic with the decision that follows it.
 *
 * The statements are FIXED strings with one bound parameter. Nothing is interpolated, no filter
 * is concatenated in, and no caller-supplied value reaches SQL text.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 *
 * Every predicate is written so that a missing row, a NULL, or an empty set produces `false`.
 * `bool_and` over no rows is NULL, so each aggregate is wrapped in `coalesce(..., false)`: a
 * Specification with no evidence at all does not accidentally satisfy "all of its evidence
 * resolves" by having none.
 *
 * ── What is re-asserted even though the database already enforces it ────────
 *
 * The grade/product relationship is a composite foreign key, the value shape is a CHECK, and the
 * forbidden claim kinds are a CHECK. They are all re-checked here anyway, and that is deliberate
 * rather than defensive clutter: the API's job is to REFUSE with a readable reason, and a
 * constraint violation arrives as a driver error that becomes a 500. Re-asserting turns each of
 * them into a named blocker a reviewer can act on. The constraints remain the invariant; these
 * are message quality, exactly as ADR-011 permits.
 */

/**
 * The mapping resolution rule, reproduced from the importer.
 *
 * `resolveProperty` in `../import/spec-property-dictionary.ts` picks a UNIT-SPECIFIC mapping over
 * a unit-agnostic one and accepts only a HIGH-confidence mapping that names a seeded key. The
 * `ORDER BY (m.raw_unit IS NULL) ASC LIMIT 1` below is that `specific ?? generic` preference
 * written in SQL, and the `confidence = 'high'` filter is the second half.
 *
 * A mapping whose own review status is `rejected` or `superseded` is skipped rather than
 * accepted, so a mapping a human has already refused cannot go on justifying approvals. A mapping
 * at `source_recorded` IS accepted when it is HIGH and names a seeded key: that is precisely the
 * repository's existing definition of a resolved property — `SPEC_PROPERTY_SEED` is "approved
 * domain truth by construction" and a HIGH mapping into it is what the importer treats as
 * resolved. Requiring `spec_property_mappings.review_status = 'approved'` instead would be a
 * stricter rule than the importer's, and no surface exists in this gate that could ever set it.
 * Flagged for the Architect in the gate report rather than decided silently.
 */
const RESOLVED_MAPPING = `
  SELECT m."spec_property_key"
    FROM "spec_property_mappings" m
   WHERE m."raw_property" = sf."raw_property"
     AND (m."raw_unit" = sf."raw_unit" OR m."raw_unit" IS NULL)
     AND m."confidence" = 'high'
     AND m."review_status" NOT IN ('rejected', 'superseded')
   ORDER BY (m."raw_unit" IS NULL) ASC
   LIMIT 1`;

/**
 * The `specifications_value_shape` CHECK, restated.
 *
 * Byte-for-byte the same CASE the migration installs, with `value_type IS NOT NULL` added: the
 * CHECK's `ELSE` branch legitimately admits a legacy row that has never been normalized, and a
 * legacy row is not something this API approves.
 */
const VALUE_SHAPE = `
  s."value_type" IS NOT NULL AND CASE s."value_type"
    WHEN 'point' THEN
      s."numeric_min" IS NOT NULL AND s."numeric_max" IS NULL
      AND s."pair_first" IS NULL AND s."pair_second" IS NULL
    WHEN 'minimum' THEN
      s."numeric_min" IS NOT NULL AND s."numeric_max" IS NULL
      AND s."pair_first" IS NULL AND s."pair_second" IS NULL
    WHEN 'maximum' THEN
      s."numeric_max" IS NOT NULL AND s."numeric_min" IS NULL
      AND s."pair_first" IS NULL AND s."pair_second" IS NULL
    WHEN 'range' THEN
      s."numeric_min" IS NOT NULL AND s."numeric_max" IS NOT NULL
      AND s."numeric_min" <= s."numeric_max"
      AND s."pair_first" IS NULL AND s."pair_second" IS NULL
    WHEN 'pair' THEN
      s."pair_first" IS NOT NULL AND s."pair_second" IS NOT NULL
      AND s."numeric_min" IS NULL AND s."numeric_max" IS NULL
    ELSE
      s."numeric_min" IS NULL AND s."numeric_max" IS NULL
      AND s."pair_first" IS NULL AND s."pair_second" IS NULL
  END`;

/** What one eligibility probe answers. Every field is a fact, never a verdict. */
export interface SpecificationEligibilityRow {
  live: boolean;
  productExists: boolean;
  gradeOk: boolean;
  propertyInDictionary: boolean;
  normalized: boolean;
  valueShapeOk: boolean;
  evidenceLinks: number;
  evidenceOrphans: number;
  mappingOk: boolean;
  plannerFlagged: boolean;
}

export const SPECIFICATION_ELIGIBILITY_SQL = `
SELECT
  (s."deleted_at" IS NULL)                                      AS "live",
  (p."id" IS NOT NULL)                                          AS "productExists",
  (s."product_grade_id" IS NULL OR g."id" IS NOT NULL)          AS "gradeOk",
  (sp."key" IS NOT NULL)                                        AS "propertyInDictionary",
  (s."value_type" IS NOT NULL
     AND s."display_value" IS NOT NULL
     AND length(btrim(s."display_value")) > 0)                   AS "normalized",
  (${VALUE_SHAPE})                                               AS "valueShapeOk",
  coalesce(ev."links", 0)                                        AS "evidenceLinks",
  coalesce(ev."orphans", 0)                                      AS "evidenceOrphans",
  coalesce(map."ok", false)                                      AS "mappingOk",
  (s."review_status" = 'needs_review')                           AS "plannerFlagged"
FROM "specifications" s
LEFT JOIN "products" p       ON p."id" = s."product_id"
LEFT JOIN "product_grades" g ON g."id" = s."product_grade_id" AND g."product_id" = s."product_id"
LEFT JOIN "spec_properties" sp ON sp."key" = s."property_key"
LEFT JOIN LATERAL (
  SELECT count(*)::int AS "links",
         count(*) FILTER (WHERE sf."id" IS NULL OR sd."id" IS NULL)::int AS "orphans"
    FROM "specification_evidence" se
    LEFT JOIN "source_facts" sf     ON sf."id" = se."source_fact_id"
    LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
   WHERE se."specification_id" = s."id"
) ev ON TRUE
LEFT JOIN LATERAL (
  SELECT coalesce(bool_and(
           mm."spec_property_key" IS NOT NULL
           AND mm."spec_property_key" = s."property_key"
         ), false) AS "ok"
    FROM "specification_evidence" se2
    JOIN "source_facts" sf ON sf."id" = se2."source_fact_id"
    LEFT JOIN LATERAL (${RESOLVED_MAPPING}) mm ON TRUE
   WHERE se2."specification_id" = s."id"
) map ON TRUE
WHERE s."id" = $1::uuid`;

export interface ProductClaimEligibilityRow {
  live: boolean;
  productExists: boolean;
  gradeOk: boolean;
  kindApprovable: boolean;
  namedBodyOk: boolean;
  identityOk: boolean;
  evidenceLinks: number;
  evidenceOrphans: number;
  plannerFlagged: boolean;
}

/**
 * `identityOk` — "a valid claim identity".
 *
 * A claim carrying nothing but its kind is not a statement about anything: `SUITABLE_FOR` with no
 * body, no code, no context and no identity hash names no standard and quotes no source sentence.
 * Any ONE of the four is enough, because the four are genuinely alternative ways a real claim is
 * identified — an API class in `standard_code`, a manufacturer in `standard_body`, a source
 * sentence in `context_note`, or the importer's normalized-statement hash.
 */
export const PRODUCT_CLAIM_ELIGIBILITY_SQL = `
SELECT
  (c."deleted_at" IS NULL)                                       AS "live",
  (p."id" IS NOT NULL)                                           AS "productExists",
  (c."product_grade_id" IS NULL OR g."id" IS NOT NULL)           AS "gradeOk",
  (c."kind" NOT IN ('licensed_by', 'reference_only'))            AS "kindApprovable",
  (c."kind" <> 'approved_by'
     OR (c."standard_body" IS NOT NULL
         AND length(btrim(c."standard_body")) > 0))              AS "namedBodyOk",
  (coalesce(length(btrim(c."standard_body")), 0) > 0
     OR coalesce(length(btrim(c."standard_code")), 0) > 0
     OR coalesce(length(btrim(c."context_note")), 0) > 0
     OR c."claim_identity_hash" IS NOT NULL)                     AS "identityOk",
  coalesce(ev."links", 0)                                        AS "evidenceLinks",
  coalesce(ev."orphans", 0)                                      AS "evidenceOrphans",
  (c."review_status" = 'needs_review')                           AS "plannerFlagged"
FROM "product_claims" c
LEFT JOIN "products" p       ON p."id" = c."product_id"
LEFT JOIN "product_grades" g ON g."id" = c."product_grade_id" AND g."product_id" = c."product_id"
LEFT JOIN LATERAL (
  SELECT count(*)::int AS "links",
         count(*) FILTER (WHERE sf."id" IS NULL OR sd."id" IS NULL)::int AS "orphans"
    FROM "claim_evidence" ce
    LEFT JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
    LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
   WHERE ce."product_claim_id" = c."id"
) ev ON TRUE
WHERE c."id" = $1::uuid`;

/**
 * The reasons, in a fixed order.
 *
 * Strings rather than a code enum: they are shown to an operator, and the set is small enough
 * that a translation catalog for an internal Admin surface would be ceremony. Every one names the
 * rule rather than the row, so a blocker never leaks a value the reviewer has not been shown.
 */
export function specificationApprovalBlockers(row: SpecificationEligibilityRow): string[] {
  const blockers: string[] = [];
  if (!row.live) blockers.push("The specification has been retired (deletedAt is set).");
  if (!row.productExists) blockers.push("The specification does not resolve to a Product.");
  if (!row.gradeOk) blockers.push("The grade does not belong to this Product.");
  if (!row.normalized) {
    blockers.push(
      "The specification is not normalized: it needs a value type and a display value.",
    );
  }
  if (!row.propertyInDictionary) {
    blockers.push("The property key is not an entry in the controlled dictionary.");
  }
  if (!row.valueShapeOk) blockers.push("The numeric columns do not match the declared value type.");
  if (row.evidenceLinks === 0) blockers.push("The specification cites no evidence.");
  if (row.evidenceOrphans > 0) {
    blockers.push("An evidence link does not resolve to a SourceFact and its SourceDocument.");
  }
  if (!row.mappingOk) {
    blockers.push(
      "The source property does not resolve to this property key through an approved " +
        "HIGH-confidence mapping.",
    );
  }
  return blockers;
}

export function productClaimApprovalBlockers(row: ProductClaimEligibilityRow): string[] {
  const blockers: string[] = [];
  if (!row.live) blockers.push("The claim has been retired (deletedAt is set).");
  if (!row.productExists) blockers.push("The claim does not resolve to a Product.");
  if (!row.gradeOk) blockers.push("The grade does not belong to this Product.");
  if (!row.kindApprovable) {
    blockers.push("This claim kind can never be approved (LICENSED_BY and REFERENCE_ONLY).");
  }
  if (!row.namedBodyOk) blockers.push("An APPROVED_BY claim requires a named standard body.");
  if (!row.identityOk)
    blockers.push("The claim carries no identifying body, code, context or hash.");
  if (row.evidenceLinks === 0) blockers.push("The claim cites no evidence.");
  if (row.evidenceOrphans > 0) {
    blockers.push("An evidence link does not resolve to a SourceFact and its SourceDocument.");
  }
  return blockers;
}

/**
 * The queue's `hasUnresolvedFindings`, defined over the same durable state.
 *
 * Two sources, and only two, because only two survive the importer as ROWS: the planner's
 * per-row verdict (`review_status = 'needs_review'`, written by `statusFor` when a conflict or
 * review flag was attached to that row) and, for a Specification, whether the property mapping
 * resolves. The manifest's flag list is a generated file, not a fact about the row, and is not
 * consulted here.
 */
export const SPECIFICATION_UNRESOLVED_SQL = `
  s."review_status" = 'needs_review'
  OR NOT coalesce((
    SELECT bool_and(mm."spec_property_key" IS NOT NULL
                    AND mm."spec_property_key" = s."property_key")
      FROM "specification_evidence" se2
      JOIN "source_facts" sf ON sf."id" = se2."source_fact_id"
      LEFT JOIN LATERAL (${RESOLVED_MAPPING}) mm ON TRUE
     WHERE se2."specification_id" = s."id"
  ), false)`;

export const PRODUCT_CLAIM_UNRESOLVED_SQL = `c."review_status" = 'needs_review'`;
