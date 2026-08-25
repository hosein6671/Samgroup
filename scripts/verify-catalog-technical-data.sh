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

# ── The census ─────────────────────────────────────────────────────────────
# Every table the probe touches, counted. Taken before and after, and compared: that proves
# the ROLLBACK restored the database whatever was in it, which an absolute "must be zero" can
# only prove on an empty one. The script has to hold on a pristine database AND on a fully
# imported catalogue, and those differ by 5,258 rows.
census() {
  run_sql <<'SQL'
SELECT 'categories='          || count(*) FROM "categories"
UNION ALL SELECT 'products='            || count(*) FROM "products"
UNION ALL SELECT 'product_grades='      || count(*) FROM "product_grades"
UNION ALL SELECT 'product_claims='      || count(*) FROM "product_claims"
UNION ALL SELECT 'specifications='      || count(*) FROM "specifications"
UNION ALL SELECT 'spec_properties='     || count(*) FROM "spec_properties"
UNION ALL SELECT 'spec_property_mappings=' || count(*) FROM "spec_property_mappings"
UNION ALL SELECT 'source_assets='       || count(*) FROM "source_assets"
UNION ALL SELECT 'source_documents='    || count(*) FROM "source_documents"
UNION ALL SELECT 'source_facts='        || count(*) FROM "source_facts"
UNION ALL SELECT 'specification_evidence=' || count(*) FROM "specification_evidence"
UNION ALL SELECT 'claim_evidence='      || count(*) FROM "claim_evidence"
UNION ALL SELECT 'import_runs='         || count(*) FROM "import_runs"
UNION ALL SELECT 'technical_reviews='   || count(*) FROM "technical_reviews"
UNION ALL SELECT 'product_types='       || count(*) FROM "product_types"
UNION ALL SELECT 'product_segments='    || count(*) FROM "product_segments"
UNION ALL SELECT 'product_slug_claims=' || count(*) FROM "product_slug_claims"
UNION ALL SELECT 'users='               || count(*) FROM "users"
UNION ALL SELECT 'sourcerefs='          || count(*) FROM "products" WHERE "source_ref" IS NOT NULL;
SQL
}

census_before=$(census)

