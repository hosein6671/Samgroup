-- ---------------------------------------------------------------------------
-- PRODUCT-REVIEW-FOUNDATION-2A — versioned review hashes and atomic
-- invalidation of stale approvals (ADR-017).
--
-- ── The defect this closes ───────────────────────────────────────────────────
--
-- ADR-014 §7 defined an evidence-set hash over EVIDENCE LINKS ONLY:
--
--     sorted lines of `<source_fact_id>:<source asset sha256>`
--
-- and 20260825120000 made the approval gate compare it. That hash is blind to
-- almost everything an approval actually rests on. Every one of the following
-- could change AFTER an approval without moving it by a single bit, leaving a
-- publicly visible technical value that no reviewer ever agreed to:
--
--   * the Specification's own value, unit, method, qualifier or result basis;
--   * a soft delete, undone;
--   * the dictionary entry behind its property — value kind, method rule,
--     quantity, allowed units;
--   * the raw-property mapping that resolves it, including a mapping being
--     rejected, downgraded, re-pointed, or outranked by a new unit-specific one;
--   * an evidence link being retired to SUPERSEDED;
--   * a ProductClaim's kind, standard body, code, context or identity — the
--     difference between "formulated for" and "approved by" is legal, not
--     stylistic, and the v1 hash could not see it change.
--
-- And even where the hash DID move, nothing acted on it. `evidenceCurrent` was
-- a label on an Admin screen. The row stayed `approved` and stayed public.
--
-- ── What this migration installs ─────────────────────────────────────────────
--
--   1. `technical_reviews.evidence_hash_version`, CHECK-matched to the subject.
--   2. Two subject-specific v2 hash functions over a canonical JSONB payload —
--      `spec-review-v2` and `claim-review-v2`. The v1 functions are DROPPED:
--      there is one authoritative hash implementation, and it is in PostgreSQL.
--   3. `review_invalidations` — a SEPARATE immutable system-event table. No
--      fabricated human decisions are ever written to `technical_reviews`.
--   4. Sixteen triggers that atomically retire a stale approval: the subject
--      leaves `approved`, leaves the public view, and gains exactly one event,
--      all in the transaction that made the change.
--   5. SourceAsset identity immutability and one-time SourceDocument capture.
--
-- ── No backfill, and why none is possible or needed ──────────────────────────
--
-- `technical_reviews` held ZERO rows when this ran, and so did the approved
-- sets and both public views (measured on live DEV immediately before). There
-- is therefore no stored v1 hash anywhere, no legacy row to migrate, no
-- dual-read window and no v1 compatibility to preserve. Every review written
-- from now on states its version explicitly or is refused by CHECK.
--
-- ── What this migration does NOT touch ───────────────────────────────────────
--
-- No catalogue content row is read for writing or changed. The two public views
-- are left exactly as they are: their predicates remain `review_status =
-- 'approved' AND deleted_at IS NULL` (plus the claim view's forbidden kinds),
-- and nothing dynamic is introduced into them. A subject stops being public
-- because its STATUS changed, which is the only mechanism this project has ever
-- had for that, and the one an index can serve.
--
-- ── The explicit transaction is load-bearing ─────────────────────────────────
--
-- Same reason 20260814120000 states: Prisma applies a migration file statement
-- by statement in autocommit, so a failure halfway would leave a half-armed set
-- of triggers behind. Measured there, reused here.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. LOCK THE PARTICIPATING TABLES.
--
-- Between creating a hash function and arming the trigger that uses it, a write
-- landing in the gap would be a change to an approved subject that no event
-- records. SHARE ROW EXCLUSIVE conflicts with ordinary DML and not with readers,
-- exactly as the ADR-011 install does.
--
-- Named in one fixed order so this statement can never deadlock against itself
-- on a retry.
-- ---------------------------------------------------------------------------
LOCK TABLE
  "specifications",
  "product_claims",
  "spec_properties",
  "spec_property_mappings",
  "specification_evidence",
  "claim_evidence",
  "source_documents",
  "source_assets",
  "technical_reviews"
IN SHARE ROW EXCLUSIVE MODE;

-- ---------------------------------------------------------------------------
-- 1. THE VERSION LABELS, as functions rather than as scattered literals.
--
-- Two callers need them at runtime (the approval gates and the invalidation
-- functions) and one caller cannot use them at all: a CHECK constraint requires
-- an IMMUTABLE expression built only from the row, so the two CHECKs below spell
-- the literals out. That duplication is deliberate and asserted by the
-- verification tests, which compare the CHECK's behaviour against these
-- functions rather than trusting that the two agree.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "spec_review_hash_version"() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$ SELECT 'spec-review-v2'::text $fn$;

CREATE FUNCTION "claim_review_hash_version"() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$ SELECT 'claim-review-v2'::text $fn$;

COMMENT ON FUNCTION "spec_review_hash_version"() IS
  'The hash definition identifier every Specification review must carry (ADR-017).';
COMMENT ON FUNCTION "claim_review_hash_version"() IS
  'The hash definition identifier every ProductClaim review must carry (ADR-017).';

-- ---------------------------------------------------------------------------
-- 2. THE DIGEST, and the canonical encoding it rests on.
--
-- ── Why JSONB and not a delimited string ─────────────────────────────────────
--
-- v1 built its input by concatenating fields with `:` and `\n`. That encoding is
-- ambiguous the moment a field can contain the delimiter, and several of the
-- fields v2 must include are verbatim source text that certainly can — a
-- `qualifier` reading `max: 0,9`, a `context_note` quoting a sentence, a
-- `raw_property` with a colon in it. Two different subjects would then be able
-- to produce one hash, which on an approval gate is not a cosmetic problem.
--
-- JSONB removes the question. Keys are explicit, values are typed, and a value
-- containing any character at all is still exactly one value. In particular:
--
--   * SQL NULL becomes JSON `null` through `jsonb_build_object`, which is a
--     DIFFERENT document from the four-character string `"null"`. A missing
--     method and a method literally recorded as the word `null` do not collide.
--   * Arrays are ordered explicitly, and `allowed_units` is emitted as a SORTED
--     JSON ARRAY rather than joined into one string — so `['cSt','mm2/s']` and
--     `['mm2/s','cSt']` are one hash and `['cSt,mm2/s']` is not either of them.
--   * Every ordering that involves text is pinned to `COLLATE "C"`, so the hash
--     does not depend on the database's lc_collate or on an ICU version.
--   * Numeric columns are rendered with `::text` rather than as JSON numbers, so
--     the exact stored `numeric(20,6)` representation is what is hashed and no
--     JSON number canonicalisation stands between the column and the digest.
--
-- ── The dependency this creates, stated rather than discovered ───────────────
--
-- `jsonb::text` is canonical WITHIN a PostgreSQL major version: object keys are
-- ordered by length then byte value, duplicates are collapsed, and separators
-- are fixed. It is not a cross-version guarantee. A future PostgreSQL major
-- upgrade must therefore verify stored hash vectors BEFORE rollout — ADR-017 §9
-- records this as a release requirement, not as a footnote.
--
-- `sha256()` is a PostgreSQL built-in since 11. No pgcrypto, no extension.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "review_hash_digest"("p_payload" JSONB) RETURNS TEXT
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $fn$
  SELECT encode(sha256(convert_to("p_payload"::text, 'UTF8')), 'hex')
$fn$;

COMMENT ON FUNCTION "review_hash_digest"(JSONB) IS
  'SHA-256, lowercase 64-hex, over the UTF-8 bytes of the canonical jsonb text. The one place a '
  'review hash is actually digested (ADR-017).';

-- ---------------------------------------------------------------------------
-- 3. THE SELECTED MAPPING, resolved by exactly the eligibility rule.
--
-- `review-eligibility.ts` decides whether a Specification's property is resolved
-- with this precedence: a UNIT-SPECIFIC mapping beats a unit-agnostic one, only
-- HIGH confidence counts, and a mapping a human has REJECTED or SUPERSEDED is
-- skipped. Ratified as Option A, ADR-016 §6.
--
-- The hash must select the SAME winner, or the two would disagree about which
-- mapping an approval rested on. So this is that predicate, unchanged, with one
-- addition: `, m."id"` as a final ordering key. It can never actually decide
-- anything — `spec_property_mappings` is UNIQUE on (raw_property, raw_unit), so
-- at most one row matches the specific bucket and at most one matches the
-- generic bucket — but it makes the ordering TOTAL as written, rather than total
-- only to a reader who has checked the unique index. Adding a tiebreak that
-- cannot fire is not a different rule.
--
-- ── Content, not identity ────────────────────────────────────────────────────
--
-- What is returned is the mapping's CONTENT and not its uuid. That is the
-- difference between the two behaviours this gate has to have at once:
--
--   * changing the winner's confidence, review status or target key must change
--     the hash — it does, because those values ARE the payload;
--   * inserting an unrelated mapping must NOT change any hash — it does not,
--     because a mapping for another raw property is never selected here.
--
-- Returns SQL NULL when nothing resolves; every call site coalesces that to JSON
-- `null` so the key is always present.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "review_selected_mapping"("p_raw_property" TEXT, "p_raw_unit" TEXT) RETURNS JSONB
  LANGUAGE sql STABLE
AS $fn$
  SELECT jsonb_build_object(
           'rawProperty',     m."raw_property",
           'rawUnit',         m."raw_unit",
           'specPropertyKey', m."spec_property_key",
           'confidence',      m."confidence"::text,
           'reviewStatus',    m."review_status"::text)
    FROM "spec_property_mappings" m
   WHERE m."raw_property" = "p_raw_property"
     AND (m."raw_unit" = "p_raw_unit" OR m."raw_unit" IS NULL)
     AND m."confidence" = 'high'
     AND m."review_status" NOT IN ('rejected', 'superseded')
   ORDER BY (m."raw_unit" IS NULL) ASC, m."id"
   LIMIT 1
$fn$;

COMMENT ON FUNCTION "review_selected_mapping"(TEXT, TEXT) IS
  'The winning raw-property mapping as CONTENT, resolved by the same precedence review eligibility '
  'uses: unit-specific over generic, HIGH confidence only, rejected and superseded skipped '
  '(ADR-016 s6, ADR-017 s4).';

-- ---------------------------------------------------------------------------
-- 4. `spec-review-v2` — the Specification review hash.
--
-- Everything an approval of a Specification depends on, and nothing else.
--
-- ── `deleted` is a BOOLEAN, not the timestamp ────────────────────────────────
--
-- The approval-meaningful fact is the one the public view tests: retired, or
-- not. Hashing the timestamp would additionally make an un-delete followed by a
-- re-delete produce a third distinct hash, which invalidates nothing extra: the
-- FIRST delete already moved the subject out of `approved`, and coming back does
-- not re-approve it. So the boolean is not a weakening — the transition it
-- reports is the one that matters, and it does not manufacture events that say
-- nothing.
--
-- ── Every evidence link, WITH its role ───────────────────────────────────────
--
-- Not just the current ones. Retiring a link to SUPERSEDED changes what the
-- approval rests on and must change the hash, so `role` is part of each entry
-- and superseded links stay in the set rather than dropping out of it — the
-- difference between "this evidence was retired" and "this evidence never
-- existed" is exactly what an audit trail is for.
--
-- ── No locator, ever ─────────────────────────────────────────────────────────
--
-- The captured file's SHA-256 identifies the bytes; `locator_value`, the
-- document title and the publisher are NOT in the payload, and no reader of a
-- hash can learn where a source lives. `assetSha256` is JSON `null` where no
-- file was captured, which is a stated absence and not an empty string.
--
-- Returns NULL for a subject that does not exist. Callers treat that as "not
-- computable" and refuse rather than substituting a value.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "specification_review_hash_v2"("p_specification_id" UUID) RETURNS TEXT
  LANGUAGE sql STABLE
AS $fn$
  SELECT "review_hash_digest"(jsonb_build_object(
    'domain',    "spec_review_hash_version"(),
    'subjectId', s."id"::text,

    'subject', jsonb_build_object(
      'productId',      s."product_id"::text,
      'productGradeId', s."product_grade_id"::text,
      'propertyKey',    s."property_key",
      'valueType',      s."value_type"::text,
      'displayValue',   s."display_value",
      'numericMin',     s."numeric_min"::text,
      'numericMax',     s."numeric_max"::text,
      'pairFirst',      s."pair_first"::text,
      'pairSecond',     s."pair_second"::text,
      'unit',           s."unit",
      'method',         s."method",
      'qualifier',      s."qualifier",
      'resultBasis',    s."result_basis"::text,
      'deleted',        (s."deleted_at" IS NOT NULL)),

    -- The controlled dictionary entry, or JSON null when the key resolves to no
    -- entry. `allowedUnits` is a sorted ARRAY under COLLATE "C" — never joined.
    'property', coalesce((
      SELECT jsonb_build_object(
               'key',               sp."key",
               'valueKind',         sp."value_kind"::text,
               'methodRequirement', sp."method_requirement"::text,
               'quantity',          sp."quantity",
               'allowedUnits',      coalesce((
                 SELECT jsonb_agg(u ORDER BY u COLLATE "C")
                   FROM unnest(sp."allowed_units") AS u), '[]'::jsonb))
        FROM "spec_properties" sp
       WHERE sp."key" = s."property_key"), 'null'::jsonb),

    -- Evidence, sorted by source fact id under COLLATE "C" so insertion order
    -- cannot reach the digest. The pair (specification_id, source_fact_id) is
    -- the link table's primary key, so the sort key is unique within a subject.
    'evidence', coalesce((
      SELECT jsonb_agg(e."entry" ORDER BY e."sort_key" COLLATE "C")
        FROM (
          SELECT se."source_fact_id"::text AS "sort_key",
                 jsonb_build_object(
                   'sourceFactId',     se."source_fact_id"::text,
                   'role',             se."role"::text,
                   'assetSha256',      sa."sha256",
                   'rawMethodPresent', (sf."raw_method" IS NOT NULL
                                        AND length(btrim(sf."raw_method")) > 0),
                   'mapping',          coalesce(
                                         "review_selected_mapping"(sf."raw_property",
                                                                   sf."raw_unit"),
                                         'null'::jsonb)) AS "entry"
            FROM "specification_evidence" se
            LEFT JOIN "source_facts" sf     ON sf."id" = se."source_fact_id"
            LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
            LEFT JOIN "source_assets" sa    ON sa."id" = sd."source_asset_id"
           WHERE se."specification_id" = s."id") e), '[]'::jsonb)))
  FROM "specifications" s
 WHERE s."id" = "p_specification_id"
$fn$;

-- ---------------------------------------------------------------------------
-- 5. `claim-review-v2` — the ProductClaim review hash.
--
-- The claim's own identity-bearing content plus its evidence membership. NO
-- dictionary block and NO mapping block: a claim has no property key, so a
-- `valueKind` or a selected mapping here would be a value nothing measured.
--
-- The four transitions it exists to detect, each of which the v1 hash missed:
--
--   * `kind` becoming LICENSED_BY or REFERENCE_ONLY — a kind that can never be
--     approved, arriving on a row that already is;
--   * an APPROVED_BY claim losing its `standard_body` — an approval by nobody;
--   * `standard_code`, `context_note` or `claim_identity_hash` changing, which
--     is the claim becoming a different statement;
--   * evidence being captured, added, removed, or retired to SUPERSEDED.
--
-- `domain` differs from the Specification payload's, so the two hash spaces are
-- disjoint by construction: a Specification and a ProductClaim can never
-- accidentally produce the same digest even if every other field matched.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "product_claim_review_hash_v2"("p_product_claim_id" UUID) RETURNS TEXT
  LANGUAGE sql STABLE
AS $fn$
  SELECT "review_hash_digest"(jsonb_build_object(
    'domain',    "claim_review_hash_version"(),
    'subjectId', c."id"::text,

    'subject', jsonb_build_object(
      'productId',         c."product_id"::text,
      'productGradeId',    c."product_grade_id"::text,
      'kind',              c."kind"::text,
      'standardBody',      c."standard_body",
      'standardCode',      c."standard_code",
      'contextNote',       c."context_note",
      'claimIdentityHash', c."claim_identity_hash",
      'deleted',           (c."deleted_at" IS NOT NULL)),

    'evidence', coalesce((
      SELECT jsonb_agg(e."entry" ORDER BY e."sort_key" COLLATE "C")
        FROM (
          SELECT ce."source_fact_id"::text AS "sort_key",
                 jsonb_build_object(
                   'sourceFactId', ce."source_fact_id"::text,
                   'role',         ce."role"::text,
                   'assetSha256',  sa."sha256") AS "entry"
            FROM "claim_evidence" ce
            LEFT JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
            LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
            LEFT JOIN "source_assets" sa    ON sa."id" = sd."source_asset_id"
           WHERE ce."product_claim_id" = c."id") e), '[]'::jsonb)))
  FROM "product_claims" c
 WHERE c."id" = "p_product_claim_id"
$fn$;

COMMENT ON FUNCTION "specification_review_hash_v2"(UUID) IS
  'spec-review-v2. The authoritative fingerprint of everything an approval of one Specification '
  'rests on: its own value state, its dictionary entry, its selected mappings and its evidence '
  'membership with roles. Canonical jsonb, SHA-256 (ADR-017).';

COMMENT ON FUNCTION "product_claim_review_hash_v2"(UUID) IS
  'claim-review-v2. The authoritative fingerprint of everything an approval of one ProductClaim '
  'rests on: its identity-bearing content and its evidence membership with roles. Canonical jsonb, '
  'SHA-256 (ADR-017).';

-- ---------------------------------------------------------------------------
-- 6. THE VERSION COLUMN.
--
-- NOT NULL and no DEFAULT. The table is empty, so `ALTER TABLE ... ADD COLUMN
-- NOT NULL` needs no default to succeed and inventing one would be worse than
-- useless: a default is a value a careless writer would inherit silently, and
-- the entire point of this column is that the version is STATED.
-- ---------------------------------------------------------------------------
ALTER TABLE "technical_reviews"
  ADD COLUMN "evidence_hash_version" TEXT NOT NULL,
  ADD COLUMN "sequence" BIGSERIAL NOT NULL;

CREATE UNIQUE INDEX "technical_reviews_sequence_key" ON "technical_reviews"("sequence");

-- ── Why `sequence` is here and `reviewed_at` is not enough ──────────────────
--
-- Section 9 has to answer "which review ESTABLISHED this approval", and that
-- means taking the LATEST approve decision on the subject. The phrase has to
-- resolve to exactly one row, always.
--
-- `reviewed_at` DEFAULTs to `now()`, which in PostgreSQL is the TRANSACTION
-- timestamp — every row written in one transaction carries the identical value,
-- and two rows in separate transactions can still land in one microsecond. The
-- only tiebreaker available was `id`, a random uuid, which decides such a tie by
-- chance rather than by time.
--
-- MEASURED on a disposable clone before this column existed: a probe that
-- approved one Specification several times picked the wrong establishing review
-- about half the time and invalidated each fresh approval the instant it was
-- granted, because the "latest" review it compared against was an older one with
-- a larger uuid and a stale hash. Nine assertions failed on that and nothing
-- else. A sequence is monotone inside a transaction as well as across them, so
-- `ORDER BY sequence DESC LIMIT 1` is a total order.
--
-- Gaps left by rolled-back transactions are expected and mean nothing: this is
-- an ORDER, not a count, and nothing reads it as one.

ALTER TABLE "technical_reviews"
  ADD CONSTRAINT "technical_reviews_hash_version_matches_subject" CHECK (
    ("specification_id" IS NOT NULL AND "evidence_hash_version" = 'spec-review-v2')
    OR
    ("product_claim_id" IS NOT NULL AND "evidence_hash_version" = 'claim-review-v2')
  );

COMMENT ON COLUMN "technical_reviews"."evidence_hash_version" IS
  'Which hash definition produced evidence_set_hash: spec-review-v2 for a Specification review, '
  'claim-review-v2 for a ProductClaim review, matched to the subject by CHECK. Stated by every '
  'writer, never defaulted and never inferred (ADR-017).';

-- ---------------------------------------------------------------------------
-- 7. `review_invalidations` — the SYSTEM event, and why it is not a review.
--
-- The shortcut this table exists to refuse is writing a `technical_reviews` row
-- with decision `needs_review` and a synthetic reviewer. That column is
-- `reviewer_email_snapshot`, it is NOT NULL, and it means "the person who
-- decided". A row there naming `system@` is a FABRICATED HUMAN ATTRIBUTION
-- placed in the audit trail whose entire job is to record who decided what.
-- Nobody decided this. A hash stopped matching.
--
-- So this is a different table with different columns, and the columns it does
-- NOT have are as deliberate as the ones it does: no reviewer id, no reviewer
-- email, no note, no locator, no document, no asset, no URL.
--
-- ── One event per approval transition ────────────────────────────────────────
--
-- UNIQUE on `technical_review_id`. Entering `approved` requires a review written
-- in the same transaction (20260825120000), so every approval transition has its
-- own distinct review row, and "at most one event per approval transition" and
-- "at most one event per establishing review" are the same sentence. A subject
-- approved, invalidated, re-approved and invalidated again produces two events
-- against two different reviews, which is correct and is not a duplicate.
-- ---------------------------------------------------------------------------
CREATE TYPE "review_invalidation_reason" AS ENUM (
  'subject_state_changed',
  'evidence_changed',
  'dictionary_changed',
  'mapping_changed',
  'source_capture_changed'
);

CREATE TABLE "review_invalidations" (
    "id" UUID NOT NULL,
    "specification_id" UUID,
    "product_claim_id" UUID,
    "technical_review_id" UUID NOT NULL,
    "reason_code" "review_invalidation_reason" NOT NULL,
    "previous_evidence_hash" CHAR(64) NOT NULL,
    "current_evidence_hash" CHAR(64) NOT NULL,
    "evidence_hash_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_invalidations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_invalidations_specification_id_idx" ON "review_invalidations"("specification_id");
CREATE INDEX "review_invalidations_product_claim_id_idx" ON "review_invalidations"("product_claim_id");
CREATE INDEX "review_invalidations_created_at_idx" ON "review_invalidations"("created_at");
CREATE UNIQUE INDEX "review_invalidations_technical_review_id_key" ON "review_invalidations"("technical_review_id");

ALTER TABLE "review_invalidations" ADD CONSTRAINT "review_invalidations_specification_id_fkey"
  FOREIGN KEY ("specification_id") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_invalidations" ADD CONSTRAINT "review_invalidations_product_claim_id_fkey"
  FOREIGN KEY ("product_claim_id") REFERENCES "product_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_invalidations" ADD CONSTRAINT "review_invalidations_technical_review_id_fkey"
  FOREIGN KEY ("technical_review_id") REFERENCES "technical_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one subject, the same shape `technical_reviews_exactly_one_target`
-- uses: an event about two subjects, or about none, is not an event.
ALTER TABLE "review_invalidations"
  ADD CONSTRAINT "review_invalidations_exactly_one_target" CHECK (
    (("specification_id" IS NOT NULL)::int + ("product_claim_id" IS NOT NULL)::int) = 1
  );

-- Both hashes are real fingerprints, not placeholders, and they always differ:
-- an event recording that nothing changed would be a lie about why an approval
-- was retired.
ALTER TABLE "review_invalidations"
  ADD CONSTRAINT "review_invalidations_previous_hash_format" CHECK (
    "previous_evidence_hash" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "review_invalidations_current_hash_format" CHECK (
    "current_evidence_hash" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "review_invalidations_hashes_differ" CHECK (
    "previous_evidence_hash" <> "current_evidence_hash"
  );

-- The event's version must match the domain of the subject it names, on exactly
-- the terms the review's own version does.
ALTER TABLE "review_invalidations"
  ADD CONSTRAINT "review_invalidations_hash_version_matches_subject" CHECK (
    ("specification_id" IS NOT NULL AND "evidence_hash_version" = 'spec-review-v2')
    OR
    ("product_claim_id" IS NOT NULL AND "evidence_hash_version" = 'claim-review-v2')
  );

COMMENT ON TABLE "review_invalidations" IS
  'Immutable SYSTEM events: an approval was retired because the subject-specific v2 hash it was '
  'granted on no longer matches. Deliberately NOT a technical_reviews row — that table records who '
  'DECIDED, and nobody decided this. Carries no reviewer, no note and no locator (ADR-017).';

-- ---------------------------------------------------------------------------
-- 8. THE EVENT TABLE IS IMMUTABLE.
--
-- Identical in force to `technical_reviews_immutable_guard`, and stricter in one
-- respect: there is no permitted UPDATE at all. That trigger has to admit
-- `reviewer_id` going to NULL because ADR-012 makes deleting a User this
-- platform's strongest credential revocation and a blanket ban would make
-- `DELETE FROM users` fail. Nothing here references a User, so nothing here
-- needs the exception.
--
-- ENABLE ALWAYS, following every other immutability guard in this schema: a
-- plain trigger is silently skipped by a session that sets
-- `session_replication_role = 'replica'`, which is exactly the privileged bypass
-- an audit table must not have. Restores are unaffected — pg_restore loads rows
-- with COPY/INSERT and this fires on neither.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "review_invalidations_immutable"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION
    'review_invalidations rows are immutable system events and cannot be %',
    CASE TG_OP WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END
    USING ERRCODE = 'restrict_violation',
          DETAIL  = format('review_invalidations row %s', OLD."id"),
          HINT    = 'An invalidation event records that an approval stopped matching its subject '
                    'at a point in time. It is never corrected: a later approval and a later '
                    'invalidation are new rows, and the trail keeps all of them.';
END
$fn$;

CREATE TRIGGER "review_invalidations_immutable_guard"
  BEFORE UPDATE OR DELETE ON "review_invalidations"
  FOR EACH ROW
  EXECUTE FUNCTION "review_invalidations_immutable"();

ALTER TABLE "review_invalidations"
  ENABLE ALWAYS TRIGGER "review_invalidations_immutable_guard";

-- ---------------------------------------------------------------------------
-- 9. THE TWO INVALIDATION FUNCTIONS.
--
-- Given candidate subject ids and a reason, retire every approval among them
-- whose v2 hash no longer matches the human review that established it —
-- atomically, and in the transaction that made the change.
--
-- ── Why the row lock comes BEFORE the status filter ──────────────────────────
--
-- The obvious ordering is to filter to `review_status = 'approved'` first and
-- lock only those, so that a change touching nothing approved costs nothing.
-- That ordering has a write-skew hole, and it is the specific hole the
-- concurrency requirement names:
--
--   Tx A is approving subject S. It holds a FOR UPDATE lock on S but has not
--   committed, so at Tx B's snapshot S is NOT approved.
--   Tx B inserts an evidence link for S. Filtering first, B sees nothing
--   approved, does nothing, and commits.
--   A commits. S is now approved on a hash computed before B's link existed.
--
-- Locking first closes it. B blocks on A's lock; when A commits, PostgreSQL
-- re-reads the locked row at its latest version, B sees S as approved, and
-- recomputes — finding the mismatch A could not have known about. There is no
-- ordering of the two transactions that ends with a published stale approval.
--
-- The lock does NOT create a deadlock against the approval path, because the
-- approval path takes no lock on any reference row: A locks only S, and B locks
-- reference rows (implicitly, by updating them) and then S. That is one
-- direction, not two. An earlier draft additionally took FOR SHARE on the
-- dependency rows during approval; it was removed on measurement precisely
-- because it introduced the AB-BA cycle that this ordering avoids.
--
-- ── Where the work is actually saved ─────────────────────────────────────────
--
-- Two short-circuits, both before anything expensive:
--
--   * an EMPTY candidate set returns before touching a table at all — which is
--     the common case for reference data nothing cites;
--   * NO APPROVED candidate returns before a single hash is computed. Hashing is
--     the only per-subject cost here; the lock is a heap tuple flag.
--
-- Everything else is set-based. There is no loop, no cursor and no per-subject
-- statement, so a bulk reference update costs one pass and not one pass per row.
--
-- ── Recursion terminates, and it terminates on the first step ────────────────
--
-- The UPDATE below fires the `specifications` statement trigger again. That
-- trigger's candidate set is the transition table filtered to
-- `review_status = 'approved'`, and every row it just wrote is `needs_review`.
-- So the recursive call receives NULL and returns at the first line. The UNIQUE
-- index on `technical_review_id` is the second, independent guarantee that a
-- second event for one approval cannot exist even if that reasoning were wrong.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "review_invalidate_specifications"(
  "p_ids" UUID[],
  "p_reason" "review_invalidation_reason"
) RETURNS VOID
  LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ids UUID[];
BEGIN
  IF "p_ids" IS NULL THEN RETURN; END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest("p_ids") AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL THEN RETURN; END IF;

  -- Deterministic lock order: ascending id, always, on every path. Two
  -- concurrent invalidations over overlapping candidate sets therefore acquire
  -- the shared rows in the same sequence and cannot deadlock each other.
  PERFORM 1
     FROM "specifications" s
    WHERE s."id" = ANY(v_ids)
    ORDER BY s."id"
      FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM "specifications" s
     WHERE s."id" = ANY(v_ids) AND s."review_status" = 'approved'
  ) THEN
    RETURN;
  END IF;

  WITH "stale" AS MATERIALIZED (
    SELECT s."id"                                    AS "subject_id",
           tr."id"                                   AS "review_id",
           tr."evidence_set_hash"                    AS "previous_hash",
           "specification_review_hash_v2"(s."id")    AS "current_hash"
      FROM "specifications" s
      -- The review that ESTABLISHED the standing approval: the LAST approve
      -- decision on this subject, by `sequence` and never by `reviewed_at`
      -- (see section 6 for what a transaction timestamp cannot order).
      -- Entering `approved` requires an approve review in the same transaction,
      -- so the last one is always the one the current status rests on.
      JOIN LATERAL (
        SELECT r."id", r."evidence_set_hash"
          FROM "technical_reviews" r
         WHERE r."specification_id" = s."id"
           AND r."decision" = 'approved'
         ORDER BY r."sequence" DESC
         LIMIT 1
      ) tr ON TRUE
     WHERE s."id" = ANY(v_ids)
       AND s."review_status" = 'approved'
  ),
  "changed" AS MATERIALIZED (
    SELECT * FROM "stale" WHERE "previous_hash" IS DISTINCT FROM "current_hash"
  ),
  -- The subject leaves `approved` — and therefore leaves v_specification_public,
  -- whose predicate is that status — in this statement, in this transaction.
  "moved" AS (
    UPDATE "specifications" s
       SET "review_status" = 'needs_review'
      FROM "changed" c
     WHERE s."id" = c."subject_id"
    RETURNING s."id"
  )
  INSERT INTO "review_invalidations" (
    "id", "specification_id", "product_claim_id", "technical_review_id",
    "reason_code", "previous_evidence_hash", "current_evidence_hash", "evidence_hash_version")
  SELECT gen_random_uuid(), c."subject_id", NULL, c."review_id", "p_reason",
         c."previous_hash", c."current_hash", "spec_review_hash_version"()
    FROM "changed" c
   WHERE EXISTS (SELECT 1 FROM "moved" m WHERE m."id" = c."subject_id")
  ON CONFLICT ("technical_review_id") DO NOTHING;
END
$fn$;

CREATE FUNCTION "review_invalidate_product_claims"(
  "p_ids" UUID[],
  "p_reason" "review_invalidation_reason"
) RETURNS VOID
  LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ids UUID[];
BEGIN
  IF "p_ids" IS NULL THEN RETURN; END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest("p_ids") AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL THEN RETURN; END IF;

  PERFORM 1
     FROM "product_claims" c
    WHERE c."id" = ANY(v_ids)
    ORDER BY c."id"
      FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM "product_claims" c
     WHERE c."id" = ANY(v_ids) AND c."review_status" = 'approved'
  ) THEN
    RETURN;
  END IF;

  WITH "stale" AS MATERIALIZED (
    SELECT c."id"                                    AS "subject_id",
           tr."id"                                   AS "review_id",
           tr."evidence_set_hash"                    AS "previous_hash",
           "product_claim_review_hash_v2"(c."id")    AS "current_hash"
      FROM "product_claims" c
      JOIN LATERAL (
        SELECT r."id", r."evidence_set_hash"
          FROM "technical_reviews" r
         WHERE r."product_claim_id" = c."id"
           AND r."decision" = 'approved'
         ORDER BY r."sequence" DESC
         LIMIT 1
      ) tr ON TRUE
     WHERE c."id" = ANY(v_ids)
       AND c."review_status" = 'approved'
  ),
  "changed" AS MATERIALIZED (
    SELECT * FROM "stale" WHERE "previous_hash" IS DISTINCT FROM "current_hash"
  ),
  "moved" AS (
    UPDATE "product_claims" c
       SET "review_status" = 'needs_review'
      FROM "changed" ch
     WHERE c."id" = ch."subject_id"
    RETURNING c."id"
  )
  INSERT INTO "review_invalidations" (
    "id", "specification_id", "product_claim_id", "technical_review_id",
    "reason_code", "previous_evidence_hash", "current_evidence_hash", "evidence_hash_version")
  SELECT gen_random_uuid(), NULL, ch."subject_id", ch."review_id", "p_reason",
         ch."previous_hash", ch."current_hash", "claim_review_hash_version"()
    FROM "changed" ch
   WHERE EXISTS (SELECT 1 FROM "moved" m WHERE m."id" = ch."subject_id")
  ON CONFLICT ("technical_review_id") DO NOTHING;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 10. THE TRIGGER FUNCTIONS — one per mutation path.
--
-- Every one is STATEMENT level with transition tables, following the ADR-011
-- registry triggers: a bulk reference update is one call with one array, not one
-- call per row. Each does exactly two things — narrow the transition set to the
-- subjects that could be affected, and hand that array to the shared function
-- with the reason that names the class of change.
--
-- The candidate sets are deliberately SUPERSETS. A mapping insert for a raw
-- property some approved Specification cites is a candidate even if the new
-- mapping is LOW confidence and therefore never wins; the hash comparison is
-- what decides, and it decides correctly. A superset costs a hash; a subset
-- would cost correctness.
-- ---------------------------------------------------------------------------

-- The subject's own approval-meaningful columns, including `deleted_at` and,
-- for a claim, `kind` / `standard_body` / `standard_code` / `context_note` /
-- `claim_identity_hash`.
--
-- Filtered to rows that are STILL approved after the statement, which is what
-- keeps an explicit human transition out of this path: a reviewer moving a row
-- from APPROVED to REJECTED leaves it `rejected` in `newtab`, so it is not a
-- candidate and no system event is written for a decision a person made.
CREATE FUNCTION "review_tg_specifications_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(n."id") INTO v FROM "newtab" n WHERE n."review_status" = 'approved';
  PERFORM "review_invalidate_specifications"(v, 'subject_state_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_product_claims_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(n."id") INTO v FROM "newtab" n WHERE n."review_status" = 'approved';
  PERFORM "review_invalidate_product_claims"(v, 'subject_state_changed');
  RETURN NULL;
END $fn$;

-- The controlled dictionary. Only the four columns that reach the hash matter:
-- `value_kind`, `method_requirement`, `quantity` and `allowed_units`. Changing
-- `canonical_meaning` is documentation and moves nothing.
--
-- The second branch covers a key RENAME, which would present as a key in one
-- transition table and not the other. Renaming a dictionary key is not a
-- supported operation — `spec_properties.key` IS the identity — but a candidate
-- set that quietly missed one would be a silent hole rather than a refusal.
CREATE FUNCTION "review_tg_spec_properties_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  WITH "touched" AS (
    SELECT n."key" AS "k"
      FROM "newtab" n
      LEFT JOIN "oldtab" o ON o."key" = n."key"
     WHERE o."key" IS NULL
        OR n."value_kind"         IS DISTINCT FROM o."value_kind"
        OR n."method_requirement" IS DISTINCT FROM o."method_requirement"
        OR n."quantity"           IS DISTINCT FROM o."quantity"
        OR n."allowed_units"      IS DISTINCT FROM o."allowed_units"
    UNION
    SELECT o."key"
      FROM "oldtab" o
      LEFT JOIN "newtab" n ON n."key" = o."key"
     WHERE n."key" IS NULL
  )
  SELECT array_agg(s."id") INTO v
    FROM "specifications" s
   WHERE s."property_key" IN (SELECT "k" FROM "touched");

  PERFORM "review_invalidate_specifications"(v, 'dictionary_changed');
  RETURN NULL;
END $fn$;

-- Raw-property mappings. A Specification is a candidate when any of its evidence
-- links quotes a raw property the statement touched — which covers a new
-- unit-specific mapping outranking the generic one, a mapping being rejected or
-- superseded, a confidence downgrade, and a re-pointed target key, without
-- needing to work out in advance which of those actually moved the winner.
CREATE FUNCTION "review_tg_mappings_ins"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT s."id") INTO v
    FROM "specifications" s
    JOIN "specification_evidence" se ON se."specification_id" = s."id"
    JOIN "source_facts" sf           ON sf."id" = se."source_fact_id"
   WHERE sf."raw_property" IN (SELECT n."raw_property" FROM "newtab" n);
  PERFORM "review_invalidate_specifications"(v, 'mapping_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_mappings_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT s."id") INTO v
    FROM "specifications" s
    JOIN "specification_evidence" se ON se."specification_id" = s."id"
    JOIN "source_facts" sf           ON sf."id" = se."source_fact_id"
   WHERE sf."raw_property" IN (
           SELECT n."raw_property" FROM "newtab" n
           UNION
           SELECT o."raw_property" FROM "oldtab" o);
  PERFORM "review_invalidate_specifications"(v, 'mapping_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_mappings_del"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT s."id") INTO v
    FROM "specifications" s
    JOIN "specification_evidence" se ON se."specification_id" = s."id"
    JOIN "source_facts" sf           ON sf."id" = se."source_fact_id"
   WHERE sf."raw_property" IN (SELECT o."raw_property" FROM "oldtab" o);
  PERFORM "review_invalidate_specifications"(v, 'mapping_changed');
  RETURN NULL;
END $fn$;

-- Evidence membership and evidence role, both directions, for both subjects.
-- An UPDATE names the subject on both sides, because re-pointing a link at a
-- different subject changes two hashes and not one.
CREATE FUNCTION "review_tg_spec_evidence_ins"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT n."specification_id") INTO v FROM "newtab" n;
  PERFORM "review_invalidate_specifications"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_spec_evidence_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT x) INTO v FROM (
    SELECT n."specification_id" AS x FROM "newtab" n
    UNION ALL
    SELECT o."specification_id"      FROM "oldtab" o) t;
  PERFORM "review_invalidate_specifications"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_spec_evidence_del"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT o."specification_id") INTO v FROM "oldtab" o;
  PERFORM "review_invalidate_specifications"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_claim_evidence_ins"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT n."product_claim_id") INTO v FROM "newtab" n;
  PERFORM "review_invalidate_product_claims"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_claim_evidence_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT x) INTO v FROM (
    SELECT n."product_claim_id" AS x FROM "newtab" n
    UNION ALL
    SELECT o."product_claim_id"      FROM "oldtab" o) t;
  PERFORM "review_invalidate_product_claims"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE FUNCTION "review_tg_claim_evidence_del"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT o."product_claim_id") INTO v FROM "oldtab" o;
  PERFORM "review_invalidate_product_claims"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

