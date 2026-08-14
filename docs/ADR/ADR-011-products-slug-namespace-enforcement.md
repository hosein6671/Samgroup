# ADR-011: Products Slug Namespace Enforcement — Shared Claim Registry

## Status

Accepted, 14 August 2026

Closes the enforcement-mechanism deferral [ADR-010](./ADR-010-products-slug-namespace-and-collision-policy.md) §6 opened and deliberately left open: _"This ADR does not select the enforcement mechanism. Choosing one is its own decision, with its own approval."_ This is that decision.

**ADR-007, ADR-008, ADR-009 and ADR-010 are not modified.** ADR-010 §6 named the deferral, listed three candidate mechanisms without selecting one, and defined the five events that end the deferral; this ADR selects a mechanism through the decision chain, exactly as ADR-010 itself closed an item ADR-008 and ADR-009 both carried forward.

**This ADR authorizes no implementation of any kind** — see Non-Goals. Nothing described below exists in the repository or in any database.

## Context

### What the audit found, in code rather than in plan

ADR-010 §6 could name candidate mechanisms without ranking them because nothing yet depended on the answer. Choosing between them does depend on facts about this repository, and four of them decide the outcome.

1. **There are no write endpoints.** `apps/api` contains no `@Post`, `@Put`, `@Patch` or `@Delete` handler. Every endpoint it serves is an unauthenticated public read.
2. **The only write paths that exist are seed scripts** — `prisma/seed.ts`, `prisma/seed-catalog.ts` and `prisma/seed-categories.ts` — and all three talk to Prisma directly. `products` is written by none of them.
3. **`apps/cms` holds only `.gitkeep`.** Payload is not scaffolded, and the CMS write architecture is undecided. There is no admin surface and no CMS process that could host a validation layer.
4. **`Product` slugs are created nowhere today, and `Category` slugs in exactly one place** — the approved-list upsert in `prisma/seed-categories.ts`.

Read together these say something specific about ADR-010 §6's five deadline events: on current evidence the first to arrive is Product reference data or the first translated-slug row, and **both are direct-Prisma scripts**. A mechanism that lives in the NestJS request path would not be on the code path for the very event that ends the deferral. This is the decisive constraint, and it is a property of the repository as it stands rather than a prediction.

### Correction to ADR-010's Context — translated slugs are not unconstrained

[ADR-010](./ADR-010-products-slug-namespace-and-collision-policy.md) Context, fact 2, states: _"Translated slugs have no uniqueness on their value at all."_ Fact 3 states that a duplicate translated slug resolves arbitrarily through `findEntityIdBySlug`'s `findFirst`.

**Both are inaccurate as descriptions of this repository.** `prisma/migrations/0_init/migration.sql` has carried a partial unique index since the first migration, and it is live in local DEV:

```sql
CREATE UNIQUE INDEX "content_translations_unique_slug"
  ON "content_translations" ("entity_type", "locale", "value") WHERE "field" = 'slug';
```

Its own comment in that migration states the purpose: _"two products could share an Arabic slug and /ar/products/&lt;slug&gt; would resolve ambiguously."_ It is one of three constraints `prisma/schema.prisma` names in its header as inexpressible in Prisma and added by hand to the first migration, alongside `locales_single_default` and `redirects_from_path_global`.

The correction is recorded **prospectively, here**, and **ADR-010 is not edited** — its Decision is unaffected, and amending an accepted ADR's Context in place would destroy the record of what was decided on what understanding.

What the existing index does and does not cover:

| Case                                                          | Constrained today                  |
| ------------------------------------------------------------- | ---------------------------------- |
| Two Categories sharing an `fa` slug                           | **Yes**                            |
| Two Products sharing an `fa` slug                             | **Yes**                            |
| A Category and a Product sharing an `fa` slug                 | No — `entity_type` differs         |
| A translated slug equal to a **different** entity's base slug | No                                 |
| Case or Unicode-composition variants within one locale        | No — the index is on the raw value |
| Reserved structural slugs, in any position                    | No                                 |

ADR-010's **Decision** therefore stands entirely: §5's symmetric union rule is still unenforced across entities, across the base/translated boundary, and against §4's reserved values. What changes is only the size of the gap, and the fact that **the existing index is retained rather than superseded** (§4 below).