# Each case reports one `result|case|observed` line. A case that behaves
# unexpectedly still reports rather than aborting, so one failure does not hide
# the rest of the matrix.
output=$(run_sql <<'SQL'
BEGIN;

-- ── Transaction-local baseline ────────────────────────────────────────────
-- Every count assertion below that is not scoped to a probe id measures a DELTA against this
-- snapshot, never an absolute. The script has to pass on a pristine database, where these are
-- all zero, AND on a fully imported one, where they are 1,398 / 1,661 / 148 and so on. An
-- absolute expectation is a statement about the whole catalogue; the probes only ever make a
-- statement about their own rows, and this is what keeps the assertions saying that.
-- The review rows that existed BEFORE this transaction opened. Captured as ids
-- rather than a count, because case 26 needs to prove that `xmin` does not
-- attribute any of them to this transaction — which is the whole basis of the
-- approval gate's same-transaction test.
CREATE TEMP TABLE td_reviews_before ON COMMIT DROP AS
  SELECT "id" FROM "technical_reviews";

CREATE TEMP TABLE td_baseline(t text PRIMARY KEY, n bigint) ON COMMIT DROP;
INSERT INTO td_baseline(t, n)
SELECT 'specification_evidence', count(*) FROM "specification_evidence"
UNION ALL SELECT 'claim_evidence', count(*) FROM "claim_evidence"
UNION ALL SELECT 'source_facts', count(*) FROM "source_facts"
UNION ALL SELECT 'specifications', count(*) FROM "specifications"
UNION ALL SELECT 'product_claims', count(*) FROM "product_claims"
UNION ALL SELECT 'product_grades', count(*) FROM "product_grades"
UNION ALL SELECT 'products', count(*) FROM "products"
UNION ALL SELECT 'spec_properties', count(*) FROM "spec_properties"
UNION ALL SELECT 'source_assets', count(*) FROM "source_assets"
UNION ALL SELECT 'source_documents', count(*) FROM "source_documents"
UNION ALL SELECT 'import_runs', count(*) FROM "import_runs"
UNION ALL SELECT 'technical_reviews', count(*) FROM "technical_reviews"
UNION ALL SELECT 'product_slug_claims', count(*) FROM "product_slug_claims";

/** Rows this transaction added to a table, over whatever was already there. */
CREATE OR REPLACE FUNCTION pg_temp.delta(tbl text) RETURNS bigint AS $$
DECLARE current_n bigint; base_n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I', tbl) INTO current_n;
  SELECT n INTO base_n FROM td_baseline WHERE t = tbl;
  IF base_n IS NULL THEN
    RAISE EXCEPTION 'no baseline captured for %', tbl;
  END IF;
  RETURN current_n - base_n;
END;
$$ LANGUAGE plpgsql;

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

-- ── The LEGITIMATE approval path, as the database now requires it ──────────
--
-- Migration 20260825120000 makes entry into `approved` conditional on a
-- TechnicalReview inserted in the SAME transaction, naming the subject, carrying
-- an approve decision, a non-blank reviewer snapshot and the evidence-set hash
-- the database computes for that subject right now (ADR-016).
--
-- Several probes below need an approved row in order to test something else
-- entirely — the public views, the forbidden-kind CHECKs, the composite grade
-- key. Before the gate existed they reached that state with a bare UPDATE. They
-- now go through these helpers instead. **No assertion was removed or weakened
-- by that change**: each of those probes still asserts exactly what it asserted
-- before, on a row that is genuinely approved. What changed is the SETUP, and it
-- changed because the setup was previously doing something the database no
-- longer permits anyone to do.
--
-- The hash is read from the function rather than passed in, so a helper can
-- never be used to smuggle a stale one past the gate.
CREATE OR REPLACE FUNCTION pg_temp.approve_spec(spec_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO "technical_reviews"
    ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
  VALUES (gen_random_uuid(), spec_id, 'dddddddd-0000-4000-8000-0000000000ab',
          'td-gate-reviewer@example.invalid', 'approved',
          "specification_evidence_set_hash"(spec_id));
  UPDATE "specifications" SET "review_status" = 'approved' WHERE "id" = spec_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.approve_claim(claim_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO "technical_reviews"
    ("id","product_claim_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
  VALUES (gen_random_uuid(), claim_id, 'dddddddd-0000-4000-8000-0000000000ab',
          'td-gate-reviewer@example.invalid', 'approved',
          "product_claim_evidence_set_hash"(claim_id));
  UPDATE "product_claims" SET "review_status" = 'approved' WHERE "id" = claim_id;
END;
$$ LANGUAGE plpgsql;

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
VALUES ('dddddddd-0000-4000-8000-0000000000aa','td-probe-reviewer@example.invalid','x','admin','active'),
       -- A SECOND reviewer, and it exists because case 8 DELETES the first one to
       -- prove ADR-012's revocation still works. Every approval helper below uses
       -- this one, so the gate probes in cases 14, 25 and 26 keep working after
       -- that deletion instead of failing on a dangling foreign key.
       ('dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','x','admin','active');

INSERT INTO "spec_properties" ("key","canonical_meaning","quantity","value_kind","allowed_units","method_requirement")
VALUES ('td_probe_viscosity_40c','Kinematic viscosity at 40 C','kinematic_viscosity','numeric','{"mm2/s"}','required'),
       ('td_probe_appearance','Visual appearance','appearance','textual','{}','not_applicable'),
       -- One key per value shape. `specifications_import_identity_key` allows one live
       -- Specification per (product, grade, property), so a probe that reused a single key
       -- for several shapes would be testing that index rather than the value-shape CHECK.
       ('td_probe_pair','Foaming sequence pair','volume_ratio','numeric','{}','optional'),
       ('td_probe_report','Reported without a value','appearance','textual','{}','not_applicable'),
       ('td_probe_limitation','Approval-limitation probe','kinematic_viscosity','numeric','{}','optional');

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
     VALUES ('ffffffff-0000-4000-8000-00000000010b','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_pair','12/40','pair',12,40)$q$,
  '5. a well-formed PAIR is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type")
     VALUES ('ffffffff-0000-4000-8000-00000000010c','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_appearance','Clear and bright','text')$q$,
  '5. a well-formed TEXT value is accepted');
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type")
     VALUES ('ffffffff-0000-4000-8000-00000000010d','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_report','Report','report_only')$q$,
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

-- Born unapproved, every one of them — the gate refuses an INSERT that arrives
-- already approved, and the two that need to BE approved are approved below
-- through the same path the review service uses.
INSERT INTO "product_claims" ("id","product_id","kind","standard_body","standard_code","review_status")
VALUES ('cafe0000-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','classification_stated','API','CF-4','source_recorded'),
       ('cafe0000-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000001','licensed_by','API','Licence 1234','source_recorded'),
       ('cafe0000-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000001','reference_only',NULL,NULL,'source_recorded'),
       ('cafe0000-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000001','formulated_for','ACEA','E7','source_recorded');

SELECT pg_temp.approve_claim('cafe0000-0000-4000-8000-000000000001');
SELECT pg_temp.approve_claim('cafe0000-0000-4000-8000-000000000004');

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
-- The positive case. It used to INSERT the row already approved; the gate now
-- refuses that for EVERY claim, so it is inserted unapproved and then approved
-- through the legitimate path. The assertion is unchanged in meaning — a named
-- body is what makes an APPROVED_BY claim approvable — and is now stronger,
-- because it also proves the gate admits a well-formed approval.
INSERT INTO "product_claims" ("id","product_id","kind","standard_body","standard_code","review_status")
VALUES ('cafe0000-0000-4000-8000-00000000004e','dddddddd-0000-4000-8000-000000000001','approved_by','Example OEM','Spec 1','source_recorded');
-- Top level, not inside expect_accepted: see the note above the Specification
-- positive control in case 26 for why a subtransaction cannot be used here.
SELECT pg_temp.approve_claim('cafe0000-0000-4000-8000-00000000004e');
SELECT pg_temp.verdict(
  (SELECT "review_status" = 'approved' FROM "product_claims" WHERE "id"='cafe0000-0000-4000-8000-00000000004e'),
  '14. APPROVED_BY with a named body is permitted',
  (SELECT "review_status"::text FROM "product_claims" WHERE "id"='cafe0000-0000-4000-8000-00000000004e'));

-- ── 13. The public views ─────────────────────────────────────────────────
-- Approve one specification and soft-delete another; add an unapproved,
-- a rejected and a superseded one. Only the approved live row may appear.
-- Approved through the gate, not by a bare UPDATE — see pg_temp.approve_spec.
-- The soft-deleted one is approved first and retired second: the gate governs
-- entry into `approved`, and retiring an already-approved row is untouched by
-- it, which is exactly the asymmetry this pair of rows goes on to prove.
SELECT pg_temp.approve_spec('ffffffff-0000-4000-8000-000000000001');
SELECT pg_temp.approve_spec('ffffffff-0000-4000-8000-000000000002');
UPDATE "specifications" SET "deleted_at"=now() WHERE "id"='ffffffff-0000-4000-8000-000000000002';
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
-- DELTA, not absolute: an imported catalogue already holds 1,398 specification_evidence and
-- 148 claim_evidence rows, and this case is about the four and the one THIS transaction made.
SELECT pg_temp.verdict(
  pg_temp.delta('specification_evidence') = 4 AND pg_temp.delta('claim_evidence') = 1,
  '18. evidence links remain intact',
  pg_temp.delta('specification_evidence')::text || ' spec + ' ||
    pg_temp.delta('claim_evidence')::text || ' claim (added by this transaction)');

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

-- ── 23. The approval transition IS database-enforced ─────────────────────
--
-- This case used to assert the OPPOSITE. ADR-014 §8 recorded, deliberately,
-- that the database gated what is read but not who decided, and wrote these
-- assertions so that "the day someone implements the review service and closes
-- it, this test fails and forces the docs to be updated". Migration
-- 20260825120000 closed it; the assertions are inverted here, and ADR-016
-- records the closure. Nothing was deleted — the same three questions are
-- asked, and the expected answers are now the safe ones.
INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
VALUES ('ffffffff-0000-4000-8000-000000000301','dddddddd-0000-4000-8000-000000000001','k','v','td_probe_limitation','7','point',7);
SELECT pg_temp.expect_rejected(
  $q$UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000301'$q$,
  '23. approval CANNOT be set with no TechnicalReview');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "technical_reviews" WHERE "specification_id"='ffffffff-0000-4000-8000-000000000301')
  AND (SELECT count(*) = 0 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000301'),
  '23. it did NOT become public, and no review row was invented',
  'gate held');
SELECT pg_temp.verdict(
  (SELECT col_description('specifications'::regclass,
            (SELECT attnum FROM pg_attribute WHERE attrelid='specifications'::regclass AND attname='review_status'))
          NOT LIKE '%DOES NOT ENFORCE%'
      AND col_description('specifications'::regclass,
            (SELECT attnum FROM pg_attribute WHERE attrelid='specifications'::regclass AND attname='review_status'))
          LIKE '%SAME transaction%'),
  '23. the COMMENT now describes the enforcement, not the limitation',
  'documented in-schema');


-- ═══════════════════════════════════════════════════════════════════════════
-- 24. PRODUCT-DATA-2C-B1: persistent catalog identity and import idempotency
--     Migration 20260823120000_add_catalog_import_identity (ADR-015).
--
--     These were run ad hoc when the migration was written. They live here now
--     because a protection that is only ever checked once is a protection that
--     silently lapses. Every probe below is transaction-scoped like the rest of
--     this script and leaves the database exactly as it found it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 24a. products.source_ref — shape, nullability, uniqueness ──────────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM information_schema.columns
    WHERE table_name='products' AND column_name='source_ref'),
  '24. products.source_ref exists',
  (SELECT coalesce(string_agg(column_name,','),'MISSING') FROM information_schema.columns
    WHERE table_name='products' AND column_name='source_ref'));