-- Source capture. Only `source_asset_id` reaches a hash; `document_date` and
-- `revision_label` are review WARNINGS and deliberately move nothing.
--
-- Both subject kinds are reached in one statement, because one document's facts
-- can support Specifications and ProductClaims at the same time.
CREATE FUNCTION "review_tg_source_documents_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE
  v_docs UUID[];
  v_spec UUID[];
  v_claim UUID[];
BEGIN
  SELECT array_agg(n."id") INTO v_docs
    FROM "newtab" n
    JOIN "oldtab" o ON o."id" = n."id"
   WHERE n."source_asset_id" IS DISTINCT FROM o."source_asset_id";

  IF v_docs IS NULL THEN RETURN NULL; END IF;

  SELECT array_agg(DISTINCT se."specification_id") INTO v_spec
    FROM "specification_evidence" se
    JOIN "source_facts" sf ON sf."id" = se."source_fact_id"
   WHERE sf."source_document_id" = ANY(v_docs);

  SELECT array_agg(DISTINCT ce."product_claim_id") INTO v_claim
    FROM "claim_evidence" ce
    JOIN "source_facts" sf ON sf."id" = ce."source_fact_id"
   WHERE sf."source_document_id" = ANY(v_docs);

  PERFORM "review_invalidate_specifications"(v_spec, 'source_capture_changed');
  PERFORM "review_invalidate_product_claims"(v_claim, 'source_capture_changed');
  RETURN NULL;