### Why the invariant cannot be a constraint on one table

`UNIQUE` is per-relation. PostgreSQL has no cross-table uniqueness or exclusion constraint, so the union ADR-010 §5 defines — base `Category` slugs, base `Product` slugs, and both entities' translated slug values — cannot be expressed as a constraint on `categories`, `products` or `content_translations`. Enforcing it in the database therefore requires either a check that spans the three tables, or a fourth relation on which a single unique key **is** the invariant. This ADR selects the second.

### Current local development state — 14 August 2026, local DEV `sam_platform` only

Scoped deliberately, and true of one database at one moment:

- `products` holds **no rows**
- `content_translations` holds **no `slug` row for any `Category` or `Product`**
- `categories` holds the six approved Product Family roots
- `product_types` holds no rows; `segments` holds the eight approved rows

No collision can exist today. This is what allows the mechanism to be installed deliberately rather than under pressure. It is **not** a durable property of the system and must not be relied on by any later document or task.

## Decision

### 1. The invariants

Three invariants are frozen. They are stated over the **participating slug sources**, which are exactly:

- `categories.slug`
- `products.slug`
- `content_translations.value` where `field = 'slug'` and `entity_type ∈ {Category, Product}`

> **INV-1 — identity.** For every participating slug source, the normalized key
>
> ```
> lower(normalize(value, NFC))
> ```
>
> belongs to **exactly one entity**, globally, across all locales. The same `(ownerType, ownerId)` **may** reuse that key across its own base slug and one or more of its own localized slug rows. Two different entities may **never** share it.

> **INV-2 — reservation.** No participating slug may normalize to `finder`, `segments` or `types`.

> **INV-3 — owner existence.** A `Category` or `Product` translated slug may claim namespace only if that entity actually exists.

`Segment.slug` and `ProductType.slug` are **not** participating sources and are never entered into this namespace. They are protected by the reserved path segments `segments` and `types` (ADR-007 §3, ADR-010 §4), which is a different mechanism for a different problem. Blog slugs are likewise outside it.

INV-3 is enforced for these two entity types only. It is **not** generalized into a polymorphic foreign-key redesign of `content_translations`, which carries five `entityType` values and one deliberate design decision against exactly that.

### 2. Global uniqueness is intentionally stricter than the theoretical minimum

This must not be read as the only defensible model, and is recorded with its costs.

- **Global, locale-agnostic uniqueness is not the only theoretically correct model.** Because `{locale}` is part of the path, ambiguity can only arise _within_ one locale. The minimal correct rule is per-locale uniqueness over each locale's **effective** namespace — that locale's translated slugs plus **all** base slugs, since `CategoriesService.findByTranslatedSlug` falls back to the base column for any entity, not only for untranslated ones.
- **INV-1 is deliberately stricter than that.** It is chosen for **invariant simplicity and compatibility with base-slug fallback**: the minimal model requires materializing one claim per entity per active locale and re-deriving them whenever a `Locale` row is added or activated. That would make adding a language depend on machinery nobody is looking at, straining the frozen rule that adding a language is a data change and never a code change. INV-1 is locale-count invariant — zero registry work when a locale is added — and it is correct without anyone having to reason about the fallback chain.
- **It can reject otherwise non-ambiguous cross-locale reuse.** An `fa` slug may never equal an unrelated `en` slug, even though `/fa/…` and `/en/…` are distinct URLs. At launch `en` is the only Latin-script locale and no `fa`/`ar` slug vocabulary is approved (ADR-010 §8), so the present cost is nil. The strictness fails **safe**: it rejects writes that would have been acceptable, never admits one that is ambiguous.
- **Relaxing it later requires its own migration and its own architecture decision** — a different unique key, a full re-backfill and a re-validation. It is not an implementation detail that a later task may quietly loosen.

### 3. Normalization is `lower(normalize(value, NFC))`, and nothing more

The comparison key is Unicode NFC normalization followed by lower-casing. This closes case variants and composition variants, both of which the existing `content_translations_unique_slug` misses because it compares raw values.

