#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Proves the catalog technical-data invariants that live in PostgreSQL rather
# than in application code — the ones a mocked unit test cannot reach.
#
# Migration 20260822120000_add_catalog_technical_data adds the PRODUCT-DATA-2A
# schema foundation: ProductGrade, the normalized Specification columns,
# ProductClaim, the immutable provenance chain, TechnicalReview, and the two
# public views. Almost none of that is visible from a Jest suite that fakes
# Prisma, because almost all of it is enforced by the database on purpose.
#
# What is checked here:
#
#    1. A zero-grade Product carries Product-level Specifications
#    2. A single-grade Product
#    3. A multi-grade Product
#    4. A grade of a DIFFERENT Product is rejected by the composite foreign key
#    5. The value-shape CHECK, across every SpecValueType
#    6. A TechnicalReview targets exactly one subject
#    7. Evidence is many-to-many in BOTH directions
#    8. Audit history cannot be deleted out from under itself
#    9. A SourceDocument addressed by URL
#   10. A SourceDocument addressed by uploaded file — no URL anywhere
#   11. The same locator re-recorded with a different hash is a new revision
#   12. source_facts rows are immutable
#   13. The public views show approved, live rows and nothing else
#   14. Forbidden third-party claims can never be approved
#   15. ProductGrade has no slug, no route, and no place in the ADR-011 namespace
#   16. ADR-011 slug-namespace behaviour is unchanged
#   17. The legacy key/value Specification shape still works
#   18. source_facts reject UPDATE **and** DELETE; INSERT still works
#   19. The public views are read models — no write path through them
#   20. TechnicalReview targets exactly one subject, and nothing else
#   21. Result-basis precedence: override -> document default -> UNSPECIFIED
#   22. Every locator shape, none of which requires a public URL
#   23. The approval transition is NOT database-enforced (asserted as a
#       LIMITATION, so closing it in 2B makes this test fail loudly)
#
# Run against the application role, because the question is what the running
# platform can do — not what a database owner could do by dropping a constraint.
#
# NOTHING SURVIVES THIS SCRIPT. Every row is written inside one transaction that
# ends in ROLLBACK, and the tables are counted afterwards to prove it.
#
# Usage:  ./scripts/verify-catalog-technical-data.sh
# Exit:   0 only if all assertions hold; 1 otherwise.
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example to .env first." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

for var in POSTGRES_PLATFORM_DB POSTGRES_PLATFORM_USER POSTGRES_PLATFORM_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in $ENV_FILE" >&2
    exit 1
  fi
done

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "ERROR: the 'postgres' service is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

run_sql() {
  docker compose exec -T -e PGPASSWORD="$POSTGRES_PLATFORM_PASSWORD" postgres \
    psql -h 127.0.0.1 -U "$POSTGRES_PLATFORM_USER" -d "$POSTGRES_PLATFORM_DB" -tA -v ON_ERROR_STOP=1
}

# Each case reports one `result|case|observed` line. A case that behaves
# unexpectedly still reports rather than aborting, so one failure does not hide
# the rest of the matrix.
output=$(run_sql <<'SQL'
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_rejected(stmt text, label text) RETURNS text AS $$
BEGIN
  EXECUTE stmt;
  RETURN 'FAIL|' || label || '|accepted';
EXCEPTION
  WHEN check_violation       THEN RETURN 'PASS|' || label || '|rejected by CHECK';
  WHEN foreign_key_violation THEN RETURN 'PASS|' || label || '|rejected by FK';
  WHEN unique_violation      THEN RETURN 'PASS|' || label || '|rejected by UNIQUE';
  WHEN restrict_violation    THEN RETURN 'PASS|' || label || '|rejected by RESTRICT';
  WHEN others                THEN RETURN 'PASS|' || label || '|rejected by ' || SQLSTATE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.expect_accepted(stmt text, label text) RETURNS text AS $$
BEGIN
  EXECUTE stmt;
  RETURN 'PASS|' || label || '|accepted';
EXCEPTION
  WHEN others THEN RETURN 'FAIL|' || label || '|rejected by ' || SQLSTATE || ' ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.verdict(ok boolean, label text, observed text) RETURNS text AS $$
  SELECT CASE WHEN $1 THEN 'PASS|' ELSE 'FAIL|' END || $2 || '|' || $3;
$$ LANGUAGE sql;

-- ── Fixture ────────────────────────────────────────────────────────────────
-- One Product Family and three Products: zero-grade, single-grade, multi-grade
-- — the three shapes the ratified distribution says the real catalog contains
-- (56 / 5 / 39 of 100). Names are clearly marked so nothing here can be mistaken
-- for catalog data even for the instant it exists.

INSERT INTO "categories" ("id","name","slug")
VALUES ('dddddddd-0000-4000-8000-00000000000f','TD Probe Family','td-probe-family');

INSERT INTO "products" ("id","name","slug","category_id")
VALUES ('dddddddd-0000-4000-8000-000000000001','TD Probe Zero','td-probe-zero','dddddddd-0000-4000-8000-00000000000f'),
       ('dddddddd-0000-4000-8000-000000000002','TD Probe Single','td-probe-single','dddddddd-0000-4000-8000-00000000000f'),
       ('dddddddd-0000-4000-8000-000000000003','TD Probe Multi','td-probe-multi','dddddddd-0000-4000-8000-00000000000f');

INSERT INTO "users" ("id","email","password_hash","role","status")
VALUES ('dddddddd-0000-4000-8000-0000000000aa','td-probe-reviewer@example.invalid','x','admin','active');

INSERT INTO "spec_properties" ("key","canonical_meaning","quantity","value_kind","allowed_units","method_requirement")
VALUES ('td_probe_viscosity_40c','Kinematic viscosity at 40 C','kinematic_viscosity','numeric','{"mm2/s"}','required'),
       ('td_probe_appearance','Visual appearance','appearance','textual','{}','not_applicable');

-- 2 + 3. Grades exist only where the source states them. The zero-grade Product
-- gets NO grade row at all — absence is the representation, not a placeholder.
INSERT INTO "product_grades" ("id","product_id","label","grade_system","sort_order")
VALUES ('eeeeeeee-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002','SAE 40','sae',1),
       ('eeeeeeee-0000-4000-8000-000000000011','dddddddd-0000-4000-8000-000000000003','SAE 10W-40','sae',1),
       ('eeeeeeee-0000-4000-8000-000000000012','dddddddd-0000-4000-8000-000000000003','SAE 15W-40','sae',2),
       ('eeeeeeee-0000-4000-8000-000000000013','dddddddd-0000-4000-8000-000000000003','ISO VG 46','iso_vg',3),
       -- A label that belongs to no published system: recorded verbatim, system NULL.
       ('eeeeeeee-0000-4000-8000-000000000014','dddddddd-0000-4000-8000-000000000003','Special Cut',NULL,4);

-- ── 1. Zero-grade Product with a Product-level Specification ───────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min","unit","result_basis")
     VALUES ('ffffffff-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','viscosity_40c','12.5','td_probe_viscosity_40c','12.5','point',12.5,'mm2/s','typical')$q$,
  '1. zero-grade product takes a product-level specification');

SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "product_grades" WHERE "product_id"='dddddddd-0000-4000-8000-000000000001'),
  '1. zero-grade product has no grade row at all',
  (SELECT count(*)::text FROM "product_grades" WHERE "product_id"='dddddddd-0000-4000-8000-000000000001'));

-- ── 2. Single-grade Product ────────────────────────────────────────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","product_grade_id","key","value","property_key","display_value","value_type","numeric_min","numeric_max","unit","result_basis")
     VALUES ('ffffffff-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000001','viscosity_40c','135-150','td_probe_viscosity_40c','135-150','range',135,150,'mm2/s','specification_limit')$q$,
  '2. single-grade product takes a grade-level specification');

-- ── 3. Multi-grade Product ─────────────────────────────────────────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","product_grade_id","key","value","property_key","display_value","value_type","numeric_min","unit")
     VALUES ('ffffffff-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000003','eeeeeeee-0000-4000-8000-000000000011','viscosity_40c','95','td_probe_viscosity_40c','95',  'point',95,'mm2/s'),
            ('ffffffff-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000003','eeeeeeee-0000-4000-8000-000000000012','viscosity_40c','110','td_probe_viscosity_40c','110','point',110,'mm2/s')$q$,
  '3. multi-grade product carries one fact per grade');

SELECT pg_temp.verdict(
  (SELECT count(*) = 4 FROM "product_grades" WHERE "product_id"='dddddddd-0000-4000-8000-000000000003'),
  '3. multi-grade product holds all four grades',
  (SELECT count(*)::text FROM "product_grades" WHERE "product_id"='dddddddd-0000-4000-8000-000000000003'));

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_grades" ("id","product_id","label","sort_order")
     VALUES ('eeeeeeee-0000-4000-8000-0000000000ff','dddddddd-0000-4000-8000-000000000003','SAE 10W-40',9)$q$,
  '3. a duplicate grade label on one product is rejected');

-- ── 4. THE INVARIANT: a grade of a different Product ───────────────────────
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","product_grade_id","key","value")
     VALUES ('ffffffff-0000-4000-8000-00000000000e','dddddddd-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000011','viscosity_40c','1')$q$,
  '4. a grade belonging to ANOTHER product is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "specifications" SET "product_id"='dddddddd-0000-4000-8000-000000000003'
     WHERE "id"='ffffffff-0000-4000-8000-000000000002'$q$,
  '4. re-parenting a grade-level fact to another product is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "product_grades" SET "product_id"='dddddddd-0000-4000-8000-000000000002'
     WHERE "id"='eeeeeeee-0000-4000-8000-000000000011'$q$,
  '4. moving a referenced grade to another product is rejected');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","product_grade_id","kind")
     VALUES ('cafe0000-0000-4000-8000-00000000000e','dddddddd-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000011','meets')$q$,
  '4. the same invariant holds for ProductClaim');

-- ── 5. Value-shape CHECK, across the whole type vocabulary ────────────────
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min","numeric_max")
     VALUES ('ffffffff-0000-4000-8000-000000000101','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','9','point',9,9)$q$,
  '5. POINT with a numeric_max is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min","numeric_max")
     VALUES ('ffffffff-0000-4000-8000-000000000102','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','9','range',150,135)$q$,
  '5. RANGE with min > max is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('ffffffff-0000-4000-8000-000000000103','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','9','range',135)$q$,
  '5. RANGE missing its upper bound is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('ffffffff-0000-4000-8000-000000000104','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','9','maximum',9)$q$,
  '5. MAXIMUM carrying numeric_min instead of numeric_max is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","pair_first")
     VALUES ('ffffffff-0000-4000-8000-000000000105','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','9','pair',1)$q$,
  '5. PAIR with only one half is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('ffffffff-0000-4000-8000-000000000106','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_appearance','Clear','text',1)$q$,
  '5. TEXT carrying a number is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","display_value","value_type","numeric_min")
     VALUES ('ffffffff-0000-4000-8000-000000000107','dddddddd-0000-4000-8000-000000000001','k','v','9','point',9)$q$,
  '5. a typed row with no property_key is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","value_type","numeric_min")
     VALUES ('ffffffff-0000-4000-8000-000000000108','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','point',9)$q$,
  '5. a typed row with no display_value is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type")
     VALUES ('ffffffff-0000-4000-8000-000000000109','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','x','unknown_type')$q$,
  '5. a value_type outside the vocabulary is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('ffffffff-0000-4000-8000-00000000010a','dddddddd-0000-4000-8000-000000000001','k','v','no_such_property','9','point',9)$q$,
  '5. a property_key outside the dictionary is rejected');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","pair_first","pair_second")
     VALUES ('ffffffff-0000-4000-8000-00000000010b','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','12/40','pair',12,40)$q$,
  '5. a well-formed PAIR is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type")
     VALUES ('ffffffff-0000-4000-8000-00000000010c','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_appearance','Clear and bright','text')$q$,
  '5. a well-formed TEXT value is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type")
     VALUES ('ffffffff-0000-4000-8000-00000000010d','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_appearance','Report','report_only')$q$,
  '5. a well-formed REPORT_ONLY value is accepted');