END $fn$;

-- ---------------------------------------------------------------------------
-- 11. ARMING THE TRIGGERS, and the one place `ENABLE ALWAYS` is wrong.
--
-- Every trigger below whose event is UPDATE or DELETE is `ENABLE ALWAYS`. That
-- is free and strictly stronger: `pg_restore` writes rows with COPY and INSERT
-- and never issues an UPDATE or a DELETE, so an ALWAYS trigger on those events
-- cannot interfere with a restore, and ALWAYS is what stops a session that sets
-- `session_replication_role = 'replica'` from changing an approved subject
-- without the approval being retired.
--
-- The three INSERT triggers are deliberately left at plain ENABLE, and this is
-- the one asymmetry in the file:
--
--   During a restore, table order is not guaranteed. If `specifications` were
--   restored before `specification_evidence`, an ALWAYS trigger would see an
--   approved subject whose evidence has not been loaded yet, compute a hash over
--   the empty set, find a mismatch, and un-approve it. The restore would
--   silently lose approval state and write invalidation events describing
--   nothing that happened. Plain ENABLE means `pg_restore --disable-triggers`
--   suppresses them, which is the documented way to restore this database
--   (ADR-017 §10).
--
-- The gap that leaves is narrow and named: a `replica`-role session could insert
-- an evidence link under an approved subject without retiring the approval.
-- Setting `session_replication_role` requires superuser, which the application
-- role is not; and the same session could not publish anything, because
-- `specification_approval_gate_guard` is ALWAYS. ADR-017 §10 records it
-- alongside the larger ownership limitation rather than leaving it implicit.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "review_invalidate_specifications_update"
  AFTER UPDATE ON "specifications" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_specifications_upd"();
