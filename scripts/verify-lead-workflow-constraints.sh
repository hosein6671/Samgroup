#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Proves the lead-workflow invariants that live in PostgreSQL rather than in
# application code — the ones a mocked unit test cannot reach.
#
# Migration 20260820120000_add_lead_workflow adds a CHECK constraining
# `status` on both lead tables to exactly ('new','in_progress','closed'), and
# the workflow service relies on compare-and-set semantics for concurrency
# (ADR-013). Neither is visible from a Jest suite that fakes Prisma, so both are
# checked here against the real database:
#
#   1. CHECK rejects a status outside the vocabulary, on BOTH tables
#   2. CHECK accepts all three legal values
#   3. Status compare-and-set: a stale `WHERE status = <old>` updates 0 rows
#   4. Assignment compare-and-set, including the IS NULL case two Admins race on
#   5. Deleting an assignee SET NULLs the live assignment (ADR-012 is unweakened)
#   6. ...and the history snapshots still name both people afterwards
#
# Point 6 is the reason the snapshot columns exist. Run against the application
# role, because the question is what the running platform can do — not what a
# database owner could do by dropping a constraint.
#
# NOTHING SURVIVES THIS SCRIPT. Every row is written inside one transaction that
# ends in ROLLBACK, and the tables are counted afterwards to prove it.
#
# Usage:  ./scripts/verify-lead-workflow-constraints.sh
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
  WHEN check_violation THEN RETURN 'PASS|' || label || '|rejected by CHECK';
  WHEN others          THEN RETURN 'FAIL|' || label || '|rejected by ' || SQLSTATE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.expect_accepted(stmt text, label text) RETURNS text AS $$
BEGIN
  EXECUTE stmt;
  RETURN 'PASS|' || label || '|accepted';
EXCEPTION
  WHEN others THEN RETURN 'FAIL|' || label || '|rejected by ' || SQLSTATE;
END;
$$ LANGUAGE plpgsql;

-- Two staff accounts and one lead of each kind, all clearly marked.
INSERT INTO "users" ("id","email","password_hash","role","status")
VALUES ('aaaaaaaa-0000-4000-8000-00000000000a','wf-probe-ada@example.invalid','x','sales_expert','active'),
       ('aaaaaaaa-0000-4000-8000-00000000000b','wf-probe-grace@example.invalid','x','sales_expert','active'),
       ('aaaaaaaa-0000-4000-8000-00000000000c','wf-probe-admin@example.invalid','x','admin','active');

INSERT INTO "inquiries"
  ("id","first_name","last_name","company_name","country","email","industry",
   "inquiry_type","products_of_interest","consent_given","status")
VALUES ('bbbbbbbb-0000-4000-8000-000000000001','Probe','Lead','Probe Ltd','Nowhere',
        'probe@example.invalid','Testing','general_inquiry','{}',true,'new');

INSERT INTO "custom_formulation_requests"
  ("id","company_name","country","industry","email","product_or_application",
   "required_specifications","consent_given","status")
VALUES ('bbbbbbbb-0000-4000-8000-000000000002','Probe Ltd','Nowhere','Testing',
        'probe@example.invalid','Probe product','Probe specs',true,'new');

-- 1 + 2. The vocabulary, on both tables.
SELECT pg_temp.expect_rejected(
  $q$UPDATE inquiries SET status='qualified' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$q$,
  'inquiries rejects a status outside the vocabulary');
SELECT pg_temp.expect_rejected(
  $q$UPDATE custom_formulation_requests SET status='won' WHERE id='bbbbbbbb-0000-4000-8000-000000000002'$q$,
  'custom_formulation_requests rejects a status outside the vocabulary');
SELECT pg_temp.expect_rejected(
  $q$UPDATE inquiries SET status='' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$q$,
  'inquiries rejects an empty status');
SELECT pg_temp.expect_accepted(
  $q$UPDATE inquiries SET status='in_progress' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$q$,
  'inquiries accepts in_progress');
SELECT pg_temp.expect_accepted(
  $q$UPDATE inquiries SET status='closed' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$q$,
  'inquiries accepts closed');
SELECT pg_temp.expect_accepted(
  $q$UPDATE custom_formulation_requests SET status='closed' WHERE id='bbbbbbbb-0000-4000-8000-000000000002'$q$,
  'custom_formulation_requests accepts closed');

-- 3. Status compare-and-set. The lead is 'closed' now; a caller who still
-- believes it is 'new' must update nothing rather than overwrite the change.
WITH stale AS (
  UPDATE inquiries SET status='in_progress'
  WHERE id='bbbbbbbb-0000-4000-8000-000000000001' AND status='new'
  RETURNING 1
)
SELECT CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
       || '|stale status CAS updates no row|' || count(*)::text FROM stale;

WITH fresh AS (
  UPDATE inquiries SET status='in_progress'
  WHERE id='bbbbbbbb-0000-4000-8000-000000000001' AND status='closed'
  RETURNING 1
)
SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
       || '|current status CAS updates one row|' || count(*)::text FROM fresh;

