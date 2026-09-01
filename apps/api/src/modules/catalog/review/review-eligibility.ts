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
 * `resolveProperty` in `../import/spec-property-dictionary.ts` prefers a UNIT-SPECIFIC mapping
 * over a unit-agnostic one and accepts only a HIGH-confidence mapping that names a seeded key.
 * `resolvedMappingSql` below is that rule in SQL, with one ratified difference recorded on it:
 * the approval filter runs BEFORE the tier is chosen, so an unusable unit-specific mapping cannot
 * shadow a usable generic one.
 *
 * A mapping whose own review status is `rejected` or `superseded` is skipped rather than
 * accepted, so a mapping a human has already refused cannot go on justifying approvals. A mapping
 * at `source_recorded` IS accepted when it is HIGH and names a seeded key: that is precisely the
 * repository's existing definition of a resolved property — `SPEC_PROPERTY_SEED` is "approved
 * domain truth by construction" and a HIGH mapping into it is what the importer treats as
 * resolved. Requiring `spec_property_mappings.review_status = 'approved'` instead would be a
 * stricter rule than the importer's, and no surface exists in this gate that could ever set it.
 * Ratified by the Architect on 25 August 2026 as Option A — ADR-016 §6.
 */

/**
 * The importer's own label normalisation, in SQL.
 *
 * `mappingLookupKey` in `../import/spec-property-dictionary.ts` folds the label as
 * `rawProperty.replace(/\s+/g, " ").trim().toLowerCase()`, and this is that expression — collapse
 * internal whitespace runs to one space, trim, fold case. ASCII catalogue vocabulary only; the
 * scope note lives on `mappingLookupKey` itself.
 *
 * ── Why it exists ──────────────────────────────────────────────────────────
 *
 * It did not, and the omission was a real defect. The gate compared `raw_property` RAW — exact,
 * case-sensitive, whitespace-sensitive — while the importer that produced the rows resolved
 * case-insensitively. **The approval gate was therefore stricter than the importer whose output it
 * judges**, and three specifications the importer had resolved perfectly well (they carry a
 * normalized `property_key` precisely because it did) were reported `PROPERTY_MAPPING_UNRESOLVED`
 * and could not be approved: the source documents spell it "Flash point" and the dictionary holds
 * "Flash Point".
 *
 * The dictionary settles which spelling is authoritative rather than leaving it to taste. Its
 * uniqueness invariant IS `mappingLookupKey`: `duplicateMappingIdentities` runs at module load and
 * throws, so two seeds that differ only in label case, in internal whitespace, or in the case of
 * their unit cannot coexist. Two spellings of one label are therefore one mapping by construction,
 * and matching case-insensitively is the only reading consistent with that.
 *
 * ── What it deliberately does not widen ────────────────────────────────────
 *
 * Only the comparison is normalised. The HIGH-confidence requirement, the seeded-key requirement
 * and the rejected/superseded exclusion are untouched, so no mapping becomes acceptable that was
 * not already acceptable under some spelling of its label.
 */
const NORMALIZED_LABEL = (column: string): string =>
  `lower(btrim(regexp_replace(${column}, '\\s+', ' ', 'g')))`;

/**
 * The unit half, normalised the way `mappingLookupKey` normalises it: `(u ?? "").trim()
 * .toLowerCase()`. No whitespace collapsing — that is the label rule, not the unit rule.
 *
 * **`coalesce` is the whole point, and it is a correction.** The importer coerces a missing unit
 * to the empty string BEFORE folding, so a fact carrying no unit and a mapping carrying `''` have
 * the same unit key and match. Comparing `lower(btrim(NULL))` instead yields NULL, which is not
 * true, so that pair silently failed to match here while the importer resolved it — the same class
 * of defect as the raw label comparison, one column over. Unit-specific mappings are dormant in the
 * current dictionary (all 75 seeds carry `rawUnit: null`), so this corrects a latent divergence
 * rather than a live one.
 */
const NORMALIZED_UNIT = (column: string): string => `lower(btrim(coalesce(${column}, '')))`;

/**
 * The importer's lookup rule as a SQL join predicate — **the single copy both consumers use.**
 *
 * `RESOLVED_MAPPING` below decides whether a Specification may be approved; the reviewer-facing
 * mapping list in `catalog-review.service.ts` decides what a reviewer is SHOWN. Were the two to
 * match differently, a reviewer could be shown a resolving mapping for a subject the gate then
 * refused as unresolved, or the reverse, which is worse. They are the same string rather than two
 * strings a comment asks you to keep aligned.
 *
 * A mapping with a unit is unit-specific and must agree on the unit; a mapping without one is
 * unit-agnostic and matches the label alone. That is `MAPPINGS_BY_LABEL_AND_UNIT` and
 * `MAPPINGS_BY_LABEL`, restated in SQL.
 */