ALTER TABLE "specifications" ENABLE ALWAYS TRIGGER "review_invalidate_specifications_update";

CREATE TRIGGER "review_invalidate_product_claims_update"
  AFTER UPDATE ON "product_claims" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_product_claims_upd"();
ALTER TABLE "product_claims" ENABLE ALWAYS TRIGGER "review_invalidate_product_claims_update";

CREATE TRIGGER "review_invalidate_spec_properties_update"
  AFTER UPDATE ON "spec_properties" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_spec_properties_upd"();
ALTER TABLE "spec_properties" ENABLE ALWAYS TRIGGER "review_invalidate_spec_properties_update";

CREATE TRIGGER "review_invalidate_mappings_insert"
  AFTER INSERT ON "spec_property_mappings" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_mappings_ins"();

CREATE TRIGGER "review_invalidate_mappings_update"
  AFTER UPDATE ON "spec_property_mappings" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_mappings_upd"();
ALTER TABLE "spec_property_mappings" ENABLE ALWAYS TRIGGER "review_invalidate_mappings_update";

CREATE TRIGGER "review_invalidate_mappings_delete"
  AFTER DELETE ON "spec_property_mappings" REFERENCING OLD TABLE AS "oldtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_mappings_del"();
ALTER TABLE "spec_property_mappings" ENABLE ALWAYS TRIGGER "review_invalidate_mappings_delete";

