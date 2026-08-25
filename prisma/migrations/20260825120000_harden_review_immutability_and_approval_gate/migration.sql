-- ---------------------------------------------------------------------------
-- PRODUCT-REVIEW-1A-H1 — the two database halves of the review gate.
--
-- ADR-014 §8 recorded a LIMITATION on purpose and deferred closing it:
--
--   > a caller with base-table write access can set `review_status = 'approved'`
--   > with ZERO TechnicalReview rows and no evidence-set-hash verification, and
--   > the row becomes publicly visible immediately. The database gates WHAT IS
--   > READ, not WHO DECIDED.
--
-- PRODUCT-REVIEW-1A built the review service that performs the transition
-- correctly (ADR-016). A service is not a boundary: `sam_platform_user` OWNS
-- these tables, so a direct `UPDATE specifications SET review_status='approved'`
-- from a psql session, a seed script, or a future module would still publish an
-- unreviewed technical value. This migration makes that impossible.
--
-- An audit during 1A also found a second, smaller gap that had been ASSUMED
-- closed and was not: `technical_reviews` accepted UPDATE and DELETE. Review
-- history that can be rewritten is not audit history.
--
-- ── Strictly additive ────────────────────────────────────────────────────────
--
-- No column is added, dropped, renamed or retyped. No row is written. No applied
-- migration is edited. Three functions and three triggers are created, and two
-- COMMENTs that describe a now-closed limitation are corrected. Every existing
-- constraint, index, view and trigger is left exactly as it was.
--
-- ── What this does NOT do ────────────────────────────────────────────────────
--
-- It gates ENTRY INTO `approved` and nothing else. Leaving `approved` — a
-- rejection, a return to review, supersession by a later import, a soft delete —
-- stays unrestricted, deliberately. See section 3's note.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. TECHNICAL REVIEWS ARE IMMUTABLE.
--
-- A `technical_reviews` row records that a named person approved or refused a
-- technical fact, on a stated evidence set, at a stated time. Every one of those
-- four is worthless if the row can be edited afterwards: an approval could be
-- re-pointed at a different subject, its note rewritten, its evidence hash
-- forged to make a stale approval look current, or the whole decision deleted so
-- that an approved specification appears to have been approved by nobody.
--
-- This mirrors `source_facts_immutable_guard` exactly, with ONE deliberate
-- difference: that trigger blocks UPDATE only, because `source_facts` rows that
-- support nothing are import artefacts and being unable to clear one would make
-- a bad import permanent. Nothing here is an artefact — a review is a decision a
-- person made — so DELETE is blocked as well.
--
-- ENABLE ALWAYS rather than plain ENABLE, following
-- 20260818140000_privacy_policy_version_immutable and
-- 20260822120000_add_catalog_technical_data: a plain trigger is silently skipped
-- by a session that sets `session_replication_role = 'replica'`, which is exactly
-- the privileged bypass an audit table must not have. Restores are unaffected —
-- pg_restore loads rows with COPY/INSERT and this fires on neither.
--
-- CORRECTING A REVIEW: you do not. A decision that was wrong is superseded by a
-- LATER decision on the same subject, which is what the history ordering in
-- `catalog-review.service.ts` renders. The trail shows both, which is the point.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "technical_reviews_immutable"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  /*
   * ── THE ONE PERMITTED UPDATE, and it is not a loophole ───────────────────
   *
   * `reviewer_id` is ON DELETE SET NULL (ADR-014 §7), and that is not decoration:
   * ADR-012 makes deleting a User this platform's STRONGEST credential
   * revocation, so an approved specification must never be able to block an
   * off-boarding. PostgreSQL implements SET NULL as an UPDATE on this table —
   * which a blanket ban would refuse, turning every review row into a permanent
   * foreign-key reference and making `DELETE FROM users` fail.
   *
   * Measured, not reasoned about: the first version of this trigger banned every
   * UPDATE, and the verification script's long-standing assertion "deleting the
   * reviewer is still permitted (ADR-012 unweakened)" failed immediately.
   *
   * So exactly one shape is allowed through: `reviewer_id` going from a value to
   * NULL, with EVERY other column byte-identical. That is not a rewrite of
   * history — it is the foreign key being released, and
   * `reviewer_email_snapshot` is NOT NULL precisely so the record still names the
   * person afterwards. Re-pointing `reviewer_id` at a DIFFERENT user, or
   * clearing it while touching anything else, is refused like any other edit.
   */
  IF TG_OP = 'UPDATE'
     AND OLD."reviewer_id" IS NOT NULL
     AND NEW."reviewer_id" IS NULL
     AND NEW."id"                      IS NOT DISTINCT FROM OLD."id"
     AND NEW."specification_id"        IS NOT DISTINCT FROM OLD."specification_id"
     AND NEW."product_claim_id"        IS NOT DISTINCT FROM OLD."product_claim_id"
     AND NEW."reviewer_email_snapshot" IS NOT DISTINCT FROM OLD."reviewer_email_snapshot"
     AND NEW."reviewed_at"             IS NOT DISTINCT FROM OLD."reviewed_at"
     AND NEW."decision"                IS NOT DISTINCT FROM OLD."decision"
     AND NEW."note"                    IS NOT DISTINCT FROM OLD."note"
     AND NEW."evidence_set_hash"       IS NOT DISTINCT FROM OLD."evidence_set_hash"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'technical_reviews rows are immutable review history and cannot be %',
    CASE TG_OP WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END
    USING ERRCODE = 'restrict_violation',
          DETAIL  = format('technical_reviews row %s', OLD."id"),
          HINT    = 'A review decision is never edited or removed. Record a NEW review on the '
                    'same subject instead; the history keeps both, which is what makes it a trail. '
                    'The only permitted change is the ON DELETE SET NULL of reviewer_id, which '
                    'releases the foreign key when a User is deleted and leaves the email '
                    'snapshot naming them.';
