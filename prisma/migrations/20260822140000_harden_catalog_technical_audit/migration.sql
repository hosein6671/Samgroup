-- ============================================================================
-- Catalog technical data — audit and publication hardening (PRODUCT-DATA-2A)
--
-- Follow-up to 20260822120000_add_catalog_technical_data, which is APPLIED and
-- is NOT rewritten here: editing an applied migration changes its checksum and
-- puts every environment's `_prisma_migrations` history out of agreement with
-- the files. Three things that migration got wrong or left open are corrected
-- here, each because a database probe showed the gap rather than because it was
-- theorised.
--
-- ── 1. source_facts were immutable against UPDATE only ─────────────────────
--
-- The first migration armed a BEFORE UPDATE guard and the report claimed the
-- rows were "never updated, never deleted". Only half of that was enforced. A
-- fact with no evidence link — an import artefact, or the tail of a reverted
-- ImportRun — could simply be DELETEd, and the record of what a source stated
-- would be gone with it. The evidence tables' ON DELETE RESTRICT protects only
-- facts that are already cited; it says nothing about the rest.
--
-- The guard now covers UPDATE and DELETE. INSERT is deliberately untouched:
-- recording a new fact is the one thing that must always work, and a correction
-- IS a new fact plus a SUPERSEDED evidence role.
--
-- The consequence is accepted deliberately: reverting an ImportRun can never
-- delete the SourceFacts it produced. A bad import is retired by superseding
-- its facts, not by erasing them. An audit trail that can be cleaned up on a
-- bad day is not an audit trail.
--
-- ── 2. WITH CASCADED CHECK OPTION is not a read-only boundary ──────────────
--
-- The first migration's comment claimed the CHECK OPTION made the public views
-- unable to publish anything unapproved. That claim was too strong and is
-- corrected here. CHECK OPTION rejects only writes that would produce a row
-- OUTSIDE the view predicate. A row that is already approved and live is inside
-- it, so an UPDATE or DELETE of an approved row through the view is permitted.
--
-- Measured against local DEV before this migration was written, as the
-- application role:
--
--     SELECT through v_specification_public          SUCCEEDED
--     UPDATE an APPROVED row through the view        SUCCEEDED   <-- the gap
--     DELETE an approved row through the view        SUCCEEDED   <-- the gap
--     INSERT an unapproved row through the view      rejected (44000)
--
-- So published content was editable through the read model. The views are read
-- models; nothing may write through them. That is now enforced with privileges
-- rather than with a predicate.
--
-- WHAT THIS IS, AND HONESTLY WHAT IT IS NOT
--
-- This repository's database architecture defines exactly three roles —
-- `postgres` (superuser), `sam_cms_user` and `sam_platform_user` (ADR-002) —
-- and `sam_platform_user` is the single application role for sam_platform: it
-- serves public reads AND will serve admin writes. There is no distinct
-- read-only runtime role, and this migration does not invent one, because a new
-- production credential is an architecture decision that needs its own ADR.
--
-- Therefore: revoking write privileges on the views from the owning role is a
-- durable GUARD RAIL, not a privilege BOUNDARY. The owner can re-grant to
-- itself at any time, and a superuser bypasses ACL checks entirely. What it
-- does buy is real and worth having — no application code path can write
-- through a view by accident or by mistake, and the ACL states the intent where
-- anyone can audit it. A true boundary requires a separate read-only role, and
-- that is a later decision.
--
-- ── 3. The approval transition is NOT enforced by the database ─────────────
--
-- Audited and confirmed against local DEV: a caller with base-table write
-- access can set `review_status = 'approved'` with ZERO TechnicalReview rows
-- and no evidence-set-hash verification, and the row becomes publicly visible
-- immediately. The database gates WHAT IS READ, not WHO DECIDED.
--
-- This is explicitly DEFERRED to PRODUCT-DATA-2B rather than patched with a
-- trigger now. A transition guard has to encode which transitions are legal,
-- who may make them and what re-verification means — that is review-service
-- workflow, and writing it before the service exists would be speculative
-- infrastructure of exactly the kind this project forbids. It would also be
-- brittle: the importer, corrections, supersession and rejection all move this
-- column, and a guard written blind to those callers would be relaxed the first
-- time it blocked one.
--
-- The obligation is recorded in the database itself, as COMMENTs, so it cannot
-- be lost with a document. See ADR-014.
--
-- Atomic by explicit BEGIN/COMMIT, per the convention 20260814120000 recorded.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SOURCE FACTS ARE IMMUTABLE AGAINST UPDATE **AND** DELETE.
--
-- The function is replaced rather than added to, so there is exactly one guard
-- body and TG_OP names which attempt was refused. The trigger is dropped and
-- recreated because PostgreSQL cannot add an event to an existing trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "source_facts_immutable"() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION
    'source_facts rows are immutable extracted evidence: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation',
          DETAIL  = format('source_facts row %s (attempted %s)', OLD."id", TG_OP),
          HINT    = 'Record a corrected reading as a NEW source_fact and mark the old evidence link SUPERSEDED. Reverting an import supersedes its facts; it never deletes them.';
END
$fn$;

DROP TRIGGER "source_facts_immutable_guard" ON "source_facts";

