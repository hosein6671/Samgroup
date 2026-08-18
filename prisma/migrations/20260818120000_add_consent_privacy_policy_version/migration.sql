-- ============================================================================
-- Consent evidence — the Privacy Policy revision a submission was consented
-- against. ADDITIVE ONLY.
--
-- Implements the requirement ratified 17 August 2026 in docs/SECURITY.md
-- (#Personal Data Retention) and restated in docs/ROADMAP.md: before the public
-- consent labels are allowed to link to a published Privacy Policy, sam_platform
-- must be able to record WHICH revision each consent was given against.
-- `created_at` already proves WHEN. Nothing else in either database does.
--
-- WHY NULLABLE, AND WHY NO BACKFILL
--
-- No approved Privacy Policy content exists — in this repository or in sam_cms —
-- and the consent labels link to nothing. A row written today was therefore
-- consented against no versioned document at all, and NULL is the only honest
-- record of that. A NOT NULL column would force a value, and every candidate
-- value would be an invented revision identifier for a policy that does not
-- exist. Both tables are empty in local DEV (0 rows, verified before this
-- migration), so nullability is not a concession to existing data; it is the
-- correct long-term meaning of "no policy was in force".
--
-- Tightening this to NOT NULL is a separate, later decision that belongs to the
-- gate which publishes approved policy content — and it would still have to
-- keep any pre-policy rows expressible, so it is not obviously desirable.
--
-- WHAT WRITES IT
--
-- apps/api, and only apps/api: the Forms module writes the constant
-- ACTIVE_PRIVACY_POLICY_REVISION on insert (see
-- apps/api/src/modules/forms/privacy-policy-revision.ts). No DTO accepts the
-- field, so no client can set or override it, and nothing reads sam_cms to
-- derive it — a form submission must never depend on CMS availability.
--
-- WHAT THIS IS NOT
--
-- Not a foreign key, and not a Payload row or revision id. sam_cms is a separate
-- database with separate credentials (ADR-002); a cross-database reference is
-- impossible to enforce and Pages.lastUpdatedDate is an editor-set display
-- field, freely rewritten after the fact, so it is not consent evidence.
--
-- No index: this column is evidence read per-row during an audit, never a query
-- axis. No consent-history table: one immutable value per submission is the
-- whole requirement. No status, retention or workflow column is touched, and no
-- other model is modified.
--
-- WHY THE EXPLICIT BEGIN/COMMIT
--
-- Prisma applies a migration file statement by statement in autocommit — the
-- 20260814120000 migration recorded that measurement. Without the transaction a
-- failure on the second ALTER would leave one table carrying the column and the
-- other not, which is exactly the half-applied state an audit column must never
-- be in.
-- ============================================================================

BEGIN;

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "privacy_policy_version" TEXT;

-- AlterTable
ALTER TABLE "custom_formulation_requests" ADD COLUMN     "privacy_policy_version" TEXT;

COMMIT;
