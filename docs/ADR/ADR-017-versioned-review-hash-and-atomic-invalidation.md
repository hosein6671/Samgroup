# ADR-017: Versioned Review Hashes, Atomic Invalidation of Stale Approvals, and Immutable Source Identity

## Status

Accepted, 26 August 2026.

Delivered by **PRODUCT-REVIEW-FOUNDATION-2A**, migration `20260826120000_add_review_hash_v2_and_invalidation`.

**Supersedes ADR-014 §7's evidence-set hash definition entirely.** The v1 functions are DROPPED, not deprecated: `specification_evidence_set_hash`, `product_claim_evidence_set_hash` and `evidence_set_hash_lines` no longer exist. There is no dual-read, no compatibility mode and no backfill, because `technical_reviews` held **zero rows** when this ran and no v1 hash had ever been stored.

**Amends ADR-016** in one place: the approval gate now compares a subject-specific v2 hash **and** its version, instead of the v1 evidence-link hash. Every other property ADR-016 §12–§15 established is retained unchanged — same-transaction `xmin` proof, reviewer snapshot, forbidden claim kinds, fail-closed savepoint behaviour, and entry-only gating.

**Amends nothing in ADR-007 through ADR-013, or ADR-015.**

**One forward-only migration. No dependency added, removed or upgraded. No manifest or lockfile change.** No catalogue content row is written or altered by it.

**Nothing in live DEV is approved.** Before and after the migration, `sam_platform` holds 0 `TechnicalReview` rows, 0 APPROVED Specifications, 0 APPROVED ProductClaims, 0 rows in both public views, and 0 rows in the new `review_invalidations` table. Every behaviour claimed below was proved on disposable clones.

---

## Context

### The defect

ADR-014 §7 defined the evidence-set hash over **evidence links alone**:

> 1. every evidence link for the subject
> 2. per link, `<source_fact_id>:<sha256 of the SourceAsset behind that fact's SourceDocument>`
> 3. sorted by byte value ascending
> 4. joined with newline, encoded UTF-8, SHA-256, lowercase hex

ADR-016 then made the approval gate compare that value, and the Admin detail screen render an `evidenceCurrent` flag from it. Both were correct as far as they went. Neither went far enough, and the shortfall has two independent halves.

**Half one — the hash could not see most of what an approval rests on.** Every one of the following could change after an approval without moving the v1 hash by a single bit:

| what changes                                                                        | visible to v1? |
| ----------------------------------------------------------------------------------- | -------------- |
| the Specification's `displayValue`, `numericMin/Max`, `unit`, `method`, `qualifier` | no             |
| `resultBasis` — the difference between a marketing figure and a specification limit | no             |
| a soft delete, or its reversal                                                      | no             |
| `SpecProperty.valueKind`, `methodRequirement`, `quantity`, `allowedUnits`           | no             |
| the winning `SpecPropertyMapping` being rejected, downgraded, or outranked          | no             |
| an evidence link retired from PRIMARY to SUPERSEDED                                 | no             |
| a ProductClaim's `kind` — including `APPROVED_BY` losing its `standardBody`         | no             |
| a ProductClaim's `standardCode`, `contextNote` or `claimIdentityHash`               | no             |

The last row is the sharpest. ADR-014 made `ProductClaimKind` a closed type precisely because "formulated for" and "approved by" are legally different sentences — and the hash that was supposed to detect an approval going stale could not tell one from the other.

**Half two — nothing acted on the hash.** ADR-014 §7 said so explicitly: "ENFORCING that — refusing to serve, or resetting the status — is review-service behaviour and belongs to the later API/admin gate." That gate is this one. Until it, `evidenceCurrent: false` was a sentence on an internal screen. The row stayed `approved`, stayed in `v_specification_public`, and stayed on the public Product detail page.

Together the two halves mean: a technical value could be approved by a named reviewer, then have the value itself rewritten, and remain published as though the reviewer had seen the new number. That is the specific failure this ADR exists to make impossible.