CREATE TRIGGER "review_invalidate_spec_evidence_insert"
  AFTER INSERT ON "specification_evidence" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_spec_evidence_ins"();

CREATE TRIGGER "review_invalidate_spec_evidence_update"
  AFTER UPDATE ON "specification_evidence" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_spec_evidence_upd"();
ALTER TABLE "specification_evidence" ENABLE ALWAYS TRIGGER "review_invalidate_spec_evidence_update";

CREATE TRIGGER "review_invalidate_spec_evidence_delete"
  AFTER DELETE ON "specification_evidence" REFERENCING OLD TABLE AS "oldtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_spec_evidence_del"();
ALTER TABLE "specification_evidence" ENABLE ALWAYS TRIGGER "review_invalidate_spec_evidence_delete";

CREATE TRIGGER "review_invalidate_claim_evidence_insert"
  AFTER INSERT ON "claim_evidence" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_claim_evidence_ins"();

CREATE TRIGGER "review_invalidate_claim_evidence_update"
  AFTER UPDATE ON "claim_evidence" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_claim_evidence_upd"();
ALTER TABLE "claim_evidence" ENABLE ALWAYS TRIGGER "review_invalidate_claim_evidence_update";

CREATE TRIGGER "review_invalidate_claim_evidence_delete"
  AFTER DELETE ON "claim_evidence" REFERENCING OLD TABLE AS "oldtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_claim_evidence_del"();