SELECT pg_temp.verdict(
  (SELECT data_type='character varying' AND character_maximum_length=64
     FROM information_schema.columns
    WHERE table_name='products' AND column_name='source_ref'),
  '24. source_ref is varchar(64)',
  (SELECT data_type||'('||coalesce(character_maximum_length::text,'?')||')'
     FROM information_schema.columns
    WHERE table_name='products' AND column_name='source_ref'));

SELECT pg_temp.verdict(
  (SELECT is_nullable='YES' FROM information_schema.columns
    WHERE table_name='products' AND column_name='source_ref'),
  '24. source_ref is nullable, so non-catalog Products need none',
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_name='products' AND column_name='source_ref'));

-- Three fresh Products, all NULL: proves multiple NULLs coexist under the unique index.
INSERT INTO "products" ("id","name","slug","category_id")
VALUES ('5cee0000-0000-4000-8000-000000000001','SR Probe A','sr-probe-a','dddddddd-0000-4000-8000-00000000000f'),
       ('5cee0000-0000-4000-8000-000000000002','SR Probe B','sr-probe-b','dddddddd-0000-4000-8000-00000000000f'),
       ('5cee0000-0000-4000-8000-000000000003','SR Probe C','sr-probe-c','dddddddd-0000-4000-8000-00000000000f');
SELECT pg_temp.verdict(
  (SELECT count(*) = 3 FROM "products"
    WHERE "id"::text LIKE '5cee0000%' AND "source_ref" IS NULL),
  '24. multiple NULL source_ref values coexist',
  (SELECT count(*)::text FROM "products" WHERE "id"::text LIKE '5cee0000%' AND "source_ref" IS NULL));

-- The probe identities are RESERVED FOR VERIFICATION and deliberately outside the ratified
-- ledger, whose space is SAMCAT-W1-R003 .. SAMCAT-W1-R300. An earlier version of this script
-- borrowed SAMCAT-W1-R003, which is a real Product once the catalogue is imported: the assign
-- then failed on the unique index, and the two immutability cases after it silently tested
-- nothing. Reserving the identities is what lets this file run against an imported database.
--
-- Asserted rather than assumed, so a future ledger that ever adopted one of these would fail
-- HERE, loudly, instead of turning three assertions into false negatives again.
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "products"
    WHERE "source_ref" IN ('SAMCAT-VERIFY-P1','SAMCAT-VERIFY-P2','SAMCAT-VERIFY-P9')),
  '24. the reserved verification identities belong to no real Product',
  (SELECT count(*)::text FROM "products"
    WHERE "source_ref" IN ('SAMCAT-VERIFY-P1','SAMCAT-VERIFY-P2','SAMCAT-VERIFY-P9')));

SELECT pg_temp.verdict(
  (SELECT bool_and(length(r) BETWEEN 1 AND 64 AND r = btrim(r) AND btrim(r) <> '')
     FROM unnest(ARRAY['SAMCAT-VERIFY-P1','SAMCAT-VERIFY-P2','SAMCAT-VERIFY-P9']) AS r),
  '24. the reserved identities satisfy the source_ref shape CHECK',
  'length 1..64, trimmed, non-empty');

SELECT pg_temp.expect_accepted(
  $q$UPDATE "products" SET "source_ref"='SAMCAT-VERIFY-P1'
      WHERE "id"='5cee0000-0000-4000-8000-000000000001'$q$,
  '24. a reserved source_ref can be assigned once');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"='SAMCAT-VERIFY-P1'
      WHERE "id"='5cee0000-0000-4000-8000-000000000002'$q$,
  '24. a DUPLICATE non-null source_ref is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"='' WHERE "id"='5cee0000-0000-4000-8000-000000000002'$q$,
  '24. a BLANK source_ref is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"='   ' WHERE "id"='5cee0000-0000-4000-8000-000000000002'$q$,
  '24. a WHITESPACE-ONLY source_ref is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"=' SAMCAT-VERIFY-P2 '
      WHERE "id"='5cee0000-0000-4000-8000-000000000002'$q$,
  '24. an UNTRIMMED source_ref is rejected');

SELECT pg_temp.expect_accepted(
  $q$UPDATE "products" SET "source_ref"=repeat('X',64)
      WHERE "id"='5cee0000-0000-4000-8000-000000000002'$q$,
  '24. a 64-character source_ref is accepted at the boundary');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"=repeat('X',65)
      WHERE "id"='5cee0000-0000-4000-8000-000000000003'$q$,
  '24. an OVER-LENGTH source_ref is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"='SAMCAT-VERIFY-P9'
      WHERE "id"='5cee0000-0000-4000-8000-000000000001'$q$,
  '24. CHANGING a non-null source_ref is rejected');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "products" SET "source_ref"=NULL
      WHERE "id"='5cee0000-0000-4000-8000-000000000001'$q$,
  '24. CLEARING a non-null source_ref is rejected');

SELECT pg_temp.expect_accepted(
  $q$UPDATE "products" SET "name"='SR Probe A renamed'
      WHERE "id"='5cee0000-0000-4000-8000-000000000001'$q$,
  '24. an unrelated Product UPDATE is still permitted');

SELECT pg_temp.verdict(
  (SELECT "source_ref"='SAMCAT-VERIFY-P1' FROM "products"
    WHERE "id"='5cee0000-0000-4000-8000-000000000001'),
  '24. the identity survived the unrelated update unchanged',
  (SELECT coalesce("source_ref",'NULL') FROM "products"
    WHERE "id"='5cee0000-0000-4000-8000-000000000001'));

-- Vacuously true on a fresh replay database, and the real assertion on live DEV
-- and on a restored backup: no demo Product ever carries a ratified identity.
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "products"
    WHERE "slug" LIKE 'sam-demo-%' AND "source_ref" IS NOT NULL),
  '24. every sam-demo- Product has a NULL source_ref',
  (SELECT count(*)::text FROM "products" WHERE "slug" LIKE 'sam-demo-%' AND "source_ref" IS NOT NULL));

SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM information_schema.columns
    WHERE table_name IN ('v_specification_public','v_product_claim_public')
      AND column_name IN ('source_ref','claim_identity_hash','manifest_hash')),
  '24. no internal identity column is exposed by either public view',
  (SELECT coalesce(string_agg(table_name||'.'||column_name,','),'none')
     FROM information_schema.columns
    WHERE table_name IN ('v_specification_public','v_product_claim_public')
      AND column_name IN ('source_ref','claim_identity_hash','manifest_hash')));

-- ── 24b. Specification import identity ─────────────────────────────────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM pg_class WHERE relname='specifications_import_identity_key'),
  '24. specifications_import_identity_key exists',
  (SELECT coalesce(string_agg(relname,','),'MISSING') FROM pg_class
    WHERE relname='specifications_import_identity_key'));

SELECT pg_temp.verdict(
  (SELECT i.indisunique FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='specifications_import_identity_key'),
  '24. it is UNIQUE',
  'indisunique');

SELECT pg_temp.verdict(
  (SELECT i.indnullsnotdistinct FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='specifications_import_identity_key'),
  '24. it uses NULLS NOT DISTINCT, so a NULL grade still collides',
  'indnullsnotdistinct');

