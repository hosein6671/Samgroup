-- ============================================================================
-- Disabling an account revokes its credentials permanently — ADR-012 §7.
--
-- Follow-up to 20260819120000_add_auth_session_and_user_status, which is
-- applied and is NOT rewritten here: editing an applied migration would change
-- its checksum and put every environment's `_prisma_migrations` history out of
-- agreement with the files. Same rule 20260818140000 followed for the same
-- reason.
--
-- WHAT THE PREVIOUS MIGRATION GOT WRONG
--
-- It made `disabled` a *gate*: every authentication path re-read the account
-- and refused while the status said so. That is suspension, not revocation.
-- Turning the account back on made every credential minted before the disable
-- work again — an unexpired 15-minute access token and a 7-day refresh session
-- alike. "We disabled that account for an hour" therefore did not mean the
-- credentials someone had taken from it stopped working; it meant they paused.
--
-- WHAT REPLACES IT
--
-- One column and two triggers, giving a per-user credential cutoff:
--
--   * every access token whose `iat` second is at or before the cutoff is
--     refused, and
--   * every refresh session live at the moment of the disable is revoked in
--     the same transaction, permanently.
--
-- Re-enabling restores the ability to authenticate with a password and to be
-- issued NEW credentials. It restores nothing that was already issued.
--
-- WHY THE DATABASE ENFORCES THIS AND NOT THE APPLICATION
--
-- **There is no status-management endpoint.** Every status transition today is
-- a direct UPDATE against this database — from a migration, from psql, from a
-- future admin API nobody has written yet — so an invariant living in a NestJS
-- service would be enforced on exactly none of the paths that currently
-- perform the transition. It would also be silently bypassed by the very
-- verification this gate runs.
--
-- That is the position ADR-011 already took and the privacy-policy-version
-- immutability trigger already implements: durable invariants belong to the
-- database, and application validation is permitted only for message quality.
-- The application still checks the cutoff on every request — but as a *read*
-- of a value the database alone is allowed to write.
--
-- WHY THE EXPLICIT BEGIN/COMMIT
--
-- Unchanged from the previous migration: Prisma applies a file
-- statement-by-statement without wrapping it in a transaction, so a failure
-- partway through would leave the column added and the triggers absent — the
-- exact half-state in which disabling looks like it works and revokes nothing.
--
-- This does not touch sam_cms (ADR-002/ADR-006), and it stores no token.
-- ============================================================================

BEGIN;

-- ── The credential cutoff ──────────────────────────────────────────────────
--
-- NULL means no credential has ever been revoked for this account, which is
-- how every user starts and how nearly every user stays.
--
-- **Nullable rather than NOT NULL DEFAULT now(), and the reason is clock
-- skew.** A non-null default would put a cutoff on every account, so every
-- authenticated request would compare a value written from the *database*
-- clock against a JWT `iat` written from the *application* clock. One second
-- of skew between the two containers would then reject freshly issued tokens
-- for every user at once — a total outage caused by a column that was supposed
-- to be inert. With NULL the comparison happens only for accounts that have
-- actually been revoked, where the two clocks disagreeing by a second rejects
-- slightly more than necessary and never less.
ALTER TABLE "users"
  ADD COLUMN "credentials_revoked_at" TIMESTAMPTZ(6);

-- ── Advancing the cutoff, and never lowering it ────────────────────────────
--
-- BEFORE UPDATE FOR EACH ROW, because this has to change the row being written
-- rather than react to one already written — the same shape, and the same
-- argument, as the privacy-policy-version guard: the statement must be correct
-- before it commits, not corrected afterwards.
--
-- Two rules, and the second is the one that makes this revocation:
--
--   1. active → disabled stamps the cutoff with the wall clock (see below).
--   2. The cutoff is MONOTONIC — it can never move backwards and never return
--      to NULL. So disabled → active leaves it exactly where the disable put
--      it, and no later UPDATE can resurrect a credential by rewinding it.
--      Not from a future endpoint, not from a hand-typed psql line, not from
--      an ORM that helpfully writes every column it knows about.
--
-- `clock_timestamp()`, NOT `now()`. `now()` is transaction START time, so a
-- transaction that opened at 12:00:00 and disabled the account at 12:00:09
-- would stamp a cutoff of 12:00:00 — and an access token minted at 12:00:05 on
-- another connection would sit AFTER that cutoff and survive the revocation.
-- `clock_timestamp()` is the real wall clock at the moment the row is written,
-- which is the only value that is guaranteed to be at or after every credential
-- the disable is meant to kill. The cutoff still lives inside the transaction
-- that revokes the sessions below, so a rollback takes both.
CREATE OR REPLACE FUNCTION "users_credential_revocation_guard"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'active' AND NEW."status" = 'disabled' THEN
    NEW."credentials_revoked_at" := clock_timestamp();
  END IF;

  IF OLD."credentials_revoked_at" IS NOT NULL
     AND (NEW."credentials_revoked_at" IS NULL
          OR NEW."credentials_revoked_at" < OLD."credentials_revoked_at") THEN
    RAISE EXCEPTION
      'credentials_revoked_at is monotonic: it cannot be cleared or moved backwards (user %)',
      OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_credential_revocation_guard"
  BEFORE UPDATE ON "users"
  FOR EACH ROW
  EXECUTE FUNCTION "users_credential_revocation_guard"();

-- ── Revoking the live sessions, in the same transaction ────────────────────
--
-- AFTER UPDATE FOR EACH STATEMENT with transition tables, following the
-- convention the nine ADR-011 slug triggers established: one pass over the
-- changed rows rather than one execution per row, so disabling a hundred
-- accounts is one UPDATE against `auth_sessions` and not a hundred.
--
-- Only rows that actually transitioned are considered, which is what makes the
-- two idempotency properties fall out rather than need special-casing:
--
--   * Re-saving an already-disabled user matches nothing, so a repeated
--     disable revokes nothing further and moves no cutoff.
--   * Re-enabling matches nothing either — the sessions were killed on the way
--     down and there is no path here that un-revokes one.
--
-- Scoped by `user_id` to exactly the transitioning users: disabling one
-- account cannot touch another account's sessions.
CREATE OR REPLACE FUNCTION "users_revoke_sessions_on_disable"()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "auth_sessions" AS s
     SET "revoked_at" = now()
   WHERE s."revoked_at" IS NULL
     AND s."user_id" IN (
       SELECT n."id"
         FROM "newtab" AS n
         JOIN "oldtab" AS o ON o."id" = n."id"
        WHERE o."status" = 'active'
          AND n."status" = 'disabled'
     );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_revoke_sessions_on_disable"
  AFTER UPDATE ON "users" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT
  EXECUTE FUNCTION "users_revoke_sessions_on_disable"();

COMMIT;