### What was audited before anything was written

- **`technical_reviews` was empty** — 0 rows — as were both approved sets and both public views. This is the only moment at which a hash definition can be replaced outright rather than versioned alongside its predecessor, and the decision below depends on it.
- **The approval gate** (`specification_approval_gate_guard`, `product_claim_approval_gate_guard`) proves same-transaction linkage with `xmin` and is `ENABLE ALWAYS`. Sound; reused unchanged except for the two conditions added.
- **Statement-level triggers with transition tables** are already this schema's idiom for exactly this shape of problem — the nine ADR-011 slug-registry triggers. No new mechanism needed inventing.
- **`review-eligibility.ts`** resolves a raw property to a dictionary key with a fixed precedence: unit-specific over generic, HIGH confidence only, `rejected`/`superseded` skipped (ADR-016 §6, ratified as Option A). The hash has to agree with it or the two would disagree about what an approval rested on.
- **No TypeScript hash implementation existed.** `evidence-set-hash.ts` was already a thin wrapper over the SQL functions, by ADR-014's own reasoning.

---

## Decision

### 1. Why the enriched hash alone was rejected

An enriched hash detects staleness. It does not act on it, and the read path is where acting has to happen or not happen at all.

Left as hash-only, the reviewer-facing screen would say "evidence has changed since this decision" while the value it describes remained on `samgp.com`. That is worse than the v1 situation rather than better: it puts the platform in the position of having recorded that a published value is no longer reviewed, and published it anyway. The hash is the detector; the invalidation is the response; shipping the detector without the response is not half the fix.

### 2. Why dynamic eligibility in the public views was rejected

The tempting shape is to make `v_specification_public` compare the live hash against the approving review, so a stale approval simply stops being selected. It was rejected on three independent grounds, any one of which is sufficient:

- **Cost and shape.** The predicate becomes a correlated recomputation of a multi-table JSONB digest per row, per public request. `review_status = 'approved' AND deleted_at IS NULL` is an index-supported test over one table. The public catalogue is the highest-traffic read path this platform has.
- **Availability.** A dynamic predicate makes a hashing failure — a missing function after a partial migration, a permissions change, a PostgreSQL upgrade that alters `jsonb` text output — present itself as **a canonical 404 on a real product page**. Infrastructure failure must never become a canonical 404. A status column cannot fail that way.
- **Auditability.** A dynamic view answers "is it publishable right now" and records nothing. There would be no row anywhere saying an approval had been withdrawn, no time it happened, and no reason. The invalidation event is the audit record, and a view that silently hid rows would have no place to write one.

**So the public-view predicates are unchanged by this gate**, and that is a load-bearing property rather than an omission. A subject stops being public because its status changed — the only mechanism this project has ever had for that.

### 3. One authoritative hash implementation, in PostgreSQL

The definition lives in the database, as `specification_review_hash_v2(uuid)` and `product_claim_review_hash_v2(uuid)`. **No TypeScript implementation of a review hash is permitted anywhere in the repository.**

ADR-014 put the definition in SQL so two callers could not disagree about it. That argument is now stronger, because the database is no longer only computing the value — it is _acting_ on it, inside triggers, in transactions the application never sees. A second definition in application code could not participate in those transactions and could only ever be a way to be wrong somewhere else.

`apps/api/.../evidence-set-hash.ts` remains a thin wrapper that calls the functions and does nothing else. `review-hash-boundary.spec.ts` scans every TypeScript source in `apps/`, `packages/`, `prisma/` and `scripts/` and fails the build if any file that mentions a review hash also calls `createHash`, `createHmac`, `subtle.digest` or `sha256(`, if any file reconstructs the canonical evidence-entry shape, or if any application module other than the wrapper names the SQL functions.

The realistic regression this catches is not somebody deciding to reimplement the hash. It is somebody needing it where there is no database handle and reaching for `node:crypto` because it is there.