**Deeper `fa`/`ar` confusable folding remains deferred** — ZWNJ (U+200C), Arabic-Indic versus Extended Arabic-Indic digits, and the Arabic/Persian yeh and kaf variants are **not** folded. Deciding that policy is deciding `fa`/`ar` slug vocabulary, which ADR-010 §8 records as unapproved, and inventing it here would be exactly the pattern ADR-010 rejected. It belongs to the gate that approves that vocabulary. Tightening the key later is one migration plus a re-backfill, and this decision is forward-compatible with it.

### 4. The mechanism: a shared claim registry, maintained by the database

A fourth relation, on which one unique key is the whole invariant:

```
ProductSlugClaim
  slugKey    PRIMARY KEY    -- lower(normalize(value, NFC))
  slug                      -- diagnostic literal only, never compared
  ownerType                 -- 'Category' | 'Product'
  ownerId                   -- UUID
  index(ownerType, ownerId) -- the release path
```

Deliberately absent, each for a reason: **no refcount** and **no source-row list**, because release recomputes from the source tables (§5) and a stored count is a second copy of the truth that can drift; **no `createdAt`**, because the row is derived data rather than a record of an event; **no surrogate `id`**, because the natural key _is_ the invariant and this schema already uses natural primary keys where one exists.

**The registry is trigger-maintained and is never written by application code.** That is the property that makes it enforcement rather than bookkeeping: a seed script, a bulk import, a future admin write and a manual `psql` fix all claim through it without opting in, because claiming happens below all of them in the same transaction as the write itself.

**`content_translations_unique_slug` is retained**, not superseded. INV-1 subsumes it, but dropping an approved constraint is a separate decision, it costs nothing to keep, and it rejects the most common duplicate earlier and under a clearer constraint name.

### 5. Same-owner semantics: one key → one entity, one entity → many sources → one claim

- One normalized key resolves to exactly one `(ownerType, ownerId)`. **One registry row per key.**
- The **same** owner may back that key from **any number of source rows** — its base slug, and its slug translation in any number of locales. A Category with `slug = 'base-oils'` and an `fa` translation whose value is also `base-oils` is **valid** and holds **one** claim.
- Any **other** entity claiming that key is rejected, in every locale.
- Duplicate `ContentTranslation` rows remain governed by the existing contract — the `(entityType, entityId, locale, field)` unique key plus `content_translations_unique_slug`. This registry adds to those and replaces neither.

**Claim is idempotent.** Insert the claim; on conflict do nothing; then verify the resulting row's owner is the intended owner and reject otherwise. The second and third source rows for one owner are silent no-ops.

**Release is conditional, and recomputed rather than counted.** A claim is deleted **only if no surviving source row for that same owner still maps to that key**, evaluated against post-statement state across all three source tables. There is no counter to drift, a manually repaired row self-heals on its next write, and the cost is bounded — one primary-key fetch plus one index scan on the existing `(entity_type, entity_id)` index, because the question is always scoped to one entity first.

### 6. Trigger architecture: statement-level, with transition tables

Enforcement is installed as **statement-level `AFTER` triggers using transition tables**, over two shared procedures — one claim, one release — that all three source tables marshal into.

**A `WHEN` clause that sees only `NEW` is rejected as a design.** It silently loses every release path: a slug translation edited into a non-slug field, or re-typed from `Category` to an unrelated entity type, would abandon its claim with nothing raised. More generally, a single row-level trigger covering INSERT, UPDATE and DELETE cannot carry a `WHEN` clause referencing both `OLD` and `NEW` at all. Statement-level triggers with transition tables need no `WHEN` clause: relevance is filtered inside the body over the transition sets, which makes the transition matrix in §7 exhaustive **by construction** rather than by review.

Two further properties follow, and both are load-bearing:

- **All releases run before all claims across the whole statement**, which is what makes multi-row renames and owner reassignment work (§7).
- **Bulk writes stay set-based.** A catalog import inserting several thousand Products performs two set-based statements rather than two trigger invocations per row. Given that a bulk seed is the most likely first Product write path, this is operational fitness rather than micro-optimization.