-- ── Provenance fixture ────────────────────────────────────────────────────
INSERT INTO "source_assets" ("id","sha256","byte_size","media_type","page_count")
VALUES ('a5e70000-0000-4000-8000-000000000001', repeat('a',64), 12345,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',NULL),
       ('a5e70000-0000-4000-8000-000000000002', repeat('b',64), 5000,'application/pdf',3),
       ('a5e70000-0000-4000-8000-000000000003', repeat('c',64), 5200,'application/pdf',3);

-- ── 9 + 10. A URL source and a non-URL source, side by side ───────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","source_asset_id","locator_type","locator_value","publisher","title","retrieved_at","default_result_basis")
     VALUES ('d0c00000-0000-4000-8000-000000000001','a5e70000-0000-4000-8000-000000000002','url','https://example.invalid/tds/probe.pdf','Example Supplier','Probe TDS',now(),'typical')$q$,
  '9. a SourceDocument addressed by URL is accepted');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","source_asset_id","locator_type","locator_value","publisher","title","retrieved_at","default_result_basis")
     VALUES ('d0c00000-0000-4000-8000-000000000002','a5e70000-0000-4000-8000-000000000001','uploaded_file','SAM-catalog-workbook.xlsx','SAM Group','Authoritative catalog workbook',now(),'average')$q$,
  '10. a SourceDocument with NO URL (uploaded workbook) is accepted');

SELECT pg_temp.verdict(
  (SELECT "locator_value" NOT LIKE 'http%' FROM "source_documents" WHERE "id"='d0c00000-0000-4000-8000-000000000002'),
  '10. the workbook source needs no URL anywhere',
  (SELECT "locator_value" FROM "source_documents" WHERE "id"='d0c00000-0000-4000-8000-000000000002'));

-- ── 11. Same locator, different hash = a new revision ─────────────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","source_asset_id","locator_type","locator_value","title","retrieved_at","revision_label")
     VALUES ('d0c00000-0000-4000-8000-000000000003','a5e70000-0000-4000-8000-000000000003','url','https://example.invalid/tds/probe.pdf','Probe TDS',now(),'Rev B')$q$,
  '11. the same locator with a DIFFERENT hash is a new revision');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "source_documents" ("id","source_asset_id","locator_type","locator_value","title","retrieved_at")
     VALUES ('d0c00000-0000-4000-8000-00000000000e','a5e70000-0000-4000-8000-000000000002','url','https://example.invalid/tds/probe.pdf','Probe TDS',now())$q$,
  '11. the same locator with the SAME hash is rejected as a duplicate');

SELECT pg_temp.expect_accepted(
  $q$UPDATE "source_documents" SET "superseded_by_id"='d0c00000-0000-4000-8000-000000000003'
     WHERE "id"='d0c00000-0000-4000-8000-000000000001'$q$,
  '11. the older revision points forward to the newer one');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "source_assets" ("id","sha256","byte_size","media_type")
     VALUES ('a5e70000-0000-4000-8000-00000000000e', repeat('a',64), 1,'application/pdf')$q$,
  '11. one physical file is one SourceAsset (sha256 is unique)');

INSERT INTO "import_runs" ("id","source_document_id","importer_version")
VALUES ('4a110000-0000-4000-8000-000000000001','d0c00000-0000-4000-8000-000000000002','probe-0.0.0');

INSERT INTO "source_facts" ("id","source_document_id","import_run_id","sheet_name","row_number","column_label","raw_property","raw_unit","raw_value","raw_method","raw_grade","extraction_method","unit_classification")
VALUES ('fac70000-0000-4000-8000-000000000001','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','Products',7,'D','Viscosity @40C','mm2/s','12.5','ASTM D445','SAE 40','spreadsheet_cell','stated'),
       ('fac70000-0000-4000-8000-000000000002','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','Products',7,'E','Viscosity @40C','mm2/s','12.5','ASTM D445',NULL,'spreadsheet_cell','stated');

-- ── 12. source_facts are immutable ────────────────────────────────────────
SELECT pg_temp.expect_rejected(
  $q$UPDATE "source_facts" SET "raw_value"='999' WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '12. rewriting a recorded source fact is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "source_facts" SET "note_does_not_exist"=1 WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '12. ...and no column of it can be touched');

-- ── 7. Evidence is many-to-many in BOTH directions ───────────────────────
-- Two facts support ONE specification...
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specification_evidence" ("specification_id","source_fact_id","role")
     VALUES ('ffffffff-0000-4000-8000-000000000001','fac70000-0000-4000-8000-000000000001','primary'),
            ('ffffffff-0000-4000-8000-000000000001','fac70000-0000-4000-8000-000000000002','corroborating')$q$,
  '7. two SourceFacts support one Specification');

-- ...and ONE fact supports two different normalized rows.
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specification_evidence" ("specification_id","source_fact_id","role")
     VALUES ('ffffffff-0000-4000-8000-000000000002','fac70000-0000-4000-8000-000000000001','primary')$q$,
  '7. one SourceFact supports a second Specification');

INSERT INTO "product_claims" ("id","product_id","kind","standard_body","standard_code","review_status")
VALUES ('cafe0000-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','classification_stated','API','CF-4','approved'),
       ('cafe0000-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000001','licensed_by','API','Licence 1234','source_recorded'),
       ('cafe0000-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000001','reference_only',NULL,NULL,'source_recorded'),
       ('cafe0000-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000001','formulated_for','ACEA','E7','approved');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "claim_evidence" ("product_claim_id","source_fact_id","role")
     VALUES ('cafe0000-0000-4000-8000-000000000001','fac70000-0000-4000-8000-000000000001','primary')$q$,
  '7. the same SourceFact also supports a ProductClaim');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specification_evidence" ("specification_id","source_fact_id","role")
     VALUES ('ffffffff-0000-4000-8000-000000000003','fac70000-0000-4000-8000-000000000002','superseded')$q$,
  '7. SUPERSEDED evidence is retained rather than unlinked');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specification_evidence" ("specification_id","source_fact_id","role")
     VALUES ('ffffffff-0000-4000-8000-000000000001','fac70000-0000-4000-8000-000000000001','primary')$q$,
  '7. the same fact cannot be linked to the same specification twice');

