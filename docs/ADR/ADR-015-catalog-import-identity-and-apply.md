# ADR-015: Persistent Catalog Identity, Database-Enforced Import Idempotency, and the Guarded Apply

## Status

Accepted, 23 August 2026.

Amends **ADR-014** in three narrow places, listed in §9. Amends nothing in ADR-007 through ADR-011: the taxonomy, the canonical identifier, the slug namespace and its trigger enforcement are untouched, and §6 records why the apply engine cannot affect them.

Covers migration `20260823120000_add_catalog_import_identity`, delivered by PRODUCT-DATA-2C-B1.

**This ADR authorizes no import.** It adds a column, four constraints and an engine that refuses to run without nine confirmations. No catalog row has been written, and no demo Product has been deleted.

## Context

PRODUCT-DATA-2C-A ratified 100 catalog identities (`SAMCAT-W1-R003` … `SAMCAT-W1-R300`) and pinned the approved master workbook in a source-controlled ledger. Nothing in the database could hold any of it: no column anywhere in the schema persisted a `sourceRef`, so a Product could not say which workbook row it came from, and a second import could not tell whether it had already run.

Auditing the fifteen tables an import writes found that eleven already had a usable natural key — `product_grades(product_id, label)`, `product_types(slug)`, `spec_properties(key)`, `spec_property_mappings(raw_property, raw_unit)`, `source_assets(sha256)`, `source_documents(locator_type, locator_value, source_asset_id)`, both evidence tables' composite primary keys, `product_segments`, and the trigger-maintained `product_slug_claims`. Four did not:

| Table            | Key before                           | Consequence of a replay                              |
| ---------------- | ------------------------------------ | ---------------------------------------------------- |
| `products`       | `slug` — display-derived and mutable | identity tied to a name that may legitimately change |
| `specifications` | surrogate `id` only                  | 1,398 duplicates                                     |
| `source_facts`   | surrogate `id` only                  | 1,661 duplicates                                     |
| `product_claims` | surrogate `id` only                  | 148 duplicates                                       |
| `import_runs`    | surrogate `id` only                  | one plan applied twice, recorded as two successes    |

Deriving deterministic uuids would have made a replay converge, but only by convention: the database would still have accepted a duplicate arriving with a different id — from a code change, a partial run, or a second writer. That is an idempotency gap concealed in application code, and it was rejected.

## Decision

### 1. `Product.sourceRef` — internal, nullable, unique, immutable

`products.source_ref VARCHAR(64)`, unique when non-NULL.

**Nullable, and it must be.** The column is additive over rows that already exist, and a Product created outside the catalog import legitimately has no ratified identity. `NOT NULL` would have made the migration impossible and would assert that every Product comes from a workbook, which is false. Multiple NULLs coexist because a unique index treats them as distinct; the ten demo Products keep `source_ref IS NULL`.

**Shape, not format.** `products_source_ref_shape` requires non-blank, whitespace-trimmed and bounded. It deliberately does **not** pattern-match `SAMCAT-…`: no ADR freezes the identity _format_, and ADR-011 with PRODUCT-DATA-2C-A freeze the opposite property — that the string is **opaque**. A regex here would reject a future lineage the owner ratifies and would have to be migrated away under pressure.

**Immutable once set.** `products_source_ref_immutable_guard` (`BEFORE UPDATE`, `ENABLE ALWAYS`) refuses to change a non-NULL value to a different one, and refuses to clear it. Assignment (`NULL → value`) is allowed once. A silent rewrite would move a product's facts, evidence and approvals with nothing in the audit trail recording it.

**Never derived.** Not from slug, not from name, not from the worksheet row. Production reconciliation treats a ratified reference as an opaque string; `proposeSourceRef` is reached only when _minting_ a first-generation proposal or a genuinely new row, never for a RATIFIED one.

**Categorically non-public.** Excluded from every Product DTO, the service's Prisma `select` allow-lists, SEO and sitemap, `apps/web`, `apps/cms` and `packages/types`. `source-ref-boundary.spec.ts` reads the actual sources and fails if the column is named in any of them, because a convention nobody tests is a convention that lapses.

### 2. Three import-identity constraints, each measured before it was written

Every key was validated against the real ratified plan rather than reasoned about:

- **`specifications_import_identity_key`** on `(product_id, product_grade_id, property_key)`, `NULLS NOT DISTINCT`, `WHERE deleted_at IS NULL` — **1398 / 1398 distinct, zero collisions**.
- **`source_facts_evidence_identity_key`** on the ten verbatim reading columns, `NULLS NOT DISTINCT` — **1661 / 1661 distinct**. `import_run_id` is excluded on purpose: including it would give every run its own copy of all 1,661 facts.
- **`product_claims_import_identity_key`** on `(product_id, product_grade_id, kind, standard_body, standard_code, claim_identity_hash)`, `NULLS NOT DISTINCT`, `WHERE deleted_at IS NULL` — **148 / 148 distinct**.