**One implementation of claim and one of release**, shared by every source table, is itself part of the decision: it is what makes future admin, API and CMS write paths reuse the rule structurally instead of by convention.

### 7. The ContentTranslation lifecycle, and the uniform transition rule

A translation row is **relevant** when `field = 'slug'` and `entity_type ∈ {Category, Product}`.

> **For UPDATE: if `OLD` is relevant, release the old owner's old key; if `NEW` is relevant, claim the new owner's new key. Release occurs before claim.**

Both steps are individually guarded and are no-ops when nothing actually moved, so the rule needs no per-transition branching. It covers, exhaustively:

| Transition                                     | Release old | Claim new   |
| ---------------------------------------------- | ----------- | ----------- |
| non-slug → slug                                | no          | **yes**     |
| slug → non-slug                                | **yes**     | no          |
| unrelated entity type → `Category`/`Product`   | no          | **yes**     |
| `Category`/`Product` → unrelated entity type   | **yes**     | no          |
| `Category` → `Product`, `Product` → `Category` | **yes**     | **yes**     |
| `entityId` change                              | **yes**     | **yes**     |
| `locale` change                                | yes (no-op) | yes (no-op) |
| `value` change                                 | **yes**     | **yes**     |
| any combination of the above                   | **yes**     | **yes**     |

INSERT claims when the new row is relevant. DELETE releases when the old row was relevant. Neither needs a special case.

**Release-before-claim is not interchangeable ordering.** Reassigning a slug translation from entity X to entity Y — an `entityId` change with an unchanged value — is a valid transition that claim-first would wrongly reject, because the registry would still show X as the owner at the moment Y claims. Release-first frees the key from X (the recompute proves X no longer uses it) and then lets Y take it. Release-first breaks nothing in return, because every release is guarded by the recompute: a case-only rename such as `Base-Oils` → `base-oils` maps to the same key, the recompute sees the row's own post-update value still using it, and the claim is kept.

**Everything runs inside the caller's transaction.** A failed claim rolls back the preceding release, an aborted statement leaves the registry untouched, and a rolled-back insert releases its claim with no compensating action. There is no cleanup job and no reconciliation task.

### 8. Delete semantics

**Deleting a `Category` or `Product` releases every claim owned by that entity** — not only the one derived from its base slug. This is required rather than tidy: `content_translations` has no foreign key to either table, so a deleted entity's slug translations survive it, and releasing only the base-slug claim would strand the translated ones as claims owned by nothing.

The result is deliberate: an orphaned slug translation survives holding **no** claim. It therefore cannot block a legitimate future entity from taking that key, and if anyone later updates it, INV-3 rejects the write.

**Deleting a `ContentTranslation` performs the guarded release** of §5 — the claim survives if the owner's base slug or another of its translations still maps to the key. Releasing a claim for an entity that no longer exists finds nothing and is a no-op, so translation rows deleted after their entity are handled without a special case.

**This gate does not repair or delete orphaned `ContentTranslation` rows.** That defect is broader than slugs — it affects `name` and `description` identically, predates this decision entirely, and fixing it is a separate Database change with its own approval. It is recorded in Deferred Decisions below.

### 9. Concurrency

**The unique key on `slugKey` is the serialization authority.** No advisory locks are introduced, in steady state or otherwise, because no concrete race requires one.

| Situation                                              | Outcome                                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent `Product` and `Category` claiming one key   | Both reach one index. The second blocks, then fails on the first's commit. Exactly one wins.                                                                                     |
| Concurrent translated and base claim of one key        | Identical — the claim's origin is irrelevant to the index. Exactly one wins.                                                                                                     |
| Rollback after a claim                                 | The claim belongs to the aborting transaction and disappears atomically. Blocked writers proceed.                                                                                |
| Delete racing a re-claim                               | The claimant blocks on the uncommitted delete; it succeeds if the delete commits and fails if it rolls back.                                                                     |
| Concurrent `A→B` and `B→A` renames in two transactions | May **deadlock**. PostgreSQL detects it and aborts one; the other succeeds and the loser retries. Safe, and advisory locks would only relocate the deadlock to the lock manager. |
| Duplicate keys within a single statement               | Insert-on-conflict keeps one silently; the **verification step is what catches this** and rejects, which is why that step is mandatory rather than decorative.                   |