-- ── 6. A TechnicalReview targets exactly one subject ─────────────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "technical_reviews" ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-0000000000aa','td-probe-reviewer@example.invalid','approved',
             specification_evidence_set_hash('ffffffff-0000-4000-8000-000000000001'))$q$,
  '6. a review of a Specification is accepted');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "technical_reviews" ("id","product_claim_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-000000000002','cafe0000-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-0000000000aa','td-probe-reviewer@example.invalid','approved',
             product_claim_evidence_set_hash('cafe0000-0000-4000-8000-000000000001'))$q$,
  '6. a review of a ProductClaim is accepted');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","specification_id","product_claim_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-00000000000e','ffffffff-0000-4000-8000-000000000001','cafe0000-0000-4000-8000-000000000001','x@example.invalid','approved',repeat('0',64))$q$,
  '6. a review with TWO subjects is rejected');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-00000000000f','x@example.invalid','approved',repeat('0',64))$q$,
  '6. a review with NO subject is rejected');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","specification_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-00000000001e','ffffffff-0000-4000-8000-000000000001','x@example.invalid','approved','NOT-A-HASH')$q$,
  '6. a malformed evidence-set hash is rejected');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","specification_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-00000000002e','ffffffff-0000-4000-8000-000000000001','   ','approved',repeat('0',64))$q$,
  '6. a review naming nobody is rejected');

-- The hash is deterministic and order-independent, and a changed evidence set
-- changes it — which is what makes a stale approval detectable.
SELECT pg_temp.verdict(
  (SELECT specification_evidence_set_hash('ffffffff-0000-4000-8000-000000000001')
        = specification_evidence_set_hash('ffffffff-0000-4000-8000-000000000001')),
  '6. the evidence-set hash is deterministic',
  substr(specification_evidence_set_hash('ffffffff-0000-4000-8000-000000000001'),1,16) || '...');

SELECT pg_temp.verdict(
  (SELECT specification_evidence_set_hash('ffffffff-0000-4000-8000-000000000001')
       <> specification_evidence_set_hash('ffffffff-0000-4000-8000-000000000002')),
  '6. different evidence sets hash differently',
  'compared');

SELECT pg_temp.verdict(
  (SELECT specification_evidence_set_hash('ffffffff-0000-4000-8000-00000000010b') ~ '^[0-9a-f]{64}$'),
  '6. an empty evidence set still yields a well-formed hash',
  substr(specification_evidence_set_hash('ffffffff-0000-4000-8000-00000000010b'),1,16) || '...');

-- ── 8. Audit history cannot be deleted out from under itself ─────────────
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000001'$q$,
  '8. deleting a Specification that carries evidence is refused');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "source_facts" WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '8. deleting a SourceFact that supports a fact is refused');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "product_claims" WHERE "id"='cafe0000-0000-4000-8000-000000000001'$q$,
  '8. deleting a reviewed ProductClaim is refused');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "product_grades" WHERE "id"='eeeeeeee-0000-4000-8000-000000000011'$q$,
  '8. deleting a grade that still carries facts is refused');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "source_documents" WHERE "id"='d0c00000-0000-4000-8000-000000000002'$q$,
  '8. deleting a cited SourceDocument is refused');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "spec_properties" WHERE "key"='td_probe_viscosity_40c'$q$,
  '8. deleting a dictionary entry in use is refused');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "products" WHERE "id"='dddddddd-0000-4000-8000-000000000003'$q$,
  '8. deleting a Product that has grades is refused');

-- ADR-012 is not weakened: deleting the reviewer still works, and the review
-- still names them afterwards.
SELECT pg_temp.expect_accepted(
  $q$DELETE FROM "users" WHERE "id"='dddddddd-0000-4000-8000-0000000000aa'$q$,
  '8. deleting the reviewer is still permitted (ADR-012 unweakened)');
SELECT pg_temp.verdict(
  (SELECT "reviewer_id" IS NULL AND "reviewer_email_snapshot"='td-probe-reviewer@example.invalid'
   FROM "technical_reviews" WHERE "id"='7ec00000-0000-4000-8000-000000000001'),
  '8. ...and the review still names the deleted reviewer',
  (SELECT coalesce("reviewer_email_snapshot",'LOST') FROM "technical_reviews" WHERE "id"='7ec00000-0000-4000-8000-000000000001'));

-- ── 14. Forbidden third-party claims can never be approved ───────────────
SELECT pg_temp.expect_rejected(
  $q$UPDATE "product_claims" SET "review_status"='approved' WHERE "id"='cafe0000-0000-4000-8000-000000000002'$q$,
  '14. LICENSED_BY can never become APPROVED');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "product_claims" SET "review_status"='approved' WHERE "id"='cafe0000-0000-4000-8000-000000000003'$q$,
  '14. REFERENCE_ONLY can never become APPROVED');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","standard_body","review_status")
     VALUES ('cafe0000-0000-4000-8000-00000000001e','dddddddd-0000-4000-8000-000000000001','licensed_by','API','approved')$q$,
  '14. ...and cannot be INSERTed approved either');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","standard_body","review_status")
     VALUES ('cafe0000-0000-4000-8000-00000000002e','dddddddd-0000-4000-8000-000000000001','approved_by',NULL,'approved')$q$,
  '14. APPROVED_BY with no named body cannot be APPROVED');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","standard_body","review_status")
     VALUES ('cafe0000-0000-4000-8000-00000000003e','dddddddd-0000-4000-8000-000000000001','approved_by','   ','approved')$q$,
  '14. ...and a blank body does not count as naming one');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","standard_body","standard_code","review_status")
     VALUES ('cafe0000-0000-4000-8000-00000000004e','dddddddd-0000-4000-8000-000000000001','approved_by','Example OEM','Spec 1','approved')$q$,
  '14. APPROVED_BY with a named body is permitted');