END
$fn$;

CREATE TRIGGER "technical_reviews_immutable_guard"
  BEFORE UPDATE OR DELETE ON "technical_reviews"
  FOR EACH ROW
  EXECUTE FUNCTION "technical_reviews_immutable"();

ALTER TABLE "technical_reviews"
  ENABLE ALWAYS TRIGGER "technical_reviews_immutable_guard";

-- ---------------------------------------------------------------------------
-- 2. THE APPROVAL GATE — how a row is allowed to BECOME `approved`.
--
-- ── The mechanism, and why it is `xmin` ──────────────────────────────────────
--
-- The requirement is that a transition into `approved` must be backed by a
-- TechnicalReview created IN THE SAME TRANSACTION. "A matching review exists
-- somewhere in history" is not sufficient and is the specific hole this closes:
-- without a same-transaction test, one genuine approval from six months ago could
-- be replayed to re-approve the row after it had been rejected, or after its
-- evidence changed and changed back.
--
-- `xmin` is the system column PostgreSQL already stores on every row: the id of
-- the transaction that inserted it. `pg_current_xact_id()::xid` is this
-- transaction's id. Comparing them asks "was this row written by me, right now?"
-- and the answer is a physical property of the heap tuple.
--
-- It is therefore EVIDENCE-BACKED in the way the requirement demands. It is not
-- a flag the client sets, not a session GUC, not a temp table, and not a
-- `current_setting()` a caller could forge — there is no way to write a
-- `technical_reviews` row carrying somebody else's `xmin`, and no way to make
-- `pg_current_xact_id()` lie.
--
-- Measured before this migration was written, on a clone of the imported
-- catalogue: a review inserted in the open transaction reports
-- `xmin = pg_current_xact_id()::xid` as TRUE, and the same row read back in a
-- later transaction reports FALSE. The `xid8 -> xid` cast is present in
-- PostgreSQL 18.4 (`pg_cast` confirms one entry).
--
-- ── The one behaviour this cannot see, stated rather than discovered ─────────
--
-- A row inserted inside a SAVEPOINT or a PL/pgSQL block with an EXCEPTION clause
-- carries a SUBtransaction id, which is not equal to the top-level id, and the
-- gate would refuse the approval. That direction is FAIL-CLOSED — it refuses a
-- legitimate approval rather than admitting an illegitimate one — and the review
-- service uses a plain interactive transaction with no savepoint, so it is not
-- on any path that exists. A caller that needs savepoints must open the
-- transaction, insert the review and update the status at the same nesting level.
--
-- ── What the database can and cannot certify ─────────────────────────────────
--
-- It certifies that a review row exists, names this subject, records an APPROVE,
-- names a reviewer, and quotes the evidence-set hash the database computes for
-- that subject RIGHT NOW — all written in the transaction doing the approving.
-- It cannot certify that a human looked at anything. Authentication and the
-- Admin role are the API's job (ADR-016 §2); this is the floor beneath it, and
-- the floor's guarantee is exactly: NO APPROVAL WITHOUT A CONTEMPORANEOUS,
-- ATTRIBUTABLE, EVIDENCE-CURRENT REVIEW RECORD.
--
-- ── Only entry is gated ──────────────────────────────────────────────────────
--
-- `NEW.review_status <> 'approved'` returns immediately, and an UPDATE whose OLD
-- status was already `approved` returns immediately too. So:
--
--   * REJECTED, NEEDS_REVIEW, SOURCE_RECORDED, SUPERSEDED — never gated, in any
--     direction, including OUT of `approved`.
--   * The importer's approved-evidence invalidation keeps working untouched: it
--     moves rows AWAY from `approved`, which this does not see.
--   * A soft delete (`deleted_at`) of an approved row is untouched.
--
-- That asymmetry is the whole design. The public risk is a row ARRIVING in
-- `approved` unreviewed; a row LEAVING it is a row becoming less public, and
-- gating that would block legitimate invalidation — which the gate brief
-- explicitly warns against.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "specification_approval_gate"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
DECLARE
  v_hash text;