### 4. The canonical encoding

Delimiter concatenation is rejected outright. v1 joined fields with `:` and `\n`, which is ambiguous the moment a field can contain the delimiter — and several fields v2 must carry are verbatim source text that certainly can: a `qualifier` reading `max: 0,9`, a `contextNote` quoting a sentence, a `rawProperty` containing a colon. Two different subjects could then produce one digest.

The payload is therefore a **canonical PostgreSQL `jsonb` document**, digested as `sha256(convert_to(payload::text, 'UTF8'))`, lowercase hex. Specifically:

- **explicit keys** throughout; no positional encoding;
- **JSON `null` for SQL NULL**, via `jsonb_build_object` — and `null` is a different document from the string `"null"`, so an absent method and a method literally recorded as that word do not collide;
- **arrays explicitly ordered**; `allowedUnits` is a **sorted JSON array**, never a comma-joined string;
- **evidence entries sorted deterministically** by `sourceFactId`, which is unique within a subject because `(specification_id, source_fact_id)` is the link table's primary key;
- **every text ordering pinned to `COLLATE "C"`**, so the digest does not depend on `lc_collate` or on an ICU version;
- **numeric columns rendered with `::text`**, so the exact stored `numeric(20,6)` representation is hashed and no JSON number canonicalisation stands between the column and the digest;
- **the digest computed from UTF-8 bytes** of that canonical text.

**Specification payload (`spec-review-v2`)** carries: the subject uuid and domain; `productId`; `productGradeId`; `propertyKey`; `valueType`; `displayValue`; `numericMin`/`numericMax`; `pairFirst`/`pairSecond`; `unit`; `method`; `qualifier`; `resultBasis`; deleted state; the `SpecProperty` block (`key`, `valueKind`, `methodRequirement`, `quantity`, sorted `allowedUnits`); and one entry per evidence link carrying `sourceFactId`, `role`, the captured `SourceAsset` SHA-256 or `null`, whether a raw method is present, and the **selected mapping as content**.

**ProductClaim payload (`claim-review-v2`)** carries: the subject uuid and domain; `productId`; `productGradeId`; `kind`; `standardBody`; `standardCode`; `contextNote`; `claimIdentityHash`; deleted state; and one entry per evidence link carrying `sourceFactId`, `role` and the captured SHA-256 or `null`.

**No external locator value appears in either.** Not a URL, not a file name, not a document title, not an object-storage key. The captured file's SHA-256 identifies the bytes and says nothing about where they live.

**`deleted` is a boolean, not the timestamp.** The approval-meaningful fact is the one the public view tests. Hashing the timestamp would make delete → undelete → re-delete produce a third distinct hash, invalidating nothing extra: the first delete already moved the subject out of `approved`, and returning does not re-approve it.

### 5. The selected mapping, resolved by the eligibility rule

`review_selected_mapping(rawProperty, rawUnit)` reproduces `review-eligibility.ts`'s precedence exactly — unit-specific over generic, HIGH confidence only, `rejected` and `superseded` skipped — with one addition: `, m."id"` as a final ordering key. It can never decide anything, because the table is UNIQUE on `(raw_property, raw_unit)` and at most one row matches each bucket. It makes the ordering total _as written_ rather than total only to a reader who has checked the unique index.

The mapping is included **as content, not as a uuid**, which is what gives the two required behaviours at once:

- an unrelated mapping insert changes **no** subject hash — it is never selected;
- a change to the winner's confidence, review status or target key **does** change the hash — those values are the payload;
- a new unit-specific mapping that **outranks** the incumbent changes the hash, because the winner itself changed.

### 6. A separate immutable system event, never a fake review

The shortcut this refuses is writing a `TechnicalReview` with decision `NEEDS_REVIEW` and a synthetic reviewer. `technical_reviews.reviewer_email_snapshot` is `NOT NULL` and means _the person who decided_. A row there naming `system@` is a fabricated human attribution placed in the audit trail whose entire job is to record who decided what. **Nobody decided this. A hash stopped matching.**