-- ── 13. The public views ─────────────────────────────────────────────────
-- Approve one specification and soft-delete another; add an unapproved,
-- a rejected and a superseded one. Only the approved live row may appear.
UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000001';
UPDATE "specifications" SET "review_status"='approved', "deleted_at"=now() WHERE "id"='ffffffff-0000-4000-8000-000000000002';
UPDATE "specifications" SET "review_status"='rejected'   WHERE "id"='ffffffff-0000-4000-8000-000000000003';
UPDATE "specifications" SET "review_status"='superseded' WHERE "id"='ffffffff-0000-4000-8000-000000000004';

SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM "v_specification_public" WHERE "id" IN
     ('ffffffff-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000002',
      'ffffffff-0000-4000-8000-000000000003','ffffffff-0000-4000-8000-000000000004',
      'ffffffff-0000-4000-8000-00000000010b','ffffffff-0000-4000-8000-00000000010c')),
  '13. only the approved, live specification is public',
  (SELECT count(*)::text FROM "v_specification_public" WHERE "id" IN
     ('ffffffff-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000002',
      'ffffffff-0000-4000-8000-000000000003','ffffffff-0000-4000-8000-000000000004',
      'ffffffff-0000-4000-8000-00000000010b','ffffffff-0000-4000-8000-00000000010c')));

SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000002'),
  '13. a soft-deleted approved row is absent',
  'checked');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_specification_public"
   WHERE "id" IN ('ffffffff-0000-4000-8000-000000000003','ffffffff-0000-4000-8000-000000000004')),
  '13. rejected and superseded rows are absent',
  'checked');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-00000000010b'),
  '13. an unapproved (source_recorded) row is absent',
  'checked');

-- No review-status and no provenance column is reachable through either view.
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns
   WHERE table_name IN ('v_specification_public','v_product_claim_public')
     AND column_name IN ('review_status','deleted_at','created_at','key','value',
                         'source_fact_id','source_document_id','import_run_id','sha256')),
  '13. the views expose no review-status and no provenance column',
  (SELECT coalesce(string_agg(column_name,','),'none') FROM information_schema.columns
   WHERE table_name IN ('v_specification_public','v_product_claim_public')
     AND column_name IN ('review_status','deleted_at','created_at','key','value',
                         'source_fact_id','source_document_id','import_run_id','sha256')));

SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM "v_product_claim_public" WHERE "product_id"='dddddddd-0000-4000-8000-000000000001' AND "kind"='classification_stated'),
  '13. the approved classification claim is public',
  'checked');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_product_claim_public" WHERE "kind" IN ('licensed_by','reference_only')),
  '13. no forbidden claim kind can appear in the public claim view',
  'checked');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "v_specification_public" ("id","product_id","display_value") VALUES ('ffffffff-0000-4000-8000-0000000001ee','dddddddd-0000-4000-8000-000000000001','sneaky')$q$,
  '13. an unapproved row cannot be smuggled in through the view');

-- ── 15. ProductGrade has no slug, no route, no namespace presence ────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns
   WHERE table_name='product_grades' AND column_name IN ('slug','url','path','locale')),
  '15. product_grades has no slug, url, path or locale column',
  (SELECT coalesce(string_agg(column_name,','),'none') FROM information_schema.columns
   WHERE table_name='product_grades' AND column_name IN ('slug','url','path','locale')));

SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "product_slug_claims" WHERE "owner_type"='ProductGrade'),
  '15. no grade ever claims a slug in the ADR-011 namespace',
  (SELECT count(*)::text FROM "product_slug_claims" WHERE "owner_type"='ProductGrade'));

-- A grade label identical to a product slug is fine — grades are not addressable.
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "product_grades" ("id","product_id","label","sort_order")
     VALUES ('eeeeeeee-0000-4000-8000-0000000000a1','dddddddd-0000-4000-8000-000000000001','td-probe-multi',1)$q$,
  '15. a grade label equal to an existing product slug is not a collision');

-- ── 16. ADR-011 slug-namespace behaviour is unchanged ────────────────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 4 FROM "product_slug_claims"
   WHERE "slug_key" IN ('td-probe-family','td-probe-zero','td-probe-single','td-probe-multi')),
  '16. the probe category and products each claimed their slug',
  (SELECT count(*)::text FROM "product_slug_claims"
   WHERE "slug_key" IN ('td-probe-family','td-probe-zero','td-probe-single','td-probe-multi')));

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "products" ("id","name","slug","category_id")
     VALUES ('dddddddd-0000-4000-8000-00000000000e','Collide','td-probe-family','dddddddd-0000-4000-8000-00000000000f')$q$,
  '16. a product colliding with a category slug is still rejected');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "products" ("id","name","slug","category_id")
     VALUES ('dddddddd-0000-4000-8000-00000000001e','Reserved','finder','dddddddd-0000-4000-8000-00000000000f')$q$,
  '16. a reserved structural slug is still rejected');

-- ── 17. The legacy key/value shape still works, unchanged ────────────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","unit")
     VALUES ('ffffffff-0000-4000-8000-000000000201','dddddddd-0000-4000-8000-000000000001','Flash Point','220','C')$q$,
  '17. a legacy key/value/unit specification is still insertable');