**One-statement slug swaps remain unsupported**, consistent with the non-deferrable `categories_slug_key` and `products_slug_key` that reject the same swap today. This introduces no new limitation; swaps go through a temporary value, exactly as they already must.

### 10. Reserved vocabulary: one authority, one enforcement copy

`finder`, `segments` and `types` remain reserved, unchanged from ADR-010 §4. The authority chain is frozen:

| Layer                                                                       | Role                                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **[ADR-010](./ADR-010-products-slug-namespace-and-collision-policy.md) §4** | **Architecture authority.** The list changes only by amending it through a new ADR.                                                                          |
| A SQL `product_slug_reserved()` function                                    | **Database enforcement copy**, and the single definition consulted by both the triggers and the migration's validation pass — so the two can never disagree. |
| A TypeScript constant                                                       | **Application declaration only** — for the future write path's error message. Never enforcement.                                                             |
| A verification test                                                         | Asserts the constant equals what the database function returns, so divergence is a failing build rather than something noticed later.                        |

Changing the reserved vocabulary later requires an explicit decision and its own migration. **Adding** a reserved word is a narrowing that can invalidate live rows, so its migration must re-run the reserved validation across the full candidate set and **abort** if any existing claim uses the newly reserved value; remediating such a row is a data decision with its own approval. **Removing** one is a widening and is always safe.

### 11. Installation must be atomic at the database level

This is frozen as a requirement, not left to the implementation gate to discover.

**The registry must be installed and armed in a single atomic database transaction, in this logical order:**

1. lock the participating source tables against conflicting writes
2. create the helper functions and the registry relation
3. build the **complete** candidate set from all three participating sources
4. validate — reserved collisions, cross-owner collisions, and orphaned `Category`/`Product` slug translations
5. backfill generically: **every** existing `Category` base slug, **every** existing `Product` base slug, and **every** `Category`/`Product` slug translation
6. arm the triggers
7. assert full coverage — the registry must account for every distinct key in the candidate set
8. commit atomically

Three properties of this ordering are themselves part of the decision:

- **Step 1 is not optional.** Without it, a write landing between the step-3 read and the step-6 arm would be permanently unclaimed and invisible to the invariant. The lock is what makes the read and the arm see one frozen state.
- **The backfill is generic, never environment-specific.** It must install the invariant correctly against **any** valid pre-migration state. A backfill written against the six `Category` rows that happen to exist in local DEV is explicitly rejected.
- **Validation aborts and never selects a winner.** A reserved value, a cross-owner collision or an orphaned translation stops the migration with the full offending set reported. Nothing is auto-repaired, nothing is skipped, and an unexpected pre-existing row is a hard stop — remediation is a human decision with its own approval.

Because steps 1–8 commit together, **there is no interval after the migration in which existing data is unclaimed**.

**If the migration tooling does not itself provide these transaction semantics, the implementation gate must establish them explicitly.** The invariant requirement is frozen now; the exact tooling mechanics are a verification obligation of that gate, not an open architecture question.

### 12. Write-path error contract

Recorded now so that the future write path implements a contract rather than inventing one. It uses the closed error catalog in `API_CONTRACT_FINAL.md` §8 and introduces no new code.

| Condition                                 | Status | Code               | `details[].field` |
| ----------------------------------------- | ------ | ------------------ | ----------------- |
| Slug normalizes to a reserved value       | `400`  | `VALIDATION_ERROR` | `slug`            |
| Slug is already claimed by another entity | `409`  | `CONFLICT`         | `slug`            |

The distinction is load-bearing: a reserved value is never valid and a client can pre-validate it, whereas an occupied slug is well-formed input that lost a race.

**The owning entity's identity is never exposed to clients** — which product or family holds a slug is an internal fact, and it belongs in the server log. This follows the existing decision not to echo caller-supplied slugs back in a 404 message.

**Application-level mapping is a later Backend gate.** No write endpoint exists today, so there is nothing to map. When one is built, its pre-check exists **for message quality only** and is explicitly not the enforcement, in ADR-010 §6's own terms: it may be adopted in addition to the database-enforced invariant, never instead of it.

