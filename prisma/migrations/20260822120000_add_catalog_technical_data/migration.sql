-- ============================================================================
-- Catalog technical data — the Prisma-owned schema foundation (PRODUCT-DATA-2A)
--
-- WHAT THIS MIGRATION IS FOR
--
-- SAM Group's catalog carries technical facts — viscosities, flash points,
-- density, API/ACEA classes — that today have nowhere to live except an untyped
-- `specifications(key, value, unit)` row. Untyped is not merely inconvenient: a
-- string column cannot say whether "12.5" is a typical value or a specification
-- limit, cannot say which grade of a multi-grade product it belongs to, cannot
-- say where it came from, and cannot say whether anyone at SAM has ever agreed
-- it is true. Every one of those four is a publication risk, because the value
-- reaches a public page regardless.
--
-- This migration adds the structure that answers all four, and nothing else. It
-- imports no data. The 100 authoritative Products, their 134 expected grades and
-- every technical value remain OUT of scope and are the next gate's work.
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
--   * No legacy column is dropped, renamed, retyped or rewritten. `key`, `value`
--     and `unit` on `specifications` are exactly as they were, and the catalog
--     API that reads them is unaffected. Every column added here is nullable or
--     carries a database default.
--   * No row is inserted, updated or deleted, in any table.
--   * No ProductGrade is invented. A product with no grades gets no row, and
--     there is no synthetic or default grade anywhere in this file.
--   * ADR-011 is untouched. `product_slug_claims` is fed by `categories.slug`,
--     `products.slug` and `content_translations`; `product_grades` has no slug
--     column, so it cannot enter that namespace and no trigger changes.
--
-- PREFLIGHT, MEASURED RATHER THAN ASSUMED
--
-- Against local DEV `sam_platform` on 22 August 2026, immediately before this
-- file was written:
--
--     products              10   (the `sam-demo-` placeholder set)
--     specifications         0
--     categories             6
--     segments               8
--     product_types          0
--     users                  0
--     product_slug_claims   16
--
-- `specifications` being empty is what makes the two CHECK constraints on it
-- trivially satisfiable here — but this file does NOT rely on that. Both are
-- added NOT VALID and then VALIDATEd as separate statements, which is the shape
-- that stays correct against an environment where the table is not empty. The
-- DO block below reports the counts it actually finds, so an apply against any
-- other database leaves the evidence in its own log rather than in this comment.
--
-- Any pre-existing row keeps every legacy value and acquires
-- `review_status = 'source_recorded'` from the column default — that is, it
-- becomes an UNAPPROVED technical fact, invisible to both public views, which is
-- the only safe default for data nobody has reviewed. No backfill re-parents,
-- reinterprets or deletes anything, and none is needed: no evidence exists that
-- would justify one.
--
-- ATOMICITY
--
-- Explicit BEGIN/COMMIT, per the convention 20260814120000 recorded: Prisma
-- applies a migration file statement by statement in autocommit, so without this
-- a failure partway would leave the database half-migrated — some tables
-- created, the views absent, the trigger unarmed.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. PREFLIGHT — report what this migration is being applied to.
--
-- Reports, deliberately, rather than aborts. There is no count at which the
-- work below becomes unsafe: it is additive in every case. What matters is that
-- the numbers appear in the apply log of every environment, so "we did not know
-- there was data" can never be said afterwards.
-- ---------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_products       bigint;
  v_specifications bigint;
BEGIN
  SELECT count(*) INTO v_products       FROM "products";
  SELECT count(*) INTO v_specifications FROM "specifications";

  RAISE NOTICE 'PRODUCT-DATA-2A preflight: products=%, specifications=%',
    v_products, v_specifications;

  IF v_specifications > 0 THEN
    RAISE NOTICE 'PRODUCT-DATA-2A: % existing specification row(s) will be preserved verbatim and become review_status=source_recorded (unapproved, non-public).',
      v_specifications;
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- 2. NEW ENUMS AND NEW TABLES.
--
-- Nothing here touches an existing table. Every type and every relation below
-- is new, so this whole step is inert with respect to anything already running.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "grade_system" AS ENUM ('sae', 'iso_vg', 'nlgi');