ALTER TABLE "claim_evidence" ENABLE ALWAYS TRIGGER "review_invalidate_claim_evidence_delete";

CREATE TRIGGER "review_invalidate_source_documents_update"
  AFTER UPDATE ON "source_documents" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_source_documents_upd"();
ALTER TABLE "source_documents" ENABLE ALWAYS TRIGGER "review_invalidate_source_documents_update";

-- ---------------------------------------------------------------------------
-- 12. SOURCE ASSET IDENTITY IS IMMUTABLE.
--
-- A `source_assets` row IS a content identity: a SHA-256, a byte size, a media
-- type. Rewriting the hash in place would repoint every citation of that file at
-- different bytes while every review that ever quoted it went on looking
-- current. That is the same failure `source_facts_immutable_guard` exists to
-- prevent, one level lower down.
--
-- DELETE is refused only ONCE REFERENCED, matching the `source_facts` reasoning:
-- an asset row nothing cites is an import artefact, and being unable to clear
-- one would make a bad capture permanent. The `source_documents` foreign key is
-- already ON DELETE RESTRICT, so this is the second statement of that rule and
-- says it as a sentence rather than as a constraint number.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "source_assets_immutable"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "source_documents" sd WHERE sd."source_asset_id" = OLD."id") THEN
      RAISE EXCEPTION 'source_assets row % is cited by a source document and cannot be deleted',
        OLD."id"
        USING ERRCODE = 'restrict_violation',
              DETAIL  = format('source_assets row %s, sha256 %s', OLD."id", OLD."sha256"),
              HINT    = 'A captured file that evidence depends on is never removed. Record a later '
                        'revision as a NEW source_document with a NEW asset instead.';
    END IF;
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'source_assets rows are immutable content identity and cannot be updated'
    USING ERRCODE = 'restrict_violation',
          DETAIL  = format('source_assets row %s, sha256 %s', OLD."id", OLD."sha256"),
          HINT    = 'The sha256 IS the identity of the bytes. Different bytes are a different '
                    'asset row, never an edit of this one.';