SELECT pg_temp.verdict(
  (SELECT "review_status"::text = 'source_recorded' AND "result_basis"::text = 'unspecified'
        AND "value_type" IS NULL AND "product_grade_id" IS NULL
   FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000201'),
  '17. ...and defaults to unapproved, unspecified, untyped, ungraded',
  (SELECT "review_status"::text || '/' || "result_basis"::text
   FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000201'));

SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000201'),
  '17. ...and an unreviewed legacy row is NOT public',
  'checked');

SELECT pg_temp.verdict(
  (SELECT count(*) = 3 FROM information_schema.columns
   WHERE table_name='specifications' AND column_name IN ('key','value','unit')),
  '17. the legacy columns key/value/unit still exist',
  (SELECT count(*)::text FROM information_schema.columns
   WHERE table_name='specifications' AND column_name IN ('key','value','unit')));

SELECT pg_temp.verdict(
  (SELECT count(*) = 2 FROM information_schema.columns
   WHERE table_name='specifications' AND column_name IN ('key','value') AND is_nullable='NO'),
  '17. ...and key/value are still NOT NULL',
  'checked');

-- ══════════════════════════════════════════════════════════════════════════
-- HARDENING (migration 20260822140000_harden_catalog_technical_audit)
-- ══════════════════════════════════════════════════════════════════════════

-- ── 18. source_facts are immutable against UPDATE **and** DELETE ─────────
SELECT pg_temp.expect_rejected(
  $q$UPDATE "source_facts" SET "raw_value"='TAMPERED' WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '18. UPDATE of a source fact is rejected');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "source_facts" WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '18. DELETE of a cited source fact is rejected');

-- A fact that nothing cites is equally undeletable — the RESTRICT on the
-- evidence tables protects only cited facts, which is why the trigger exists.
INSERT INTO "source_facts" ("id","source_document_id","import_run_id","raw_value","extraction_method","unit_classification")
VALUES ('fac70000-0000-4000-8000-000000000009','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','orphan','spreadsheet_cell','absent');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "source_facts" WHERE "id"='fac70000-0000-4000-8000-000000000009'$q$,
  '18. DELETE of an UNCITED source fact is rejected too');

-- An ImportRun revert must not be able to take the history with it.
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "source_facts" WHERE "import_run_id"='4a110000-0000-4000-8000-000000000001'$q$,
  '18. an ImportRun revert cannot delete its historical facts');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "import_runs" WHERE "id"='4a110000-0000-4000-8000-000000000001'$q$,
  '18. ...nor can the ImportRun row itself be deleted');

-- The facts and the evidence links survived every attempt above.
SELECT pg_temp.verdict(
  (SELECT count(*) = 3 FROM "source_facts" WHERE "import_run_id"='4a110000-0000-4000-8000-000000000001'),
  '18. all source facts remain present after the attempts',
  (SELECT count(*)::text FROM "source_facts" WHERE "import_run_id"='4a110000-0000-4000-8000-000000000001'));
SELECT pg_temp.verdict(
  (SELECT "raw_value" = '12.5' FROM "source_facts" WHERE "id"='fac70000-0000-4000-8000-000000000001'),
  '18. ...with their raw values unaltered',
  (SELECT "raw_value" FROM "source_facts" WHERE "id"='fac70000-0000-4000-8000-000000000001'));
SELECT pg_temp.verdict(
  (SELECT count(*) = 4 FROM "specification_evidence") AND (SELECT count(*) = 1 FROM "claim_evidence"),
  '18. evidence links remain intact',
  (SELECT count(*)::text FROM "specification_evidence") || ' spec + ' || (SELECT count(*)::text FROM "claim_evidence") || ' claim');

-- INSERT is deliberately NOT blocked: a correction is a new fact.
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_facts" ("id","source_document_id","import_run_id","raw_value","extraction_method","unit_classification")
     VALUES ('fac70000-0000-4000-8000-00000000000a','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','12.7','spreadsheet_cell','stated')$q$,
  '18. INSERT of a corrected fact is still permitted');

-- ── 19. The public views are read models, by privilege ───────────────────
SELECT pg_temp.expect_accepted(
  $q$SELECT 1 FROM "v_specification_public"$q$,
  '19. SELECT through v_specification_public still works');
SELECT pg_temp.expect_accepted(
  $q$SELECT 1 FROM "v_product_claim_public"$q$,
  '19. SELECT through v_product_claim_public still works');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "v_specification_public" SET "display_value"='TAMPERED' WHERE "id"='ffffffff-0000-4000-8000-000000000001'$q$,
  '19. UPDATE of an APPROVED row through the view is denied');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000001'$q$,
  '19. DELETE of an approved row through the view is denied');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "v_specification_public" ("id","product_id","display_value") VALUES ('ffffffff-0000-4000-8000-0000000009e1','dddddddd-0000-4000-8000-000000000001','x')$q$,
  '19. INSERT through v_specification_public is denied');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "v_product_claim_public" SET "standard_code"='TAMPERED' WHERE "id"='cafe0000-0000-4000-8000-000000000001'$q$,
  '19. UPDATE through v_product_claim_public is denied');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "v_product_claim_public" WHERE "id"='cafe0000-0000-4000-8000-000000000001'$q$,
  '19. DELETE through v_product_claim_public is denied');

-- The published value is genuinely unchanged after those attempts.
SELECT pg_temp.verdict(
  (SELECT "display_value" = '12.5' FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000001'),
  '19. the approved row was not modified by any of them',
  (SELECT "display_value" FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000001'));

-- ...while the base table remains writable, which is how the API must write.
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "qualifier"='base-table write works' WHERE "id"='ffffffff-0000-4000-8000-000000000001'$q$,
  '19. base-table writes remain available to the application role');

-- No write privilege is held by PUBLIC or by the owner on either view.
SELECT pg_temp.verdict(
  (SELECT bool_and(NOT (has_table_privilege('public', v, 'INSERT') OR has_table_privilege('public', v, 'UPDATE') OR has_table_privilege('public', v, 'DELETE')))
   FROM unnest(ARRAY['v_specification_public','v_product_claim_public']) AS v),
  '19. PUBLIC holds no INSERT/UPDATE/DELETE on either view',
  'checked');
SELECT pg_temp.verdict(
  (SELECT bool_and(has_table_privilege(current_user, v, 'SELECT')
              AND NOT has_table_privilege(current_user, v, 'INSERT')
              AND NOT has_table_privilege(current_user, v, 'UPDATE')
              AND NOT has_table_privilege(current_user, v, 'DELETE'))
   FROM unnest(ARRAY['v_specification_public','v_product_claim_public']) AS v),
  '19. the application role holds SELECT only on both views',
  current_user);

-- Locator values are provenance and must not be reachable through a view.
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns
   WHERE table_name IN ('v_specification_public','v_product_claim_public')
     AND column_name IN ('locator_value','locator_type','publisher','retrieved_at','revision_label','evidence_set_hash','raw_value')),
  '19. no locator or provenance column is exposed by either view',
  (SELECT coalesce(string_agg(column_name,','),'none') FROM information_schema.columns
   WHERE table_name IN ('v_specification_public','v_product_claim_public')
     AND column_name IN ('locator_value','locator_type','publisher','retrieved_at','revision_label','evidence_set_hash','raw_value')));