So `review_invalidations` is a separate table, and the columns it does **not** have are as deliberate as the ones it does: no reviewer id, no reviewer email, no note, no locator, no document, no URL.

| column                   | meaning                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `id`                     | uuid primary key                                              |
| `specification_id`       | exactly one of these two is set — CHECK                       |
| `product_claim_id`       |                                                               |
| `technical_review_id`    | the human review whose approval was retired. Required, UNIQUE |
| `reason_code`            | closed enum, below                                            |
| `previous_evidence_hash` | what the approval was granted on                              |
| `current_evidence_hash`  | what stands now. CHECK: differs from the previous             |
| `evidence_hash_version`  | matched to the subject's domain by CHECK                      |
| `created_at`             |                                                               |

The reason codes are the smallest set that covers the mutation paths, one per class of change: `SUBJECT_STATE_CHANGED`, `EVIDENCE_CHANGED`, `DICTIONARY_CHANGED`, `MAPPING_CHANGED`, `SOURCE_CAPTURE_CHANGED`. Each names the class, never the row. `SOURCE_CAPTURE_CHANGED` says a cited source became captured and says nothing about which one.

**At most one event per approval transition** is the UNIQUE index on `technical_review_id`. Entering `approved` requires a review written in the same transaction, so every approval transition has its own review row, and "one per transition" and "one per establishing review" are the same statement. A subject approved, invalidated, re-approved and invalidated again produces two events against two different reviews — correct, and not a duplicate.

`review_invalidations_immutable_guard` (BEFORE UPDATE OR DELETE, FOR EACH ROW, `ENABLE ALWAYS`) refuses every UPDATE and every DELETE. It is stricter than `technical_reviews_immutable_guard`, which has to admit `reviewer_id → NULL` so that ADR-012's credential revocation cannot be blocked; nothing here references a User, so nothing here needs the exception.

### 7. `technical_reviews.sequence` — and why `reviewed_at` was not enough

Finding which review _established_ a standing approval means taking the last approve decision on the subject, and that phrase has to resolve to exactly one row every time.

`reviewed_at` defaults to `now()`, which in PostgreSQL is the **transaction** timestamp: every row written in one transaction carries the identical value, and two rows in separate transactions can still land inside one microsecond. The only available tiebreaker was `id` — a random uuid — so on a tie the "latest" review was decided by chance.

**Measured, not reasoned about.** On a disposable clone with the uuid tiebreaker, a probe that approved one Specification several times picked the wrong establishing review roughly half the time and invalidated each fresh approval the instant it was granted. Nine assertions failed on that and nothing else.

A `BIGSERIAL` is monotone inside a transaction as well as across them, so `ORDER BY sequence DESC LIMIT 1` is a total order. Gaps from rolled-back transactions are expected and carry no meaning: this is an order, not a count.

### 8. Concurrency — the lock precedes the status filter

The invalidation function locks its **entire candidate set** with `FOR UPDATE`, in ascending id order, **before** filtering to `review_status = 'approved'`.

The cheaper ordering — filter first, lock only what is already approved — has a write-skew hole, and it is exactly the one the gate's concurrency requirement names:

> Tx A is approving subject S. It holds a `FOR UPDATE` lock on S but has not committed, so at Tx B's snapshot S is **not** approved.
> Tx B changes a dependency of S. Filtering first, B observes nothing approved, does nothing, and commits.
> A commits. S is now approved on a hash computed before B's change existed, and it is published.

**Measured.** A counterfactual build of the function with the filter-first ordering, run against that interleaving on a disposable clone, ended with `status=approved`, `public=true`, `hashMatchesEstablishingReview=false` — a published stale approval. The shipped ordering, run against the same interleaving, ended `needs_review`, not public, with exactly one invalidation event.