SELECT pg_temp.verdict(
  (SELECT pg_get_indexdef(c.oid) LIKE '%WHERE (deleted_at IS NULL)%' FROM pg_class c
    WHERE c.relname='specifications_import_identity_key'),
  '24. it applies to LIVE rows only (deleted_at IS NULL)',
  (SELECT substring(pg_get_indexdef(c.oid) FROM 'WHERE.*$') FROM pg_class c
    WHERE c.relname='specifications_import_identity_key'));

INSERT INTO "spec_properties" ("key","canonical_meaning","quantity","value_kind","allowed_units","method_requirement")
VALUES ('sr_probe_prop','Identity probe property','kinematic_viscosity','numeric','{"mm2/s"}','optional');

INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
VALUES ('5cee1111-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','k','v','sr_probe_prop','1.0','point',1.0);
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('5cee1111-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000001','k','v','sr_probe_prop','2.0','point',2.0)$q$,
  '24. a duplicate PRODUCT-level (product, NULL grade, property) is rejected');

INSERT INTO "specifications" ("id","product_id","product_grade_id","key","value","property_key","display_value","value_type","numeric_min")
VALUES ('5cee1111-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000001','k','v','sr_probe_prop','3.0','point',3.0);
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","product_grade_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('5cee1111-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000001','k','v','sr_probe_prop','4.0','point',4.0)$q$,
  '24. a duplicate GRADE-level (product, grade, property) is rejected');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('5cee1111-0000-4000-8000-000000000005','dddddddd-0000-4000-8000-000000000003','k','v','sr_probe_prop','5.0','point',5.0)$q$,
  '24. the same property on a DIFFERENT product is still accepted');

UPDATE "specifications" SET "deleted_at"=now() WHERE "id"='5cee1111-0000-4000-8000-000000000001';
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
     VALUES ('5cee1111-0000-4000-8000-000000000006','dddddddd-0000-4000-8000-000000000001','k','v','sr_probe_prop','6.0','point',6.0)$q$,
  '24. retiring a Specification frees the identity for its replacement');

-- ── 24c. SourceFact evidence identity and immutability ─────────────────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM pg_class WHERE relname='source_facts_evidence_identity_key'),
  '24. source_facts_evidence_identity_key exists',
  (SELECT coalesce(string_agg(relname,','),'MISSING') FROM pg_class
    WHERE relname='source_facts_evidence_identity_key'));

SELECT pg_temp.verdict(
  (SELECT string_agg(a.attname, ',' ORDER BY k.ord) =
          'source_document_id,page_number,sheet_name,row_number,column_label,raw_property,raw_unit,raw_value,raw_method,raw_grade'
     FROM pg_index i
     JOIN pg_class c ON c.oid=i.indexrelid
     CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE c.relname='source_facts_evidence_identity_key'),
  '24. its identity columns are exactly the ten verbatim reading columns, in order',
  (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
     FROM pg_index i
     JOIN pg_class c ON c.oid=i.indexrelid
     CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE c.relname='source_facts_evidence_identity_key'));

SELECT pg_temp.verdict(
  (SELECT i.indnullsnotdistinct FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='source_facts_evidence_identity_key'),
  '24. the evidence identity uses NULLS NOT DISTINCT',
  'indnullsnotdistinct');

SELECT pg_temp.verdict(
  (SELECT NOT bool_or(a.attname = 'import_run_id')
     FROM pg_index i
     JOIN pg_class c ON c.oid=i.indexrelid
     CROSS JOIN LATERAL unnest(i.indkey) AS k(attnum)
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE c.relname='source_facts_evidence_identity_key'),
  '24. import_run_id is NOT part of the evidence identity, so a replay converges',
  'absent');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "source_facts" ("id","source_document_id","import_run_id","sheet_name","row_number","column_label","raw_property","raw_unit","raw_value","raw_method","raw_grade","extraction_method","unit_classification")
     VALUES ('5cee2222-0000-4000-8000-000000000001','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','Products',7,'D','Viscosity @40C','mm2/s','12.5','ASTM D445','SAE 40','spreadsheet_cell','stated')$q$,
  '24. re-reading the SAME evidence does not create a second SourceFact');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "source_facts" ("id","source_document_id","import_run_id","sheet_name","row_number","column_label","raw_property","raw_unit","raw_value","raw_method","raw_grade","extraction_method","unit_classification")
     VALUES ('5cee2222-0000-4000-8000-000000000002','d0c00000-0000-4000-8000-000000000002','4a110000-0000-4000-8000-000000000001','Products',7,'D','Viscosity @40C','mm2/s','99.9','ASTM D445','SAE 40','spreadsheet_cell','stated')$q$,
  '24. a CORRECTED reading is a new SourceFact revision, not an edit');

SELECT pg_temp.expect_rejected(
  $q$UPDATE "source_facts" SET "raw_value"='tampered'
      WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '24. UPDATE of a SourceFact is still refused');

SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "source_facts" WHERE "id"='fac70000-0000-4000-8000-000000000001'$q$,
  '24. DELETE of a SourceFact is still refused');

-- ── 24d. ProductClaim identity ─────────────────────────────────────────────
SELECT pg_temp.verdict(
  (SELECT data_type='character' AND character_maximum_length=64
     FROM information_schema.columns
    WHERE table_name='product_claims' AND column_name='claim_identity_hash'),
  '24. product_claims.claim_identity_hash is char(64)',
  (SELECT coalesce(data_type||'('||coalesce(character_maximum_length::text,'?')||')','MISSING')
     FROM information_schema.columns
    WHERE table_name='product_claims' AND column_name='claim_identity_hash'));

SELECT pg_temp.verdict(
  (SELECT is_nullable='YES' FROM information_schema.columns
    WHERE table_name='product_claims' AND column_name='claim_identity_hash'),
  '24. it is nullable by design, for claims the importer did not create',
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_name='product_claims' AND column_name='claim_identity_hash'));

SELECT pg_temp.verdict(
  (SELECT col_description('product_claims'::regclass,
            (SELECT attnum FROM pg_attribute
              WHERE attrelid='product_claims'::regclass AND attname='claim_identity_hash'))
          LIKE '%IDENTITY%'),
  '24. the column documents that it is an identity, not an evidence link',
  'documented in-schema');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","claim_identity_hash")
     VALUES ('5cee3333-0000-4000-8000-000000000009','dddddddd-0000-4000-8000-000000000001','suitable_for','NOT-A-HASH')$q$,
  '24. a malformed claim_identity_hash is rejected by CHECK');

SELECT pg_temp.verdict(
  (SELECT string_agg(a.attname, ',' ORDER BY k.ord) =
          'product_id,product_grade_id,kind,standard_body,standard_code,claim_identity_hash'
     FROM pg_index i
     JOIN pg_class c ON c.oid=i.indexrelid
     CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE c.relname='product_claims_import_identity_key'),
  '24. the claim identity index carries exactly the intended columns',
  (SELECT coalesce(string_agg(a.attname, ',' ORDER BY k.ord),'MISSING')
     FROM pg_index i
     JOIN pg_class c ON c.oid=i.indexrelid
     CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE c.relname='product_claims_import_identity_key'));