export const mappingMatchesFactSql = (mapping: string, fact: string): string =>
  `${NORMALIZED_LABEL(`${mapping}."raw_property"`)} = ${NORMALIZED_LABEL(`${fact}."raw_property"`)}
   AND (${mapping}."raw_unit" IS NULL
        OR ${NORMALIZED_UNIT(`${mapping}."raw_unit"`)} = ${NORMALIZED_UNIT(`${fact}."raw_unit"`)})`;

/**
 * One matching mapping the gate is willing to consider: the shared predicate, plus the two filters
 * that make a mapping authoritative. `resolvedMappingSql` needs this twice — once to aggregate
 * over and once to ask whether a unit-specific candidate exists — so it is written once.
 */
const eligibleMappingSql = (mapping: string): string =>
  `${mappingMatchesFactSql(mapping, "sf")}
     AND ${mapping}."confidence" = 'high'
     AND ${mapping}."review_status" NOT IN ('rejected', 'superseded')`;

/**
 * The resolved property key for one SourceFact, or NULL when the mappings do not settle it.
 *
 * ── Tier preference: specific over generic, among APPROVABLE mappings ───────
 *
 * `(m."raw_unit" IS NOT NULL) = EXISTS (… an approvable unit-specific match …)` is the
 * specific-over-generic rule: when a unit-specific mapping is available, only unit-specific
 * mappings are considered; otherwise only unit-agnostic ones are.
 *
 * **This is close to the importer's `specific ?? generic` but is deliberately NOT identical, and
 * the difference is ratified rather than accidental.** `resolveProperty` selects the mapping
 * FIRST and judges confidence SECOND, so a LOW unit-specific mapping shadows a HIGH generic one
 * and the fact resolves to nothing. Here the approval filter runs first, so a LOW — or rejected,
 * or superseded — unit-specific mapping never claims the tier, and a qualifying generic mapping
 * resolves instead. The reviewer contract is "the specific tier among mappings eligible for
 * approval", which is also what the previous `ORDER BY … LIMIT 1` did; it is preserved here, not
 * changed. `catalog-review-integration.spec.ts` pins every combination against a real PostgreSQL.
 *
 * It is a correlated `EXISTS` rather than a ranked derived table because the whole constant is
 * already a LATERAL subquery over `sf`, and ordinary correlation is the form whose scoping is
 * beyond doubt.
 *
 * ── Ambiguity, and why it still fails closed ────────────────────────────────
 *
 * Normalising the comparison makes rows equivalent that the database still stores as distinct, and
 * the two sides of that are now in different states:
 *
 *   - **The importer's seed cannot collide.** `duplicateMappingIdentities` runs at module load in
 *     `../import/spec-property-dictionary.ts` and throws, so two seeds sharing a normalised
 *     identity are unrepresentable — the silent last-write-wins in its `Map`s is closed
 *     structurally.
 *   - **Database rows still can.** `spec_property_mappings_raw_property_raw_unit_key` is UNIQUE on
 *     the RAW pair and is NULLS DISTINCT, so `('Flash Point', NULL)` and `('Flash  Point', NULL)`
 *     remain two legal rows, as do two rows carrying the identical label and a NULL unit. A
 *     normalised unique index would close that; it is a migration, and it is deferred while the
 *     live table has zero collisions.
 *
 * So ambiguity reaching this query is database-originated, and this query is where it is caught. A
 * bare `LIMIT 1` had nothing to decide which row won, so the same specification could be
 * approvable on one call and blocked on the next; adding a tiebreaker would invent an answer the
 * contract does not give. It therefore yields a key only when every candidate in the winning tier
 * carries the SAME non-null key, and NULL — `PROPERTY_MAPPING_UNRESOLVED`, blocked — when they
 * disagree or when any of them names no key at all.
 *
 * Failing closed is the safe direction: blocking a subject is recoverable by fixing the data,
 * while approving one on a coin toss publishes an unreviewed technical fact.
 */
const resolvedMappingSql = (relation: string): string => `
  SELECT CASE
           WHEN count(*) = count(m."spec_property_key")
            AND count(DISTINCT m."spec_property_key") = 1
           THEN min(m."spec_property_key")
         END AS "spec_property_key"
    FROM ${relation} m
   WHERE ${eligibleMappingSql("m")}
     AND (m."raw_unit" IS NOT NULL) = EXISTS (
           SELECT 1
             FROM ${relation} m2
            WHERE ${eligibleMappingSql("m2")}
              AND m2."raw_unit" IS NOT NULL
         )`;

