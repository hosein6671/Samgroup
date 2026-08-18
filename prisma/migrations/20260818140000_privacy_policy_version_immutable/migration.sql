-- ============================================================================
-- `privacy_policy_version` is immutable after INSERT — enforced by PostgreSQL.
--
-- Follow-up to 20260818120000_add_consent_privacy_policy_version, which added
-- the column. That migration is applied and is NOT rewritten here: editing an
-- applied migration would change its checksum and put every environment's
-- `_prisma_migrations` history out of agreement with the files.
--
-- WHY A DATABASE GUARD AND NOT AN APPLICATION RULE
--
-- The column is consent evidence. Its value answers "which Privacy Policy text
-- did this person agree to", and an answer that can be edited afterwards is not
-- evidence. Today no code path updates either table — there is no Admin surface
-- and no PATCH endpoint — but "no caller exists yet" is a property of this
-- moment, not an invariant. ADR-011 already established the repository's
-- position on this: durable invariants are enforced by the database, and
-- application validation is permitted only for message quality.
--
-- NO BYPASS, DELIBERATELY
--
-- There is no session flag, no privileged role check and no "admin override"
-- path through this trigger, and none may be added. If a consent was recorded
-- against NULL, the platform genuinely cannot later rewrite it to claim a policy
-- was in force. Any future legal correction requirement is a separately designed
-- audit mechanism — a record ABOUT the evidence — never mutation OF it.
--
-- The triggers are ENABLE ALWAYS rather than plain ENABLE. A plain trigger is
-- silently skipped when a session sets `session_replication_role = 'replica'`,
-- which is exactly the kind of privileged bypass the paragraph above rules out.
-- Restores are unaffected: pg_restore loads rows with COPY/INSERT, and this
-- trigger only ever fires on UPDATE.
--
-- WHAT IS NOT HERE
--
-- No generic immutable-column framework, no metadata table of protected
-- columns, no second trigger doing anything else. Every other column on both
-- tables stays normally updateable — the future lead workflow will need
-- `status` and `assigned_to_id` to change, and this must not stand in its way.
-- No other model, column, index or row is touched.
--
-- Atomic by explicit BEGIN/COMMIT, per the convention 20260814120000 recorded:
-- Prisma applies a migration file statement by statement in autocommit, so
-- without this a failure on the second CREATE TRIGGER would leave one table
-- protected and the other not.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- The guard, shared by both tables.
--
-- One function rather than two: plpgsql resolves OLD/NEW field references
-- against the row type at execution time, so the same body serves any table
-- carrying a `privacy_policy_version` column, and `TG_TABLE_NAME` names the one
-- that raised.
--
-- The comparison is IS DISTINCT FROM, which is the whole specification:
--
--   NULL      -> NULL       allowed  (not distinct)
--   'v1'      -> 'v1'       allowed  (not distinct)
--   NULL      -> 'v1'       DENIED
--   'v1'      -> NULL       DENIED
--   'v1'      -> 'v2'       DENIED
--
-- Plain `<>` would let both NULL transitions through, because a comparison with
-- NULL yields NULL and a NULL trigger condition does not raise. That is not a
-- theoretical difference: NULL -> 'v1' is precisely the backfill this evidence
-- field must never permit.
--
-- The body re-checks the condition even though the triggers below carry the
-- same test in a WHEN clause. The WHEN clause is what keeps ordinary updates
-- free — the function is not called at all when the value is unchanged — and
-- the body check is what keeps the function correct if it is ever attached
-- without one.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "consent_policy_version_immutable"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  IF OLD."privacy_policy_version" IS DISTINCT FROM NEW."privacy_policy_version" THEN
    RAISE EXCEPTION 'privacy_policy_version is immutable consent evidence and cannot be changed after insert'
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('%s row %s: %L -> %L',
                             TG_TABLE_NAME, OLD."id",
                             OLD."privacy_policy_version", NEW."privacy_policy_version"),
            HINT    = 'This field records which Privacy Policy revision a person agreed to. A correction must be a separate audit record, never a rewrite of the evidence.';
  END IF;

  RETURN NEW;
END
$fn$;

-- ---------------------------------------------------------------------------
-- Arm it on the two entities that carry the column.
--
-- BEFORE UPDATE FOR EACH ROW: the statement must fail before anything is
-- written, and the decision is per row.
-- ---------------------------------------------------------------------------
CREATE TRIGGER "inquiries_privacy_policy_version_immutable"
  BEFORE UPDATE ON "inquiries"
  FOR EACH ROW
  WHEN (OLD."privacy_policy_version" IS DISTINCT FROM NEW."privacy_policy_version")
  EXECUTE FUNCTION "consent_policy_version_immutable"();

ALTER TABLE "inquiries"
  ENABLE ALWAYS TRIGGER "inquiries_privacy_policy_version_immutable";

CREATE TRIGGER "custom_formulation_requests_privacy_policy_version_immutable"
  BEFORE UPDATE ON "custom_formulation_requests"
  FOR EACH ROW
  WHEN (OLD."privacy_policy_version" IS DISTINCT FROM NEW."privacy_policy_version")
  EXECUTE FUNCTION "consent_policy_version_immutable"();

ALTER TABLE "custom_formulation_requests"
  ENABLE ALWAYS TRIGGER "custom_formulation_requests_privacy_policy_version_immutable";

COMMIT;