END
$fn$;

CREATE TRIGGER "source_assets_immutable_guard"
  BEFORE UPDATE OR DELETE ON "source_assets"
  FOR EACH ROW
  EXECUTE FUNCTION "source_assets_immutable"();

ALTER TABLE "source_assets"
  ENABLE ALWAYS TRIGGER "source_assets_immutable_guard";

COMMENT ON TABLE "source_assets" IS
  'Immutable content identity for a captured source file: sha256, byte size, media type, and no '
  'bytes. source_assets_immutable_guard refuses every UPDATE and refuses DELETE once a '
  'source_document cites the row (ADR-017).';

-- ---------------------------------------------------------------------------
-- 13. SOURCE DOCUMENT CAPTURE HAPPENS ONCE.
--
-- `source_documents.source_asset_id` is nullable because a source can legitimately
-- be cited before, or without, a captured file — a standards page read in a
-- browser has no asset (ADR-014). Filling it in later is the CAPTURE this
-- project still has ahead of it, and it is a one-way door:
--
--   NULL -> non-null        allowed. This is the capture, and it invalidates
--                           every approval that cited the document, through
--                           `review_invalidate_source_documents_update`.
--   non-null -> different   REFUSED. Different bytes at the same locator are a
--                           REVISION, and a revision is a new SourceDocument
--                           plus new evidence linkage — never a rewrite, because
--                           a rewrite would silently repoint every existing
--                           citation at a document nobody reviewed.
--   non-null -> NULL        REFUSED. Un-capturing is not a state this project
--                           has; it would make a reviewed source unreviewable
--                           while leaving every approval standing.
--
-- The locator is untouched by this rule and must stay that way: changing
-- `locator_value` to point at a newer file is the same rewrite by another route,
-- and the (locator_type, locator_value, source_asset_id) unique key is what
-- makes the revision a separate row.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "source_documents_asset_capture_guard"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW."source_asset_id" IS NOT DISTINCT FROM OLD."source_asset_id" THEN
    RETURN NEW;
  END IF;

  IF OLD."source_asset_id" IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'source_documents row % already has a captured asset and it cannot be %', OLD."id",
    CASE WHEN NEW."source_asset_id" IS NULL THEN 'cleared' ELSE 'replaced' END
    USING ERRCODE = 'restrict_violation',
          DETAIL  = format('source_documents row %s is captured as asset %s', OLD."id",
                           OLD."source_asset_id"),
          HINT    = 'Capture is one-way. A later revision of the same source is a NEW '
                    'source_document with its own asset and its own evidence links; the older row '
                    'is kept and pointed forward with superseded_by_id.';
END
$fn$;

CREATE TRIGGER "source_documents_asset_capture_guard"
  BEFORE UPDATE ON "source_documents"
  FOR EACH ROW
  EXECUTE FUNCTION "source_documents_asset_capture_guard"();

ALTER TABLE "source_documents"
  ENABLE ALWAYS TRIGGER "source_documents_asset_capture_guard";

COMMENT ON COLUMN "source_documents"."source_asset_id" IS
  'The captured file, or NULL for a source cited without one. Settable exactly once: '
  'source_documents_asset_capture_guard allows NULL -> non-null as the initial capture and refuses '
  'both replacement and clearing. A later revision is a new source_document (ADR-017).';

-- ---------------------------------------------------------------------------
-- 14. THE APPROVAL GATES NOW COMPARE THE V2 HASH **AND** ITS VERSION.
--
-- Everything about 20260825120000's design is retained and none of it is
-- relaxed: entry into `approved` still requires a `technical_reviews` row
-- written in the SAME transaction (proved by `xmin`, which no client can forge),
-- naming this subject and no other, recording an approve decision, carrying a
-- non-blank reviewer snapshot. Leaving `approved` is still not gated, so
-- rejection, supersession, soft deletion and the invalidation above all stay
-- possible. A row still cannot be born approved. A savepoint still fails closed.
--
-- Two conditions are ADDED:
--
--   * the quoted hash must equal the SUBJECT-SPECIFIC v2 value the database
--     computes right now — a far larger surface than v1's evidence-link set;
--   * `evidence_hash_version` must be the version for this subject's domain. A
--     ProductClaim review quoting `spec-review-v2`, or a review quoting a future
--     version this build does not implement, is refused rather than compared.
--
-- The version test is not redundant with the CHECK. The CHECK says the column is
-- consistent with the row's own subject; this says it is consistent with the
-- definition the gate just used. Those diverge exactly when a definition changes,
-- which is the moment the check has to hold.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "specification_approval_gate"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
DECLARE
  v_hash text;