-- 4. Assignment compare-and-set. `IS NOT DISTINCT FROM` is what Prisma's
-- `assignedToId: null` compiles to, and it is the predicate two Admins racing
-- for the same unassigned lead depend on.
WITH claim AS (
  UPDATE inquiries SET assigned_to_id='aaaaaaaa-0000-4000-8000-00000000000a'
  WHERE id='bbbbbbbb-0000-4000-8000-000000000001'
    AND assigned_to_id IS NOT DISTINCT FROM NULL
  RETURNING 1
)
SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
       || '|first claim of an unassigned lead wins|' || count(*)::text FROM claim;

WITH loser AS (
  UPDATE inquiries SET assigned_to_id='aaaaaaaa-0000-4000-8000-00000000000b'
  WHERE id='bbbbbbbb-0000-4000-8000-000000000001'
    AND assigned_to_id IS NOT DISTINCT FROM NULL
  RETURNING 1
)
SELECT CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
       || '|second claim of the same lead updates nothing|' || count(*)::text FROM loser;

-- The audit rows a real reassignment would have written, with both ends snapshotted.
INSERT INTO "lead_assignment_history"
  ("id","entity_type","entity_id","from_assignee_id","from_assignee_email_snapshot",
   "to_assignee_id","to_assignee_email_snapshot","changed_by_id","changed_by_email_snapshot")
VALUES ('cccccccc-0000-4000-8000-000000000001','Inquiry','bbbbbbbb-0000-4000-8000-000000000001',
        NULL, NULL,
        'aaaaaaaa-0000-4000-8000-00000000000a','wf-probe-ada@example.invalid',
        'aaaaaaaa-0000-4000-8000-00000000000c','wf-probe-admin@example.invalid');

INSERT INTO "status_history"
  ("id","entity_type","entity_id","from_status","to_status","changed_by_id","changed_by_email_snapshot")
VALUES ('cccccccc-0000-4000-8000-000000000002','Inquiry','bbbbbbbb-0000-4000-8000-000000000001',
        'new','in_progress','aaaaaaaa-0000-4000-8000-00000000000a','wf-probe-ada@example.invalid');

-- 5. Deleting the assignee. ADR-012 keeps physical deletion as the strongest
-- revocation, so this must succeed and must SET NULL — not RESTRICT.
DELETE FROM "users" WHERE id='aaaaaaaa-0000-4000-8000-00000000000a';

SELECT CASE WHEN assigned_to_id IS NULL THEN 'PASS' ELSE 'FAIL' END
       || '|deleting the assignee unassigns the live lead|'
       || coalesce(assigned_to_id::text,'NULL')
FROM inquiries WHERE id='bbbbbbbb-0000-4000-8000-000000000001';

-- 6. ...and the history still names them. This is the whole point of the
-- snapshot columns: the FK is gone, the record is not.
SELECT CASE WHEN to_assignee_id IS NULL
             AND to_assignee_email_snapshot = 'wf-probe-ada@example.invalid'
            THEN 'PASS' ELSE 'FAIL' END
       || '|assignment history still names a deleted assignee|'
       || coalesce(to_assignee_email_snapshot,'LOST')
FROM lead_assignment_history WHERE id='cccccccc-0000-4000-8000-000000000001';

SELECT CASE WHEN changed_by_id IS NULL
             AND changed_by_email_snapshot = 'wf-probe-ada@example.invalid'
            THEN 'PASS' ELSE 'FAIL' END
       || '|status history still names a deleted actor|'
       || coalesce(changed_by_email_snapshot,'LOST')
FROM status_history WHERE id='cccccccc-0000-4000-8000-000000000002';

ROLLBACK;
SQL
)

status=0

if [ -z "$output" ]; then
  echo "ERROR: no output from psql — the probe transaction did not run." >&2
  exit 1
fi

# psql echoes a command tag for every INSERT/DELETE/ROLLBACK alongside the
# assertion rows, so only lines that actually carry a verdict are read. Without
# this filter a fully passing run reports failure, because "INSERT 0 1" is not
# the string "PASS".
verdicts=$(echo "$output" | grep -E '^(PASS|FAIL)\|')

if [ -z "$verdicts" ]; then
  echo "ERROR: the probe produced no verdict lines." >&2
  exit 1
fi

while IFS='|' read -r result label observed; do
  [ -z "$result" ] && continue
  printf '  %-4s %-58s %s\n' "$result" "$label" "$observed"
  [ "$result" = "PASS" ] || status=1
done <<< "$verdicts"

# The rollback is not assumed. Both lead tables and both history tables must be
# exactly as they were.
residue=$(run_sql <<'SQL'
SELECT (SELECT count(*) FROM inquiries WHERE company_name = 'Probe Ltd')
     + (SELECT count(*) FROM custom_formulation_requests WHERE company_name = 'Probe Ltd')
     + (SELECT count(*) FROM users WHERE email LIKE 'wf-probe-%')
     + (SELECT count(*) FROM lead_assignment_history WHERE entity_id = 'bbbbbbbb-0000-4000-8000-000000000001')
     + (SELECT count(*) FROM status_history WHERE entity_id = 'bbbbbbbb-0000-4000-8000-000000000001');
SQL
)

if [ "$(echo "$residue" | tr -d '[:space:]')" = "0" ]; then
  printf '  %-4s %s\n' "PASS" "nothing survived the probe transaction"
else
  printf '  %-4s %s\n' "FAIL" "probe rows survived: $residue"
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "All lead-workflow database invariants hold."
else
  echo "One or more lead-workflow invariants FAILED." >&2
fi

exit "$status"