BEGIN
  -- Not entering `approved`: nothing to say.
  IF NEW."review_status" <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- Already approved and staying approved: this UPDATE is about some other
  -- column, and re-demanding a review for it would block a soft delete.
  IF TG_OP = 'UPDATE' AND OLD."review_status" = 'approved' THEN
    RETURN NEW;
  END IF;

  -- A row cannot be BORN approved. There is no review to point at, because the
  -- subject the review must name does not exist until this statement finishes.
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION
      'a specification cannot be created already approved'
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('specifications row %s', NEW."id"),
            HINT    = 'Insert the specification unapproved, then approve it through the review '
                      'service, which records a TechnicalReview in the same transaction.';
  END IF;

  -- Recomputed HERE, from the database, in this transaction. The review row's
  -- stored hash is only ever compared against this — never trusted as input.
  v_hash := "specification_evidence_set_hash"(NEW."id");

  IF NOT EXISTS (
    SELECT 1
      FROM "technical_reviews" tr
     WHERE tr."specification_id" = NEW."id"
       AND tr."product_claim_id" IS NULL
       AND tr."decision" = 'approved'
       AND tr."evidence_set_hash" = v_hash
       AND length(btrim(tr."reviewer_email_snapshot")) > 0
       AND tr.xmin = pg_current_xact_id()::xid
  ) THEN
    RAISE EXCEPTION
      'specification % cannot become approved without a matching TechnicalReview recorded in '
      'this transaction', NEW."id"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format(
              'Required, all of: a technical_reviews row inserted in THIS transaction, naming '
              'specification_id = %s and no product_claim_id, with decision = approved, a '
              'non-blank reviewer_email_snapshot, and evidence_set_hash = %s (the value the '
              'database computes for this subject right now).', NEW."id", v_hash),
            HINT    = 'Approve through the Admin review service (ADR-016). A historical review, a '
                      'review of another subject, and a review quoting a stale evidence set are '
                      'all refused here by design.';
  END IF;

  RETURN NEW;
END
$fn$;

CREATE TRIGGER "specification_approval_gate_guard"
  BEFORE INSERT OR UPDATE ON "specifications"
  FOR EACH ROW
  EXECUTE FUNCTION "specification_approval_gate"();

ALTER TABLE "specifications"
  ENABLE ALWAYS TRIGGER "specification_approval_gate_guard";

-- ---------------------------------------------------------------------------
-- 3. THE SAME GATE FOR PRODUCT CLAIMS.
--
-- Identical in every respect, over `claim_evidence` and
-- `product_claim_evidence_set_hash`, plus one addition: the two forbidden kinds
-- are re-asserted here.
--
-- That re-assertion is deliberate duplication and follows the precedent
-- `v_product_claim_public` already set — ADR-014 called it "the second lock on
-- the door that publishes". `product_claims_forbidden_approval` remains the
-- invariant. This is the second statement of it, so that if that CHECK were ever
-- dropped by a future migration, a LICENSED_BY row still could not be approved.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "product_claim_approval_gate"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
DECLARE
  v_hash text;