-- Two suitabilities that differ ONLY by statement: the case the columns alone lose.
INSERT INTO "product_claims" ("id","product_id","kind","claim_identity_hash")
VALUES ('5cee3333-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','suitable_for',repeat('a',64));
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","claim_identity_hash")
     VALUES ('5cee3333-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000001','suitable_for',repeat('b',64))$q$,
  '24. two SUITABLE_FOR claims with different statements both survive');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","claim_identity_hash")
     VALUES ('5cee3333-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000001','suitable_for',repeat('a',64))$q$,
  '24. the SAME claim identity twice is rejected');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","claim_identity_hash")
     VALUES ('5cee3333-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000001','recommended_for',NULL)$q$,
  '24. a NULL claim_identity_hash is still accepted for a non-imported claim');

-- ── 24e. ImportRun application identity ────────────────────────────────────
SELECT pg_temp.verdict(
  (SELECT data_type='character' AND character_maximum_length=64
     FROM information_schema.columns
    WHERE table_name='import_runs' AND column_name='manifest_hash'),
  '24. import_runs.manifest_hash is char(64)',
  (SELECT coalesce(data_type||'('||coalesce(character_maximum_length::text,'?')||')','MISSING')
     FROM information_schema.columns
    WHERE table_name='import_runs' AND column_name='manifest_hash'));

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "import_runs" ("id","importer_version","manifest_hash")
     VALUES ('5cee4444-0000-4000-8000-000000000009','probe-0.0.0','NOT-A-HASH')$q$,
  '24. a malformed manifest_hash is rejected by CHECK');

INSERT INTO "import_runs" ("id","importer_version","manifest_hash","finished_at")
VALUES ('5cee4444-0000-4000-8000-000000000001','probe-0.0.0',repeat('c',64),now());
SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "import_runs" ("id","importer_version","manifest_hash","finished_at")
     VALUES ('5cee4444-0000-4000-8000-000000000002','probe-0.0.0',repeat('c',64),now())$q$,
  '24. the same manifest cannot be recorded as applied twice');

SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "import_runs" ("id","importer_version","manifest_hash")
     VALUES ('5cee4444-0000-4000-8000-000000000003','probe-0.0.0',repeat('c',64))$q$,
  '24. an UNFINISHED run with that manifest is still allowed, so a retry stays possible');

SELECT pg_temp.verdict(
  (SELECT pg_get_indexdef(c.oid) LIKE '%finished_at IS NOT NULL%' FROM pg_class c
    WHERE c.relname='import_runs_applied_manifest_key'),
  '24. the manifest identity applies to FINISHED runs only',
  (SELECT substring(pg_get_indexdef(c.oid) FROM 'WHERE.*$') FROM pg_class c
    WHERE c.relname='import_runs_applied_manifest_key'));

-- ── 24f. ADR-011 regression, with source_ref present ───────────────────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 3 FROM "product_slug_claims"
    WHERE "slug" IN ('sr-probe-a','sr-probe-b','sr-probe-c')),
  '24. inserting a Product still CLAIMS its slug by trigger',
  (SELECT count(*)::text FROM "product_slug_claims"
    WHERE "slug" IN ('sr-probe-a','sr-probe-b','sr-probe-c')));

UPDATE "products" SET "slug"='sr-probe-a-renamed' WHERE "id"='5cee0000-0000-4000-8000-000000000001';
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM "product_slug_claims" WHERE "slug"='sr-probe-a-renamed')
  AND (SELECT count(*) = 0 FROM "product_slug_claims" WHERE "slug"='sr-probe-a'),
  '24. renaming a Product releases the old claim and takes the new one',
  (SELECT coalesce(string_agg("slug",','),'none') FROM "product_slug_claims"
    WHERE "slug" LIKE 'sr-probe-a%'));

DELETE FROM "products" WHERE "id"='5cee0000-0000-4000-8000-000000000003';
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "product_slug_claims" WHERE "slug"='sr-probe-c'),
  '24. deleting a Product releases its trigger-managed slug claim',
  (SELECT count(*)::text FROM "product_slug_claims" WHERE "slug"='sr-probe-c'));

SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='product_slug_claims' AND NOT t.tgisinternal),
  '24. product_slug_claims is written only BY triggers, never by one',
  (SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='product_slug_claims' AND NOT t.tgisinternal));


-- ═══════════════════════════════════════════════════════════════════════════
-- 25. PRODUCT-REVIEW-1A-H1: immutable review history
--     Migration 20260825120000_harden_review_immutability_and_approval_gate.
--
--     `technical_reviews` accepted UPDATE and DELETE until this migration. That
--     had been ASSUMED closed and was not — a probe deleted six rows and
--     PostgreSQL accepted it. An audit table that can be rewritten is not audit
--     history, and an assumption nobody tested is exactly how this survived.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 25a. The trigger's shape, not just its effect ─────────────────────────
-- The effect tests below would still pass if someone replaced the trigger with a
-- plain ENABLE one, which a session setting `session_replication_role='replica'`
-- silently skips. So the definition is asserted first, field by field.
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname='technical_reviews' AND t.tgname='technical_reviews_immutable_guard'),
  '25. technical_reviews_immutable_guard exists',
  (SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='technical_reviews' AND t.tgname='technical_reviews_immutable_guard'));

-- tgtype is a bitmask: 1 = ROW, 2 = BEFORE, 8 = DELETE, 16 = UPDATE.
SELECT pg_temp.verdict(
  (SELECT (t.tgtype & 1) = 1 FROM pg_trigger t
    WHERE t.tgname='technical_reviews_immutable_guard'),
  '25. it is ROW-level, so every row is checked individually',
  (SELECT (t.tgtype & 1)::text FROM pg_trigger t WHERE t.tgname='technical_reviews_immutable_guard'));
SELECT pg_temp.verdict(
  (SELECT (t.tgtype & 2) = 2 FROM pg_trigger t
    WHERE t.tgname='technical_reviews_immutable_guard'),
  '25. it fires BEFORE, so a refused write never touches the heap',
  (SELECT (t.tgtype & 2)::text FROM pg_trigger t WHERE t.tgname='technical_reviews_immutable_guard'));
SELECT pg_temp.verdict(
  (SELECT (t.tgtype & 8) = 8 AND (t.tgtype & 16) = 16 FROM pg_trigger t
    WHERE t.tgname='technical_reviews_immutable_guard'),
  '25. it covers BOTH update and delete',
  (SELECT ((t.tgtype & 8) = 8)::text || '/' || ((t.tgtype & 16) = 16)::text
     FROM pg_trigger t WHERE t.tgname='technical_reviews_immutable_guard'));
SELECT pg_temp.verdict(
  (SELECT t.tgenabled = 'A' FROM pg_trigger t
    WHERE t.tgname='technical_reviews_immutable_guard'),
  '25. it is ENABLE ALWAYS, so session_replication_role cannot skip it',
  (SELECT t.tgenabled::text FROM pg_trigger t WHERE t.tgname='technical_reviews_immutable_guard'));

-- INSERT is untouched: the table must still be writable, or nothing could ever
-- be approved.
INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
VALUES ('ffffffff-0000-4000-8000-000000000401','dddddddd-0000-4000-8000-000000000002','k','v','td_probe_report','reported','report_only',NULL);
SELECT pg_temp.expect_accepted(
  $q$INSERT INTO "technical_reviews"
       ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
     VALUES ('7ec00000-0000-4000-8000-000000000401','ffffffff-0000-4000-8000-000000000401',
             'dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','rejected',
             "specification_evidence_set_hash"('ffffffff-0000-4000-8000-000000000401'))$q$,
  '25. INSERT is still accepted');