-- CreateEnum
CREATE TYPE "spec_value_type" AS ENUM ('point', 'range', 'minimum', 'maximum', 'text', 'report_only', 'code', 'pair');

-- CreateEnum
CREATE TYPE "spec_value_kind" AS ENUM ('numeric', 'textual', 'coded');

-- CreateEnum
CREATE TYPE "method_requirement" AS ENUM ('required', 'optional', 'not_applicable');

-- CreateEnum
CREATE TYPE "result_basis" AS ENUM ('average', 'typical', 'specification_limit', 'measured', 'unspecified');

-- CreateEnum
CREATE TYPE "technical_review_status" AS ENUM ('source_recorded', 'needs_review', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "technical_review_decision" AS ENUM ('approved', 'rejected', 'needs_review', 'superseded');

-- CreateEnum
CREATE TYPE "product_claim_kind" AS ENUM ('classification_stated', 'meets', 'suitable_for', 'recommended_for', 'formulated_for', 'approved_by', 'licensed_by', 'reference_only');

-- CreateEnum
CREATE TYPE "source_locator_type" AS ENUM ('url', 'uploaded_file');

-- CreateEnum
CREATE TYPE "extraction_method" AS ENUM ('spreadsheet_cell', 'pdf_text_layer', 'pdf_ocr', 'manual_transcription');

-- CreateEnum
CREATE TYPE "source_unit_classification" AS ENUM ('stated', 'absent', 'dimensionless', 'unrecognized');

-- CreateEnum
CREATE TYPE "evidence_role" AS ENUM ('primary', 'corroborating', 'superseded');

-- CreateEnum
CREATE TYPE "mapping_confidence" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "product_grades" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "grade_system" "grade_system",
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_properties" (
    "key" TEXT NOT NULL,
    "canonical_meaning" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "value_kind" "spec_value_kind" NOT NULL,
    "allowed_units" TEXT[],
    "method_requirement" "method_requirement" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_properties_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "product_claims" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_grade_id" UUID,
    "kind" "product_claim_kind" NOT NULL,
    "standard_body" TEXT,
    "standard_code" TEXT,
    "context_note" TEXT,
    "review_status" "technical_review_status" NOT NULL DEFAULT 'source_recorded',
    "sort_order" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_assets" (
    "id" UUID NOT NULL,
    "sha256" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "media_type" TEXT NOT NULL,
    "page_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" UUID NOT NULL,
    "source_asset_id" UUID,
    "locator_type" "source_locator_type" NOT NULL,
    "locator_value" TEXT NOT NULL,
    "publisher" TEXT,
    "title" TEXT NOT NULL,
    "document_date" DATE,
    "revision_label" TEXT,
    "retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "default_result_basis" "result_basis" NOT NULL DEFAULT 'unspecified',
    "superseded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" UUID NOT NULL,
    "source_document_id" UUID,
    "importer_version" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "note" TEXT,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_facts" (
    "id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "import_run_id" UUID NOT NULL,
    "page_number" INTEGER,
    "sheet_name" TEXT,
    "row_number" INTEGER,
    "column_label" TEXT,
    "raw_property" TEXT,
    "raw_unit" TEXT,
    "raw_value" TEXT NOT NULL,
    "raw_method" TEXT,
    "raw_grade" TEXT,
    "extraction_method" "extraction_method" NOT NULL,
    "unit_classification" "source_unit_classification" NOT NULL,
    "result_basis_override" "result_basis",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specification_evidence" (
    "specification_id" UUID NOT NULL,
    "source_fact_id" UUID NOT NULL,
    "role" "evidence_role" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specification_evidence_pkey" PRIMARY KEY ("specification_id","source_fact_id")
);