/**
 * Exported ONLY so the integration suite can drive the identical text over a `VALUES` relation of
 * synthetic candidates. Production always reads the real table; nothing else may pass a relation.
 */
export const resolvedMappingSqlOver = resolvedMappingSql;

const RESOLVED_MAPPING = resolvedMappingSql('"spec_property_mappings"');

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

/**
 * "Current evidence", as the fail-closed rules of this gate mean it.
 *
 * SUPERSEDED evidence is retained and never unlinked (ADR-014), which is right for an audit trail
 * and wrong for an eligibility rule: a superseded reading is precisely the one a later revision
 * replaced, and letting it satisfy "the method is evidenced" or "the source is captured" would let
 * a withdrawn document go on justifying an approval.
 *
 * The two rules added by this gate therefore quantify over PRIMARY and CORROBORATING links only.
 * The pre-existing rules (`evidenceLinks`, `evidenceOrphans`, `mappingOk`) are deliberately left
 * quantifying over every link, because narrowing them would change what they mean and this gate
 * ratified no such change. In the live catalogue all 1,546 links are PRIMARY, so the two
 * quantifications currently select the same rows — the difference is a rule about the future.
 */
const CURRENT_EVIDENCE = `"role" <> 'superseded'`;

/**
 * "The source behind this evidence link is captured", as one predicate.
 *
 * Four conditions, and every one of them must hold: the fact resolves to a document, the document
 * names an asset, the asset row exists, and the asset carries a real SHA-256 over a non-empty file.
 * A `sha256` that is not 64 lowercase hex characters is not an identity — it is a placeholder
 * someone wrote — and a `byte_size` of zero identifies no bytes at all.
 *
 * The locator is NOT read here and must never be: a blocker built from this predicate says that a
 * source is uncaptured, and it says nothing about where the source lives.
 */
