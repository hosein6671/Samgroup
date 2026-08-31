-- ADR-019 · Product Copy as a third review subject.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What this migration does, and the one thing it must not do
-- ─────────────────────────────────────────────────────────────────────────────
--
-- It widens the review subsystem from two subjects to three. `technical_reviews`
-- holds this platform's audit evidence: every row is a named human's attestation,
-- append-only, and never rewritten. Widening a CHECK on that table is not
-- reversible by editing a file, which is why ADR-019 was ratified before this was
-- written rather than after.
--
-- The immutability guarantees are NOT touched. The same BEFORE UPDATE trigger,
-- the same append-only `sequence`, the same `reviewer_email_snapshot`. This
-- migration adds a nullable column and relaxes two CHECKs from "one of two" to
-- "one of three"; every existing row satisfies the widened form unchanged, and no
-- existing row is read, moved or rewritten.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Where copy is deliberately STRICTER than the other two subjects
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `specification_approval_gate` and `product_claim_approval_gate` do not check
-- for evidence: evidence presence is an eligibility blocker computed by the
-- review service, and the gate only enforces that a matching review exists.
--
-- `product_copy_approval_gate` DOES check, because ADR-019 §3 was ratified on
-- exactly that question. `PRODUCT_RESEARCH_REGISTER.md` rule 11 — copy wording is
-- transcribed from that product's bound source document and never synthesized —
-- is the rule with no technical residue to catch it later. A wrong specification
-- number contradicts a datasheet; invented prose contradicts nothing and reads
-- perfectly well. So the binding is enforced where it cannot be forgotten.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · The subject table and its evidence
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "product_copy" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "selection_note" TEXT,
    "review_status" "technical_review_status" NOT NULL DEFAULT 'source_recorded',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_copy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copy_evidence" (
    "product_copy_id" UUID NOT NULL,
    "source_fact_id" UUID NOT NULL,
    "role" "evidence_role" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_evidence_pkey" PRIMARY KEY ("product_copy_id","source_fact_id")
);

CREATE INDEX "product_copy_product_id_idx" ON "product_copy"("product_id");
CREATE INDEX "product_copy_review_status_idx" ON "product_copy"("review_status");
CREATE UNIQUE INDEX "product_copy_product_id_locale_key" ON "product_copy"("product_id", "locale");
CREATE INDEX "copy_evidence_source_fact_id_idx" ON "copy_evidence"("source_fact_id");

ALTER TABLE "product_copy" ADD CONSTRAINT "product_copy_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copy_evidence" ADD CONSTRAINT "copy_evidence_product_copy_id_fkey"
  FOREIGN KEY ("product_copy_id") REFERENCES "product_copy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "copy_evidence" ADD CONSTRAINT "copy_evidence_source_fact_id_fkey"
  FOREIGN KEY ("source_fact_id") REFERENCES "source_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- `summary` is the thing being reviewed. A blank one is not a draft of anything,
-- and would otherwise be approvable.
ALTER TABLE "product_copy" ADD CONSTRAINT "product_copy_summary_not_blank"
  CHECK (length(btrim("summary")) > 0);