-- CreateTable
CREATE TABLE "claim_evidence" (
    "product_claim_id" UUID NOT NULL,
    "source_fact_id" UUID NOT NULL,
    "role" "evidence_role" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_evidence_pkey" PRIMARY KEY ("product_claim_id","source_fact_id")
);

-- CreateTable
CREATE TABLE "spec_property_mappings" (
    "id" UUID NOT NULL,
    "raw_property" TEXT NOT NULL,
    "raw_unit" TEXT,
    "spec_property_key" TEXT,
    "confidence" "mapping_confidence" NOT NULL,
    "review_status" "technical_review_status" NOT NULL DEFAULT 'source_recorded',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_property_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_reviews" (
    "id" UUID NOT NULL,
    "specification_id" UUID,
    "product_claim_id" UUID,
    "reviewer_id" UUID,
    "reviewer_email_snapshot" TEXT NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" "technical_review_decision" NOT NULL,
    "note" TEXT,
    "evidence_set_hash" TEXT NOT NULL,

    CONSTRAINT "technical_reviews_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. NEW COLUMNS ON THE EXISTING `specifications` TABLE — ALL ADDITIVE.
--
-- Every column is nullable or carries a DEFAULT, so no existing row is
-- invalidated and no rewrite is triggered: PostgreSQL has stored a non-volatile
-- ADD COLUMN ... DEFAULT as catalog metadata since version 11, making this fast
-- regardless of table size.
--
-- `key`, `value` and `unit` are NOT in this list. They are untouched.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "specifications" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "display_value" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "numeric_max" DECIMAL(20,6),
ADD COLUMN     "numeric_min" DECIMAL(20,6),
ADD COLUMN     "pair_first" DECIMAL(20,6),
ADD COLUMN     "pair_second" DECIMAL(20,6),
ADD COLUMN     "product_grade_id" UUID,
ADD COLUMN     "property_key" TEXT,
ADD COLUMN     "qualifier" TEXT,
ADD COLUMN     "result_basis" "result_basis" NOT NULL DEFAULT 'unspecified',
ADD COLUMN     "review_status" "technical_review_status" NOT NULL DEFAULT 'source_recorded',
ADD COLUMN     "sort_order" INTEGER,
ADD COLUMN     "value_type" "spec_value_type";

-- ---------------------------------------------------------------------------
-- 3b. INDEXES AND FOREIGN KEYS.
--
-- The composite `(product_grade_id, product_id)` references on `specifications`
-- and `product_claims` are the Grade/Product invariant itself: a multi-column
-- foreign key defaults to MATCH SIMPLE, which skips the check when any column is
-- NULL. So a Product-level fact (NULL grade) is unconstrained, and a Grade-level
-- fact can only name a grade that exists WITH THIS product_id. A grade belonging
-- to another Product is not a referenceable pair.
--
-- This was measured against Prisma 7.9.1 and PostgreSQL 18 before being chosen,
-- so no trigger is needed for it and none is defined.
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "product_grades_product_id_idx" ON "product_grades"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_grades_product_id_label_key" ON "product_grades"("product_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "product_grades_id_product_id_key" ON "product_grades"("id", "product_id");

-- CreateIndex
CREATE INDEX "product_claims_product_id_idx" ON "product_claims"("product_id");

-- CreateIndex
CREATE INDEX "product_claims_product_grade_id_idx" ON "product_claims"("product_grade_id");

-- CreateIndex
CREATE INDEX "product_claims_review_status_idx" ON "product_claims"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "source_assets_sha256_key" ON "source_assets"("sha256");

-- CreateIndex
CREATE INDEX "source_documents_source_asset_id_idx" ON "source_documents"("source_asset_id");

-- CreateIndex
CREATE INDEX "source_documents_superseded_by_id_idx" ON "source_documents"("superseded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_documents_locator_type_locator_value_source_asset_id_key" ON "source_documents"("locator_type", "locator_value", "source_asset_id");

-- CreateIndex
CREATE INDEX "import_runs_source_document_id_idx" ON "import_runs"("source_document_id");

-- CreateIndex
CREATE INDEX "source_facts_source_document_id_idx" ON "source_facts"("source_document_id");

-- CreateIndex
CREATE INDEX "source_facts_import_run_id_idx" ON "source_facts"("import_run_id");

-- CreateIndex
CREATE INDEX "specification_evidence_source_fact_id_idx" ON "specification_evidence"("source_fact_id");

-- CreateIndex
CREATE INDEX "claim_evidence_source_fact_id_idx" ON "claim_evidence"("source_fact_id");

-- CreateIndex
CREATE INDEX "spec_property_mappings_spec_property_key_idx" ON "spec_property_mappings"("spec_property_key");

-- CreateIndex
CREATE INDEX "spec_property_mappings_review_status_idx" ON "spec_property_mappings"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "spec_property_mappings_raw_property_raw_unit_key" ON "spec_property_mappings"("raw_property", "raw_unit");

-- CreateIndex
CREATE INDEX "technical_reviews_specification_id_idx" ON "technical_reviews"("specification_id");

-- CreateIndex
CREATE INDEX "technical_reviews_product_claim_id_idx" ON "technical_reviews"("product_claim_id");

-- CreateIndex
CREATE INDEX "technical_reviews_reviewer_id_idx" ON "technical_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "technical_reviews_reviewed_at_idx" ON "technical_reviews"("reviewed_at");

-- CreateIndex
CREATE INDEX "specifications_product_grade_id_idx" ON "specifications"("product_grade_id");

-- CreateIndex
CREATE INDEX "specifications_property_key_idx" ON "specifications"("property_key");

-- CreateIndex
CREATE INDEX "specifications_review_status_idx" ON "specifications"("review_status");

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_product_grade_id_product_id_fkey" FOREIGN KEY ("product_grade_id", "product_id") REFERENCES "product_grades"("id", "product_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_property_key_fkey" FOREIGN KEY ("property_key") REFERENCES "spec_properties"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grades" ADD CONSTRAINT "product_grades_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_claims" ADD CONSTRAINT "product_claims_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_claims" ADD CONSTRAINT "product_claims_product_grade_id_product_id_fkey" FOREIGN KEY ("product_grade_id", "product_id") REFERENCES "product_grades"("id", "product_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "source_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_facts" ADD CONSTRAINT "source_facts_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_facts" ADD CONSTRAINT "source_facts_import_run_id_fkey" FOREIGN KEY ("import_run_id") REFERENCES "import_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specification_evidence" ADD CONSTRAINT "specification_evidence_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specification_evidence" ADD CONSTRAINT "specification_evidence_source_fact_id_fkey" FOREIGN KEY ("source_fact_id") REFERENCES "source_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_product_claim_id_fkey" FOREIGN KEY ("product_claim_id") REFERENCES "product_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_source_fact_id_fkey" FOREIGN KEY ("source_fact_id") REFERENCES "source_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_property_mappings" ADD CONSTRAINT "spec_property_mappings_spec_property_key_fkey" FOREIGN KEY ("spec_property_key") REFERENCES "spec_properties"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_reviews" ADD CONSTRAINT "technical_reviews_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_reviews" ADD CONSTRAINT "technical_reviews_product_claim_id_fkey" FOREIGN KEY ("product_claim_id") REFERENCES "product_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_reviews" ADD CONSTRAINT "technical_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. COMPATIBILITY / BACKFILL — INTENTIONALLY EMPTY.
--
-- No UPDATE, no INSERT, no DELETE runs in this migration.
--
-- The preflight in step 1 measured `specifications` at 0 rows in local DEV, and
-- the column defaults added in step 3 already give any row in any other
-- environment the correct, safe state: legacy values preserved verbatim,
-- `review_status = 'source_recorded'`, `result_basis = 'unspecified'`. There is
-- nothing a backfill could add that would not be a guess, and a guess written
-- into a technical-data table is exactly what this whole gate exists to prevent.
--
-- In particular: no ProductGrade row is created, no fact is re-parented onto a
-- grade, and no legacy `key` string is parsed into `property_key`. Mapping the
-- legacy rows is the importer's job, with evidence, in PRODUCT-DATA-2B.
-- ---------------------------------------------------------------------------

-- (no statements)

-- ---------------------------------------------------------------------------
-- 5. CONSTRAINTS — the rules that are not expressible in schema.prisma.
--
-- On `specifications`, which already exists and may hold rows anywhere this is
-- applied, both CHECKs go on NOT VALID first and are VALIDATEd in step 6. NOT
-- VALID takes only a brief lock and does not scan the table; VALIDATE scans
-- without blocking readers or writers. Adding them in one step would take an
-- ACCESS EXCLUSIVE lock for the whole scan. The tables created above are new and
-- empty by construction, so their CHECKs are added inline with no such dance.
-- ---------------------------------------------------------------------------

-- The numeric columns must mean what `value_type` says they mean.
--
-- Written as CASE over `value_type` so that every shape is stated once, in one
-- place, and the ELSE branch is load-bearing: it catches `text`, `report_only`,
-- `code` AND `value_type IS NULL` — the last being every legacy row — and
-- requires all four numeric columns to be empty for them. A comparison against
-- NULL yields NULL rather than true, so a NULL `value_type` never matches a WHEN
-- and always lands in ELSE.
--
-- `range` additionally requires min <= max. A range whose ends are the wrong way
-- round is not a range, and it is exactly the kind of thing a spreadsheet import
-- produces when two columns are read in the wrong order.
ALTER TABLE "specifications"
  ADD CONSTRAINT "specifications_value_shape" CHECK (
    CASE "value_type"
      WHEN 'point' THEN
        "numeric_min" IS NOT NULL AND "numeric_max" IS NULL
        AND "pair_first" IS NULL AND "pair_second" IS NULL
      WHEN 'minimum' THEN
        "numeric_min" IS NOT NULL AND "numeric_max" IS NULL
        AND "pair_first" IS NULL AND "pair_second" IS NULL
      WHEN 'maximum' THEN
        "numeric_max" IS NOT NULL AND "numeric_min" IS NULL
        AND "pair_first" IS NULL AND "pair_second" IS NULL
      WHEN 'range' THEN
        "numeric_min" IS NOT NULL AND "numeric_max" IS NOT NULL
        AND "numeric_min" <= "numeric_max"
        AND "pair_first" IS NULL AND "pair_second" IS NULL
      WHEN 'pair' THEN
        "pair_first" IS NOT NULL AND "pair_second" IS NOT NULL
        AND "numeric_min" IS NULL AND "numeric_max" IS NULL
      ELSE
        "numeric_min" IS NULL AND "numeric_max" IS NULL
        AND "pair_first" IS NULL AND "pair_second" IS NULL
    END
  ) NOT VALID;

-- A row that has been normalized must be completely normalized: it names a
-- dictionary property and it carries something a reader can actually be shown.
-- A `value_type` with no `display_value` is a fact the public surface would have
-- to render as an empty string.
--
-- Legacy rows (`value_type IS NULL`) are exempt by the leading disjunct — that
-- is what makes this constraint addable to a populated table without a backfill.
ALTER TABLE "specifications"
  ADD CONSTRAINT "specifications_normalized_complete" CHECK (
    "value_type" IS NULL
    OR ("property_key" IS NOT NULL
        AND "display_value" IS NOT NULL
        AND length(btrim("display_value")) > 0)
  ) NOT VALID;

-- Two claim kinds can NEVER be approved, and therefore can never be published.
--
-- LICENSED_BY: the licensing statements in the supplied external material are a
-- third party's, about a third party's relationship with a standards body. This
-- platform has no right to republish them, and no review — however senior —
-- creates one. REFERENCE_ONLY exists precisely to hold something recorded for
-- internal reference and never shown, including the unnamed automaker claim.
--
-- A CHECK rather than a service rule because "no code path does this today" is a
-- property of today. This one is a property of the database.
ALTER TABLE "product_claims"
  ADD CONSTRAINT "product_claims_forbidden_approval" CHECK (
    NOT ("kind" IN ('licensed_by', 'reference_only') AND "review_status" = 'approved')
  );

-- An approval by nobody in particular is not an approval. APPROVED_BY may reach
-- APPROVED only with a named body.
--
-- The other half of the rule — that SAM verification is recorded — is the
-- existence of a TechnicalReview row, which is a fact about a DIFFERENT table
-- and therefore invisible to a CHECK. It belongs to the review service in the
-- later API/admin gate, and is documented on the ProductClaim model so the
-- division is not left to be rediscovered.
ALTER TABLE "product_claims"
  ADD CONSTRAINT "product_claims_approved_by_named_body" CHECK (
    NOT ("kind" = 'approved_by'
         AND "review_status" = 'approved'
         AND ("standard_body" IS NULL OR length(btrim("standard_body")) = 0))
  );

-- A review is OF a Specification or OF a ProductClaim. Never both — that would
-- be one decision claiming to be two — and never neither, which would be a
-- decision about nothing.
ALTER TABLE "technical_reviews"
  ADD CONSTRAINT "technical_reviews_exactly_one_target" CHECK (
    (("specification_id" IS NOT NULL)::int + ("product_claim_id" IS NOT NULL)::int) = 1
  );

-- The fingerprint is a SHA-256 in lowercase hex or it is not a fingerprint.
-- Rejecting the wrong shape here is what stops a placeholder, a truncation or an
-- uppercase variant from silently becoming "the evidence this was approved on".
ALTER TABLE "technical_reviews"
  ADD CONSTRAINT "technical_reviews_evidence_set_hash_format" CHECK (
    "evidence_set_hash" ~ '^[0-9a-f]{64}$'
  );

-- A review names its reviewer, permanently. The FK is ON DELETE SET NULL so that
-- ADR-012's user deletion keeps working; this is what keeps the record true
-- afterwards, and an empty string would defeat it.
ALTER TABLE "technical_reviews"
  ADD CONSTRAINT "technical_reviews_reviewer_named" CHECK (
    length(btrim("reviewer_email_snapshot")) > 0
  );

-- ---------------------------------------------------------------------------
-- 6. VALIDATION — scan `specifications` and mark the two CHECKs valid.
--
-- Separate statements by design. If either fails, the whole migration aborts at
-- COMMIT and the constraint never becomes enforceable-and-trusted; a half state
-- where a constraint exists NOT VALID is not left behind.
-- ---------------------------------------------------------------------------
ALTER TABLE "specifications" VALIDATE CONSTRAINT "specifications_value_shape";
ALTER TABLE "specifications" VALIDATE CONSTRAINT "specifications_normalized_complete";

-- ---------------------------------------------------------------------------
-- 6b. THE EVIDENCE-SET HASH.
--
-- `TechnicalReview.evidence_set_hash` records exactly what a reviewer looked at.
-- Recomputing it later and getting a different answer means the evidence changed
-- after the approval — so the approval no longer describes the facts in front of
-- it and must not keep a row public. ACTING on that (refusing to serve, or
-- resetting the status) is review-service behaviour and belongs to the later
-- gate. Making it COMPUTABLE, deterministically and in one agreed way, is this
-- migration's job, and putting the definition in the database rather than in a
-- service is what stops two callers from disagreeing about it.
--
-- The definition, fixed:
--
--   1. every evidence link for the subject
--   2. per link, `<source_fact_id>:<sha256 of the SourceAsset behind that fact's
--      SourceDocument>`, with the empty string where no asset was captured
--   3. sorted by byte value ascending — so insertion order cannot change it
--   4. joined with newline, encoded UTF-8, SHA-256, lowercase hex
--
-- An empty evidence set hashes the empty string. That is a real, stable value
-- rather than NULL, which means "approved on no evidence at all" is recorded
-- distinguishably instead of being indistinguishable from "not computed".
--
-- `sha256()` is a PostgreSQL built-in since 11 — no pgcrypto, no extension, and
-- therefore nothing extra to install on the VPS that does not exist yet.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "evidence_set_hash_lines"(p_lines text[]) RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS $fn$
  SELECT encode(
           sha256(
             convert_to(coalesce(string_agg(l, E'\n' ORDER BY l), ''), 'UTF8')
           ),
           'hex'
         )
  FROM unnest(p_lines) AS l;
$fn$;

CREATE FUNCTION "specification_evidence_set_hash"(p_specification_id uuid) RETURNS text
  LANGUAGE sql
  STABLE
AS $fn$
  SELECT "evidence_set_hash_lines"(
           coalesce(
             array_agg(se."source_fact_id"::text || ':' || coalesce(sa."sha256", '')),
             ARRAY[]::text[]
           )
         )
  FROM "specification_evidence" se
  JOIN "source_facts" sf     ON sf."id" = se."source_fact_id"
  JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
  LEFT JOIN "source_assets" sa ON sa."id" = sd."source_asset_id"
  WHERE se."specification_id" = p_specification_id;
$fn$;

CREATE FUNCTION "product_claim_evidence_set_hash"(p_product_claim_id uuid) RETURNS text
  LANGUAGE sql
  STABLE
AS $fn$
  SELECT "evidence_set_hash_lines"(
           coalesce(
             array_agg(ce."source_fact_id"::text || ':' || coalesce(sa."sha256", '')),
             ARRAY[]::text[]
           )
         )
  FROM "claim_evidence" ce
  JOIN "source_facts" sf     ON sf."id" = ce."source_fact_id"
  JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
  LEFT JOIN "source_assets" sa ON sa."id" = sd."source_asset_id"
  WHERE ce."product_claim_id" = p_product_claim_id;
$fn$;

-- ---------------------------------------------------------------------------
-- 6c. SOURCE FACTS ARE IMMUTABLE.
--
-- A `source_facts` row records what a document SAID. A normalized Specification
-- can be corrected; what the source said cannot be, because a rewritable record
-- of a claim is not evidence of anything. A correction is a NEW SourceFact plus
-- a SUPERSEDED evidence role — the old reading stays readable, which is the
-- whole point of keeping it.
--
-- This also protects the evidence-set hash from the front: if a fact's raw value
-- could be edited in place, the hash would still match while the evidence
-- underneath it had changed, and the approval would look current when it was not.
--
-- ENABLE ALWAYS rather than plain ENABLE, following
-- 20260818140000_privacy_policy_version_immutable: a plain trigger is silently
-- skipped by a session that sets `session_replication_role = 'replica'`, which is
-- exactly the privileged bypass this must not have. Restores are unaffected —
-- pg_restore loads rows with COPY/INSERT and this fires only on UPDATE.
--
-- DELETE is deliberately NOT blocked here. The evidence tables reference
-- `source_facts` ON DELETE RESTRICT, so a fact that supports anything already
-- cannot be deleted; a fact that supports nothing is an import artefact, and
-- being unable to clear one would make a bad import permanent.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "source_facts_immutable"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'source_facts rows are immutable extracted evidence and cannot be updated'
    USING ERRCODE = 'restrict_violation',
          DETAIL  = format('source_facts row %s', OLD."id"),
          HINT    = 'Record a corrected reading as a NEW source_fact and mark the old evidence link SUPERSEDED. Never rewrite what a source stated.';
END
$fn$;

CREATE TRIGGER "source_facts_immutable_guard"
  BEFORE UPDATE ON "source_facts"
  FOR EACH ROW
  EXECUTE FUNCTION "source_facts_immutable"();

ALTER TABLE "source_facts"
  ENABLE ALWAYS TRIGGER "source_facts_immutable_guard";

-- ---------------------------------------------------------------------------
-- 7. PUBLICATION PROTECTION — the two public views.
--
-- These are the ONLY sanctioned public read surface for catalog technical data.
-- Each one is an explicit allow-list of columns over an explicit filter, and the
-- two halves of the filter are the two frozen rules: nothing is public before
-- SAM technical approval, and a retired fact stops being public.
--
--   * `review_status` itself is NOT selected. Neither is `created_at`,
--     `deleted_at`, or any column of any table in the provenance section. A
--     consumer of these views cannot learn that an unapproved row exists, cannot
--     learn where an approved one came from, and cannot reach a SourceDocument,
--     a SourceFact, a SourceAsset hash or an ImportRun through them. The views
--     join none of those tables, and no future view may.
--   * The legacy `key` / `value` columns are NOT selected either. They are the
--     old untyped surface, served directly by the existing catalog API; this
--     view is the normalized one, and mixing the two would let an unreviewed
--     legacy string ride out on a row that was approved for something else.
--
-- WITH CASCADED CHECK OPTION does real work rather than decorating: a simple
-- single-table view is auto-updatable in PostgreSQL, so without it these views
-- would be a writable path that could set rows to states the filter excludes.
-- With it, any write attempted through a view must still satisfy that view's
-- WHERE clause — so neither view can ever be used to publish an unapproved row,
-- a soft-deleted one, or a forbidden claim kind.
-- ---------------------------------------------------------------------------
CREATE VIEW "v_specification_public" AS
SELECT
  s."id",
  s."product_id",
  s."product_grade_id",
  s."property_key",
  s."display_value",
  s."value_type",
  s."numeric_min",
  s."numeric_max",
  s."pair_first",
  s."pair_second",
  s."unit",
  s."method",
  s."qualifier",
  s."result_basis",
  s."sort_order"
FROM "specifications" s
WHERE s."review_status" = 'approved'
  AND s."deleted_at" IS NULL
WITH CASCADED CHECK OPTION;

-- The claim view repeats the forbidden-kind exclusion that
-- `product_claims_forbidden_approval` already enforces on the table. That is
-- deliberate duplication: the CHECK is the invariant, and this is the second
-- lock on the door that publishes. If the CHECK were ever dropped by a future
-- migration, a LICENSED_BY row set to approved would still not reach the public
-- surface through this view.
CREATE VIEW "v_product_claim_public" AS
SELECT
  c."id",
  c."product_id",
  c."product_grade_id",
  c."kind",
  c."standard_body",
  c."standard_code",
  c."context_note",
  c."sort_order"
FROM "product_claims" c
WHERE c."review_status" = 'approved'
  AND c."deleted_at" IS NULL
  AND c."kind" NOT IN ('licensed_by', 'reference_only')
WITH CASCADED CHECK OPTION;

-- ---------------------------------------------------------------------------
-- 8. NO LEGACY-COLUMN REMOVAL.
--
-- `specifications`.`key`, `.value` and `.unit` still exist, still hold exactly
-- what they held before this migration ran, and are still what the shipped
-- catalog API reads. Retiring them requires evidence this gate does not have:
-- the 100 authoritative Products imported, every legacy row accounted for, and
-- every reader migrated. It is a later migration's decision, made with counts in
-- front of it, and nothing here presumes the outcome.
-- ---------------------------------------------------------------------------

COMMIT;
