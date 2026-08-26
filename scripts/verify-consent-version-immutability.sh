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
# workflow needs `status` and `assigned_to_id` to move. That half is a POSITIVE
# CONTROL: case 3 performs a legal `status` update and case 3b reads the row
# back to confirm the new value landed AND the consent evidence beside it did
# not move. "The statement did not raise" would not have proved either.
#
# ── A denial only counts when it is the RIGHT denial ────────────────────────
#
# Every negative case asserts the SPECIFIC error the guard raises — SQLSTATE
# 23001 (`restrict_violation`) together with the trigger's own message — and not
# merely that something failed. Two defects made that necessary rather than
# tidy, and both were real:
#
#   * case 3 wrote `status = 'probe-touched'`, which violates
#     `inquiries_status_check` (`new` / `in_progress` / `closed`). It was denied
#     with 23514 at an unrelated CHECK, before the consent trigger was ever
#     reached, and the script reported FAIL for a guard that is in fact working;
#   * the scoring compared only the first word of the observation, so any error
#     at all satisfied a `DENIED` expectation.
#
# Together those meant a negative case could have gone green while the trigger
# it names had been dropped. `inquiries_status_check` was NOT weakened to fix
# this — the probe was corrected to use a value the column has always permitted.
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

/*
 * What a CORRECT denial looks like, in one place.
 *
 * The guard under test is the BEFORE UPDATE trigger
 * `<table>_privacy_policy_version_immutable`, which executes
 * `consent_policy_version_immutable` and raises with
 * `ERRCODE = 'restrict_violation'` — SQLSTATE 23001 — and a fixed message.
 *
 * Both halves are required. The SQLSTATE alone is not enough: 23001 is
 * `restrict_violation`, which a future ON DELETE RESTRICT foreign key on either
 * table could also raise. The message alone is not enough either, because a
 * message is prose and prose gets reworded. Together they identify this trigger
 * and nothing else, which is what "assert the intended error" has to mean.
 */
CREATE FUNCTION pg_temp.classify_denial("p_sqlstate" TEXT, "p_message" TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN "p_sqlstate" = '23001'
     AND "p_message" LIKE '%privacy_policy_version is immutable consent evidence%'
      THEN 'DENIED 23001 consent-guard'
    ELSE 'DENIED ' || "p_sqlstate" || ' other-guard'
  END
$fn$;

DO $probe$
DECLARE
  v_tbl  TEXT;
  v_null UUID;
  v_rev  UUID;
  /* The positive control's read-back count. */
  v_ok   INT;
  /*
   * The only observation a negative case may be scored a PASS on. Held in a
   * variable so the expectation and the classifier cannot drift apart.
   */
  v_denied_expected CONSTANT TEXT := 'DENIED 23001 consent-guard';
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

    /*
     * Each attempt runs in its own subtransaction, so a denial does not abort
     * the probe.
     *
     * ── A denial is only a pass when it is THE RIGHT denial ──────────────────
     *
     * `pg_temp.classify_denial` classifies the error rather than merely recording
     * that one happened. Every negative case below expects the exact string
     * `DENIED 23001 consent-guard`, which requires BOTH the SQLSTATE of
     * `restrict_violation` AND the trigger's own message. Any other failure —
     * a CHECK violation, a foreign key, a typo in a column name — produces
     * `DENIED <sqlstate> other-guard` and FAILS.
     *
     * This is not hypothetical tightening. Case 3 below used to write
     * `status = 'probe-touched'`, which violates `inquiries_status_check`
     * (`new` / `in_progress` / `closed`) and was denied with 23514 before the
     * consent trigger was ever reached — an unrelated CHECK standing in for the
     * guard under test. It was caught because case 3 expects `allowed`; had the
     * same mistake been made in a negative case, "any SQL error" would have
     * reported a green pass for a guard that never fired.
     */
    BEGIN
      EXECUTE format('UPDATE %I SET "status" = %L WHERE "id" = %L', v_tbl, 'in_progress', v_rev);
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '3. UPDATE another column, revision untouched', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES ('allowed', v_tbl, '3. UPDATE another column, revision untouched', 'DENIED ' || SQLSTATE);
    END;

    /*
     * The POSITIVE CONTROL, and the reason case 3 alone is not one.
     *
     * "The statement did not raise" is a weaker claim than "the column changed":
     * an UPDATE whose WHERE matched nothing also does not raise. This reads the
     * row back and requires the new value to be there AND the consent evidence
     * beside it to be untouched — which is the whole invariant stated
     * positively, and the half a negative probe can never establish.
     */
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE "id" = %L AND "status" = %L '
      || 'AND "privacy_policy_version" IS NOT DISTINCT FROM %L',
      v_tbl, v_rev, 'in_progress', 'probe-rev-1')
      INTO v_ok;
    INSERT INTO "matrix" VALUES
      ('allowed', v_tbl, '3b. the unrelated update actually persisted',
       CASE WHEN v_ok = 1 THEN 'allowed' ELSE 'DENIED not-persisted' END);

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = %L WHERE "id" = %L', v_tbl, 'probe-rev-2', v_null);
      INSERT INTO "matrix" VALUES (v_denied_expected, v_tbl, '4. NULL -> revision', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES (v_denied_expected, v_tbl, '4. NULL -> revision', pg_temp.classify_denial(SQLSTATE, SQLERRM));
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = %L WHERE "id" = %L', v_tbl, 'probe-rev-2', v_rev);
      INSERT INTO "matrix" VALUES (v_denied_expected, v_tbl, '5. revision -> different revision', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES (v_denied_expected, v_tbl, '5. revision -> different revision', pg_temp.classify_denial(SQLSTATE, SQLERRM));
    END;

    BEGIN
      EXECUTE format('UPDATE %I SET "privacy_policy_version" = NULL WHERE "id" = %L', v_tbl, v_rev);
      INSERT INTO "matrix" VALUES (v_denied_expected, v_tbl, '6. revision -> NULL', 'allowed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO "matrix" VALUES (v_denied_expected, v_tbl, '6. revision -> NULL', pg_temp.classify_denial(SQLSTATE, SQLERRM));
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

/*
 * EXACT equality, not a prefix match.
 *
 * This used to compare `split_part(observed, ' ', 1)` against `expected`, which
 * compared only the first WORD — so every negative case scored a PASS on the
 * bare token `DENIED`, whatever error had actually been raised. That is the
 * "any SQL error counts as success" shape, and it is precisely what would have
 * hidden a guard that had been dropped and replaced by an incidental constraint.
 *
 * With full equality a negative case passes only on the exact string
 * `DENIED 23001 consent-guard`, which `pg_temp.classify_denial` emits for the
 * consent trigger and for nothing else.
 */
SELECT format('%s|%s|%s|%s',
              CASE WHEN "observed" = "expected" THEN 'PASS' ELSE 'FAIL' END,
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