ALTER TABLE "product_copy" ADD CONSTRAINT "product_copy_selection_note_not_blank"
  CHECK ("selection_note" IS NULL OR length(btrim("selection_note")) > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · The third subject key on the two audit tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "technical_reviews"    ADD COLUMN "product_copy_id" UUID;
ALTER TABLE "review_invalidations" ADD COLUMN "product_copy_id" UUID;

ALTER TABLE "technical_reviews" ADD CONSTRAINT "technical_reviews_product_copy_id_fkey"
  FOREIGN KEY ("product_copy_id") REFERENCES "product_copy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "review_invalidations" ADD CONSTRAINT "review_invalidations_product_copy_id_fkey"
  FOREIGN KEY ("product_copy_id") REFERENCES "product_copy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "technical_reviews_product_copy_id_idx"    ON "technical_reviews"("product_copy_id");
CREATE INDEX "review_invalidations_product_copy_id_idx" ON "review_invalidations"("product_copy_id");

-- The two widenings. Dropped and recreated rather than altered because Postgres
-- has no ALTER CHECK; every existing row satisfies the new form, so the implicit
-- validation scan on recreate finds nothing to complain about.

ALTER TABLE "technical_reviews" DROP CONSTRAINT "technical_reviews_exactly_one_target";
ALTER TABLE "technical_reviews" ADD  CONSTRAINT "technical_reviews_exactly_one_target"
  CHECK (
    ("specification_id" IS NOT NULL)::int
  + ("product_claim_id" IS NOT NULL)::int
  + ("product_copy_id"  IS NOT NULL)::int = 1);

ALTER TABLE "technical_reviews" DROP CONSTRAINT "technical_reviews_hash_version_matches_subject";
ALTER TABLE "technical_reviews" ADD  CONSTRAINT "technical_reviews_hash_version_matches_subject"
  CHECK (
    ("specification_id" IS NOT NULL AND "evidence_hash_version" = 'spec-review-v2')
 OR ("product_claim_id" IS NOT NULL AND "evidence_hash_version" = 'claim-review-v2')
 OR ("product_copy_id"  IS NOT NULL AND "evidence_hash_version" = 'copy-review-v2'));

ALTER TABLE "review_invalidations" DROP CONSTRAINT "review_invalidations_exactly_one_target";
ALTER TABLE "review_invalidations" ADD  CONSTRAINT "review_invalidations_exactly_one_target"
  CHECK (
    ("specification_id" IS NOT NULL)::int
  + ("product_claim_id" IS NOT NULL)::int
  + ("product_copy_id"  IS NOT NULL)::int = 1);

ALTER TABLE "review_invalidations" DROP CONSTRAINT "review_invalidations_hash_version_matches_subject";
ALTER TABLE "review_invalidations" ADD  CONSTRAINT "review_invalidations_hash_version_matches_subject"
  CHECK (
    ("specification_id" IS NOT NULL AND "evidence_hash_version" = 'spec-review-v2')
 OR ("product_claim_id" IS NOT NULL AND "evidence_hash_version" = 'claim-review-v2')
 OR ("product_copy_id"  IS NOT NULL AND "evidence_hash_version" = 'copy-review-v2'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · The versioned review hash (ADR-017, third variant)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "copy_review_hash_version"()
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$ SELECT 'copy-review-v2'::text $fn$;

-- Starts at v2, not v1, to keep one version vocabulary across the three subjects:
-- `spec-review-v2` and `claim-review-v2` are what the constraint above accepts,
-- and a lone `copy-review-v1` would read as an older scheme rather than a newer
-- subject.
--
-- The subject half covers the TEXT, because for copy the text IS the fact. A word
-- changed on an approved row moves it to needs_review through the same mechanism
-- that a changed specification value does — see §5.
CREATE OR REPLACE FUNCTION "product_copy_review_hash_v2"(p_product_copy_id uuid)
RETURNS text LANGUAGE sql STABLE
AS $fn$
  SELECT "review_hash_digest"(jsonb_build_object(
    'domain',    "copy_review_hash_version"(),
    'subjectId', pc."id"::text,

    'subject', jsonb_build_object(
      'productId',     pc."product_id"::text,
      'locale',        pc."locale",
      'summary',       pc."summary",
      'selectionNote', pc."selection_note",
      'deleted',       (pc."deleted_at" IS NOT NULL)),

    'evidence', coalesce((
      SELECT jsonb_agg(e."entry" ORDER BY e."sort_key" COLLATE "C")
        FROM (
          SELECT ce."source_fact_id"::text AS "sort_key",
                 jsonb_build_object(
                   'sourceFactId', ce."source_fact_id"::text,
                   'role',         ce."role"::text,
                   'assetSha256',  sa."sha256") AS "entry"
            FROM "copy_evidence" ce
            LEFT JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
            LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
            LEFT JOIN "source_assets" sa    ON sa."id" = sd."source_asset_id"
           WHERE ce."product_copy_id" = pc."id") e), '[]'::jsonb)))
  FROM "product_copy" pc
 WHERE pc."id" = "p_product_copy_id"
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · The approval gate
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "product_copy_approval_gate"()
RETURNS trigger LANGUAGE plpgsql
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
      'product copy cannot be created already approved'
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('product_copy row %s', NEW."id"),
            HINT    = 'Insert the copy unapproved, then approve it through the review service, '
                      'which records a TechnicalReview in the same transaction.';
  END IF;

  -- ADR-019 §3, enforced rather than documented. A draft with no source binding
  -- that resolves to a captured asset is reviewable and rejectable, and never
  -- approvable — see the header note on why copy is stricter here than the other
  -- two subjects.
  IF NOT EXISTS (
    SELECT 1
      FROM "copy_evidence" ce
      JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
      JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
     WHERE ce."product_copy_id" = NEW."id"
       AND sd."source_asset_id" IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'product copy % cannot be approved without a bound, captured source document', NEW."id"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('product_copy row %s has no copy_evidence row whose source fact '
                             'reaches a source_document with a captured source_asset.', NEW."id"),
            HINT    = 'Copy wording is transcribed from that product''s bound source document and '
                      'never synthesized (PRODUCT_RESEARCH_REGISTER rule 11). Bind the evidence '
                      'first, or reject the draft.';
  END IF;

  -- Recomputed HERE, from the database, in this transaction. The review row's
  -- stored hash is only ever compared against this — never trusted as input.
  v_hash := "product_copy_review_hash_v2"(NEW."id");

  IF NOT EXISTS (
    SELECT 1
      FROM "technical_reviews" tr
     WHERE tr."product_copy_id" = NEW."id"
       AND tr."specification_id" IS NULL
       AND tr."product_claim_id" IS NULL
       AND tr."decision" = 'approved'
       AND tr."evidence_set_hash" = v_hash
       AND tr."evidence_hash_version" = "copy_review_hash_version"()
       AND length(btrim(tr."reviewer_email_snapshot")) > 0
       AND tr.xmin = pg_current_xact_id()::xid
  ) THEN
    RAISE EXCEPTION
      'product copy % cannot become approved without a matching TechnicalReview recorded in '
      'this transaction', NEW."id"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format(
              'Required, all of: a technical_reviews row inserted in THIS transaction, naming '
              'product_copy_id = %s and no other subject, with decision = approved, a non-blank '
              'reviewer_email_snapshot, evidence_hash_version = %L, and evidence_set_hash = %s '
              '(the value the database computes for this subject right now).',
              NEW."id", "copy_review_hash_version"(), v_hash),
            HINT    = 'Approve through the Admin review service (ADR-016/ADR-017/ADR-019).';
  END IF;

  RETURN NEW;
END $fn$;

CREATE TRIGGER "product_copy_approval_gate_guard"
BEFORE INSERT OR UPDATE ON "product_copy"
FOR EACH ROW EXECUTE FUNCTION "product_copy_approval_gate"();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Invalidation — an approved row whose evidence or text moved
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "review_invalidate_product_copy"(p_ids uuid[], p_reason review_invalidation_reason)
RETURNS void LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ids UUID[];
BEGIN
  IF "p_ids" IS NULL THEN RETURN; END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest("p_ids") AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL THEN RETURN; END IF;

  PERFORM 1
     FROM "product_copy" pc
    WHERE pc."id" = ANY(v_ids)
    ORDER BY pc."id"
      FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM "product_copy" pc
     WHERE pc."id" = ANY(v_ids) AND pc."review_status" = 'approved'
  ) THEN
    RETURN;
  END IF;

  WITH "stale" AS MATERIALIZED (
    SELECT pc."id"                                 AS "subject_id",
           tr."id"                                 AS "review_id",
           tr."evidence_set_hash"                  AS "previous_hash",
           "product_copy_review_hash_v2"(pc."id")  AS "current_hash"
      FROM "product_copy" pc
      JOIN LATERAL (
        SELECT r."id", r."evidence_set_hash"
          FROM "technical_reviews" r
         WHERE r."product_copy_id" = pc."id"
           AND r."decision" = 'approved'
         ORDER BY r."sequence" DESC
         LIMIT 1
      ) tr ON TRUE
     WHERE pc."id" = ANY(v_ids)
       AND pc."review_status" = 'approved'
  ),
  "changed" AS MATERIALIZED (
    SELECT * FROM "stale" WHERE "previous_hash" IS DISTINCT FROM "current_hash"
  ),
  "moved" AS (
    UPDATE "product_copy" pc
       SET "review_status" = 'needs_review'
      FROM "changed" ch
     WHERE pc."id" = ch."subject_id"
    RETURNING pc."id"
  )
  INSERT INTO "review_invalidations" (
    "id", "specification_id", "product_claim_id", "product_copy_id", "technical_review_id",
    "reason_code", "previous_evidence_hash", "current_evidence_hash", "evidence_hash_version")
  SELECT gen_random_uuid(), NULL, NULL, ch."subject_id", ch."review_id", "p_reason",
         ch."previous_hash", ch."current_hash", "copy_review_hash_version"()
    FROM "changed" ch
   WHERE EXISTS (SELECT 1 FROM "moved" m WHERE m."id" = ch."subject_id")
  ON CONFLICT ("technical_review_id") DO NOTHING;
END $fn$;

CREATE OR REPLACE FUNCTION "review_tg_product_copy_upd"()
RETURNS trigger LANGUAGE plpgsql
AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(n."id") INTO v FROM "newtab" n WHERE n."review_status" = 'approved';
  PERFORM "review_invalidate_product_copy"(v, 'subject_state_changed');
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION "review_tg_copy_evidence_ins"()
RETURNS trigger LANGUAGE plpgsql
AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT n."product_copy_id") INTO v FROM "newtab" n;
  PERFORM "review_invalidate_product_copy"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION "review_tg_copy_evidence_upd"()
RETURNS trigger LANGUAGE plpgsql
AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT x) INTO v FROM (
    SELECT n."product_copy_id" AS x FROM "newtab" n
    UNION ALL
    SELECT o."product_copy_id"      FROM "oldtab" o) t;
  PERFORM "review_invalidate_product_copy"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION "review_tg_copy_evidence_del"()
RETURNS trigger LANGUAGE plpgsql
AS $fn$
DECLARE v UUID[];
BEGIN
  SELECT array_agg(DISTINCT o."product_copy_id") INTO v FROM "oldtab" o;
  PERFORM "review_invalidate_product_copy"(v, 'evidence_changed');
  RETURN NULL;
END $fn$;

CREATE TRIGGER "review_invalidate_product_copy_update"
AFTER UPDATE ON "product_copy" REFERENCING NEW TABLE AS "newtab"
FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_product_copy_upd"();

CREATE TRIGGER "review_invalidate_copy_evidence_insert"
AFTER INSERT ON "copy_evidence" REFERENCING NEW TABLE AS "newtab"
FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_copy_evidence_ins"();

CREATE TRIGGER "review_invalidate_copy_evidence_update"
AFTER UPDATE ON "copy_evidence" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_copy_evidence_upd"();

CREATE TRIGGER "review_invalidate_copy_evidence_delete"
AFTER DELETE ON "copy_evidence" REFERENCING OLD TABLE AS "oldtab"
FOR EACH STATEMENT EXECUTE FUNCTION "review_tg_copy_evidence_del"();

-- The source-document fan-out gains its third arm. Without this, re-capturing a
-- document would invalidate the specifications and claims that cite it while
-- leaving approved copy transcribed from the SAME document untouched — the one
-- asymmetry that would make the third subject weaker than the other two.
CREATE OR REPLACE FUNCTION "review_tg_source_documents_upd"()
RETURNS trigger LANGUAGE plpgsql
AS $fn$
DECLARE
  v_docs UUID[];
  v_spec UUID[];
  v_claim UUID[];
  v_copy UUID[];
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

  SELECT array_agg(DISTINCT ce."product_copy_id") INTO v_copy
    FROM "copy_evidence" ce
    JOIN "source_facts" sf ON sf."id" = ce."source_fact_id"
   WHERE sf."source_document_id" = ANY(v_docs);

  PERFORM "review_invalidate_specifications"(v_spec, 'source_capture_changed');
  PERFORM "review_invalidate_product_claims"(v_claim, 'source_capture_changed');
  PERFORM "review_invalidate_product_copy"(v_copy, 'source_capture_changed');
  RETURN NULL;
END $fn$;