-- ── 25b. Every field a rewrite would target ───────────────────────────────
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "note"='rewritten' WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the note cannot be rewritten');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "evidence_set_hash"=repeat('0',64) WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the evidence hash cannot be rewritten');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "decision"='approved' WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the decision cannot be rewritten');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "reviewer_email_snapshot"='someone.else@example.invalid'
      WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the reviewer snapshot cannot be rewritten');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "specification_id"='ffffffff-0000-4000-8000-000000000001'
      WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the subject cannot be re-pointed at another row');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "reviewed_at"=now() - interval '1 year'
      WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the timestamp cannot be back-dated');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "technical_reviews" WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. a single review cannot be deleted');
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "technical_reviews"$q$,
  '25. and neither can the whole table');
SELECT pg_temp.verdict(
  (SELECT "note" IS NULL AND "decision"='rejected'
      AND "reviewer_email_snapshot"='td-gate-reviewer@example.invalid'
      AND "reviewer_id"='dddddddd-0000-4000-8000-0000000000ab'
     FROM "technical_reviews" WHERE "id"='7ec00000-0000-4000-8000-000000000401'),
  '25. the row is byte-for-byte what was inserted',
  (SELECT "decision"::text FROM "technical_reviews" WHERE "id"='7ec00000-0000-4000-8000-000000000401'));

-- ── 25b-ii. The ONE permitted update, and its exact boundary ──────────────
--
-- `reviewer_id` is ON DELETE SET NULL, and PostgreSQL implements that as an
-- UPDATE on this table. A blanket ban would make `DELETE FROM users` fail and
-- would break ADR-012's strongest credential revocation — measured, not
-- reasoned about: the first version of this trigger did exactly that and case 8
-- failed. So clearing `reviewer_id` to NULL with every other column untouched is
-- permitted, and nothing else is.
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "reviewer_id"='dddddddd-0000-4000-8000-0000000000aa'
      WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. the reviewer cannot be re-pointed at a DIFFERENT user');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "technical_reviews" SET "reviewer_id"=NULL, "note"='and a rewrite'
      WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. clearing it while touching anything else is still refused');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "technical_reviews" SET "reviewer_id"=NULL
      WHERE "id"='7ec00000-0000-4000-8000-000000000401'$q$,
  '25. clearing reviewer_id alone IS permitted — it is the FK release');
SELECT pg_temp.verdict(
  (SELECT "reviewer_id" IS NULL
      AND "reviewer_email_snapshot"='td-gate-reviewer@example.invalid'
      AND "decision"='rejected' AND "note" IS NULL
     FROM "technical_reviews" WHERE "id"='7ec00000-0000-4000-8000-000000000401'),
  '25. ...and the snapshot still names the reviewer afterwards',
  (SELECT coalesce("reviewer_email_snapshot",'LOST') FROM "technical_reviews"
    WHERE "id"='7ec00000-0000-4000-8000-000000000401'));

-- ── 25c. The subject still cannot be deleted out from under its history ───
-- This was true before the migration (both subject FKs are ON DELETE RESTRICT)
-- and must stay true: immutability of the review is worth nothing if the row it
-- describes can be erased.
SELECT pg_temp.expect_rejected(
  $q$DELETE FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000401'$q$,
  '25. a reviewed Specification cannot be hard-deleted');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "deleted_at"=now() WHERE "id"='ffffffff-0000-4000-8000-000000000401'$q$,
  '25. ...but it can be retired, which is the supported path');


-- ═══════════════════════════════════════════════════════════════════════════
-- 26. PRODUCT-REVIEW-1A-H1: the approval gate
--
--     ADR-014 §8 recorded that the database gated WHAT IS READ, not WHO
--     DECIDED. `sam_platform_user` owns these tables, so the review service
--     alone was never a boundary. Entry into `approved` now requires a
--     TechnicalReview written in the SAME transaction, proved by `xmin`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 26a. Both gates exist, on both tables, ENABLE ALWAYS ──────────────────
SELECT pg_temp.verdict(
  (SELECT count(*) = 2 FROM pg_trigger t
    WHERE t.tgname IN ('specification_approval_gate_guard','product_claim_approval_gate_guard')
      AND t.tgenabled = 'A'),
  '26. both approval gates exist and are ENABLE ALWAYS',
  (SELECT coalesce(string_agg(t.tgname || '=' || t.tgenabled::text, ','),'MISSING') FROM pg_trigger t
    WHERE t.tgname IN ('specification_approval_gate_guard','product_claim_approval_gate_guard')));
-- tgtype 4 = INSERT, 16 = UPDATE. Both are needed: gating only UPDATE would let
-- a row be born approved.
SELECT pg_temp.verdict(
  (SELECT bool_and((t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16 AND (t.tgtype & 2) = 2 AND (t.tgtype & 1) = 1)
     FROM pg_trigger t
    WHERE t.tgname IN ('specification_approval_gate_guard','product_claim_approval_gate_guard')),
  '26. each is BEFORE INSERT OR UPDATE, row-level',
  'tgtype checked');

-- ── 26b. Specification: every way in is refused except the right one ──────
INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","numeric_min")
VALUES ('ffffffff-0000-4000-8000-000000000501','dddddddd-0000-4000-8000-000000000002','k','v','td_probe_viscosity_40c','11','point',11),
       ('ffffffff-0000-4000-8000-000000000502','dddddddd-0000-4000-8000-000000000003','k','v','td_probe_viscosity_40c','12','point',12);

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "specifications" ("id","product_id","key","value","review_status")
     VALUES ('ffffffff-0000-4000-8000-000000000503','dddddddd-0000-4000-8000-000000000002','k','v','approved')$q$,
  '26. a Specification cannot be INSERTed already approved');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. a bare UPDATE to approved is refused');

-- A review for ANOTHER subject, written in this transaction, must not help.
INSERT INTO "technical_reviews"
  ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
VALUES ('7ec00000-0000-4000-8000-000000000501','ffffffff-0000-4000-8000-000000000502',
        'dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','approved',
        "specification_evidence_set_hash"('ffffffff-0000-4000-8000-000000000502'));
