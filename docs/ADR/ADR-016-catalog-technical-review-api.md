# ADR-016: The Admin Catalog Technical-Review API — Transactional Approval, Evidence-Hash Concurrency and Immutable Review History

## Status

Accepted, 25 August 2026.

Delivered in two parts on the same day:

- **PRODUCT-REVIEW-1A** — the Admin review API (§1–§11), built with no migration on the schema ADR-014 installed.
- **PRODUCT-REVIEW-1A-H1** — the database halves (§12–§15), migration `20260825120000_harden_review_immutability_and_approval_gate`, added on the Architect's ruling that service-only enforcement and the mutable audit table were both mandatory blockers.

**Closes the limitation ADR-014 §8 recorded deliberately** — and closes it in the database, not only in a service. That section audited the schema and confirmed it did not enforce _how_ a row reaches `review_status = 'approved'`; it deferred the answer to "PRODUCT-DATA-2B" and listed four mandatory requirements. §4 meets all four; §12 removes the reason the limitation existed at all.

**Amends ADR-014 in one place and ADR-015 in one place**, both listed in §11. Amends nothing in ADR-007 through ADR-013.

**One additive migration. No dependency. No lockfile change.** The migration adds three functions, three triggers and three `COMMENT`s. No column is added, dropped, renamed or retyped; no row is written; no applied migration is edited. Prisma reports **no drift** on every database state it was applied to, and the only Prisma-schema changes are documentation comments.

**Nothing in live DEV was approved.** `sam_platform` still holds 0 APPROVED Specifications, 0 APPROVED ProductClaims, 0 TechnicalReviews and 0 users. Every decision proved by this gate was made on a disposable clone.

## Context

### What was open

The catalogue was imported by ADR-015: 100 Products, 1,398 Specifications, 148 ProductClaims, 1,661 immutable SourceFacts. Every technical row is `SOURCE_RECORDED` or `NEEDS_REVIEW`, and `PUBLIC_SPECIFICATION_WHERE` in `products.service.ts` publishes `APPROVED` and nothing else — so the public Product detail serves an empty `specifications` array for all 100 Products. The catalogue is imported and entirely unpublished, which is the correct state and not a useful one.

Moving a row out of it needs a decision by a person, and ADR-014 §8 established that the database will not make that decision trustworthy on its own:

> a caller with base-table write access can set `review_status = 'approved'` with **zero** `TechnicalReview` rows and no evidence-set-hash verification, and the row becomes publicly visible immediately. The database gates **what is read**, not **who decided**.

### What the audit found before anything was written

- **Auth**: `JwtAuthGuard` → `AccessTokenVerifier` → live `users` row; `RolesGuard` reads `@Roles()` metadata and **denies by default**. Four roles, no machine role. Nothing needed inventing.
- **Admin convention**: `/admin/*` (API_CONTRACT_FINAL.md §2.10), `Cache-Control: no-store` on every response, narrow command sub-resources rather than a generic `PATCH` — the shape `LeadWorkflowController` already established.
- **Schema**: `TechnicalReview` with an XOR over its two subject keys, a `NOT NULL` reviewer email snapshot, `reviewerId ON DELETE SET NULL`, and `evidence_set_hash`. Both hash functions already installed. Both public views already installed, with `INSERT`/`UPDATE`/`DELETE` revoked.
- **Transactions**: the import writer's `beginGuardedTransaction` sets isolation, a lock timeout, a statement timeout and an advisory lock. The lead workflow uses a bare compare-and-set with `updateMany`'s row count as the concurrency signal.
- **Errors**: `ApiException` + the closed `ErrorCode` catalog; 409 `CONFLICT` is the staleness answer.

**Conclusion: the schema supports the whole workflow and no migration is needed.** That was checked before any code was written, as the gate required.

## Decision

### 1. One Admin-only surface, under the existing namespace

Five routes, all `Admin`, all `no-store`:

| Method | Path                                                 | Purpose                                   |
| ------ | ---------------------------------------------------- | ----------------------------------------- |
| GET    | `/admin/catalog/review/queue`                        | Paginated queue over BOTH subject types   |
| GET    | `/admin/catalog/review/specifications/:id`           | Full review context for one Specification |
| POST   | `/admin/catalog/review/specifications/:id/decisions` | Record one decision                       |
| GET    | `/admin/catalog/review/product-claims/:id`           | Full review context for one ProductClaim  |
| POST   | `/admin/catalog/review/product-claims/:id/decisions` | Record one decision                       |

**Nested under `/admin/catalog/review/` rather than on `/admin/specifications`.** §2.10 reserves `/admin/products`, `/admin/categories` and `/admin/specifications` for catalog CRUD, which is a different, unbuilt surface. Claiming that namespace for a review workflow would take a path a later gate needs and would suggest this API can create or edit a Specification, which it cannot.

**`POST` to a `decisions` sub-collection, never `PATCH` on the subject.** A decision is an event appended to an immutable history; the subject's status moving is a _consequence_. Spelling it as a `PATCH` would make the status the thing being written — which is exactly the generic-update shape ADR-014 §8 forbids — and would imply a decision can be edited.

**No bulk endpoint, and adding one needs its own gate.** The subject id is in the path, so a bulk decision is not expressible. Bulk approval is a single click that publishes an unbounded number of unread technical values, and the per-subject evidence-hash check is precisely the guarantee it would have to discard.

**No document proxy.** No route streams, redirects to, or signs a URL for a source document. The review DTO carries a document's _identity_ — title, publisher, locator, SHA-256, media type, byte size — and nothing more. ADR-014 stores no bytes, and putting a download route here would create the republication risk it refused.

### 2. Admin only, on the existing authentication

`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)` on every controller class. **No second authentication system**, no new guard, no new token, no service-account concept.

- unauthenticated, malformed, expired, or a good signature over a deleted user → **401**, one message for all of them
- Content Manager, Sales Expert, Customer → **403**, naming no role
- a service account → whatever its `users.role` says; the platform has four roles and no machine role, so a service identity is denied unless somebody deliberately made it an Admin user — in which case it _is_ an explicitly authorized Admin identity. Payload's `service` role lives in `sam_cms` and is unrelated (ADR-006); no value here is compared against it.
- Admin → allowed

**Narrower than SECURITY.md's matrix, deliberately.** That matrix gives Content Manager and Sales Expert `read` on Products/Catalog. This surface is not catalog product data: it serves unapproved values, supplier provenance and the internal `sourceRef`, and deciding on one is a catalog **write**, which the matrix gives to Admin alone. Narrower than the matrix is always safe; widening it would need the matrix changed first.

**No existing access was weakened.** The public catalog routes, DTOs and selects are untouched.

### 3. `Product.sourceRef` is served here, and only here

ADR-015 §1 made the column categorically non-public and `source-ref-boundary.spec.ts` asserted it was named nowhere outside the importer. A reviewer reconciling a value against the ratified workbook needs to know which workbook row the Product is, so the Admin review DTO carries it.

The boundary is therefore **"non-public", not "unreadable"**, and the exemption is _narrowed rather than granted_: the boundary test now exempts `catalog/review/` by name and adds an assertion that fails unless every `@Controller` in that folder is under `admin/` and carries both guards plus `@Roles(UserRole.ADMIN)`. The column remains absent from `products.service.ts`, every public Product DTO, SEO, the sitemap, `apps/web`, `apps/cms` and `packages/types`.

### 4. Every decision is one transaction, in a fixed order

ADR-014 §8's four requirements, and where each is met:

| §8 requirement                                           | How                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| transitions performed only by the review service         | `CatalogReviewService.decide` is the only writer of either `review_status` column             |
| RBAC on that service                                     | §2                                                                                            |
| hash recomputed and compared **in the same transaction** | steps 3 and 5 below                                                                           |
| no generic update endpoint exposes `review_status`       | the DTO has no such field; `forbidNonWhitelisted` answers 400 naming it if a client sends one |