Locking first closes it because `FOR UPDATE` in READ COMMITTED re-reads the locked row at its latest version once the blocking transaction commits: B waits for A, then sees S as approved and recomputes.

**No deadlock is introduced against the approval path**, and an earlier draft that would have introduced one was removed on this reasoning. The approval path locks only its subject; the invalidating path locks reference rows implicitly (by updating them) and then the subject. That is one direction, not two. An intermediate design additionally took `FOR SHARE` on the dependency rows during approval, which created the AB-BA cycle the current ordering avoids — it was dropped.

Two short-circuits keep the cost honest: an **empty** candidate set returns before touching a table (the common case for reference data nothing cites), and **no approved candidate** returns before a single hash is computed. Hashing is the only per-subject cost; the lock is a heap tuple flag. Everything is set-based — no loop, no cursor, no per-subject statement.

**Recursion terminates on the first step.** The status UPDATE re-fires the `specifications` statement trigger, whose candidate set is the transition table filtered to `approved` — and every row it just wrote is `needs_review`. The UNIQUE index on `technical_review_id` is the second, independent guarantee.

**Rollback restores everything**, because the whole sequence is ordinary transactional work: original status, original public visibility, zero events.

**An explicit human transition out of `approved` writes no system event.** The trigger's candidate filter is rows still `approved` after the statement, and a reviewer's REJECT leaves the row `rejected`.

### 9. The PostgreSQL-version dependency, stated as a release requirement

`jsonb::text` is canonical **within** a PostgreSQL major version: object keys ordered by length then byte value, duplicates collapsed, separators fixed. That is not a cross-version guarantee.

**A future PostgreSQL major upgrade must verify stored hash vectors before rollout.** Concretely: before switching, recompute `specification_review_hash_v2` and `product_claim_review_hash_v2` for every subject carrying a stored `evidence_set_hash` on the new major and confirm each matches. A mismatch means the encoding moved, and every standing approval would otherwise be invalidated en masse on first write. This is a release gate, not a footnote.

Current major: **PostgreSQL 18.4**, which is what every measurement in this ADR was taken on.

### 10. Trigger arming, and the one place `ENABLE ALWAYS` is wrong

Sixteen triggers. Every one whose event is UPDATE or DELETE is `ENABLE ALWAYS` — free and strictly stronger, because `pg_restore` writes with COPY and INSERT and never issues an UPDATE or a DELETE, so an ALWAYS trigger on those events cannot interfere with a restore.

The three **INSERT** triggers — on `specification_evidence`, `claim_evidence` and `spec_property_mappings` — are deliberately left at plain `ENABLE`. During a restore, table order is not guaranteed. If `specifications` were restored before `specification_evidence`, an ALWAYS trigger would see an approved subject whose evidence has not loaded yet, hash the empty set, find a mismatch, and un-approve it — silently losing approval state and writing events describing nothing that happened. Plain `ENABLE` means `pg_restore --disable-triggers` suppresses them, which is therefore **the documented way to restore this database**.

The gap that leaves is narrow and named: a session with `session_replication_role = 'replica'` could insert an evidence link under an approved subject without the approval being retired. Setting that GUC requires superuser, which the application role is not; and such a session still could not publish anything, because both approval gates are ALWAYS.

**The larger limitation, recorded rather than papered over: the table owner can disable or drop its own triggers.** `sam_platform_user` owns these tables, so `ALTER TABLE ... DISABLE TRIGGER` and `DROP TRIGGER` are within its rights. No trigger-based mechanism can defend against the role that owns it. Closing this needs a privilege separation — a distinct owner role from the application's connection role — which is a DevOps decision with its own consequences for migrations and deployment, and it is **not** made here. It is recorded so the next reader knows the boundary rather than assuming there is none.

### 11. SourceAsset identity and one-time SourceDocument capture