BEGIN
  IF NEW."review_status" <> 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."review_status" = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Second lock. The CHECK is the invariant; this is the duplicate.
  IF NEW."kind" IN ('licensed_by', 'reference_only') THEN
    RAISE EXCEPTION
      'a % product claim can never be approved', NEW."kind"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('product_claims row %s', NEW."id"),
            HINT    = 'LICENSED_BY is a third party''s statement this platform has no right to '
                      'republish, and REFERENCE_ONLY exists to hold what is never shown.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION
      'a product claim cannot be created already approved'
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format('product_claims row %s', NEW."id"),
            HINT    = 'Insert the claim unapproved, then approve it through the review service, '
                      'which records a TechnicalReview in the same transaction.';
  END IF;

  v_hash := "product_claim_evidence_set_hash"(NEW."id");

  IF NOT EXISTS (
    SELECT 1
      FROM "technical_reviews" tr
     WHERE tr."product_claim_id" = NEW."id"
       AND tr."specification_id" IS NULL
       AND tr."decision" = 'approved'
       AND tr."evidence_set_hash" = v_hash
       AND length(btrim(tr."reviewer_email_snapshot")) > 0
       AND tr.xmin = pg_current_xact_id()::xid
  ) THEN
    RAISE EXCEPTION
      'product claim % cannot become approved without a matching TechnicalReview recorded in '
      'this transaction', NEW."id"
      USING ERRCODE = 'restrict_violation',
            DETAIL  = format(
              'Required, all of: a technical_reviews row inserted in THIS transaction, naming '
              'product_claim_id = %s and no specification_id, with decision = approved, a '
              'non-blank reviewer_email_snapshot, and evidence_set_hash = %s (the value the '
              'database computes for this subject right now).', NEW."id", v_hash),
            HINT    = 'Approve through the Admin review service (ADR-016).';
  END IF;

  RETURN NEW;
END
$fn$;

CREATE TRIGGER "product_claim_approval_gate_guard"
  BEFORE INSERT OR UPDATE ON "product_claims"
  FOR EACH ROW
  EXECUTE FUNCTION "product_claim_approval_gate"();

ALTER TABLE "product_claims"
  ENABLE ALWAYS TRIGGER "product_claim_approval_gate_guard";

-- ---------------------------------------------------------------------------
-- 4. THE COLUMN COMMENTS NOW DESCRIBE A CLOSED LIMITATION.
--
-- 20260822120000 wrote a COMMENT on both `review_status` columns recording that
-- the approval transition was NOT database-enforced, so that the limitation
-- would travel with the schema into every dump and introspection. It is enforced
-- as of this migration, and a comment that still warns otherwise is worse than
-- no comment: the next reader would trust it and design around a hole that is
-- no longer there.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN "specifications"."review_status" IS
  'The publication gate. Only `approved` reaches v_specification_public. ENTRY into `approved` '
  'is enforced by specification_approval_gate_guard: it requires a technical_reviews row '
  'inserted in the SAME transaction, naming this specification, recording an approve decision, '
  'with a non-blank reviewer snapshot and an evidence_set_hash equal to the value the database '
  'computes for this subject at that moment. A historical review, another subject''s review, and '
  'a review with a stale hash are all refused. Leaving `approved` is deliberately NOT gated, so '
  'rejection, supersession and evidence-driven invalidation stay possible (ADR-016).';

COMMENT ON COLUMN "product_claims"."review_status" IS
  'The publication gate, enforced by product_claim_approval_gate_guard on exactly the same terms '
  'as specifications.review_status, and additionally refusing approval of LICENSED_BY and '
  'REFERENCE_ONLY claims — a duplicate of product_claims_forbidden_approval, kept as a second '
  'lock on the door that publishes (ADR-016).';

COMMENT ON TABLE "technical_reviews" IS
  'Immutable SAM technical review history. technical_reviews_immutable_guard refuses every UPDATE '
  'and every DELETE; INSERT is the only write. A decision that was wrong is superseded by a LATER '
  'decision on the same subject, never edited away (ADR-016).';

COMMIT;