Inside one interactive transaction, in this order:

1. `SET LOCAL lock_timeout` and `statement_timeout`.
2. `SELECT ... FOR UPDATE` the subject. **`deleted_at` is not filtered** — a retired subject must be found and reported ineligible, not reported missing.
3. Recompute the evidence-set hash against the locked row, through the database function.
4. Compare the caller's `expectedReviewStatus`. Mismatch → **409**, nothing written.
5. Compare the caller's `expectedEvidenceSetHash`. Mismatch → **409**, nothing written.
6. Check the current status is decidable, that the decision would actually **change** it, and that a rejection carries a note.
7. For an approval only: run the eligibility probe (§6). Any blocker → **409** listing every one, and the subject keeps its status.
8. Insert one immutable `TechnicalReview`, carrying the **recomputed** hash and the reviewer snapshot from the authenticated session.
9. Compare-and-set the status with `updateMany`; a count other than 1 aborts.
10. Ask the public view whether it now agrees with the decision; disagreement aborts the whole transaction.

**Locking, not compare-and-set alone.** `LeadWorkflowService`'s bare compare-and-set is right for a lead: the predicate the caller holds _is_ the whole question. It is not enough here, because the second half of the question — the evidence-set hash — is computed from four other tables and cannot be folded into a `WHERE`. The row lock is what makes the hash comparison mean something; the compare-and-set stays underneath it.

**A decision must be a change.** A request whose target status equals the current status is **400**, not 409 — the caller's expectation matched, so they were not stale; they asked to move the row to where it already is. This is the rule `LeadWorkflowService` applies to `from === to`, and it is load-bearing: without it, two concurrent approvals of an already-approved row would both succeed and the audit trail would gain a decision that decided nothing. **Found by the concurrency test**, not by reasoning.

### 5. One canonical evidence-set hash, and the client never computes it

The definition is ADR-014 §7's and lives in the database as `specification_evidence_set_hash(uuid)` and `product_claim_evidence_set_hash(uuid)`. `evidence-set-hash.ts` calls them and does nothing else — **it does not re-implement the five steps in TypeScript**, because a second definition is exactly what putting the first one in the database was meant to prevent, and it could drift from the values stored in existing `technical_reviews` rows.

The queue, the detail response and the decision transaction all come through that one module, which makes "identical between queue, detail and decision" structural rather than conventional.

The client submits `expectedEvidenceSetHash` for **one purpose: comparison**. It is never stored, never trusted, and never echoed into `technical_reviews.evidence_set_hash` — the row written always carries the value recomputed inside the transaction.

Measured on the imported catalogue: deterministic across repeated computation, identical between the module and the detail response, **independent of the order evidence was linked** (proved by construction with two probes carrying the same links inserted in opposite orders), and changed by an addition and restored by its removal.

### 6. Approval eligibility, and what "approved mapping" was taken to mean

Every rule is evaluated by one fixed SQL statement with one bound parameter, run inside the decision transaction. Every predicate **fails closed**: `bool_and` over an empty set is `NULL` and is wrapped in `coalesce(..., false)`, so a Specification with no evidence does not satisfy "all of its evidence resolves" by having none.

**A Specification may be approved only when** it is live; it resolves to a Product; its grade — if any — belongs to that Product; it is normalized (a value type and a non-blank display value); its `propertyKey` is an entry in `spec_properties`; the numeric columns match the declared value type; it cites at least one evidence link; every link resolves to a SourceFact _and_ that fact's SourceDocument; and every evidence fact's raw property resolves to this row's `propertyKey` through a HIGH-confidence mapping.