`NULLS NOT DISTINCT` is load-bearing, not tidiness: `product_grade_id` is NULL on all 487 Product-level specifications, and under the default the index would have been silently inert for exactly those rows. The partial `WHERE deleted_at IS NULL` keeps ADR-014 §6's "retire, never erase" workable — a retired row does not block re-importing the same fact.

### 3. `ProductClaim.claimIdentityHash` — a discriminator the columns could not provide

Three products state **two different suitabilities** that both normalize to `SUITABLE_FOR` with a NULL body, code and note: `SAMCAT-W1-R243` and `SAMCAT-W1-R246` each say "Suitable for manual gear box" _and_ "Suitable for helical and spiral gear box"; `SAMCAT-W1-R300` states two different grease suitabilities. Keyed on the normalized columns alone, 148 measured claims collapse to 145 and **three genuine claims are lost**.

`claim_identity_hash` is the SHA-256 of the **normalized statement** — the claim sentence, NFKC-folded, whitespace-collapsed and lowercased. `kind`, `standard_body` and `standard_code` remain in the key because one reading can legitimately yield more than one claim — measured on four readings.

The identity is deliberately the statement and **not** the reading it was found in. An earlier version of this decision hashed the SourceFact _evidence identity_, which includes the page number; the durable-verification pass proved that a supplier re-issuing a catalogue and moving an identical sentence from page 33 to page 35 produced a **second active ProductClaim for a statement that never changed**. A claim's identity is what it says. Where it was found is evidence, evidence has its own identity, and a later revision of the same sentence attaches through `ClaimEvidence` as another link rather than creating a second claim. Excluded as inputs, each proved by invariance rather than by inspecting the digest: page, row, column, sheet, document key, method, and the public product name. Both derivations distinguish all 148 claims and keep the three genuine pairs as six; only this one is stable across an evidence revision.

Storing a hash rather than the sentence is what keeps verbatim third-party text out of any column, and `claim_identity_hash` appears in neither public view.

It is an **identity, not an evidence link**. `ClaimEvidence` remains the only statement of which facts support a claim, and a claim may cite many. NULL for any claim not created by the importer.

### 4. `ImportRun.manifestHash` — one successful application per plan

Unique among **finished** runs (`WHERE finished_at IS NOT NULL AND manifest_hash IS NOT NULL`). A run that was rolled back or abandoned keeps `finished_at` NULL, does not consume the hash, and a retry stays possible — while the same plan can never be recorded as applied twice.

### 5. Action semantics are derived from the database, not the ledger

Carried forward from PRODUCT-DATA-2C-A and now enforceable: `INSERT` versus `UPDATE` is decided by whether a Product already exists under the ratified `sourceRef`, never by whether the ledger knows the identity. A ratified identity is not a persisted Product. `SKIP` requires **both** a persisted Product and an unchanged evidence hash.

The preflight admits exactly two states — **FIRST_APPLY** (nothing persisted, 100 INSERT) and **IDENTICAL_REPLAY** (all 100 persisted, 100 SKIP). Anything between them is a partial catalogue, and it is reported rather than completed.

### 6. The guarded apply

**Nine confirmations**, each stating a different fact the operator must already know, each checked against reality: workbook path, ledger path, expected workbook SHA-256, expected ledger SHA-256, expected manifest hash, explicit target database, explicit demo-replacement authorization, a backup attestation, and the typed phrase `APPLY RATIFIED CATALOG TO SAM_PLATFORM`. There is no `--force` and no `--yes`, and adding one is the change this design exists to prevent.

**One SERIALIZABLE transaction**, a fixed transaction-scoped advisory lock so two imports cannot interleave, and both `lock_timeout` and `statement_timeout` set. Every check is re-run inside the transaction. A partial catalogue is worse than none, because it looks complete.

**What the engine may never do**, asserted by test rather than by intention: write `product_slug_claims` (ADR-011 maintains it by trigger — a writer that touched it would be asserting the invariant instead of being subject to it), set any review status to `APPROVED`, normalize a withheld fact into a Specification, or store a byte of any TDS, image or workbook.

### 7. Guarded demo replacement