-- BEFORE UPDATE OR DELETE, FOR EACH ROW: the statement must fail before
-- anything is written, and the decision is per row. INSERT is NOT listed, by
-- decision — recording a fact must always work.
--
-- ENABLE ALWAYS, following 20260818140000_privacy_policy_version_immutable: a
-- plain trigger is silently skipped by a session that sets
-- `session_replication_role = 'replica'`, which is precisely the privileged
-- bypass an evidence guard must not have.
CREATE TRIGGER "source_facts_immutable_guard"
  BEFORE UPDATE OR DELETE ON "source_facts"
  FOR EACH ROW
  EXECUTE FUNCTION "source_facts_immutable"();

ALTER TABLE "source_facts"
  ENABLE ALWAYS TRIGGER "source_facts_immutable_guard";

-- ---------------------------------------------------------------------------
-- 2. THE PUBLIC VIEWS BECOME READ MODELS, BY PRIVILEGE.
--
-- Revoked from PUBLIC and from each view's OWNER. The owner is resolved at
-- apply time rather than hardcoded: the role name comes from the environment's
-- own configuration (POSTGRES_PLATFORM_USER), so naming `sam_platform_user`
-- here would be correct in development and wrong anywhere it differs.
--
-- SELECT is deliberately left in place. These views exist to be read.
-- ---------------------------------------------------------------------------
DO $grants$
DECLARE
  v_view  text;
  v_owner text;
BEGIN
  FOREACH v_view IN ARRAY ARRAY['v_specification_public', 'v_product_claim_public'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I FROM PUBLIC', v_view);

    SELECT pg_get_userbyid(c.relowner) INTO v_owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relname = v_view;

    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I FROM %I', v_view, v_owner);

    RAISE NOTICE 'PRODUCT-DATA-2A: % is now SELECT-only for PUBLIC and for its owner %', v_view, v_owner;
  END LOOP;
END
$grants$;

-- ---------------------------------------------------------------------------
-- 3. RESULT-BASIS RESOLUTION, STATED ONCE.
--
-- Three columns carry result basis and they are not redundant:
--
--     source_documents.default_result_basis   what this document's numbers are
--     source_facts.result_basis_override      what THIS fact's number is, when
--                                             the document's default is wrong
--     specifications.result_basis             the RESOLVED value on the
--                                             normalized, publishable fact
--
-- The precedence between the first two is fixed and lives here so the importer
-- cannot quietly implement a different one:
--
--     SourceFact override  ->  otherwise SourceDocument default  ->  otherwise
--     UNSPECIFIED
--
-- The third arm is not decoration. `default_result_basis` is NOT NULL with an
-- 'unspecified' default, so a document that never said what its numbers are
-- resolves to UNSPECIFIED rather than to a guess — and a fact that resolves to
-- UNSPECIFIED must never be rendered as a specification limit.
--
-- `specifications.result_basis` is deliberately NOT computed from this. It is
-- the value a reviewer approved, stored on the row; recomputing it at read time
-- would let a later edit to a source document silently change what was
-- approved. The function is what the IMPORTER resolves WITH, in 2B.
--
-- There is no free-text qualifier note anywhere in this chain, by decision.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "source_fact_result_basis"(p_source_fact_id uuid) RETURNS "result_basis"
  LANGUAGE sql
  STABLE
AS $fn$
  SELECT coalesce(sf."result_basis_override", sd."default_result_basis", 'unspecified'::"result_basis")
  FROM "source_facts" sf
  JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
  WHERE sf."id" = p_source_fact_id;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. THE LIMITATIONS, RECORDED IN THE DATABASE.
--
-- COMMENTs rather than a document alone: a comment travels with the schema into
-- every dump, every introspection and every environment, and cannot be lost by
-- someone reading a stale file. See ADR-014.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN "specifications"."review_status" IS
  'Publication gate. APPROVED is the ONLY state the public view exposes. The DATABASE DOES NOT ENFORCE HOW A ROW REACHES APPROVED: a caller with base-table write access can set it directly, with no TechnicalReview and no evidence-set-hash check. Approval transitions are owned exclusively by the review service in PRODUCT-DATA-2B, which must verify RBAC and recompute the evidence-set hash inside the same transaction. No generic update endpoint may ever expose this column. See ADR-014.';

COMMENT ON COLUMN "product_claims"."review_status" IS
  'Publication gate. See specifications.review_status for the same limitation. Additionally constrained: LICENSED_BY and REFERENCE_ONLY can never reach APPROVED (product_claims_forbidden_approval), and APPROVED_BY requires a named standard_body.';

COMMENT ON VIEW "v_specification_public" IS
  'READ MODEL. Approved, live, allow-listed columns only; no review-status and no provenance column. INSERT/UPDATE/DELETE are revoked from PUBLIC and from the owner, so no application path writes through it. That is a guard rail, not a boundary: the owner may re-grant and a superuser bypasses ACLs. API and admin mutations write validated base-table commands, never this view.';

COMMENT ON VIEW "v_product_claim_public" IS
  'READ MODEL. See v_specification_public. Additionally excludes the forbidden claim kinds, duplicating the table CHECK as a second lock on the door that publishes.';

COMMENT ON TABLE "source_facts" IS
  'Immutable extracted evidence. UPDATE and DELETE are refused by source_facts_immutable_guard (ENABLE ALWAYS); INSERT is unrestricted. Reverting an ImportRun supersedes its facts and never deletes them.';

COMMIT;
