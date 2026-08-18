#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Proves that `privacy_policy_version` cannot change after INSERT, and that the
# guard is PostgreSQL's rather than the application's.
#
# The column records which Privacy Policy revision a person consented to
# (docs/SECURITY.md "Personal Data Retention"). Evidence that can be edited
# afterwards is not evidence, so migration
# 20260818140000_privacy_policy_version_immutable installs a BEFORE UPDATE
# trigger on `inquiries` and `custom_formulation_requests`. This script checks
# that the trigger behaves as specified, on IS DISTINCT FROM semantics:
#
#   NULL -> NULL              allowed        'v1' -> 'v1'   allowed
#   NULL -> revision          DENIED         'v1' -> 'v2'   DENIED
#   revision -> NULL          DENIED
#
# and that every OTHER column stays updateable, because the future lead
# workflow needs `status` and `assigned_to_id` to move.
#
# It connects as the APPLICATION role, which is the identity that matters: the
# question is not whether a database administrator could disable a trigger —
# any table owner can — but whether the running platform can rewrite consent
# evidence. It cannot.
#
# NOTHING SURVIVES THIS SCRIPT. Every probe row is written inside one
# transaction that ends in ROLLBACK, and the tables are re-checked afterwards.
#
# Usage:  ./scripts/verify-consent-version-immutability.sh
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

# Each case reports one `result|table|case|observed` line. A case that behaves
# unexpectedly still reports rather than aborting, so one failure does not hide
# the rest of the matrix.
output=$(run_sql <<'SQL'
BEGIN;

INSERT INTO "inquiries"
  ("id","first_name","last_name","company_name","country","email","industry",
   "inquiry_type","products_of_interest","consent_given","status","privacy_policy_version")
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001','Probe','Null','Probe Ltd','Nowhere',
   'probe@example.invalid','Testing','general_inquiry','{}',true,'new',NULL),
  ('aaaaaaaa-0000-4000-8000-000000000002','Probe','Rev','Probe Ltd','Nowhere',
   'probe@example.invalid','Testing','general_inquiry','{}',true,'new','probe-rev-1');

INSERT INTO "custom_formulation_requests"
  ("id","company_name","country","industry","email","product_or_application",
   "required_specifications","consent_given","status","privacy_policy_version")
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001','Probe Ltd','Nowhere','Testing',
   'probe@example.invalid','Probe','Probe spec',true,'new',NULL),
  ('bbbbbbbb-0000-4000-8000-000000000002','Probe Ltd','Nowhere','Testing',
   'probe@example.invalid','Probe','Probe spec',true,'new','probe-rev-1');

CREATE TEMP TABLE "matrix"("expected" TEXT, "tbl" TEXT, "case" TEXT, "observed" TEXT);

