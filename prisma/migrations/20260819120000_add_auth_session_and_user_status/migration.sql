-- ============================================================================
-- Application sessions and account status — ADR-012.
--
-- Two things arrive together because neither is complete without the other:
-- a refresh session that cannot be refused for a disabled account is not a
-- revocation mechanism, and an account status that no session checks is a
-- column nobody reads.
--
-- WHY THE EXPLICIT BEGIN/COMMIT
--
-- Same reason as 20260814120000_add_product_slug_namespace_registry, which
-- measured it: Prisma applies a migration file statement-by-statement without
-- wrapping it in a transaction, so a failure partway through would leave the
-- enum created and the table absent. The explicit block makes the file
-- all-or-nothing.
--
-- WHAT THIS DOES NOT DO
--
--   - It does not touch sam_cms. Payload owns that database, has its own
--     `users` and `users_sessions` tables, and ADR-006 keeps the two identity
--     systems unrelated. Nothing here crosses the ADR-002 split.
--   - It does not backfill a value into an existing row by UPDATE. The column
--     is added NOT NULL DEFAULT 'active', which PostgreSQL applies to every
--     existing row as part of the ADD COLUMN itself — see the note below.
--   - It stores no refresh token. `token_hash` holds a SHA-256 digest and the
--     application has no path that writes anything else into it.
-- ============================================================================

BEGIN;

-- ── Account status ─────────────────────────────────────────────────────────
--
-- Two labels, and the enum is the enforcement: a status outside this set is a
-- write error, not a validation rule someone can forget to apply. Adding a
-- third label later is a migration and a decision, which is the point.
CREATE TYPE "user_status" AS ENUM ('active', 'disabled');

-- NOT NULL with a default, in one statement.
--
-- PostgreSQL 11+ fills existing rows from the default without rewriting the
-- table, so every `users` row that exists at this moment becomes 'active' —
-- there is no window in which a row has no status, and no separate UPDATE that
-- could be run against a subset. The default is retained afterwards rather
-- than dropped: it is what makes a raw INSERT that omits the column safe, and
-- "an account whose status was never decided" is a state this platform should
-- not be able to represent.
ALTER TABLE "users"
  ADD COLUMN "status" "user_status" NOT NULL DEFAULT 'active';

-- ── Refresh sessions ───────────────────────────────────────────────────────
--
-- `token_hash` is a SHA-256 digest in lowercase hex — 64 characters, fixed.
-- The raw refresh token is never written here, and no column in this table can
-- hold one: this is the whole reason the digest exists rather than the token.
CREATE TABLE "auth_sessions" (
    "id"         UUID         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "token_hash" TEXT         NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- The lookup key. Unique because "the session for this token" must have at
-- most one answer: without it, two rows could answer to one credential and
-- rotation would have no single row to claim.
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- PostgreSQL does not index a foreign key on its own, and this is also the
-- only non-token query shape the application has: logout scopes its revocation
-- to the authenticated caller's own sessions, which is a lookup by user_id.
--
-- No index on expires_at or revoked_at, deliberately. Nothing queries by
-- either: eligibility is checked on a row already found by its unique digest,
-- and there is no expiry sweep. An index that no query uses is write cost
-- with no read benefit.
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- ON DELETE CASCADE, deliberately rather than RESTRICT.
--
-- Deleting a `User` is this platform's hardest revocation, and it already
-- takes effect on the next authenticated request because the guard resolves
-- the user from this database every time. Sessions are that user's
-- credentials; leaving them behind would be leaving rows that reference an
-- identity that no longer exists. RESTRICT would instead make a delete fail
-- because the account had once logged in, turning the strongest revocation
-- into the one that is hardest to perform.
ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
