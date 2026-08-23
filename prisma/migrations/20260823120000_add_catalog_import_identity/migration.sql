-- PRODUCT-DATA-2C-B1: persistent catalog identity and database-enforced import idempotency.
--
-- Additive only. No column is dropped, no type is narrowed, no existing row is rewritten, and
-- every new column is NULL on every row that exists today. The ten demo Products keep
-- `source_ref IS NULL` and remain untouched.
--
-- ── Why the three unique indexes exist ──────────────────────────────────────
--
-- A repeatable import needs every row it writes to have a database-enforced identity.
-- `product_grades`, `product_types`, `spec_properties`, `spec_property_mappings`,
-- `source_assets`, `source_documents`, `product_segments` and both evidence tables already
-- have one. `specifications`, `source_facts` and `product_claims` had only a surrogate
-- primary key, so a replay would have inserted 1,398 + 1,661 + 148 duplicates and the
-- database would have accepted every one of them. Deterministic UUIDs alone would have made
-- that an application-level convention rather than an invariant; these make it an invariant.
--
-- Every key below was measured against the ratified plan before being written:
--   specifications  1398 / 1398 distinct
--   source_facts    1661 / 1661 distinct  (1,676 references; 15 cells support both a value
--                                          and a claim, which is ADR-014 §6 by design)
--   product_claims   148 /  148 distinct

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Product.source_ref — the ratified catalog identity
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "products" ADD COLUMN "source_ref" VARCHAR(64);

-- Unique when present. A unique index treats NULLs as distinct, so the ten demo Products
-- and any future non-catalog Product coexist freely while one ratified identity can name at
-- most one row.
CREATE UNIQUE INDEX "products_source_ref_key" ON "products"("source_ref");

-- Shape only: non-blank, untrimmed-whitespace rejected, bounded.
--
-- Deliberately NOT a pattern match on `SAMCAT-…`. No ADR freezes the ratified identity
-- FORMAT — ADR-011 and PRODUCT-DATA-2C-A freeze that the string is OPAQUE, which is the
-- opposite of constraining its shape. A regex here would reject a future lineage the owner
-- ratifies and would have to be migrated away under pressure.
ALTER TABLE "products" ADD CONSTRAINT "products_source_ref_shape" CHECK (
  "source_ref" IS NULL
  OR (
    length("source_ref") BETWEEN 1 AND 64
    AND "source_ref" = btrim("source_ref")
    AND btrim("source_ref") <> ''
  )
);

-- No silent rewrite. Once a Product carries a ratified identity, that identity is the row's
-- permanent name: it may be assigned (NULL -> value) but never changed to a different value
-- and never cleared. A rewrite would move a hundred products' facts, evidence and approvals
-- without anything in the audit trail recording that it happened.
CREATE OR REPLACE FUNCTION "products_source_ref_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."source_ref" IS NOT NULL AND NEW."source_ref" IS DISTINCT FROM OLD."source_ref" THEN
    RAISE EXCEPTION
      'products.source_ref is immutable once set: % cannot become %',
      OLD."source_ref", coalesce(NEW."source_ref", 'NULL')
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_source_ref_immutable_guard"
BEFORE UPDATE ON "products"
FOR EACH ROW
EXECUTE FUNCTION "products_source_ref_immutable"();

ALTER TABLE "products" ENABLE ALWAYS TRIGGER "products_source_ref_immutable_guard";

COMMENT ON COLUMN "products"."source_ref" IS
  'INTERNAL ratified catalog identity (e.g. SAMCAT-W1-R003). Never public: excluded from '
  'every Product DTO, the catalog API, the sitemap, web and the CMS. Opaque after '
  'ratification - never derived from slug, name or worksheet row. Immutable once set.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Specification identity
-- ─────────────────────────────────────────────────────────────────────────────
--
-- One normalized value per subject and property. `NULLS NOT DISTINCT` is essential rather
-- than tidy: `product_grade_id` is NULL on all 487 Product-level rows, and under the default
-- NULLS DISTINCT the index would be silently inert for exactly those. Partial on
-- `deleted_at IS NULL` so retiring a row (ADR-014 §6 retires, never erases) does not block
-- re-importing the same fact later.
CREATE UNIQUE INDEX "specifications_import_identity_key"
  ON "specifications"("product_id", "product_grade_id", "property_key")
  NULLS NOT DISTINCT
  WHERE "deleted_at" IS NULL;