DO $probe$
DECLARE
  v_tbl  TEXT;
  v_null UUID;
  v_rev  UUID;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['inquiries','custom_formulation_requests'] LOOP
    IF v_tbl = 'inquiries' THEN
      v_null := 'aaaaaaaa-0000-4000-8000-000000000001';
      v_rev  := 'aaaaaaaa-0000-4000-8000-000000000002';
    ELSE
      v_null := 'bbbbbbbb-0000-4000-8000-000000000001';
      v_rev  := 'bbbbbbbb-0000-4000-8000-000000000002';
    END IF;

    -- 1 and 2: the INSERTs above are the assertion. Reaching this line proves them.
    INSERT INTO "matrix" VALUES
      ('allowed', v_tbl, '1. INSERT with NULL revision', 'allowed'),
      ('allowed', v_tbl, '2. INSERT with a revision',    'allowed');

    -- Each attempt runs in its own subtransaction, so a denial does not abort
    -- the probe.
    BEGIN
      EXECUTE format('UPDATE %I SET "status" = %L WHERE "id" = %L', v_tbl, 'probe-touched', v_rev);
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '3. UPDATE another column, revision untouched', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '3. UPDATE another column, revision untouched', 'DENIED ' || SQLSTATE);
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = %L WHERE "id" = %L', v_tbl, 'probe-rev-2', v_null);
      INSERT INTO "matrix" VALUES ('DENIED', v_tbl, '4. NULL -> revision', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('DENIED', v_tbl, '4. NULL -> revision', 'DENIED ' || SQLSTATE);
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = %L WHERE "id" = %L', v_tbl, 'probe-rev-2', v_rev);
      INSERT INTO "matrix" VALUES ('DENIED', v_tbl, '5. revision -> different revision', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('DENIED', v_tbl, '5. revision -> different revision', 'DENIED ' || SQLSTATE);
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = NULL WHERE "id" = %L', v_tbl, v_rev);
      INSERT INTO "matrix" VALUES ('DENIED', v_tbl, '6. revision -> NULL', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('DENIED', v_tbl, '6. revision -> NULL', 'DENIED ' || SQLSTATE);
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = %L WHERE "id" = %L', v_tbl, 'probe-rev-1', v_rev);
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '7. same revision -> same revision', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '7. same revision -> same revision', 'DENIED ' || SQLSTATE);
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = NULL WHERE "id" = %L', v_tbl, v_null);
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '8. NULL -> NULL', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '8. NULL -> NULL', 'DENIED ' || SQLSTATE);
    END;
  END LOOP;
END
$probe$;

-- `A` is "enabled always": the trigger still fires for a session that sets
-- session_replication_role = replica, which would otherwise be a bypass.
INSERT INTO "matrix"
SELECT 'A', c.relname, '9. trigger is ENABLE ALWAYS', t.tgenabled
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal
   AND t.tgname LIKE '%privacy_policy_version_immutable';

SELECT format('%s|%s|%s|%s',
              CASE WHEN split_part("observed", ' ', 1) = "expected" THEN 'PASS' ELSE 'FAIL' END,
              "tbl", "case", "observed")
  FROM "matrix"
 ORDER BY "tbl", "case";

ROLLBACK;
SQL
)

if [ -z "$output" ]; then
  echo "ERROR: the probe produced no output — the SQL did not run." >&2
  exit 1
fi

echo "privacy_policy_version immutability check"
echo

fail_count=0
pass_count=0

# psql prints a status line for every statement (BEGIN, INSERT 0 2, ROLLBACK).
# Only the pipe-delimited rows are assertions; anything else is noise and must
# not be counted as a failure.
while IFS= read -r line; do
  case "$line" in
    *"|"*) ;;
    *) continue ;;
  esac

  IFS='|' read -r result tbl description observed <<< "$line"
  printf '  %-4s  %-27s  %-46s  %s\n' "$result" "$tbl" "$description" "$observed"
  if [ "$result" = "PASS" ]; then
    pass_count=$((pass_count + 1))
  else
    fail_count=$((fail_count + 1))
  fi
done <<< "$output"

# The transaction rolled back, so both tables must hold exactly what they held
# before. Checked rather than assumed — a probe row left in a lead table would
# be indistinguishable from a real submission.
residue=$(run_sql <<'SQL'
SELECT (SELECT count(*) FROM "inquiries" WHERE "email" = 'probe@example.invalid')
     + (SELECT count(*) FROM "custom_formulation_requests" WHERE "email" = 'probe@example.invalid');
SQL
)

echo
if [ "$(echo "$residue" | tr -d '[:space:]')" = "0" ]; then
  echo "  PASS  no probe row survived the rollback"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL  probe rows survived — clean them before proceeding"
  fail_count=$((fail_count + 1))
fi

echo
echo "-------------------------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass_count" "$fail_count"

if [ "$fail_count" -ne 0 ]; then
  echo "RESULT: FAIL — consent evidence is not immutable. Do not proceed."
  exit 1
fi

echo "RESULT: PASS — privacy_policy_version cannot be changed after insert."