**A ProductClaim may be approved only when** it is live; it resolves to a Product; its grade — if any — belongs to that Product; its kind is not `LICENSED_BY` or `REFERENCE_ONLY`; an `APPROVED_BY` claim names a non-blank `standardBody`; it carries some identity (a body, a code, a context note, or the importer's `claimIdentityHash`); it cites at least one evidence link; and every link resolves.

Constraints the database already enforces — the composite grade key, `specifications_value_shape`, `product_claims_forbidden_approval`, `product_claims_approved_by_named_body` — are **re-asserted here anyway**. Not defensive clutter: a constraint violation arrives as a driver error and becomes a 500, while re-asserting turns each into a named blocker a reviewer can act on. The constraints remain the invariant; this is message quality, exactly as ADR-011 permits.

**No inference of legal approval from a bare classification.** `ProductClaim.kind` is never written by this API — the decision writes `review_status` and nothing else — so a `CLASSIFICATION_STATED` row cannot become an `APPROVED_BY` one through any path here.

**A rejection is always permitted on a decidable row, even an ineligible one.** Refusing to let a reviewer reject something that can never be approved would trap the worst rows in the queue permanently.

#### The mapping rule — **Option A, ratified by the Architect on 25 August 2026**

The requirement "an approved HIGH-confidence property mapping" admitted two readings. The Architect considered both and **approved Option A**:

> A HIGH-confidence mapping that resolves to the Specification's seeded property key is sufficient for the Specification to enter Admin review. **The Specification itself is the object the Admin approves.** `spec_property_mappings.review_status = 'approved'` is deliberately **not** required, because no mapping-review workflow exists and that rule would make all 1,398 Specifications permanently unapprovable.

The rule as implemented, in one SQL fragment — `RESOLVED_MAPPING` in `review-eligibility.ts`:

| Property                                            | Preserved                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| unit-specific mapping precedence over unit-agnostic | `ORDER BY (raw_unit IS NULL) ASC LIMIT 1` — the importer's own `specific ?? generic` |
| HIGH confidence only                                | `confidence = 'high'`; MEDIUM and LOW never resolve                                  |
| mapping key must match the Specification's property | `spec_property_key = specifications.property_key`                                    |
| rejected/superseded mappings ineligible             | `review_status NOT IN ('rejected','superseded')`                                     |
| every evidence link must resolve, not merely one    | `bool_and(...)`, wrapped in `coalesce(..., false)`                                   |

**Measured on the imported catalogue: 1,395 of 1,398 evidence links resolve, 0 mismatches, 3 unresolved.**

What Option A does **not** relax, and this is the point of it: eligibility is a precondition for a human decision, never a substitute for one. **Nothing is approved automatically.** An Admin still reads the Specification, its normalized value, its raw source readings, the citing document and the mapping confidence, and still records a decision — and since PRODUCT-REVIEW-1A-H1 the database itself refuses the transition unless that decision exists (§12).

The rejected reading is recorded for completeness: requiring `review_status = 'approved'` on the mapping would have been stricter on paper and inert in practice, because no surface in this repository can set that column. Building one is its own gate.

### 7. The queue

One statement over both subject tables, so a mixed queue is paginated as one list — two lists stitched together in JavaScript would make `meta.total` a lie and put rows on two pages at once. Every ordering carries `id` as a tiebreaker.

Filters: subject type, review status, Product slug, `sourceRef`, Product Family (by canonical default-locale `Category.slug`, ADR-009), `ProductType.slug`, property key, claim kind, evidence document locator, and unresolved findings. All ten are **bound parameters compared against a fixed `($n IS NULL OR ...)` predicate in one fixed SQL string** — no fragment is concatenated per request. The sort is a lookup into a four-entry constant map keyed by the closed vocabulary the DTO already validated; no caller-supplied text reaches SQL.

**`hasUnresolvedFindings` is defined over durable database state only**: the planner's per-row verdict (`review_status = 'needs_review'`, written by `statusFor` when a conflict or review flag was attached to that row) and, for a Specification, whether the property mapping resolves. **The importer's manifest flags are a generated file, not a fact about a row, and are not consulted** — serving something that looks like a live finding but is a snapshot of an artefact nobody can reproduce would be worse than serving nothing. The two halves of the filter partition the queue exactly, which is asserted.

### 8. Public transition

**Approved Specification →** in `v_specification_public`, and served by the existing curated legacy DTO on `GET /products/:slug` — `id`, `key`, `unit`, `value`, unchanged by this gate. Proved end to end on a disposable clone: empty before, exactly one specification after, and none of 24 internal markers anywhere in the serialized response.

**Rejected, returned to needs-review, superseded, or soft-deleted →** out of the view and out of the public API. Proved for all four.

**ProductClaims stay non-public.** An approved claim reaches `v_product_claim_public` and **nothing reads that view**. No public claim contract exists and none is created here: the public Product detail's shape is unchanged and a claim never appears on it.

Step 10 of the transaction asks the view directly, before the commit, and aborts on disagreement. The expectation is asymmetric on purpose — an APPROVED Specification **must** be visible and everything else must not, while for a claim only the negative half is asserted, because asserting a publication requirement for a surface that does not exist would be inventing one.

### 9. Immutable review history — and what "immutable" actually means

Every decision appends one `TechnicalReview` carrying the subject, the decision, the recomputed hash, the note, the timestamp, `reviewerId` and the `reviewerEmailSnapshot` taken from the authenticated session. History is served newest first, ordered by `reviewedAt` then `id` so two decisions sharing a timestamp cannot reorder between requests, and each entry reports whether its hash still matches the evidence as it stands now.

> **Measured correction, recorded rather than quietly dropped.** This gate first assumed the database refuses `DELETE FROM technical_reviews`. **It did not** — a probe deleted six review rows and PostgreSQL accepted it. `source_facts` had a `BEFORE UPDATE` trigger; `technical_reviews` had none, and ADR-014 §7 never claimed one.
>
> **Closed by §12** — the Architect ruled this a mandatory blocker and authorized the migration.

### 9b. What immutability rests on, in both layers

| Layer    | Guarantee                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | `technical_reviews_immutable_guard` refuses every UPDATE and DELETE (§12)                                                                                     |
| Database | A reviewed subject cannot be hard-deleted — both subject FKs are `ON DELETE RESTRICT`                                                                         |
| Database | `technical_reviews_exactly_one_target`, `technical_reviews_reviewer_named`                                                                                    |
| Service  | Exactly one write: `technicalReview.create`. Asserted by reading the shipped source and failing on any `update`, `delete`, `upsert`, or raw `UPDATE`/`DELETE` |

### 10. What was deliberately not built

No Admin frontend UI. No Product Detail frontend. No ProductMedia. No public claim contract. No bulk decision. No mapping-curation surface. No `SUPERSEDED` decision — superseding is a consequence of a replacement arriving, never something a reviewer picks while looking at one row, and an endpoint offering it would produce retired facts that nothing replaces.

### 11. What this ADR amends

- **ADR-014 §8** — the deferral is closed, in both layers. The limitation text stays as the record of what was true between 22 and 25 August 2026; the four requirements are met by §4, and the limitation itself is closed by §12. The `COMMENT` on both `review_status` columns is rewritten by the same migration, because a comment that still warns of a hole that no longer exists is worse than none.
- **ADR-015 §1** — `Product.sourceRef` remains categorically non-public; the Admin review DTO is now a named, guard-conditional exemption. See §3.

---

## Amendment — PRODUCT-REVIEW-1A-H1: the database halves

Added 25 August 2026, on the Architect's ruling that §9's finding and §4's service-only enforcement were both mandatory blockers. Migration `20260825120000_harden_review_immutability_and_approval_gate`. **Strictly additive: three functions, three triggers, three COMMENTs. No column added, dropped, renamed or retyped; no row written; no applied migration edited.**

### 12. A service is not a boundary

§4 said the review service is the only caller that performs the transition. That was true and it was not enough: `sam_platform_user` **owns** `specifications` and `product_claims`, so a psql session, a seed script or a future module could still `UPDATE ... SET review_status='approved'` and publish an unreviewed technical value. ADR-014 §8 said so in as many words — the database gated _what is read_, not _who decided_.

Two triggers now gate **entry into `approved`**, on both tables, `BEFORE INSERT OR UPDATE`, `FOR EACH ROW`, `ENABLE ALWAYS`:

- a row can never be **INSERTed** already approved;
- a transition into `approved` requires a `TechnicalReview` **inserted in the same transaction**, naming exactly that subject (and no other), with `decision = 'approved'`, a non-blank `reviewer_email_snapshot`, and an `evidence_set_hash` equal to the value **the database recomputes for that subject at that moment**;
- `product_claim_approval_gate` additionally refuses `LICENSED_BY` and `REFERENCE_ONLY` — a deliberate duplicate of `product_claims_forbidden_approval`, kept as the second lock on the door that publishes, exactly as `v_product_claim_public` already is.

A historical review, another subject's review, a review quoting a stale hash, and a review recording a rejection are each refused. Every one is asserted permanently in `scripts/verify-catalog-technical-data.sh` §26.

### 13. The same-transaction mechanism is `xmin`

`xmin` is the system column PostgreSQL already stores on every row: the id of the transaction that inserted it. `pg_current_xact_id()::xid` is this transaction's id. Comparing them asks _"was this row written by me, right now?"_, and the answer is a physical property of the heap tuple.

That satisfies the requirement for an **evidence-backed** mechanism. It is not a client flag, not a session GUC, not a temp table, and not a `current_setting()` anyone can forge: there is no way to write a `technical_reviews` row carrying somebody else's `xmin`, and no way to make `pg_current_xact_id()` lie. **No schema addition was needed** — the column has always been there.

Verified before the migration was written, on a clone of the imported catalogue: a review inserted in the open transaction reports `xmin = pg_current_xact_id()::xid` **true**; the same row read in a later transaction reports **false**; the `xid8 → xid` cast exists in PostgreSQL 18.4.

> **Known, fail-closed limitation.** A review inserted inside a SAVEPOINT or a PL/pgSQL `EXCEPTION` block carries a **sub**transaction id, which is not equal to the top-level id, and the gate refuses the approval. It refuses a legitimate approval rather than admitting an illegitimate one, so the direction is safe. The review service uses a plain interactive transaction with no savepoint, so no existing path is affected. A caller that needs savepoints must insert the review and update the status at the same nesting level. This is **tested, not merely documented** — verification §26 asserts it.

### 14. Immutable review history, and the one update that must still work

`technical_reviews_immutable_guard` (`BEFORE UPDATE OR DELETE`, `FOR EACH ROW`, `ENABLE ALWAYS`) refuses every UPDATE and every DELETE. INSERT is untouched.

**Exactly one shape is allowed through, and finding it was not optional.** `reviewer_id` is `ON DELETE SET NULL` (ADR-014 §7) because ADR-012 makes deleting a User this platform's strongest credential revocation — an approved specification must never block an off-boarding. PostgreSQL implements SET NULL as an **UPDATE on this table**, so a blanket ban makes `DELETE FROM users` fail.

The first version of this trigger did exactly that, and the verification script's long-standing assertion _"deleting the reviewer is still permitted (ADR-012 unweakened)"_ failed on the first run. The trigger now permits `reviewer_id` going from a value to NULL **with every other column byte-identical**, and nothing else: re-pointing it at a different user is refused, and clearing it while touching anything else is refused. That is the foreign key being released, not history being edited — `reviewer_email_snapshot` is `NOT NULL` precisely so the record still names the person afterwards.

### 15. What is enforced in the database, and what is not

**Enforced:** entry into `approved`, on both tables, on the terms in §12. Refusal of the two forbidden claim kinds. Immutability of review history.

**Deliberately NOT enforced — every other transition.** `REJECTED`, `NEEDS_REVIEW`, `SUPERSEDED` and `SOURCE_RECORDED` are ungated in every direction, **including out of `approved`**. The asymmetry is the design:

- the public risk is a row **arriving** in `approved` unreviewed; a row **leaving** it is a row becoming less public;
- gating the exit would break the importer's approved-evidence invalidation, every rejection, and every supersession — which the gate brief explicitly warned against.

Two further honest limits, stated rather than implied:

1. **The database cannot certify that a human looked at anything.** It certifies that an attributable, evidence-current review record exists, written in the approving transaction. Authentication and the Admin role remain the API's job (§2). The floor's guarantee is exactly: _no approval without a contemporaneous, attributable, evidence-current review record._
2. **A caller who can write both tables can still write both rows.** They must then produce a real review row with a real reviewer snapshot and the correct live hash — which is a recorded, attributable decision, which is the invariant. What is now impossible is approving with **no** review, with someone **else's** review, or on **stale** evidence.

Do not read this as "all transitions are database-enforced". They are not, and §15 is the list.

### 16. Reviewer attribution — what the gate checks, and what it cannot

The gate requires the matching review to carry a **non-blank `reviewer_email_snapshot`**. It does **not** verify that the snapshot names the authenticated caller, and it cannot: PostgreSQL has no knowledge of the HTTP session, and any value it could consult for that purpose would be one the caller supplied — which the brief rightly forbids.

Measured on a disposable clone: a same-transaction review naming a _different_ real person is **accepted** by the database.

What closes the gap is **structural, in the service, not a check that could be forgotten**:

- `ReviewDecisionDto` declares no `reviewerId`, `reviewerEmail`, `reviewerEmailSnapshot`, `reviewedAt` or `reviewer` field, and the global `ValidationPipe` runs `forbidNonWhitelisted`, so sending any of them is a **400 naming the property**. There is nothing a client can supply.
- `CatalogReviewService.decide` writes `reviewerId: actor.id` and `reviewerEmailSnapshot: actor.email` from the guard-supplied `AuthenticatedUser`, which `JwtAuthGuard` re-read from `sam_platform` on that request.

Both halves are asserted by test — the DTO rejections in `catalog-review.controller.spec.ts`, the snapshot provenance in `catalog-review.service.spec.ts`, and the database's acceptance of a differently-attributed review in `catalog-review-integration.spec.ts`, so the limit is recorded rather than mistaken for enforcement.

**Not closed by inventing a user or weakening authentication**, and no schema change would close it: binding a review row to an HTTP identity is not something the database can witness.

---

## Development migration incident — 25 August 2026

Recorded because migration history is a durable artefact and this is the established place for decisions about it.

**What happened.** The first version of `20260825120000_harden_review_immutability_and_approval_gate` was applied to local DEV `sam_platform` and recorded in `_prisma_migrations`. Testing then found a defect in it: the immutability trigger banned every UPDATE on `technical_reviews`, which breaks `reviewer_id ON DELETE SET NULL` and therefore ADR-012's user-deletion revocation (§14). To correct it, the migration's database objects were dropped manually, **its `_prisma_migrations` row was deleted manually**, the file was corrected, and the corrected version was applied again.

**This was history manipulation and is not to be repeated.** Deleting the row removed the _record_ of the first application; it did not undo the fact that a different file content had already been applied under that migration name. The earlier report described this as "the file has never been edited after being recorded as applied", which was wrong as written and is corrected here.

**Scope.** Local development only. **No production database exists** (ADR-005 — the VPS has not been acquired), no staging environment exists, and the migration had never left this working tree: it is untracked in git and has never been committed, pushed or shared. No other environment ever saw the first version.

**Current state, verified.** The `_prisma_migrations` row for this migration records `checksum = b89e74b0…f108a9`, `applied_steps_count = 1`, `rolled_back_at = NULL`, and that checksum **matches the SHA-256 of the repository file exactly**. `prisma migrate status` reports the schema up to date and `prisma migrate deploy` is a no-op on every database tested.

**Distributability, verified after the fact.** The repository's migration set was proved to produce a byte-identical schema on three independently built databases — the existing imported DEV, a fresh empty database migrated from the repository only, and a database restored from the retained pre-import backup and then migrated normally. Functions, trigger definitions, `ENABLE ALWAYS` flags, views, view privileges, table ownership and CHECK constraints compare identical, all three report no drift, and the 234-assertion verification script returns the identical label set with identical verdicts on all three. Separately, applying the migration over the imported catalogue (1,398 Specifications, 148 ProductClaims, 0 reviews, 0 approved) was shown to leave every catalogue table's content hash unchanged.

**Rule, going forward.** `_prisma_migrations` is never deleted, updated, or hand-edited; migrations are never marked applied or rolled back by hand; an applied migration file is never edited or replaced; and migration objects are never dropped in order to reshape migration history. A defect found in an applied migration is corrected by a **new additive migration**, exactly as this one was itself added rather than by amending `20260822120000`.

## Consequences

- A technical value can reach the public site, and only through one Admin-authenticated transaction that recomputed the evidence it rests on.
- Every publication is attributable: who decided, when, on what evidence, with what note — and the record survives the reviewer's account being deleted.
- An approval silently stops describing the facts the moment its evidence changes, and the API says so rather than letting a stale approval keep publishing.
- Two reviewers cannot both win, and neither can overwrite the other: the loser gets 409 and writes nothing.
- **Under Option A (§6), 1,395 of 1,398 evidence links resolve, so the review queue is workable today.** Under the rejected reading none would be.
- **The database now enforces the approval transition** (§12). A direct `UPDATE ... SET review_status='approved'` by a holder of the application credential is refused, which is what ADR-014 §8 deferred and what the service alone could never provide.
- **Review history cannot be rewritten or deleted** (§14), while `DELETE FROM users` still works and the snapshot still names the reviewer.
- Every transition **other than** entry into `approved` remains ungated, on purpose (§15). The importer's evidence-driven invalidation is untouched.
- The verification script grew from **183 to 234 permanent assertions**, and passes identically on live imported DEV, a fresh migration replay, and a restored imported database with ownership preserved.
- `apps/web` has no way to reach any of this yet. The queue and the review screens are the next gate.
- **Live DEV has `users = 0`.** The API is reachable but nobody can authenticate to it: no Admin account exists, and creating one is a deployment/operations act, not a code change. This gate deliberately did not create one.

## Alternatives Considered

**A generic `PATCH /admin/specifications/:id` accepting `reviewStatus`.** Rejected outright — ADR-014 §8 forbids it by name, and it is the single change that would undo this gate.

**Bulk approval.** Rejected for this gate. It cannot preserve the per-subject evidence-hash check, which is the guarantee the whole design rests on.

**Re-implementing the evidence-set hash in TypeScript.** Rejected. It would create the second definition the database function exists to prevent, and it could drift from the values already stored in review rows.

**Trusting the client's hash and storing it.** Rejected. The submitted value is an assertion about a past screen; only the value recomputed under the row lock describes what was approved.

**SERIALIZABLE isolation instead of a row lock.** Rejected. It answers a concurrent decision with a `40001` serialization failure, which surfaces as a 500; `FOR UPDATE` makes the second caller block, re-read, and receive an accurate **409**.

**Advisory locks, as the import writer uses.** Rejected. The importer locks the whole catalogue because it rewrites the whole catalogue; a review decision touches one row, and a global lock would serialize every reviewer on the platform.

**A database trigger enforcing the transition.** Initially not taken, on the instruction to prefer no schema change. The Architect then ruled it a mandatory blocker, and §12 implements it. The concern that a transition guard "must accommodate the importer, corrections, supersession and rejection" is what §15 answers: only ENTRY into `approved` is gated, so none of those four callers is touched.

**Making `technical_reviews` append-only with a trigger.** Same history: recorded in §9 as an open item, then ruled mandatory and implemented in §14.

**Requiring `spec_property_mappings.review_status = 'approved'`.** Considered by the Architect and rejected in favour of Option A (§6): no surface in this repository can set that column, so the rule would be stricter on paper and inert in practice — all 1,398 Specifications would be permanently unapprovable.
