#!/bin/bash
# ---------------------------------------------------------------------------
# Creates the two independent databases required by ADR-002.
#
# ADR-002 forbids a shared database with separate schemas: sam_platform
# (Prisma / apps/api) and sam_cms (Payload / apps/cms) are separate databases
# with separate owners, and neither owner may connect to the other's database.
#
# The isolation is enforced here by REVOKE, not by application configuration.
# PostgreSQL grants CONNECT to PUBLIC on every new database by default, so
# creating two databases is NOT sufficient on its own — without the REVOKE
# below, either user could connect to the other's database freely.
#
# Run `scripts/verify-db-isolation.sh` after the stack is up to prove the
# boundary actually holds (PROJECT_HANDOFF.md §5 step 2).
#
# IMPORTANT: the official postgres image runs files in this directory ONLY on
# first initialisation, when the data volume is empty. Editing this script
# later has no effect on an existing volume — you must either apply the change
# by hand or recreate the volume with `docker compose down -v` (which destroys
# all local data).
# ---------------------------------------------------------------------------
set -euo pipefail

# Fail loudly rather than creating a half-configured cluster.
: "${POSTGRES_PLATFORM_DB:?POSTGRES_PLATFORM_DB must be set}"
: "${POSTGRES_PLATFORM_USER:?POSTGRES_PLATFORM_USER must be set}"
: "${POSTGRES_PLATFORM_PASSWORD:?POSTGRES_PLATFORM_PASSWORD must be set}"
: "${POSTGRES_CMS_DB:?POSTGRES_CMS_DB must be set}"
: "${POSTGRES_CMS_USER:?POSTGRES_CMS_USER must be set}"
: "${POSTGRES_CMS_PASSWORD:?POSTGRES_CMS_PASSWORD must be set}"

echo "ADR-002: creating ${POSTGRES_PLATFORM_DB} and ${POSTGRES_CMS_DB} as independent databases"

# Note on quoting: passwords are interpolated into SQL string literals, so a
# password containing a single quote will break this script. Keep generated
# passwords to alphanumerics and -_.~ characters.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
-- Roles ---------------------------------------------------------------------
CREATE ROLE "${POSTGRES_PLATFORM_USER}" WITH LOGIN PASSWORD '${POSTGRES_PLATFORM_PASSWORD}';
CREATE ROLE "${POSTGRES_CMS_USER}"      WITH LOGIN PASSWORD '${POSTGRES_CMS_PASSWORD}';

-- Databases, each owned by its own role ------------------------------------
CREATE DATABASE "${POSTGRES_PLATFORM_DB}" OWNER "${POSTGRES_PLATFORM_USER}";
CREATE DATABASE "${POSTGRES_CMS_DB}"      OWNER "${POSTGRES_CMS_USER}";

-- The actual boundary: drop the default PUBLIC grant, then re-grant CONNECT
-- to the owning role only. Without this, both roles could connect to both
-- databases and ADR-002 would be convention rather than enforcement.
REVOKE ALL ON DATABASE "${POSTGRES_PLATFORM_DB}" FROM PUBLIC;
REVOKE ALL ON DATABASE "${POSTGRES_CMS_DB}"      FROM PUBLIC;

GRANT CONNECT, TEMPORARY ON DATABASE "${POSTGRES_PLATFORM_DB}" TO "${POSTGRES_PLATFORM_USER}";
GRANT CONNECT, TEMPORARY ON DATABASE "${POSTGRES_CMS_DB}"      TO "${POSTGRES_CMS_USER}";
EOSQL

# Schema-level ownership, applied inside each database so the owning role can
# create its own tables and nothing else can.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_PLATFORM_DB" <<EOSQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "${POSTGRES_PLATFORM_USER}";
GRANT ALL ON SCHEMA public TO "${POSTGRES_PLATFORM_USER}";
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_CMS_DB" <<EOSQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "${POSTGRES_CMS_USER}";
GRANT ALL ON SCHEMA public TO "${POSTGRES_CMS_USER}";
EOSQL

echo "ADR-002: databases created and cross-database CONNECT revoked"