const SOURCE_CAPTURED = `
  sd."id" IS NOT NULL
  AND sd."source_asset_id" IS NOT NULL
  AND sa."id" IS NOT NULL
  AND sa."sha256" ~ '^[0-9a-f]{64}$'
  AND sa."byte_size" > 0`;

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

  /**
   * The dictionary's method rule for this property, or null when the key resolves to no entry.
   *
   * Null is safe rather than permissive: a Specification whose key is not in the dictionary is
   * already blocked by `PROPERTY_NOT_IN_DICTIONARY`, so no method rule needs to fire to keep it
   * ineligible. Nothing infers `required` from a missing record, and nothing infers `optional`.
   */
  methodRequirement: string | null;

  /** `specifications.method` is non-null and non-blank after trimming. */
  normalizedMethodPresent: boolean;

  /** At least one CURRENT evidence link carries a non-blank `source_facts.raw_method`. */
  rawMethodPresent: boolean;

  /** EVERY current evidence link satisfies the capture chain. False over an empty set. */
  sourceCaptured: boolean;

  /** At least one current evidence document has no `document_date`. */
  documentDateUnknown: boolean;

  /** At least one current evidence document has no non-blank `revision_label`. */
  documentRevisionUnknown: boolean;
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
  (s."review_status" = 'needs_review')                           AS "plannerFlagged",
  sp."method_requirement"::text                                  AS "methodRequirement",
  (s."method" IS NOT NULL
     AND length(btrim(s."method")) > 0)                           AS "normalizedMethodPresent",
  coalesce(cur."rawMethodPresent", false)                        AS "rawMethodPresent",
  coalesce(cur."sourceCaptured", false)                          AS "sourceCaptured",
  coalesce(cur."documentDateUnknown", false)                     AS "documentDateUnknown",
  coalesce(cur."documentRevisionUnknown", false)                 AS "documentRevisionUnknown"
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
  SELECT
    coalesce(bool_or(sf."raw_method" IS NOT NULL
                     AND length(btrim(sf."raw_method")) > 0), false) AS "rawMethodPresent",
    coalesce(bool_and(${SOURCE_CAPTURED}), false)                    AS "sourceCaptured",
    coalesce(bool_or(sd."id" IS NULL OR sd."document_date" IS NULL), false)
                                                                     AS "documentDateUnknown",
    coalesce(bool_or(sd."id" IS NULL
                     OR sd."revision_label" IS NULL
                     OR length(btrim(sd."revision_label")) = 0), false)
                                                                     AS "documentRevisionUnknown"
    FROM "specification_evidence" se3
    LEFT JOIN "source_facts" sf      ON sf."id" = se3."source_fact_id"
    LEFT JOIN "source_documents" sd  ON sd."id" = sf."source_document_id"
    LEFT JOIN "source_assets" sa     ON sa."id" = sd."source_asset_id"
   WHERE se3."specification_id" = s."id" AND se3.${CURRENT_EVIDENCE}
) cur ON TRUE
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

  /**
   * The same three facts a Specification carries, and NOT the two method facts.
   *
   * A claim has no property key, so it has no `SpecProperty` record, so it has no method
   * requirement and no normalized method. Nothing here invents one, and the claim blocker builder
   * cannot emit `REQUIRED_METHOD_ABSENT` or `METHOD_NOT_EVIDENCED` because it has nothing to build
   * one from. That is the contract separation, enforced by the row shape rather than by discipline.
   */
  sourceCaptured: boolean;
  documentDateUnknown: boolean;
  documentRevisionUnknown: boolean;
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
  (c."review_status" = 'needs_review')                           AS "plannerFlagged",
  coalesce(cur."sourceCaptured", false)                          AS "sourceCaptured",
  coalesce(cur."documentDateUnknown", false)                     AS "documentDateUnknown",
  coalesce(cur."documentRevisionUnknown", false)                 AS "documentRevisionUnknown"
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
LEFT JOIN LATERAL (
  SELECT
    coalesce(bool_and(${SOURCE_CAPTURED}), false)                    AS "sourceCaptured",
    coalesce(bool_or(sd."id" IS NULL OR sd."document_date" IS NULL), false)
                                                                     AS "documentDateUnknown",
    coalesce(bool_or(sd."id" IS NULL
                     OR sd."revision_label" IS NULL
                     OR length(btrim(sd."revision_label")) = 0), false)
                                                                     AS "documentRevisionUnknown"
    FROM "claim_evidence" ce2
    LEFT JOIN "source_facts" sf      ON sf."id" = ce2."source_fact_id"
    LEFT JOIN "source_documents" sd  ON sd."id" = sf."source_document_id"
    LEFT JOIN "source_assets" sa     ON sa."id" = sd."source_asset_id"
   WHERE ce2."product_claim_id" = c."id" AND ce2.${CURRENT_EVIDENCE}
) cur ON TRUE
WHERE c."id" = $1::uuid`;

/**
 * What one ProductCopy probe answers — the narrowest of the three row shapes.
 *
 * ── What is deliberately absent, and why the SHAPE is what enforces it ──────
 *
 * No `mappingOk`, no value shape, no method facts, no claim identity. Copy has no property key, no
 * numeric value, no unit and no standard reference, so every one of those rules is about something
 * this subject does not have. They are absent from the row rather than defaulted to `true`,
 * because a field that is always `true` is a rule someone will later mistake for a satisfied one.
 *
 * `gradeOk` is absent for a different reason: copy is written about a Product, never about one
 * grade of it. `product_copy` has no `product_grade_id` column at all.
 */
export interface ProductCopyEligibilityRow {
  live: boolean;
  productExists: boolean;
  localeActive: boolean;
  evidenceLinks: number;
  evidenceOrphans: number;
  plannerFlagged: boolean;

  sourceCaptured: boolean;
  documentDateUnknown: boolean;
  documentRevisionUnknown: boolean;
}

/**
 * The ProductCopy eligibility probe.
 *
 * ── `localeActive` is a fact here and NOT a blocker ─────────────────────────
 *
 * The locale list is data, never code (`PROJECT_HANDOFF` §6.9), so `product_copy.locale` is a text
 * column rather than a foreign key — Catalog's row must not take a hard dependency on
 * Localization's table. That leaves open the case of copy written for a locale that was since
 * deactivated, and this column reports it.
 *
 * It reports it and stops there. Turning it into a blocker would be adding a rule ADR-019 did not
 * ratify, and it would be the wrong rule anyway: a locale being switched off is an editorial
 * decision about the SITE, and it does not make a reviewed sentence untrue. What it does is stop
 * the sentence being served, which §5 already handles by serving nothing.
 */
export const PRODUCT_COPY_ELIGIBILITY_SQL = `
SELECT
  (pc."deleted_at" IS NULL)                                      AS "live",
  (p."id" IS NOT NULL)                                           AS "productExists",
  (l."code" IS NOT NULL AND l."is_active")                       AS "localeActive",
  coalesce(ev."links", 0)                                        AS "evidenceLinks",
  coalesce(ev."orphans", 0)                                      AS "evidenceOrphans",
  (pc."review_status" = 'needs_review')                          AS "plannerFlagged",
  coalesce(cur."sourceCaptured", false)                          AS "sourceCaptured",
  coalesce(cur."documentDateUnknown", false)                     AS "documentDateUnknown",
  coalesce(cur."documentRevisionUnknown", false)                 AS "documentRevisionUnknown"