SELECT pg_temp.expect_rejected(
  $q$UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. another subject''s review cannot be borrowed');

-- A review for the RIGHT subject with a STALE hash must not help either.
INSERT INTO "technical_reviews"
  ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
VALUES ('7ec00000-0000-4000-8000-000000000502','ffffffff-0000-4000-8000-000000000501',
        'dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','approved',
        repeat('b',64));
SELECT pg_temp.expect_rejected(
  $q$UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. a review quoting a stale evidence hash cannot be reused');

-- Right subject, right hash, but the decision is a REJECTION.
INSERT INTO "technical_reviews"
  ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
VALUES ('7ec00000-0000-4000-8000-000000000503','ffffffff-0000-4000-8000-000000000501',
        'dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','rejected',
        "specification_evidence_set_hash"('ffffffff-0000-4000-8000-000000000501'));
SELECT pg_temp.expect_rejected(
  $q$UPDATE "specifications" SET "review_status"='approved' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. a rejection decision does not authorize an approval');

/*
 * Everything right. This is the review service's exact sequence.
 *
 * ── Why this one is NOT wrapped in pg_temp.expect_accepted ─────────────────
 *
 * `expect_accepted` and `expect_rejected` catch exceptions, and a PL/pgSQL block
 * with an EXCEPTION clause is a SUBTRANSACTION. A review inserted inside one
 * carries a SUBtransaction id, which is not equal to `pg_current_xact_id()`, so
 * the gate refuses it — fail-closed, and exactly the behaviour documented in the
 * migration. Wrapping the positive control would therefore have tested the
 * wrapper rather than the gate, and it would have made every negative case above
 * pass for the wrong reason.
 *
 * So the legitimate approval runs at the TOP LEVEL, where the review service also
 * runs it. If the gate ever wrongly refuses it, this statement raises and the
 * whole script aborts loudly with a non-zero exit — which is the correct outcome
 * for a broken approval path, not something to be swallowed into one FAIL line.
 *
 * The subtransaction behaviour is then asserted explicitly below, so it is a
 * recorded, tested property instead of a hidden confound.
 */
SELECT pg_temp.approve_spec('ffffffff-0000-4000-8000-000000000501');
SELECT pg_temp.verdict(
  (SELECT "review_status" = 'approved' FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000501'),
  '26. a matching current-transaction approve review IS accepted',
  (SELECT "review_status"::text FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000501'));
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000501'),
  '26. ...and only then does the public view contain it',
  (SELECT count(*)::text FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000501'));

-- The subtransaction property, stated and tested rather than left to surprise a
-- future caller. A review written inside a savepoint or an EXCEPTION block does
-- not satisfy the gate. That refuses a legitimate approval rather than admitting
-- an illegitimate one, so the direction is safe; a caller that needs savepoints
-- must insert the review and update the status at the same nesting level.
INSERT INTO "specifications" ("id","product_id","key","value","property_key","display_value","value_type","pair_first","pair_second")
VALUES ('ffffffff-0000-4000-8000-000000000504','dddddddd-0000-4000-8000-000000000002','k','v','td_probe_pair','1:1','pair',1,1);
SELECT pg_temp.expect_rejected(
  $q$SELECT pg_temp.approve_spec('ffffffff-0000-4000-8000-000000000504')$q$,
  '26. a review written inside a SUBtransaction does not satisfy the gate (fail-closed)');
SELECT pg_temp.verdict(
  (SELECT "review_status" = 'source_recorded' FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000504'),
  '26. ...and that subject stayed unapproved',
  (SELECT "review_status"::text FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000504'));

-- The residue check: three refused attempts wrote no status and left the row
-- unapproved until the legitimate one. The reviews they inserted DO remain —
-- they are real recorded decisions and the table is append-only — which is why
-- this asserts the STATUS, not the review count.
SELECT pg_temp.verdict(
  (SELECT "review_status" = 'source_recorded' FROM "specifications"
    WHERE "id"='ffffffff-0000-4000-8000-000000000502'),
  '26. a subject whose approval was refused kept its original status',
  (SELECT "review_status"::text FROM "specifications" WHERE "id"='ffffffff-0000-4000-8000-000000000502'));

-- ── 26c. A HISTORICAL review cannot be replayed ───────────────────────────
-- The heart of the same-transaction rule. The row above is approved now, on a
-- review written in this transaction. Take it back out of `approved` — which is
-- deliberately ungated — and try to put it back using that same, now-historical
-- review. Within one transaction every row shares an xmin, so this case is
-- proved against the REAL historical rows in the database instead: any review
-- that exists in `technical_reviews` before this script opened its transaction.
SELECT pg_temp.verdict(
  (SELECT count(*) > 0 FROM "technical_reviews"
    WHERE xmin = pg_current_xact_id()::xid),
  '26. xmin identifies the reviews THIS transaction wrote — the gate''s mechanism',
  (SELECT count(*)::text FROM "technical_reviews" WHERE xmin = pg_current_xact_id()::xid));

-- The other half, and the one that makes a historical review unusable. Every
-- review that already existed when this transaction opened must NOT be
-- attributed to it. On a database with no review history this is vacuous and
-- says so; on one with history it is the assertion that a six-month-old approval
-- cannot be replayed to re-approve a row.
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "technical_reviews" tr
     JOIN td_reviews_before b ON b."id" = tr."id"
    WHERE tr.xmin = pg_current_xact_id()::xid),
  '26. no PRE-EXISTING review is attributed to this transaction',
  (SELECT count(*)::text || ' of ' || (SELECT count(*)::text FROM td_reviews_before)
     || ' pre-existing rows misattributed'
     FROM "technical_reviews" tr JOIN td_reviews_before b ON b."id" = tr."id"
    WHERE tr.xmin = pg_current_xact_id()::xid));

-- ── 26d. Leaving `approved` is NOT gated ──────────────────────────────────
-- Deliberate, and load-bearing: gating the exit would block the importer's
-- evidence-driven invalidation and every rejection.
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "review_status"='superseded' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. an approved row can still be superseded');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "review_status"='rejected' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. and rejected');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "review_status"='needs_review' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. and returned to review');
SELECT pg_temp.expect_accepted(
  $q$UPDATE "specifications" SET "review_status"='source_recorded' WHERE "id"='ffffffff-0000-4000-8000-000000000501'$q$,
  '26. and reset to source_recorded');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000501'),
  '26. every one of those removed it from the public view',
  (SELECT count(*)::text FROM "v_specification_public" WHERE "id"='ffffffff-0000-4000-8000-000000000501'));

-- ── 26e. ProductClaim: the same gate, plus the forbidden kinds ────────────
INSERT INTO "product_claims" ("id","product_id","kind","standard_body","standard_code")
VALUES ('cafe0000-0000-4000-8000-000000000501','dddddddd-0000-4000-8000-000000000002','meets','API','CK-4'),
       ('cafe0000-0000-4000-8000-000000000502','dddddddd-0000-4000-8000-000000000002','licensed_by','API','L-1'),
       ('cafe0000-0000-4000-8000-000000000503','dddddddd-0000-4000-8000-000000000002','reference_only',NULL,NULL),
       ('cafe0000-0000-4000-8000-000000000504','dddddddd-0000-4000-8000-000000000003','meets','ACEA','E9');

SELECT pg_temp.expect_rejected(
  $q$INSERT INTO "product_claims" ("id","product_id","kind","review_status")
     VALUES ('cafe0000-0000-4000-8000-000000000505','dddddddd-0000-4000-8000-000000000002','meets','approved')$q$,
  '26. a ProductClaim cannot be INSERTed already approved');
SELECT pg_temp.expect_rejected(
  $q$UPDATE "product_claims" SET "review_status"='approved' WHERE "id"='cafe0000-0000-4000-8000-000000000501'$q$,
  '26. a bare UPDATE to approved is refused for claims too');

INSERT INTO "technical_reviews"
  ("id","product_claim_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
VALUES ('7ec00000-0000-4000-8000-000000000511','cafe0000-0000-4000-8000-000000000504',
        'dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','approved',
        "product_claim_evidence_set_hash"('cafe0000-0000-4000-8000-000000000504'));
SELECT pg_temp.expect_rejected(
  $q$UPDATE "product_claims" SET "review_status"='approved' WHERE "id"='cafe0000-0000-4000-8000-000000000501'$q$,
  '26. another claim''s review cannot be borrowed');

INSERT INTO "technical_reviews"
  ("id","product_claim_id","reviewer_id","reviewer_email_snapshot","decision","evidence_set_hash")
VALUES ('7ec00000-0000-4000-8000-000000000512','cafe0000-0000-4000-8000-000000000501',
        'dddddddd-0000-4000-8000-0000000000ab','td-gate-reviewer@example.invalid','approved',
        repeat('c',64));
SELECT pg_temp.expect_rejected(
  $q$UPDATE "product_claims" SET "review_status"='approved' WHERE "id"='cafe0000-0000-4000-8000-000000000501'$q$,
  '26. a claim review with a stale hash cannot be reused');

-- Top level, for the reason given above the Specification positive control.
SELECT pg_temp.approve_claim('cafe0000-0000-4000-8000-000000000501');
SELECT pg_temp.verdict(
  (SELECT "review_status" = 'approved' FROM "product_claims" WHERE "id"='cafe0000-0000-4000-8000-000000000501'),
  '26. a matching current-transaction approve review IS accepted for a claim',
  (SELECT "review_status"::text FROM "product_claims" WHERE "id"='cafe0000-0000-4000-8000-000000000501'));
SELECT pg_temp.verdict(
  (SELECT count(*) = 1 FROM "v_product_claim_public" WHERE "id"='cafe0000-0000-4000-8000-000000000501'),
  '26. ...and the claim reaches the public claim view',
  (SELECT count(*)::text FROM "v_product_claim_public" WHERE "id"='cafe0000-0000-4000-8000-000000000501'));

/*
 * The forbidden kinds, tested on the CORRECT path.
 *
 * Case 14 proves the CHECK refuses a bare write. These prove the trigger refuses
 * even a perfectly formed approval attempt — the case that would actually be
 * made by the review service, and the one a dropped CHECK would otherwise let
 * through. The kind is checked BEFORE the same-transaction review lookup in
 * `product_claim_approval_gate`, so the subtransaction wrapper cannot be what
 * causes these rejections: the refusal happens on the kind, first.
 */
SELECT pg_temp.expect_rejected(
  $q$SELECT pg_temp.approve_claim('cafe0000-0000-4000-8000-000000000502')$q$,
  '26. LICENSED_BY is refused even with a valid current-transaction review');
SELECT pg_temp.expect_rejected(
  $q$SELECT pg_temp.approve_claim('cafe0000-0000-4000-8000-000000000503')$q$,
  '26. REFERENCE_ONLY is refused even with a valid current-transaction review');
SELECT pg_temp.verdict(
  (SELECT count(*) = 0 FROM "v_product_claim_public"
    WHERE "id" IN ('cafe0000-0000-4000-8000-000000000502','cafe0000-0000-4000-8000-000000000503')),
  '26. neither forbidden kind reached the public claim view',
  (SELECT count(*)::text FROM "v_product_claim_public"
    WHERE "id" IN ('cafe0000-0000-4000-8000-000000000502','cafe0000-0000-4000-8000-000000000503')));
SELECT pg_temp.verdict(
  (SELECT bool_and("review_status" = 'source_recorded') FROM "product_claims"
    WHERE "id" IN ('cafe0000-0000-4000-8000-000000000502','cafe0000-0000-4000-8000-000000000503')),
  '26. and both kept their original status',
  (SELECT string_agg("review_status"::text,',') FROM "product_claims"
    WHERE "id" IN ('cafe0000-0000-4000-8000-000000000502','cafe0000-0000-4000-8000-000000000503')));

-- ── 26f. The gate is not a privilege boundary, and says so ────────────────
-- Everything above runs as the APPLICATION role, which owns these tables. That
-- is the point: the guard holds against the credential the running platform
-- actually uses, not merely against an unprivileged one.
SELECT pg_temp.verdict(
  (SELECT current_user = (SELECT rolname FROM pg_roles r
                            JOIN pg_class c ON c.relowner = r.oid
                           WHERE c.relname = 'specifications')),
  '26. these probes ran as the table OWNER, not a restricted role',
  current_user);
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

# The rollback is not assumed, and it is checked two ways.
#
# FIRST: no row carrying a probe MARKER is left anywhere. Markers, not table totals — an
# imported catalogue legitimately holds thousands of rows in these tables, and "count them all
# and expect zero" only ever worked because the tables happened to be empty.
residue=$(run_sql <<'SQL'
SELECT (SELECT count(*) FROM "categories"    WHERE "slug" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "products"      WHERE "slug" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "products"      WHERE "slug" LIKE 'sr-probe-%')
     + (SELECT count(*) FROM "products"      WHERE "id"::text LIKE '5cee0000%')
     + (SELECT count(*) FROM "products"      WHERE "source_ref" LIKE 'SAMCAT-VERIFY-%')
     + (SELECT count(*) FROM "products"      WHERE "id"::text LIKE 'dddddddd%')
     + (SELECT count(*) FROM "product_grades"  WHERE "id"::text LIKE 'eeeeeeee%')
     + (SELECT count(*) FROM "specifications"  WHERE "id"::text LIKE 'ffffffff%')
     + (SELECT count(*) FROM "product_claims"  WHERE "id"::text LIKE 'cafe0000%')
     + (SELECT count(*) FROM "source_facts"    WHERE "id"::text LIKE 'fac70000%')
     + (SELECT count(*) FROM "import_runs"     WHERE "id"::text LIKE '4a110000%')
     + (SELECT count(*) FROM "technical_reviews" WHERE "id"::text LIKE '7ec00000%')
     + (SELECT count(*) FROM "users"         WHERE "email" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "product_slug_claims" WHERE "slug_key" LIKE 'td-probe-%')
     + (SELECT count(*) FROM "product_slug_claims" WHERE "slug_key" LIKE 'sr-probe-%');
SQL
)

if [ "$(echo "$residue" | tr -d '[:space:]')" = "0" ]; then
  printf '  %-4s %s\n' "PASS" "no probe row survived the transaction"
else
  printf '  %-4s %s\n' "FAIL" "probe rows survived: $residue"
  status=1
fi

# SECOND, and stronger: every counted table is back to exactly what it held before the run.
# This is what makes the script safe against an imported catalogue — it proves the run changed
# NOTHING, rather than proving the tables are empty.
census_after=$(census)

if [ "$census_before" = "$census_after" ]; then
  printf '  %-4s %s\n' "PASS" "every table count is identical to before the run"
else
  printf '  %-4s %s\n' "FAIL" "the probe transaction changed table counts"
  printf '    before: %s\n' "$(echo "$census_before" | tr '\n' ' ')" >&2
  printf '    after:  %s\n' "$(echo "$census_after" | tr '\n' ' ')" >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "All catalog technical-data database invariants hold."
else
  echo "One or more catalog technical-data invariants FAILED." >&2
fi

exit "$status"
