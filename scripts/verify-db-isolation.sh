#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Proves the ADR-002 database boundary is enforced by PostgreSQL itself.
#
# ADR-002 requires sam_platform (Prisma / apps/api) and sam_cms (Payload /
# apps/cms) to be independent databases whose owners cannot reach each other.
# The positive case is proven every time an app connects. The NEGATIVE case is
# the one that matters, and the one PROJECT_HANDOFF.md §5 step 2 asks for by
# name: confirm the sam_platform user genuinely CANNOT connect to sam_cms.
#
# Without that check the isolation is convention, not enforcement — PostgreSQL
# grants CONNECT to PUBLIC on every new database by default, so two databases
# alone would still be mutually reachable.
#
# SCOPE — the superuser is intentionally excluded.
# This script tests the two APPLICATION roles only. The `postgres` superuser
# can still reach both databases, by design: the container entrypoint needs it
# to create them, and backups need it to dump them per database. ADR-002
# separates the two applications from each other, not the database
# administrator from the server. A PASS here therefore means "neither
# application role can cross the boundary" — it does not mean "no role can".
#
# Usage:  ./scripts/verify-db-isolation.sh
# Exit:   0 only if all four assertions hold; 1 otherwise.
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

for var in POSTGRES_PLATFORM_DB POSTGRES_PLATFORM_USER POSTGRES_PLATFORM_PASSWORD \
           POSTGRES_CMS_DB POSTGRES_CMS_USER POSTGRES_CMS_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in $ENV_FILE" >&2
    exit 1
  fi
done

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "ERROR: the 'postgres' service is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

pass_count=0
fail_count=0

# Connects over TCP to 127.0.0.1 *inside* the container, which forces password
# authentication through pg_hba. Connecting over the local socket could succeed
# via peer/trust auth and would not test what we mean to test.
try_connect() {
  local user="$1" password="$2" database="$3"
  docker compose exec -T -e PGPASSWORD="$password" postgres \
    psql -h 127.0.0.1 -U "$user" -d "$database" -tAc 'SELECT 1' >/dev/null 2>&1
}

assert_can_connect() {
  local user="$1" password="$2" database="$3"
  if try_connect "$user" "$password" "$database"; then
    echo "  PASS  $user CAN connect to $database (expected)"
    pass_count=$((pass_count + 1))
  else
    echo "  FAIL  $user CANNOT connect to $database — it owns this database and must be able to"
    fail_count=$((fail_count + 1))
  fi
}

assert_cannot_connect() {
  local user="$1" password="$2" database="$3"
  if try_connect "$user" "$password" "$database"; then
    echo "  FAIL  $user CAN connect to $database — ADR-002 ISOLATION IS BROKEN"
    fail_count=$((fail_count + 1))
  else
    echo "  PASS  $user cannot connect to $database (expected)"
    pass_count=$((pass_count + 1))
  fi
}

echo "ADR-002 database isolation check"
echo
echo "Positive cases — each owner reaches its own database:"
assert_can_connect "$POSTGRES_PLATFORM_USER" "$POSTGRES_PLATFORM_PASSWORD" "$POSTGRES_PLATFORM_DB"
assert_can_connect "$POSTGRES_CMS_USER" "$POSTGRES_CMS_PASSWORD" "$POSTGRES_CMS_DB"

echo
echo "Negative cases — neither owner reaches the other's database:"
assert_cannot_connect "$POSTGRES_PLATFORM_USER" "$POSTGRES_PLATFORM_PASSWORD" "$POSTGRES_CMS_DB"
assert_cannot_connect "$POSTGRES_CMS_USER" "$POSTGRES_CMS_PASSWORD" "$POSTGRES_PLATFORM_DB"

echo
echo "-------------------------------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass_count" "$fail_count"

if [ "$fail_count" -ne 0 ]; then
  echo "RESULT: FAIL — the ADR-002 boundary is not enforced. Do not proceed."
  exit 1
fi

echo "RESULT: PASS — ADR-002 isolation is enforced by PostgreSQL."