`source_assets_immutable_guard` (BEFORE UPDATE OR DELETE, FOR EACH ROW, `ENABLE ALWAYS`): every UPDATE is refused, and DELETE is refused **once referenced**. A `source_assets` row _is_ a content identity — a SHA-256, a size, a media type. Rewriting the hash in place would repoint every citation at different bytes while every review that quoted it went on looking current. DELETE is refused only when cited, matching the `source_facts` reasoning: an asset nothing cites is an import artefact, and being unable to clear one would make a bad capture permanent.

`source_documents_asset_capture_guard` (BEFORE UPDATE, FOR EACH ROW, `ENABLE ALWAYS`) makes capture one-way:

- `NULL → non-null` — **allowed**. This is the capture, and it invalidates every approval citing the document.
- `non-null → different non-null` — **refused**. Different bytes at the same locator are a **revision**, and a revision is a new `SourceDocument` plus new evidence linkage, never a rewrite — a rewrite would silently repoint every existing citation at a document nobody reviewed.
- `non-null → NULL` — **refused**. Un-capturing is not a state this project has.

The locator is untouched by this rule and must stay that way: changing `locatorValue` to point at a newer file is the same rewrite by another route, and `(locatorType, locatorValue, sourceAssetId)` being the unique key is what makes a revision a separate row.

**No bytes are captured by this gate**, and no object-storage key or source locator is exposed by anything it adds.

---

## Consequences

**What is now impossible.** An approved technical value cannot be edited, have its dictionary entry changed, have its mapping re-pointed, have its evidence added to, removed from or retired, or have its cited source captured, and stay published. The approval is withdrawn in the same transaction as the change, the row leaves the public view before that transaction commits, and one immutable event records which approval, which class of change, and when.

**What reviewers will see.** Approvals will be withdrawn by the system, and the Admin detail screen shows them in a separate read-only "Automatic invalidations" panel — visually distinct from a decision, never labelled as one, naming no reviewer and no locator, offering no control. This is expected behaviour, not a fault, and the wording says so.

**The 16 external sources are still uncaptured.** When they are captured, every approval citing them will be invalidated by `SOURCE_CAPTURE_CHANGED`. Since nothing is approved today, that costs nothing today — and it is a strong argument for capturing before approving rather than after.

**Cost.** Reference-data mutation now locks the subjects that depend on it and hashes the approved ones. Catalogue reads are unaffected; public reads are entirely unaffected, because the view predicates did not change.

**Phase C is unblocked and not started.** No decision UI exists, no decision control was added, and `phase-boundary.spec.ts` still forbids one.

---

## Alternatives Considered

**Enriched hash alone, no invalidation.** Rejected — §1. Detecting staleness and publishing it anyway is worse than not detecting it.

**Dynamic eligibility in the public views.** Rejected — §2, on cost, on availability (infrastructure failure becoming a canonical 404), and on auditability.

**A system-authored `TechnicalReview` row.** Rejected — §6. It fabricates a human attribution in the one table whose purpose is attribution.

**Application-level invalidation in the review service.** Rejected. ADR-016 §12 already established why a service is not a boundary: `sam_platform_user` owns these tables, so a direct `UPDATE` from psql, a seed script or a future module would bypass it. Invalidation has to sit where the write happens.

**Keeping the v1 functions alongside v2.** Rejected — §3. Two hash definitions in the database is the drift the one-implementation rule exists to prevent, and the empty `technical_reviews` table meant nothing was orphaned by dropping them.

**Filter-then-lock in the invalidation function.** Rejected — §8, and _measured_ to publish a stale approval under the documented interleaving.

**`FOR SHARE` on dependency rows during approval.** Rejected — §8. It closed the same race from the other side and introduced an AB-BA deadlock cycle the chosen ordering does not have.

**Ordering the establishing review by `reviewed_at, id`.** Rejected — §7, and measured to pick the wrong review about half the time when decisions share a transaction timestamp.

**Hashing `deletedAt` as a timestamp rather than a boolean.** Rejected — §4. It manufactures distinct hashes for transitions that invalidate nothing extra.