## Non-Goals

Accepting this ADR authorizes **no implementation work of any kind**. Every item below remains a separate task with its own approval, per [CLAUDE.md](../../CLAUDE.md) §4's rule that a documentation approval is never a code approval.

**ADR-011 does NOT authorize:**

- creating the `product_slug_claims` relation, or any migration
- writing any trigger, trigger function, or helper function
- any change to `prisma/schema.prisma`
- any change to any seed script
- any `Product` row, Product reference data, or Product write path
- any `Category` or `Product` translated-slug row
- write endpoints of any kind, or the application-level pre-check and error mapping
- the read-side Product-vs-Family discriminator ADR-010 §2 requires
- dropping, altering or replacing `content_translations_unique_slug`
- repairing orphaned `ContentTranslation` rows
- any dependency change

It also does not decide the `fa`/`ar` slug vocabulary, the confusable-folding policy, or when either is approved.

## Consequences

**Positive**

- **ADR-010 §6's deadline is no longer a blocker without an answer.** The five events that end the deferral now have a mechanism to be enforced by, and the work they were blocked behind is a scoped, single-migration Database task.
- **Enforcement covers the writers that actually exist.** The audit found that every write path in this repository bypasses NestJS entirely; a database-resident invariant is on the path for all of them, including the bulk seed most likely to be the first Product write.
- **Race safety is structural rather than argued.** A unique index cannot be raced, so correctness does not depend on lock discipline, isolation level, or every future writer remembering a rule.
- **The invariant is inspectable.** "Who owns this slug?" is one row lookup, which is a materially better debugging story than reconstructing the answer from a procedure that scans three tables.
- **Enforcement cannot be separately unavailable.** The claim shares a transaction with the write it guards, so there is no state in which a write succeeded and the check did not run.
- **A latent documentation error is corrected.** The existing `content_translations_unique_slug` was invisible to ADR-010 and to `DATA_MODEL.md`; both described translated slug values as wholly unconstrained.

**Negative / trade-off**

- **Claim and release bookkeeping is the real cost**, and it is not free. Recomputation removes the drift failure mode but not the logic; rename, reassignment and delete each have a correct behaviour that has to be verified rather than assumed.
- **INV-1 is stricter than necessary** and will reject some non-ambiguous cross-locale reuse (§2). The cost is nil today and grows only if a second Latin-script locale is added.
- **Trigger logic is invisible in `prisma/schema.prisma`.** The repository already carries three such objects and names them in that file's header; this decision adds more, and the same declaration discipline is mandatory rather than optional.
- **`prisma migrate reset` drops the triggers**, since they exist only in migration SQL. That is the existing behaviour for the three constraints already added by hand, and recovery is the same.
- **Cross-transaction slug swaps can deadlock.** Detected and safe, but it is a real operational behaviour that a future admin UI should surface as retryable.
- **The registry is derived data.** Its coherence rests on the triggers being armed; a database restored without them would drift silently. The atomic installation in §11 is what prevents that at install time, not forever.

## Alternatives Considered