BEGIN
  IF NEW."review_status" <> 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."review_status" = 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION
      'a specification cannot be created already approved'
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('specifications row %s', NEW."id"),
            HINT    = 'Insert the specification unapproved, then approve it through the review '
                      'service, which records a TechnicalReview in the same transaction.';
  END IF;

  -- Recomputed HERE, from the database, in this transaction. The review row's
  -- stored hash is only ever compared against this — never trusted as input.
  v_hash := "specification_review_hash_v2"(NEW."id");

  IF NOT EXISTS (
    SELECT 1
      FROM "technical_reviews" tr
     WHERE tr."specification_id" = NEW."id"
       AND tr."product_claim_id" IS NULL
       AND tr."decision" = 'approved'
       AND tr."evidence_set_hash" = v_hash
       AND tr."evidence_hash_version" = "spec_review_hash_version"()
       AND length(btrim(tr."reviewer_email_snapshot")) > 0
       AND tr.xmin = pg_current_xact_id()::xid
  ) THEN
    RAISE EXCEPTION
      'specification % cannot become approved without a matching TechnicalReview recorded in '
      'this transaction', NEW."id"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format(
              'Required, all of: a technical_reviews row inserted in THIS transaction, naming '
              'specification_id = %s and no product_claim_id, with decision = approved, a '
              'non-blank reviewer_email_snapshot, evidence_hash_version = %L, and '
              'evidence_set_hash = %s (the value the database computes for this subject right '
              'now).', NEW."id", "spec_review_hash_version"(), v_hash),
            HINT    = 'Approve through the Admin review service (ADR-016/ADR-017). A historical '
                      'review, a review of another subject, a review quoting a stale hash and a '
                      'review quoting the wrong hash version are all refused here by design.';
  END IF;

  RETURN NEW;
END
$fn$;

CREATE OR REPLACE FUNCTION "product_claim_approval_gate"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
DECLARE
  v_hash text;
BEGIN
  IF NEW."review_status" <> 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."review_status" = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Second lock. `product_claims_forbidden_approval` is the invariant; this is
  -- the duplicate, kept exactly as 20260825120000 left it.
  IF NEW."kind" IN ('licensed_by', 'reference_only') THEN
    RAISE EXCEPTION
      'a % product claim can never be approved', NEW."kind"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('product_claims row %s', NEW."id"),
            HINT    = 'LICENSED_BY is a third party''s statement this platform has no right to '
                      'republish, and REFERENCE_ONLY exists to hold what is never shown.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION
      'a product claim cannot be created already approved'
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('product_claims row %s', NEW."id"),
            HINT    = 'Insert the claim unapproved, then approve it through the review service, '
                      'which records a TechnicalReview in the same transaction.';
  END IF;

  v_hash := "product_claim_review_hash_v2"(NEW."id");

  IF NOT EXISTS (
    SELECT 1
      FROM "technical_reviews" tr
     WHERE tr."product_claim_id" = NEW."id"
       AND tr."specification_id" IS NULL
       AND tr."decision" = 'approved'
       AND tr."evidence_set_hash" = v_hash
       AND tr."evidence_hash_version" = "claim_review_hash_version"()
       AND length(btrim(tr."reviewer_email_snapshot")) > 0
       AND tr.xmin = pg_current_xact_id()::xid
  ) THEN
    RAISE EXCEPTION
      'product claim % cannot become approved without a matching TechnicalReview recorded in '
      'this transaction', NEW."id"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format(
              'Required, all of: a technical_reviews row inserted in THIS transaction, naming '
              'product_claim_id = %s and no specification_id, with decision = approved, a '
              'non-blank reviewer_email_snapshot, evidence_hash_version = %L, and '
              'evidence_set_hash = %s (the value the database computes for this subject right '
              'now).', NEW."id", "claim_review_hash_version"(), v_hash),
            HINT    = 'Approve through the Admin review service (ADR-016/ADR-017).';
  END IF;

  RETURN NEW;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 15. THE V1 HASH FUNCTIONS ARE DROPPED.
--
-- ADR-017 requires ONE authoritative hash implementation, in PostgreSQL. Leaving
-- `specification_evidence_set_hash` and `product_claim_evidence_set_hash` in
-- place would leave two, and the weaker one would still be callable — which is
-- the exact shape of the drift the decision exists to prevent. `technical_reviews`
-- is empty, so no stored value was ever computed with them and nothing is being
-- orphaned.
--
-- `evidence_set_hash_lines` goes with them: it was their shared helper and has
-- no other caller. Dropped without CASCADE, deliberately — if anything did
-- still depend on one of these, this migration should fail loudly here rather
-- than quietly removing whatever that was.
-- ---------------------------------------------------------------------------
DROP FUNCTION "specification_evidence_set_hash"(uuid);
DROP FUNCTION "product_claim_evidence_set_hash"(uuid);
DROP FUNCTION "evidence_set_hash_lines"(text[]);

-- ---------------------------------------------------------------------------
-- 16. THE COLUMN COMMENTS DESCRIBE WHAT IS NOW TRUE.
--
-- 20260825120000 corrected these once already, for the same reason: a comment
-- travels into every dump and every introspection, and one that describes a
-- superseded rule is worse than no comment at all, because the next reader
-- trusts it.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN "specifications"."review_status" IS
  'The publication gate. Only `approved` reaches v_specification_public, whose predicate remains '
  'exactly review_status = approved AND deleted_at IS NULL. ENTRY into `approved` is enforced by '
  'specification_approval_gate_guard: a technical_reviews row inserted in the SAME transaction, '
  'naming this specification, recording an approve decision, with a non-blank reviewer snapshot, '
  'evidence_hash_version = spec-review-v2, and evidence_set_hash equal to '
  'specification_review_hash_v2 for this subject at that moment. LEAVING `approved` is not gated: '
  'rejection, supersession and automatic invalidation all depend on it. An approval whose v2 hash '
  'stops matching is retired to needs_review automatically, in the transaction that changed the '
  'subject, its dictionary entry, its mapping, its evidence or its source capture — and one '
  'immutable review_invalidations event records it (ADR-016, ADR-017).';

COMMENT ON COLUMN "product_claims"."review_status" IS
  'The publication gate, enforced by product_claim_approval_gate_guard on exactly the same terms '
  'as specifications.review_status over claim-review-v2, and additionally refusing approval of '
  'LICENSED_BY and REFERENCE_ONLY — a duplicate of product_claims_forbidden_approval, kept as a '
  'second lock on the door that publishes. Automatic invalidation applies identically '
  '(ADR-016, ADR-017).';

COMMENT ON TABLE "technical_reviews" IS
  'Immutable SAM technical review history — HUMAN decisions only. '
  'technical_reviews_immutable_guard refuses every UPDATE and every DELETE; INSERT is the only '
  'write. A decision that was wrong is superseded by a LATER decision on the same subject, never '
  'edited away. System-driven invalidation of an approval is NOT recorded here: it has no '
  'reviewer, and it lives in review_invalidations (ADR-016, ADR-017).';

COMMIT;