COMMENT ON INDEX "specifications_import_identity_key" IS
  'Import idempotency: one normalized Specification per (product, grade, property) among '
  'live rows. Without it a replay inserts a duplicate of every specification.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SourceFact identity
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The immutable evidence identity: which document, where in it, and what it said verbatim.
--
-- `import_run_id` is deliberately EXCLUDED. Including it would give every run its own copy of
-- all 1,661 facts and defeat the whole purpose. Excluding it makes an unchanged reading
-- converge on the row that already exists, while a CHANGED reading differs in `raw_value`
-- and correctly becomes a new fact — which is precisely ADR-014 §6's "a correction is a new
-- fact plus a SUPERSEDED evidence role".
--
-- Compatible with `source_facts_immutable_guard`: this index is reachable only by
-- `ON CONFLICT DO NOTHING`. `ON CONFLICT DO UPDATE` would fire the guard and abort, which is
-- the correct outcome and not something the importer may work around.
-- The `WHERE raw_value IS NOT NULL` predicate is ALWAYS TRUE — `raw_value` is NOT NULL on
-- this table — so the index covers every row. It is written as a partial index because
-- Prisma's datamodel cannot express either `NULLS NOT DISTINCT` or a partial predicate:
-- declared as a plain `@@unique` it would be created NULLS DISTINCT and would be inert for
-- the majority of facts, which carry a NULL page, column or unit. Left as a full index it is
-- reported as drift and the next `prisma migrate dev` offers to drop it. Partial keeps it
-- outside Prisma's index model, exactly as ADR-014's CHECKs, triggers and views already sit
-- outside it. Verified: `prisma migrate diff` reports no drift with this form.
CREATE UNIQUE INDEX "source_facts_evidence_identity_key"
  ON "source_facts"(
    "source_document_id", "page_number", "sheet_name", "row_number", "column_label",
    "raw_property", "raw_unit", "raw_value", "raw_method", "raw_grade"
  )
  NULLS NOT DISTINCT
  WHERE "raw_value" IS NOT NULL;

COMMENT ON INDEX "source_facts_evidence_identity_key" IS
  'Import idempotency: one SourceFact per verbatim reading per document location. Excludes '
  'import_run_id on purpose, so a replay converges instead of duplicating 1,661 facts.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ProductClaim identity
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "product_claims" ADD COLUMN "claim_identity_hash" CHAR(64);

ALTER TABLE "product_claims" ADD CONSTRAINT "product_claims_identity_hash_shape" CHECK (
  "claim_identity_hash" IS NULL OR "claim_identity_hash" ~ '^[0-9a-f]{64}$'
);

-- The normalized columns cannot tell two real claims apart: three products state two
-- DIFFERENT suitabilities that both normalize to SUITABLE_FOR with a NULL body, code and
-- note. Keyed on the columns alone, 148 measured claims collapse to 145 and three genuine
-- claims are lost. The discriminator is the identity of the reading each claim came from.
--
-- `kind`, `standard_body` and `standard_code` stay in the key because one reading can
-- legitimately yield more than one claim — measured on four readings — so the fact identity
-- is not by itself unique within a product.
CREATE UNIQUE INDEX "product_claims_import_identity_key"
  ON "product_claims"(
    "product_id", "product_grade_id", "kind",
    "standard_body", "standard_code", "claim_identity_hash"
  )
  NULLS NOT DISTINCT
  WHERE "deleted_at" IS NULL;

COMMENT ON COLUMN "product_claims"."claim_identity_hash" IS
  'SHA-256 of the evidence identity of the reading this claim was normalized from. An '
  'IDENTITY discriminator, NOT an evidence link: ClaimEvidence remains the only statement '
  'of which facts support a claim. NULL for any claim not created by the importer.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ImportRun application identity
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "import_runs" ADD COLUMN "manifest_hash" CHAR(64);

ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_manifest_hash_shape" CHECK (
  "manifest_hash" IS NULL OR "manifest_hash" ~ '^[0-9a-f]{64}$'
);

-- One SUCCESSFUL application per manifest. Partial on `finished_at IS NOT NULL` so a run
-- that was rolled back or abandoned does not consume the hash and a retry stays possible,
-- while the same plan can never be recorded as having been applied twice.
CREATE UNIQUE INDEX "import_runs_applied_manifest_key"
  ON "import_runs"("manifest_hash")
  WHERE "finished_at" IS NOT NULL AND "manifest_hash" IS NOT NULL;

COMMENT ON COLUMN "import_runs"."manifest_hash" IS
  'Canonical manifest hash this run applied. Unique among finished runs, so one plan cannot '
  'be applied twice and recorded as two successes. NULL while a run is in flight.';