- **Application-level pre-write checks only.** Rejected, and ADR-010 §6 rejected it in advance: _"Application validation alone is not equivalent to a database-enforced invariant."_ The audit makes the objection concrete rather than theoretical — **all three write paths that exist today bypass NestJS**, `apps/cms` is an empty directory, and the events that end ADR-010 §6's deferral are seed scripts. It is also unsafe under concurrency: check-then-write is a time-of-check/time-of-use race, and each table's own unique key catches only same-table duplicates, never the cross-entity case that is the entire problem. It is retained **in addition**, for message quality only (§12).
- **PostgreSQL triggers performing a cross-table `SELECT` check.** Rejected. It covers every writer, which is the right instinct, but the check cannot see another transaction's uncommitted row, so it is unsafe under concurrency without an explicit advisory lock on every write — and `DEFERRABLE INITIALLY DEFERRED` does not help, since a deferred check still cannot see uncommitted peers. It also puts hand-written procedural logic scanning three tables on the critical path of every slug write, and answering "why was this rejected?" means re-running that procedure by hand. The registry inverts this: the trigger _claims_, and an index _rejects_, which is both race-safe without locking and far smaller to review.
- **Advisory-lock enforcement in the application.** Rejected. It fixes the race in the previous option but not the bypass, which is the more serious of the two here: a non-participating writer takes no lock and proceeds. It buys the harder half of the guarantee and leaves the half the audit says matters.
- **A registry maintained by application code.** Rejected, and this is the closest call, because the table and its unique key would be identical. The difference is coherence: a derived registry written by application code drifts the moment a seed script, an import or a manual fix writes a base slug without claiming — and that is precisely the class of writer this repository consists of today. A registry that can silently disagree with the tables it describes is worse than no registry, because it looks authoritative. Database-maintained claims are what make the table a projection of reality rather than a parallel copy of it.
- **A per-locale registry model.** Rejected, though it is the theoretically minimal correct rule (§2). Keying claims by `(locale, key)` requires materializing each entity's base slug into every active locale — because base-slug fallback makes it answer in all of them — and re-deriving that fan-out whenever a `Locale` row is added or activated. That makes adding a language depend on a trigger nobody is watching, against the frozen rule that adding a language is a data change and never a code change. The global key is locale-count invariant and needs no reasoning about the fallback chain to be correct.
- **Selecting nothing and deferring again.** Rejected. ADR-010 §6's deferral was defensible only while nothing could violate the invariant, and it expires on the first of five events rather than on a date. Three of those five can arrive without a single Product row, and the work they gate is otherwise ready.

## Relation to ADR-007, ADR-008, ADR-009 and ADR-010

- **[ADR-010](./ADR-010-products-slug-namespace-and-collision-policy.md) is unmodified.** Its §6 deferral is **closed** by this ADR. §3's Family precedence and "colliding data is invalid", §4's reserved values, §5's symmetric union, §7's failure semantics, §8's `fa`/`ar` launch position and §9's proof-route ordering all stand exactly as written — this ADR supplies the mechanism §6 said it was not supplying. Its **Context** facts 2 and 3 are inaccurate about this repository and are corrected prospectively above; the Context is **not** edited in place, because the record of what was decided on what understanding is worth more than a tidy document.
- **[ADR-009](./ADR-009-product-family-canonical-identifier.md) is unmodified.** The one canonical identifier per Product Family, and §3's rule that localized slugs are request and URL vocabulary rather than identifiers, are both preserved. INV-1 depends on that rule rather than relaxing it: a localized slug participates in the namespace, and still never becomes an identifier or a fixture key.
- **[ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md) is unmodified.** Its filter contract and its eight approved Segment slugs are untouched, and `Segment.slug` is explicitly **not** a participating source in this namespace (§1).
- **[ADR-007](./ADR-007-product-taxonomy-v2.md) is unmodified.** §2's canonical flat Product URL and §3's reserved Segment and Product Type namespaces both stand; §3's reservation is what keeps `ProductType.slug` out of this registry.

## Deferred Decisions

Named so that none is later mistaken for something this ADR settled.

- **Deeper `fa`/`ar` Unicode-confusable folding** — ZWNJ, Arabic-Indic digit variants, yeh and kaf variants. Belongs to the gate that approves `fa`/`ar` slug vocabulary. Normalization here is `lower(normalize(value, NFC))` and nothing more (§3).
- **Orphaned `ContentTranslation` cleanup architecture** — rows surviving the deletion of their `Category` or `Product`. A pre-existing defect affecting `name` and `description` equally, outside this gate, and its own Database change (§8).
- **The read-side Product-vs-Family discriminator** that ADR-010 §2 requires. This ADR governs writes only; nothing here decides how a request resolves a slug to a page.
- **Future write endpoints** — for `Product`, for `Category`, and for translated slugs — together with the application-level pre-check and the mapping onto §12's contract.
- **Whether Payload or a future CMS ever writes these tables**, directly or through NestJS. `apps/cms` is an empty directory and that architecture is undecided; the mechanism chosen here is deliberately indifferent to the answer.
- **Whether `content_translations_unique_slug` is eventually retired as redundant.** It is retained (§4), and retiring it is not proposed.