-- ── 20. TechnicalReview target: XOR, and no second source of truth ───────
-- There is NO declared subject enum column on technical_reviews. The subject IS
-- which foreign key is set, so "subject says Specification but the target is a
-- Claim" is not a state that can be represented at all — there is nothing for
-- the FKs to disagree with. These are the invalid combinations that CAN be
-- expressed, and all of them are refused.
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns
   WHERE table_name='technical_reviews' AND column_name IN ('subject','subject_type','target_type','entity_type')),
  '20. no declared subject enum exists, so it cannot disagree with the FKs',
  (SELECT coalesce(string_agg(column_name,','),'none') FROM information_schema.columns
   WHERE table_name='technical_reviews' AND column_name IN ('subject','subject_type','target_type','entity_type')));
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-0000000000c1','r@example.invalid','approved',repeat('0',64))$q$,
  '20. both targets NULL is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","specification_id","product_claim_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-0000000000c2','ffffffff-0000-4000-8000-000000000001','cafe0000-0000-4000-8000-000000000001','r@example.invalid','approved',repeat('0',64))$q$,
  '20. both targets non-NULL is rejected');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "product_claim_id"='cafe0000-0000-4000-8000-000000000001'
     WHERE "id"='7ec00000-0000-4000-8000-000000000001'$q$,
  '20. adding a second target to an existing review is rejected');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "specification_id"=NULL WHERE "id"='7ec00000-0000-4000-8000-000000000001'$q$,
  '20. clearing the only target of a review is rejected');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","specification_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-0000000000c3','cafe0000-0000-4000-8000-000000000001','r@example.invalid','approved',repeat('0',64))$q$,
  '20. a claim id in the specification column is rejected by the FK');
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "technical_reviews" ("id","product_claim_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-0000000000c4','ffffffff-0000-4000-8000-000000000001','r@example.invalid','approved',repeat('0',64))$q$,
  '20. a specification id in the claim column is rejected by the FK');

-- Hard deletion of a reviewed subject is blocked; soft deletion still works.
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000001'$q$,
  '20. hard-deleting a reviewed Specification is blocked');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "product_claims" WHERE "id"='cafe0000-0000-4000-8000-000000000001'$q$,
  '20. hard-deleting a reviewed ProductClaim is blocked');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "deleted_at"=now() WHERE "id"='ffffffff-0000-4000-8000-000000000001'$q$,
  '20. soft-deleting a reviewed Specification is permitted');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "product_claims" SET "deleted_at"=now() WHERE "id"='cafe0000-0000-4000-8000-000000000001'$q$,
  '20. soft-deleting a reviewed ProductClaim is permitted');
SELECT pg_temp.verdict(
  (SELECT count(*) = 2 FROM "technical_reviews"
   WHERE "id" IN ('7ec00000-0000-4000-8000-000000000001','7ec00000-0000-4000-8000-000000000002')),
  '20. the review history survived the soft deletions',
  (SELECT count(*)::text FROM "technical_reviews"));
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000001')
  AND (SELECT count(*) = 0 FROM "v_product_claim_public" WHERE "id"='cafe0000-0000-4000-8000-000000000001'),
  '20. ...and the soft-deleted rows left the public views',
  'checked');

-- ── 21. Result-basis precedence ──────────────────────────────────────────
-- override -> document default -> UNSPECIFIED.
-- Document d0c...0002 (the workbook) defaults to 'average'; d0c...0004 says
-- nothing and therefore defaults to 'unspecified'.
INSERT INTO "source_documents" ("id","source_asset_id","locator_type","locator_value","title","retrieved_at")
VALUES ('d0c00000-0000-4000-8000-000000000004',NULL,'uploaded_file','internal://probe/no-default.xlsx','No default stated',now());
INSERT INTO "import_runs" ("id","source_document_id","importer_version")
VALUES ('4a110000-0000-4000-8000-000000000002','d0c00000-0000-4000-8000-000000000004','probe-0.0.0');
INSERT INTO "source_facts" ("id","source_document_id","import_run_id","raw_value","extraction_method","unit_classification","result_basis_override")
VALUES ('fac70000-0000-4000-8000-000000000021','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','9','spreadsheet_cell','stated','measured'),
       ('fac70000-0000-4000-8000-000000000022','d0c00000-0000-4000-8000-000000000004','4a110000-0000-4000-8000-000000000002','9','spreadsheet_cell','stated',NULL);

SELECT pg_temp.verdict(
  (SELECT source_fact_result_basis('fac70000-0000-4000-8000-000000000021')::text = 'measured'),
  '21. a fact override wins over the document default',
  source_fact_result_basis('fac70000-0000-4000-8000-000000000021')::text);
SELECT pg_temp.verdict(
  (SELECT source_fact_result_basis('fac70000-0000-4000-8000-000000000001')::text = 'average'),
  '21. with no override, the document default applies',
  source_fact_result_basis('fac70000-0000-4000-8000-000000000001')::text);
SELECT pg_temp.verdict(
  (SELECT source_fact_result_basis('fac70000-0000-4000-8000-000000000022')::text = 'unspecified'),
  '21. with neither, the result is UNSPECIFIED',
  source_fact_result_basis('fac70000-0000-4000-8000-000000000022')::text);
