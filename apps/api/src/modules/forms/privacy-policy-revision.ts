/**
 * The Privacy Policy revision every consented submission is stamped with — **server-owned, and
 * currently absent.**
 *
 * ── What this constant is for ───────────────────────────────────────────────
 *
 * `created_at` proves *when* a consent was given. Nothing proved *what* was consented to.
 * SECURITY.md §Personal Data Retention ratified the fix on 17 August 2026: before the public
 * consent labels may link to a published Privacy Policy, `sam_platform` must persist the policy
 * revision agreed to. This constant is the single place the platform decides what that revision is,
 * and `inquiries.privacy_policy_version` / `custom_formulation_requests.privacy_policy_version`
 * are where each submission keeps its own copy of it.
 *
 * ── Why it is `null` today, and why that is not a placeholder ───────────────
 *
 * **No approved Privacy Policy exists** — not in this repository, not in `sam_cms`. The canonical
 * `/{locale}/privacy-policy` route answers 404 in all three locales, and the four consent labels
 * name the policy as plain text without linking it. A submitter today therefore agreed to no
 * versioned document, and `null` records exactly that. Any string here would be a revision
 * identifier invented for a policy that does not exist, which is the one thing every document
 * covering this gate forbids.
 *
 * `null` is a **measured fact about the current state of the platform, not a TODO value**. It stops
 * being correct at the moment approved policy content is published, and setting it is part of
 * publishing that content — see below.
 *
 * ── What the gate that publishes the policy must do ─────────────────────────
 *
 * Replace `null` with the revision identifier the approved policy actually carries — a human
 * readable, stable string an auditor can match back to a specific approved text (`"2026-09-01"`,
 * `"v1.0"`, whatever the legal review names it). **That naming is a legal/product decision and is
 * deliberately not made here.** Changing this value is a commit, so the platform's own history is
 * the record of which revision was in force between which dates; that is the property an
 * environment variable or a CMS lookup would not have.
 *
 * ── Why the value is not read from Payload ──────────────────────────────────
 *
 * Three reasons, in order of weight.
 *
 * 1. **A valid lead must never be lost because the CMS is down.** Fetching the active revision at
 *    submission time would put `apps/cms` in the critical write path of an unauthenticated lead
 *    form: a Payload outage would turn a real inquiry into a 503. Nothing in the write path here
 *    touches the CMS, so form persistence is unaffected by CMS availability.
 * 2. **`Pages.lastUpdatedDate` is not consent evidence.** It is an editor-set display field in
 *    `sam_cms` — nullable, non-localized, and freely rewritten after the fact (SECURITY.md). A
 *    consent record derived from it could be silently changed by an editor months later.
 * 3. **No cross-database reference exists, by decision.** ADR-002 keeps `sam_platform` and
 *    `sam_cms` independent, with isolation enforced by Postgres credentials. A Payload row id or
 *    revision id stored as consent evidence would be a dangling reference the moment a document was
 *    reworked, and could never be a foreign key.
 *
 * The same reasoning rules out the client supplying it: a value an anonymous submitter controls is
 * not evidence of anything. No DTO declares the field, so `forbidNonWhitelisted` answers 400 naming
 * the property — the same protection `status` has.
 *
 * ── Immutability ────────────────────────────────────────────────────────────
 *
 * The value is written once, by `create`, and there is no code path in this application that
 * updates either table — no admin surface, no PATCH endpoint, no service method. It is a stored
 * literal rather than a join, so no later change to the CMS, this constant, or anything else can
 * alter what an existing row says.
 *
 * **And that is enforced by PostgreSQL, not by this file.** Migration
 * `20260818140000_privacy_policy_version_immutable` puts a `BEFORE UPDATE` trigger on both tables
 * that raises whenever `privacy_policy_version IS DISTINCT FROM` its stored value — so
 * `NULL → revision`, `revision → NULL` and `revision → other revision` all fail at the database,
 * whatever writes them. Every other column stays updateable. **There is no application bypass and
 * none may be added:** a consent recorded against `NULL` cannot later be rewritten to claim a
 * policy was in force. If a correction is ever legally required it must be a separate audit record
 * about the evidence, never a mutation of it.
 *
 * Held in one constant, in the module that owns every consented submission entity, so the eventual
 * first real revision is one edit — exactly as `INITIAL_SUBMISSION_STATUS` is.
 */
export const ACTIVE_PRIVACY_POLICY_REVISION: string | null = null;
