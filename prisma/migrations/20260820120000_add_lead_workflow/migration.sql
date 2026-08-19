-- ============================================================================
-- Lead workflow: assignment history, audit snapshots, and a status vocabulary.
--
-- ADDITIVE ONLY. No existing column changes type or nullability, no foreign key
-- rule is altered, and no row is rewritten except by the backfill described
-- below (which touches nothing, because both tables are empty here).
--
-- Implements the decisions recorded in docs/ADR/ADR-013-lead-assignment-and-status-workflow.md.
--
-- FOUR THINGS, IN ORDER
--
--   1. lead_assignment_history            — who owned a lead, and who changed it
--   2. status_history.changed_by_email_snapshot
--   3. CHECK constraints on both lead status columns
--   4. (nothing else — see WHAT THIS DELIBERATELY DOES NOT DO)
--
-- WHY SNAPSHOT COLUMNS EXIST AT ALL
--
-- Every actor and assignee foreign key into `users` is ON DELETE SET NULL, and
-- deleting a User row is this platform's strongest credential revocation
-- (ADR-012 §7) rather than an exceptional event. Measured before writing this
-- migration, in a rolled-back transaction: deleting a user who held an assigned
-- lead and had written a status_history row leaves the lead silently unassigned
-- and the history row present with a NULL actor. The audit trail survives and
-- stops naming anyone.
--
-- The fix is not RESTRICT. Making a User undeletable once they touch a lead
-- would break revocation-by-deletion, which ADR-012 explicitly protects. Instead
-- the identity is captured as text at write time: the FK keeps the live link
-- while the row exists, the snapshot keeps the record readable after it does
-- not. Email only — it is already the human-readable operator identity across
-- this application, and no password, token, role or profile field belongs in an
-- audit row.
--
-- WHY A CHECK AND NOT A POSTGRESQL ENUM
--
-- Three values, and a vocabulary that a later workflow phase may extend. An enum
-- would make every future change an ALTER TYPE with its own migration and its own
-- ordering problems; a CHECK gives identical integrity and is edited in place.
-- The column stays `text`, so no application type changes and no cast is needed.
--
-- The CHECK constrains the VOCABULARY, not the transition graph. A row-level
-- constraint cannot see the previous value, so `closed -> new` is refused by the
-- Forms module, not by PostgreSQL. That split is deliberate and is stated in the
-- schema comment on both columns.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
--   - No `updated_at`, no `version`, no ETag column. Concurrency is compare-and-
--     set against the value the caller already holds (ADR-013 §Concurrency);
--     a version column would be a second mechanism for the same job.
--   - No foreign key from either history table to a lead. Both are polymorphic
--     over two parents, exactly like status_history, seo_meta and specifications;
--     one table cannot hold an FK to two different parents.
--   - No change to any `assigned_to_id` FK rule. SET NULL stays SET NULL.
--   - No trigger. Nothing here needs to be enforced against application code the
--     way the ADR-011 slug registry or the consent-version immutability guard do:
--     history rows are written by one service, in one transaction, and a missing
--     row is a bug rather than a bypass. This is a smaller claim than those
--     migrations make, and it is made on purpose.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. lead_assignment_history
--
-- Separate from status_history rather than folded into it. status_history's
-- `to_status` is NOT NULL, so an assignment-only row could not be written there
-- without making a shipped column nullable — on a table content_translations
-- also uses. One narrow table is the smaller and safer change.
--
-- `entity_type` is 'Inquiry' or 'CustomFormulationRequest' today. It is left
-- unconstrained, matching status_history, because distributor_applications and
-- download_requests already carry assigned_to_id and will reuse this table
-- without a schema change when they get endpoints.
-- ---------------------------------------------------------------------------
CREATE TABLE "lead_assignment_history" (
    "id"                           UUID         NOT NULL,
    "entity_type"                  TEXT         NOT NULL,
    "entity_id"                    UUID         NOT NULL,
    "from_assignee_id"             UUID,
    "from_assignee_email_snapshot" TEXT,
    "to_assignee_id"               UUID,
    "to_assignee_email_snapshot"   TEXT,
    "changed_by_id"                UUID,
    "changed_by_email_snapshot"    TEXT,
    "changed_at"                   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"                         TEXT,

    CONSTRAINT "lead_assignment_history_pkey" PRIMARY KEY ("id")
);

-- All three are SET NULL for the same reason the lead's own assigned_to_id is:
-- a User must stay deletable. The snapshot columns are what keep the row
-- meaningful once they are gone.
ALTER TABLE "lead_assignment_history"
    ADD CONSTRAINT "lead_assignment_history_from_assignee_id_fkey"
        FOREIGN KEY ("from_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "lead_assignment_history_to_assignee_id_fkey"
        FOREIGN KEY ("to_assignee_id")   REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "lead_assignment_history_changed_by_id_fkey"
        FOREIGN KEY ("changed_by_id")    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL does not auto-index foreign keys, and the read path is always
-- "the history of one lead, newest first".
CREATE INDEX "lead_assignment_history_entity_type_entity_id_idx"
    ON "lead_assignment_history"("entity_type", "entity_id");
CREATE INDEX "lead_assignment_history_changed_by_id_idx"
    ON "lead_assignment_history"("changed_by_id");
CREATE INDEX "lead_assignment_history_changed_at_idx"
    ON "lead_assignment_history"("changed_at");

-- ---------------------------------------------------------------------------
-- 2. The actor snapshot on the existing status_history
--
-- Nullable, and NOT backfilled. There are zero rows in this table (verified
-- before writing this migration), so there is no history to reconstruct — and if
-- there were, inventing an address for a past actor would be fabricating audit
-- evidence. NULL means "written before this column existed", which is the truth.
-- ---------------------------------------------------------------------------
ALTER TABLE "status_history"
    ADD COLUMN "changed_by_email_snapshot" TEXT;

-- ---------------------------------------------------------------------------
-- 3. The status vocabulary
--
-- Both lead tables, same three values. Existing rows all hold 'new' — it is the
-- only value the ingestion constant has ever written and the only one the API
-- has ever accepted — so every current row satisfies the constraint and no
-- backfill or data migration is required. Stated as a fact rather than assumed:
-- the constraint is added WITHOUT `NOT VALID`, so PostgreSQL validates every
-- existing row as part of this statement and the migration fails loudly here if
-- any row disagrees.
-- ---------------------------------------------------------------------------
ALTER TABLE "inquiries"
    ADD CONSTRAINT "inquiries_status_check"
    CHECK ("status" IN ('new', 'in_progress', 'closed'));

ALTER TABLE "custom_formulation_requests"
    ADD CONSTRAINT "custom_formulation_requests_status_check"
    CHECK ("status" IN ('new', 'in_progress', 'closed'));

COMMIT;