FROM "product_copy" pc
LEFT JOIN "products" p ON p."id" = pc."product_id"
LEFT JOIN "locales" l  ON l."code" = pc."locale"
LEFT JOIN LATERAL (
  SELECT count(*)::int AS "links",
         count(*) FILTER (WHERE sf."id" IS NULL OR sd."id" IS NULL)::int AS "orphans"
    FROM "copy_evidence" ce
    LEFT JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
    LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
   WHERE ce."product_copy_id" = pc."id"
) ev ON TRUE
LEFT JOIN LATERAL (
  SELECT
    coalesce(bool_and(${SOURCE_CAPTURED}), false)                    AS "sourceCaptured",
    coalesce(bool_or(sd."id" IS NULL OR sd."document_date" IS NULL), false)
                                                                     AS "documentDateUnknown",
    coalesce(bool_or(sd."id" IS NULL
                     OR sd."revision_label" IS NULL
                     OR length(btrim(sd."revision_label")) = 0), false)
                                                                     AS "documentRevisionUnknown"
    FROM "copy_evidence" ce2
    LEFT JOIN "source_facts" sf      ON sf."id" = ce2."source_fact_id"
    LEFT JOIN "source_documents" sd  ON sd."id" = sf."source_document_id"
    LEFT JOIN "source_assets" sa     ON sa."id" = sd."source_asset_id"
   WHERE ce2."product_copy_id" = pc."id" AND ce2.${CURRENT_EVIDENCE}
) cur ON TRUE
WHERE pc."id" = $1::uuid`;

/* -------------------------------------------------------------------------- */
/* The structured reasons                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The blocker vocabulary — a closed set of stable codes, and this file is its authority.
 *
 * ── Why the sentences became codes ──────────────────────────────────────────
 *
 * These used to be bare strings, on the argument that they are shown to an operator and that a
 * code table would be ceremony for an internal surface. That argument held while the only consumer
 * was a page. It stopped holding the moment a refusal had to be machine-readable: the ratified rule
 * is that **frontend wording is never the enforcement boundary**, so a direct `POST` that rendered
 * no page must still come back with the reason, and a client must be able to branch on it without
 * matching English prose.
 *
 * The code is the rule's identity. The message is its rendering, and it may be reworded freely.
 * Adding a code is adding a rule; changing one is changing the contract.
 *
 * ── The mapping is one-to-one and nothing moved ─────────────────────────────
 *
 * Every sentence that existed before this gate has exactly one code, and every code covers exactly
 * one rule. Where a rule is literally the same rule on both subject types — retired, unresolved
 * Product, foreign grade, no evidence, unresolvable evidence link — the code is shared and the
 * message still names the subject it is about. No rule's eligibility meaning changed; the last
 * three entries are the ones this gate ADDS.
 *
 *   SUBJECT_RETIRED              was "The specification/claim has been retired (deletedAt is set)."
 *   PRODUCT_UNRESOLVED           was "The specification/claim does not resolve to a Product."
 *   GRADE_NOT_OF_PRODUCT         was "The grade does not belong to this Product."
 *   SPECIFICATION_NOT_NORMALIZED was "The specification is not normalized: it needs a value type…"
 *   PROPERTY_NOT_IN_DICTIONARY   was "The property key is not an entry in the controlled dictionary."
 *   VALUE_SHAPE_MISMATCH         was "The numeric columns do not match the declared value type."
 *   EVIDENCE_ABSENT              was "The specification/claim cites no evidence."
 *   EVIDENCE_LINK_UNRESOLVED     was "An evidence link does not resolve to a SourceFact and its…"
 *   PROPERTY_MAPPING_UNRESOLVED  was "The source property does not resolve to this property key…"
 *   CLAIM_KIND_NEVER_APPROVABLE  was "This claim kind can never be approved (LICENSED_BY and…)."
 *   NAMED_BODY_ABSENT            was "An APPROVED_BY claim requires a named standard body."
 *   CLAIM_IDENTITY_ABSENT        was "The claim carries no identifying body, code, context or hash."
 *   REQUIRED_METHOD_ABSENT       new in this gate
 *   METHOD_NOT_EVIDENCED         new in this gate
 *   SOURCE_ASSET_ABSENT          new in this gate
 */
export const REVIEW_BLOCKER_CODES = [
  "SUBJECT_RETIRED",
  "PRODUCT_UNRESOLVED",
  "GRADE_NOT_OF_PRODUCT",
  "EVIDENCE_ABSENT",
  "EVIDENCE_LINK_UNRESOLVED",
  "SPECIFICATION_NOT_NORMALIZED",
  "PROPERTY_NOT_IN_DICTIONARY",
  "VALUE_SHAPE_MISMATCH",
  "PROPERTY_MAPPING_UNRESOLVED",
  "REQUIRED_METHOD_ABSENT",
  "METHOD_NOT_EVIDENCED",
  "CLAIM_KIND_NEVER_APPROVABLE",
  "NAMED_BODY_ABSENT",
  "CLAIM_IDENTITY_ABSENT",
  "SOURCE_ASSET_ABSENT",
] as const;

export type ReviewBlockerCode = (typeof REVIEW_BLOCKER_CODES)[number];

/**
 * The warning vocabulary. A warning is a reason to look twice and NEVER a reason to refuse.
 *
 * The distinction earns its keep immediately: every one of the 69 source documents in the
 * catalogue is missing both its date and its revision label, so promoting either to a blocker
 * would freeze all 1,546 subjects on a metadata gap that says nothing about whether the recorded
 * value is right.
 */
export const REVIEW_WARNING_CODES = [
  "METHOD_NOT_APPLICABLE_BUT_PRESENT",
  "DOCUMENT_DATE_UNKNOWN",
  "DOCUMENT_REVISION_UNKNOWN",
] as const;

export type ReviewWarningCode = (typeof REVIEW_WARNING_CODES)[number];

export interface ReviewBlocker {
  readonly code: ReviewBlockerCode;
  readonly message: string;
}

export interface ReviewWarning {
  readonly code: ReviewWarningCode;
  readonly message: string;
}

function blocker(code: ReviewBlockerCode, message: string): ReviewBlocker {
  return { code, message };
}

function warning(code: ReviewWarningCode, message: string): ReviewWarning {
  return { code, message };
}

/**
 * The message every uncaptured source gets, on either subject type.
 *
 * It names the RULE and never the row. There is no locator in it, no file name, no URL, no
 * document title and no asset hash — a blocker is rendered on a screen and echoed in a 409 body,
 * and neither is a place for an external address (ADR-014, ADR-015).
 *
 * It also covers the manual-transcription case rather than being joined by a second blocker for it.
 * "This value was typed in from a document nobody captured" and "the source behind this evidence is
 * not captured" are one live condition, and emitting both would double-count a single defect.
 */
const SOURCE_ASSET_ABSENT_MESSAGE =
  "A cited source is not captured: its document names no stored file, or the stored file has no " +
  "valid SHA-256 identity and non-zero size. Manual transcription is acceptable only when the " +
  "source bytes it was transcribed from are captured.";

/** Shared by both subject types, because it is the same fact about the same link. */
const EVIDENCE_LINK_UNRESOLVED_MESSAGE =
  "An evidence link does not resolve to a SourceFact and its SourceDocument.";

/**
 * The Specification blockers, in a fixed order.
 *
 * The order is the reading order a reviewer gets, and it is deliberately stable: identity first,
 * then normalization, then the dictionary, then the evidence, then the two method rules, then
 * capture.
 */
export function specificationApprovalBlockers(row: SpecificationEligibilityRow): ReviewBlocker[] {
  const blockers: ReviewBlocker[] = [];

  if (!row.live) {
    blockers.push(
      blocker("SUBJECT_RETIRED", "The specification has been retired (deletedAt is set)."),
    );
  }
  if (!row.productExists) {
    blockers.push(
      blocker("PRODUCT_UNRESOLVED", "The specification does not resolve to a Product."),
    );
  }
  if (!row.gradeOk) {
    blockers.push(blocker("GRADE_NOT_OF_PRODUCT", "The grade does not belong to this Product."));
  }
  if (!row.normalized) {
    blockers.push(
      blocker(
        "SPECIFICATION_NOT_NORMALIZED",
        "The specification is not normalized: it needs a value type and a display value.",
      ),
    );
  }
  if (!row.propertyInDictionary) {
    blockers.push(
      blocker(
        "PROPERTY_NOT_IN_DICTIONARY",
        "The property key is not an entry in the controlled dictionary.",
      ),
    );
  }
  if (!row.valueShapeOk) {
    blockers.push(
      blocker("VALUE_SHAPE_MISMATCH", "The numeric columns do not match the declared value type."),
    );
  }
  if (row.evidenceLinks === 0) {
    blockers.push(blocker("EVIDENCE_ABSENT", "The specification cites no evidence."));
  }
  if (row.evidenceOrphans > 0) {
    blockers.push(blocker("EVIDENCE_LINK_UNRESOLVED", EVIDENCE_LINK_UNRESOLVED_MESSAGE));
  }
  if (!row.mappingOk) {
    blockers.push(
      blocker(
        "PROPERTY_MAPPING_UNRESOLVED",
        "The source property does not resolve to this property key through an approved " +
          "HIGH-confidence mapping.",
      ),
    );
  }

  /*
   * ── Rule 1 — the dictionary requires a method and none is recorded ──────────
   *
   * Fires whether or not the evidence carries a raw method: a raw method the platform never
   * normalized is not a normalized method, and approving the row would publish a required-method
   * property with no method on it.
   *
   * A null `methodRequirement` — the key resolves to no dictionary entry — does NOT fire this rule,
   * and that is safe rather than permissive: such a row is already blocked by
   * `PROPERTY_NOT_IN_DICTIONARY` above, so it cannot reach approval either way. Inferring
   * `required` from a missing record would be inventing a dictionary entry.
   */
  if (row.methodRequirement === "required" && !row.normalizedMethodPresent) {
    blockers.push(
      blocker(
        "REQUIRED_METHOD_ABSENT",
        "This property requires a test method and the specification records none.",
      ),
    );
  }

  /*
   * ── Rule 2 — a normalized method that no source stated ──────────────────────
   *
   * The guarded fabrication shape. A method on the row that no current evidence carries is a value
   * this platform produced rather than read, and publishing it would attribute a test method to a
   * supplier who never named one. It applies regardless of the requirement — including where the
   * dictionary says the method is OPTIONAL or NOT_APPLICABLE — because the objection is not that a
   * method is missing but that the one present is unsupported.
   *
   * Live count is currently zero. The rule exists so that it stays zero.
   */
  if (row.normalizedMethodPresent && !row.rawMethodPresent) {
    blockers.push(
      blocker(
        "METHOD_NOT_EVIDENCED",
        "The recorded test method is not stated by any current evidence.",
      ),
    );
  }

  /*
   * ── The capture rule ────────────────────────────────────────────────────────
   *
   * Gated on there being any evidence at all, so a subject citing nothing gets `EVIDENCE_ABSENT`
   * alone rather than two blockers describing one absence. It stays fail-closed for every other
   * shape: a subject whose links are ALL superseded has `evidenceLinks > 0` and an empty current
   * set, and `bool_and` over an empty set is coalesced to false, so it is blocked here.
   */
  if (row.evidenceLinks > 0 && !row.sourceCaptured) {
    blockers.push(blocker("SOURCE_ASSET_ABSENT", SOURCE_ASSET_ABSENT_MESSAGE));
  }

  return blockers;
}

export function productClaimApprovalBlockers(row: ProductClaimEligibilityRow): ReviewBlocker[] {
  const blockers: ReviewBlocker[] = [];

  if (!row.live) {
    blockers.push(blocker("SUBJECT_RETIRED", "The claim has been retired (deletedAt is set)."));
  }
  if (!row.productExists) {
    blockers.push(blocker("PRODUCT_UNRESOLVED", "The claim does not resolve to a Product."));
  }
  if (!row.gradeOk) {
    blockers.push(blocker("GRADE_NOT_OF_PRODUCT", "The grade does not belong to this Product."));
  }
  if (!row.kindApprovable) {
    blockers.push(
      blocker(
        "CLAIM_KIND_NEVER_APPROVABLE",
        "This claim kind can never be approved (LICENSED_BY and REFERENCE_ONLY).",
      ),
    );
  }
  if (!row.namedBodyOk) {
    blockers.push(
      blocker("NAMED_BODY_ABSENT", "An APPROVED_BY claim requires a named standard body."),
    );
  }
  if (!row.identityOk) {
    blockers.push(
      blocker(
        "CLAIM_IDENTITY_ABSENT",
        "The claim carries no identifying body, code, context or hash.",
      ),
    );
  }
  if (row.evidenceLinks === 0) {
    blockers.push(blocker("EVIDENCE_ABSENT", "The claim cites no evidence."));
  }
  if (row.evidenceOrphans > 0) {
    blockers.push(blocker("EVIDENCE_LINK_UNRESOLVED", EVIDENCE_LINK_UNRESOLVED_MESSAGE));
  }

  /*
   * The same capture rule, on the same gate.
   *
   * A claim has no property key, so it has no dictionary record, so neither method rule can apply
   * to it — and `ProductClaimEligibilityRow` carries neither method fact, so neither could be
   * emitted here even by mistake.
   */
  if (row.evidenceLinks > 0 && !row.sourceCaptured) {
    blockers.push(blocker("SOURCE_ASSET_ABSENT", SOURCE_ASSET_ABSENT_MESSAGE));
  }

  return blockers;
}

/* -------------------------------------------------------------------------- */
/* Warnings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The document-metadata warnings, identical on both subject types.
 *
 * Neither is ever a blocker, and neither is ever consulted by the decision transaction. They exist
 * because a reviewer approving a value should know that the document behind it carries no date and
 * no revision label — not because either fact disqualifies it.
 *
 * Both fire for every subject in the catalogue today. That is the expected state and it must not be
 * read as a defect in the rule.
 */
function documentWarnings(row: {
  documentDateUnknown: boolean;
  documentRevisionUnknown: boolean;
}): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];

  if (row.documentDateUnknown) {
    warnings.push(
      warning(
        "DOCUMENT_DATE_UNKNOWN",
        "A cited source document records no publication date, so how current it is cannot be " +
          "established from the record.",
      ),
    );
  }
  if (row.documentRevisionUnknown) {
    warnings.push(
      warning(
        "DOCUMENT_REVISION_UNKNOWN",
        "A cited source document records no revision label, so which revision was read cannot be " +
          "established from the record.",
      ),
    );
  }

  return warnings;
}

/**
 * The Specification warnings — the method-axis mismatch, then the two document ones.
 *
 * `METHOD_NOT_APPLICABLE_BUT_PRESENT` is a warning and not a blocker by ratified decision: a method
 * on a property the dictionary says takes none is a mismatch worth a reviewer's eye, but the
 * recorded method is still something a source stated, and refusing the row would be the platform
 * overruling the document.
 */
export function specificationApprovalWarnings(row: SpecificationEligibilityRow): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];

  if (row.methodRequirement === "not_applicable" && row.normalizedMethodPresent) {
    warnings.push(
      warning(
        "METHOD_NOT_APPLICABLE_BUT_PRESENT",
        "The dictionary records no test method for this property, but the specification carries " +
          "one.",
      ),
    );
  }

  warnings.push(...documentWarnings(row));

  return warnings;
}

export function productClaimApprovalWarnings(row: ProductClaimEligibilityRow): ReviewWarning[] {
  return documentWarnings(row);
}

/**
 * The ProductCopy blockers — five rules, and **not one new code**.
 *
 * ── Why the vocabulary did not grow ────────────────────────────────────────
 *
 * ADR-019 §3 named exactly which rules apply to the third subject: "the `SOURCE_ASSET_ABSENT` and
 * `EVIDENCE_ABSENT` blockers, applied to a third subject". Adding a code is adding a rule, and the
 * ratification did not add any — so every blocker below is one of the five that already meant the
 * same thing for the other two subjects, with a message that names copy.
 *
 * ── The rule this list does NOT carry, and where it lives instead ───────────
 *
 * "The copy must be transcribed from a bound source document" is not in this file. It is a CHECK
 * in `product_copy_approval_gate`, which refuses the UPDATE outright. That is deliberate and it is
 * the one place copy is stricter than the other two subjects: an eligibility blocker is advice the
 * decision path consults, and this rule had to survive a caller that never consults it.
 *
 * `SOURCE_ASSET_ABSENT` below is the same condition rendered as advice, so the reviewer sees the
 * reason on the screen instead of meeting a database exception. The gate is the enforcement; this
 * is the explanation.
 */
export function productCopyApprovalBlockers(row: ProductCopyEligibilityRow): ReviewBlocker[] {
  const blockers: ReviewBlocker[] = [];

  if (!row.live) {
    blockers.push(blocker("SUBJECT_RETIRED", "The copy has been retired (deletedAt is set)."));
  }
  if (!row.productExists) {
    blockers.push(blocker("PRODUCT_UNRESOLVED", "The copy does not resolve to a Product."));
  }
  if (row.evidenceLinks === 0) {
    blockers.push(blocker("EVIDENCE_ABSENT", "The copy cites no evidence."));
  }
  if (row.evidenceOrphans > 0) {
    blockers.push(blocker("EVIDENCE_LINK_UNRESOLVED", EVIDENCE_LINK_UNRESOLVED_MESSAGE));
  }

  /*
   * Emitted whether or not any link exists, which is where this differs from the other two.
   *
   * For a Specification and a claim the condition is guarded by `evidenceLinks > 0`, so a subject
   * citing nothing gets `EVIDENCE_ABSENT` alone rather than two blockers for one defect. Copy gets
   * both, because for copy they are two different defects: the gate refuses an approval with no
   * CAPTURED source, and a reviewer who saw only "cites no evidence" would fix that by binding a
   * link to an uncaptured document and hit the gate anyway.
   */
  if (!row.sourceCaptured) {
    blockers.push(blocker("SOURCE_ASSET_ABSENT", SOURCE_ASSET_ABSENT_MESSAGE));
  }

  return blockers;
}

export function productCopyApprovalWarnings(row: ProductCopyEligibilityRow): ReviewWarning[] {
  return documentWarnings(row);
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

/**
 * Copy has no mapping to resolve, so the planner's verdict is the whole of it — the same shape the
 * claim arm has, and for the same reason.
 */
export const PRODUCT_COPY_UNRESOLVED_SQL = `pc."review_status" = 'needs_review'`;