The owner authorized removing **ten audited rows**, not a prefix. The guard requires, inside the same transaction: exactly 10 rows, every id in the allowlist, every slug prefixed `sam-demo-`, every name carrying the `SAM Demo` marker, every `source_ref IS NULL`, zero ProductGrades, zero Specifications, zero ProductClaims, zero SourceFacts, zero Inquiries (unless SET NULL is separately accepted), exactly 18 ProductSegments, and exactly 10 trigger-managed slug claims.

Two of those counts are checked here **because the database will not check them**: `specifications.product_id` and `product_claims.product_id` are `ON DELETE CASCADE`, so a delete would take reviewed technical data silently. Only `product_grades` is `RESTRICT`.

The delete runs after the reference data and before the 100 Products, inside the same transaction as every insert. Rehearsed on a disposable database: deleting the ten demos, inserting 100 real Products and then failing restored all ten Products, their 18 segment memberships and their 10 trigger-released slug claims automatically.

### 8. Reference data records confidence without conferring belief

All 75 reviewed `SpecPropertyMapping` rows are written with `confidence` preserved verbatim (52 HIGH, 15 MEDIUM, 8 LOW) and `review_status = SOURCE_RECORDED`. None is ever `APPROVED`.

MEDIUM and LOW are written rather than dropped because an uncertain reading is precisely what a reviewer needs to see, and `resolveProperty` resolves **only** a HIGH mapping — so a MEDIUM or LOW row cannot produce a Specification whatever is stored. Recording a reading is not agreeing with it.

## Consequences

### 9. What this changes in ADR-014

1. **`specifications` now carries a uniqueness rule.** ADR-014 §3 recorded "no unique on `(productId, key)` by decision: a product may carry the same key more than once, e.g. one row per grade." That remains true — grade is part of the new key. What is **no longer permitted** is two _live_ Specifications for the same product, grade and dictionary property. Measured against the whole ratified catalogue this costs nothing (1398/1398 distinct), and `verify-catalog-technical-data.sh` was adjusted to give each value-shape probe its own property key, which tests the value-shape CHECK exactly as before.

   The policy means: **one active normalized value for one property at one scope.** Two readings that would land on the same subject are never merged and never silently chosen between. They are reported during the DRY RUN as a `SPECIFICATION_SUBJECT_DUPLICATED` conflict naming the property and the scope, so a reviewer sees them in the artefact they read rather than discovering them when the apply aborts; the row is marked `NEEDS_REVIEW`, and `SPECIFICATION` stays out of `PRODUCT_BLOCKING_CATEGORIES` so the Product row itself is still writable. The resolution is the owner's: decide which reading is the specification, or give readings that measure different conditions or methods distinct approved property identities. Because the authoritative workbook contains no such collision, the rule is exercised by a synthetic conflict test rather than by the data.

2. **`product_claims` gains a non-normalized column.** `claim_identity_hash` is identity, and §3 above records why the normalized columns could not carry it.
3. **`import_runs` gains `manifest_hash`.** ADR-014 §6's rule that reverting a run cannot delete its SourceFacts is unchanged; this only prevents recording one plan as two successes.

### 10. What is deferred, and remains deferred

Approval is still a human decision belonging to a review service that does not exist. ADR-014 §8's recorded limitation — that the database gates _what is read_, not _who decided_ — is **not** closed by this ADR, and the verification script still asserts it as failing-open. The apply engine writes `SOURCE_RECORDED` and nothing else.

**No deletion by omission.** A ratified identity that no workbook row claims is reported as a reconciliation for the owner. No code path deletes a Product because it stopped appearing in a workbook.

**Immutable facts are corrected by revision.** A changed reading differs in the evidence identity, so it becomes a new `SourceFact`; the old one is retired by a `SUPERSEDED` evidence role. `source_facts_immutable_guard` still refuses UPDATE and DELETE, and the import path reaches the new unique index only through `ON CONFLICT DO NOTHING` — never `DO UPDATE`, which would fire the guard and abort, correctly.

### 11. Accepted costs

- `source_facts_evidence_identity_key` is written with an always-true `WHERE raw_value IS NOT NULL` predicate. Prisma's datamodel can express neither `NULLS NOT DISTINCT` nor a partial index; declared as a plain `@@unique` it would be created NULLS DISTINCT and inert for most facts, and left as a full index it is reported as drift and offered for deletion on the next `migrate dev`. Partial keeps it outside Prisma's index model, where ADR-014's CHECKs, triggers and views already sit. **This relies on Prisma ignoring partial indexes**, which is observed behaviour rather than a documented guarantee; `prisma migrate diff` is verified to report no drift, and that verification is the thing that would catch a change.
- A 64-character bound on `source_ref` is a judgement, not a derived limit. The ratified format uses 14.