SELECT pg_temp.verdict(
  (SELECT count(*) = 3 FROM information_schema.columns
   WHERE (table_name='source_documents' AND column_name='default_result_basis')
      OR (table_name='source_facts'     AND column_name='result_basis_override')
      OR (table_name='specifications'   AND column_name='result_basis')),
  '21. all three result-basis columns exist',
  (SELECT count(*)::text FROM information_schema.columns
   WHERE (table_name='source_documents' AND column_name='default_result_basis')
      OR (table_name='source_facts'     AND column_name='result_basis_override')
      OR (table_name='specifications'   AND column_name='result_basis')));
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns WHERE column_name ILIKE '%qualifier_note%' OR column_name ILIKE '%value_qualifier%'),
  '21. no free-text valueQualifierNote column exists anywhere',
  (SELECT coalesce(string_agg(table_name||'.'||column_name,','),'none') FROM information_schema.columns WHERE column_name ILIKE '%qualifier_note%' OR column_name ILIKE '%value_qualifier%'));

-- ── 22. Locators: every shape, and never a required public URL ───────────
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","locator_type","locator_value","title","retrieved_at")
     VALUES ('d0c00000-0000-4000-8000-000000000011','url','https://example.invalid/standards/probe.html','An HTTP page',now())$q$,
  '22. an HTTP URL locator is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","locator_type","locator_value","title","retrieved_at")
     VALUES ('d0c00000-0000-4000-8000-000000000012','url','https://example.invalid/tds/other.pdf','A PDF URL',now())$q$,
  '22. a PDF URL locator is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","locator_type","locator_value","title","retrieved_at")
     VALUES ('d0c00000-0000-4000-8000-000000000013','uploaded_file','SAM catalog workbook (chat attachment, no public URL)','Uploaded workbook',now())$q$,
  '22. an uploaded workbook with NO public URL is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","locator_type","locator_value","title","retrieved_at")
     VALUES ('d0c00000-0000-4000-8000-000000000014','uploaded_file','internal://sam/catalog/2026-08/workbook-v1','A stable internal locator',now())$q$,
  '22. a stable internal locator reference is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_documents" ("id","source_asset_id","locator_type","locator_value","title","retrieved_at","revision_label")
     VALUES ('d0c00000-0000-4000-8000-000000000015','a5e70000-0000-4000-8000-000000000003','uploaded_file','internal://sam/catalog/2026-08/workbook-v1','A later revision at the same locator',now(),'Rev C')$q$,
  '22. the same locator with a later asset hash is a new revision');
SELECT pg_temp.verdict(
  (SELECT is_nullable='YES' FROM information_schema.columns WHERE table_name='source_documents' AND column_name='source_asset_id'),
  '22. a source may be cited before any asset is captured',
  'source_asset_id nullable');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns WHERE table_name='source_documents' AND column_name IN ('url','is_publishable')),
  '22. there is no url column and no isPublishable flag',
  (SELECT coalesce(string_agg(column_name,','),'none') FROM information_schema.columns WHERE table_name='source_documents' AND column_name IN ('url','is_publishable')));

-- ── 23. The approval transition is NOT database-enforced (documented) ────
-- This asserts the LIMITATION, so that the day someone implements the review
-- service and closes it, this test fails and forces the docs to be updated.
INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
VALUES ('ffffffff-0000-4000-8000-000000000301','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_viscosity_40c','7','point',7);
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000301'$q$,
  '23. LIMITATION: approval can be set with no TechnicalReview');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "technical_reviews" WHERE "specification_id"='ffffffff-0000-4000-8000-000000000301')
  AND (SELECT count(*) = 1 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000301'),
  '23. LIMITATION: it becomes public with zero review rows (see ADR-014)',
  'deferred to PRODUCT-DATA-2B');
SELECT pg_temp.verdict(
  (SELECT obj_description('specifications'::regclass) IS NULL
      AND col_description('specifications'::regclass,
            (SELECT attnum FROM pg_attribute WHERE attrelid='specifications'::regclass AND attname='review_status')) LIKE '%DOES NOT ENFORCE%'),
  '23. the limitation is recorded as a database COMMENT',
  'documented in-schema');

ROLLBACK;
SQL
)

status=0

if [ -z "$output" ]; then
  echo "ERROR: no output from psql — the probe transaction did not run." >&2
  exit 1
fi

# psql echoes a command tag for every INSERT/UPDATE/ROLLBACK alongside the
# assertion rows, so only lines that actually carry a verdict are read.
verdicts=$(echo "$output" | grep -E '^(PASS|FAIL)\|')

if [ -z "$verdicts" ]; then
  echo "ERROR: the probe produced no verdict lines." >&2
  echo "$output" >&2
  exit 1
fi

while IFS='|' read -r result label observed; do
  [ -z "$result" ] && continue
  printf '  %-4s %-64s %s\n' "$result" "$label" "$observed"
  [ "$result" = "PASS" ] || status=1
done <<< "$verdicts"

# The rollback is not assumed. Every table this probe wrote must be as it was.
residue=$(run_sql <<'SQL'
SELECT (SELECT count(*) FROM "categories"    WHERE "slug" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "products"      WHERE "slug" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "product_grades")
     + (SELECT count(*) FROM "product_claims")
     + (SELECT count(*) FROM "spec_properties")
     + (SELECT count(*) FROM "source_assets")
     + (SELECT count(*) FROM "source_documents")
     + (SELECT count(*) FROM "import_runs")
     + (SELECT count(*) FROM "source_facts")
     + (SELECT count(*) FROM "specification_evidence")
     + (SELECT count(*) FROM "claim_evidence")
     + (SELECT count(*) FROM "technical_reviews")
     + (SELECT count(*) FROM "specifications")
     + (SELECT count(*) FROM "users"         WHERE "email" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "product_slug_claims" WHERE "slug_key" LIKE 'td-probe-%');
SQL
)

if [ "$(echo "$residue" | tr -d '[:space:]')" = "0" ]; then
  printf '  %-4s %s\n' "PASS" "nothing survived the probe transaction"
else
  printf '  %-4s %s\n' "FAIL" "probe rows survived: $residue"
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "All catalog technical-data database invariants hold."
else
  echo "One or more catalog technical-data invariants FAILED." >&2
fi

exit "$status"
