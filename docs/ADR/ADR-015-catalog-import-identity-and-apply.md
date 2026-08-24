# ADR-015: Persistent Catalog Identity, Database-Enforced Import Idempotency, and the Guarded Apply

## Status

Accepted, 23 August 2026.

Amends **ADR-014** in three narrow places, listed in §9. Amends nothing in ADR-007 through ADR-011: the taxonomy, the canonical identifier, the slug namespace and its trigger enforcement are untouched, and §6 records why the apply engine cannot affect them.

Covers migration `20260823120000_add_catalog_import_identity`, delivered by PRODUCT-DATA-2C-B1. Extended by PRODUCT-DATA-2C-B2A, which completed the writer and proved it on disposable databases (§12-§17). That work carried no migration and no schema change.

**This ADR authorizes no import.** It adds a column, four constraints and an engine that refuses to run without nine confirmations. No catalog row has been written in `sam_platform`, and no demo Product has been deleted there. `APPLY_EXECUTION_ENABLED` is still `false`: the completed writer is reachable only from an internal test harness that refuses any database not explicitly named disposable, and the public CLI still stops before the transaction opens.

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

## Amendment — PRODUCT-DATA-2C-B2A: the completed writer

Added 24 August 2026. Sections 1-11 above are unchanged and every reference to them still resolves; this amendment records what the writer DOES, now that it exists and has been proved, and what the Architect required corrected before it could be committed (§18-§20). No migration, no schema change, and no import.

### 12. What the writer actually does, per table

PRODUCT-DATA-2C-B2A replaced the planned-row skeleton with real persistence for all thirteen inserting tables plus the `ImportRun`, in the order §6 fixed. Every table reconciles the **same** way:

1. read what the database already holds, keyed by that table's identity;
2. a row that is present and matches is **SKIP**;
3. a row that is absent is **INSERT**;
4. a row present under the planned identity but carrying different immutable data **ABORTS the import**.

There is deliberately no blanket `ON CONFLICT DO NOTHING` standing in for step 4: a blanket `DO NOTHING` makes "already correct" and "already **wrong**" produce the same silent success. `source_facts` is the single table that reaches its unique index through `ON CONFLICT DO NOTHING`, and only after step 4 has already passed, because §10 requires it — `DO UPDATE` would fire `source_facts_immutable_guard` and abort.

`import_run_id` is excluded from the SourceFact comparison. It records which run first read a fact; a later run re-reading an unchanged fact must not turn that into a conflict, because the reading did not change.

**The exact first-apply row counts**, measured on a disposable clone of the current DEV catalogue and identical to what the manifest promises: 100 Products, 41 ProductSegments, 8 ProductTypes, 26 SpecProperties, 75 SpecPropertyMappings, 134 ProductGrades, 1,661 SourceFacts, 1,398 Specifications, 148 ProductClaims, 1,398 SpecificationEvidence, 148 ClaimEvidence, 53 SourceAssets, 69 SourceDocuments, 1 ImportRun. The ProductSegment count is **computed from the manifest** — 41 of the 100 rows carry exactly one Segment and 59 carry none — and is asserted against the plan rather than against a constant, so a taxonomy change fails a test instead of drifting.

### 13. Review status is per row, and is never approval

A Specification or ProductClaim is written `NEEDS_REVIEW` when the planner attached a conflict or review flag **to that row**, and `SOURCE_RECORDED` otherwise. Measured: 1,335 / 63 for Specifications, 81 / 67 for Claims. Nothing is `APPROVED`, and two independent assertions enforce it — one over the planned rows before the transaction opens, one re-reading the tables inside it.

Per row rather than per product, on purpose. A product with one entangled grade label has one questionable reading, not fifteen; marking all fifteen would bury the one that needs a person.

### 14. Truthful replay semantics

The manifest records what a plan WOULD DO, and `action` is one of the fields it hashes. A first apply plans 100 INSERT; a replay of the same workbook against the resulting database plans 100 SKIP. **These are different plans and they hash differently**, which is correct — a reviewer reading the second is reading a different document.

Three consequences follow, and all three are implemented rather than assumed:

1. A replay must not look for a successful `ImportRun` under its **own** manifest hash: there never was one and there must never be one, because a plan that writes nothing is not an application of the catalogue. It checks the two facts that matter instead — some run did finish, and no run claims THIS plan as an application.
2. **A replay inserts nothing, in any table.** Every ratified identity is persisted, so a row still missing means the catalogue is incomplete; a replay that filled the gap would be repairing a state nobody reviewed. Measured on a disposable database: 0 inserted, and 100 / 41 / 134 / 1,661 / 1,398 / 148 / 1,398 / 148 skipped, no demo deletion, no second ImportRun, and every count identical before and after.
3. Refusing a manifest that was already applied belongs in the **preflight**, not at the `import_runs` step — the demo deletion happens in between, and a plan that can never commit must be refused before it deletes anything, even though the transaction would have rolled the deletion back.

**A replay was not expressible before this gate.** `checkSlugNamespace` reported every already-claimed slug as `SLUG_COLLISION_WITH_EXISTING`, so re-planning against an imported catalogue produced 100 blocking conflicts rather than 100 SKIP — the 100 slugs are claimed, by the very Products that propose them. The planner now optionally receives, for each live slug key, the ratified `source_ref` of the Product owning it, and suppresses the collision only when the single proposing row IS that owner. A Category, a translated slug, or a Product carrying no identity maps to null and can never look like self-ownership; omitting the map entirely restores the previous behaviour exactly, which is the right reading for a catalogue never imported. **The first-apply manifest hash is unchanged by this**, verified on a fresh clone: `3a9c07dce033d09fc0e96382b91012a013be8dc6fa96fba3a472ee9d21ea26e9`.

### 15. Post-write verification, and when the run becomes successful

Fifty-three assertions run **inside the transaction**, before COMMIT and before `finished_at` is set. Each is a `SELECT` re-reading the tables, never an accumulator the writer incremented — a trigger, a cascade, a partial-index predicate or a `DO NOTHING` that quietly matched would all leave an accumulator right and the table wrong.

They cover: every exact row count; every `sourceRef` present exactly once and none outside the plan; every Product slug registered by ADR-011 and every claim owned; no demo Product and no demo claim remaining; all six Category claims intact; every Grade, Specification and Claim belonging to the Product the plan names, and no unplanned row of any of them; every Specification and Claim carrying evidence; every evidence link resolving on both ends; every SourceFact owning one SourceDocument and one ImportRun; the withheld readings still backing nothing; no Specification from an unapproved or non-HIGH mapping; zero `APPROVED` rows and no review state outside the two permitted; no byte-capable column on any provenance table; and the workbook, ledger and manifest hashes still the confirmed ones.

**`finished_at` is set only after all of them pass.** A failure rolls the whole transaction back and leaves the manifest hash unconsumed, so a retry stays possible (§4). Rehearsed: an unplanned `source_assets` row makes the verification fail, and the ten demo Products, their 18 memberships and their 10 trigger-managed slug claims all come back.

### 16. Evidence revision

Proved against PostgreSQL rather than argued. A statement that moves to another page keeps its ProductClaim — same row, same `claim_identity_hash`, no second claim — while the reading becomes a NEW immutable `source_facts` row, the claim gains a `ClaimEvidence` link to it, and the older link is retired to role `SUPERSEDED` rather than deleted. The superseded reading still refuses both `UPDATE` and `DELETE`. A statement whose MEANING changed produces a different claim identity, because the hash is over the normalized sentence.

The product's evidence hash **does** change when a reading moves, which is what expires an approval: approval is keyed to the evidence a reviewer actually looked at, and a re-issued document is different evidence even when the number on the page is the same.

**One accepted cost, recorded because it will matter later.** `ClaimEvidence.role` is compared as immutable, so once a review service starts retiring evidence links, re-running the same workbook REFUSES rather than skipping — the retired link says `SUPERSEDED` where the plan says `PRIMARY`. Refusing is the correct default here; the alternative is an importer that quietly reinstates evidence a reviewer retired. Reconciling reviewed evidence is the review service's decision to model (§10), not this engine's.

### 17. Execution remains disabled

> **Superseded in one respect by §21.** The constant was `false` and still is, but at the time this section was written flipping it would have enabled nothing: it was never read, and the `--apply` branch ended in an unconditional throw. PRODUCT-DATA-2C-B2A-H1 wired the path; read §21-§26 with this section.

`APPLY_EXECUTION_ENABLED` is `false`, and PRODUCT-DATA-2C-B2A did not change it. `--apply` still runs every confirmation, guard and preflight and then stops where the transaction would open. The completed writer is reachable only through an internal test harness that reads the database's own name out of the connection string and refuses anything not matching `sam_platform_disposable_*` — `sam_platform` and `sam_cms` cannot be reached from it at all, whatever is passed. No second flag, argument or environment variable was added; flipping the constant is a separate reviewed change.

### 18. A Specification is public only when a human approved it

`GET /products/:slug` selected `specifications.key`, `.value` and `.unit` — the legacy triple ADR-014 deliberately did not drop — with **no `review_status` filter**. That was not a bug when it shipped: every row in the table was hand-seeded demo data, so "return them all" and "return the approved ones" described the same set, and nothing forced the distinction.

The import ends that. It writes 1,398 Specifications, every one `SOURCE_RECORDED` or `NEEDS_REVIEW`, none fit to publish. Committing it against the old query would have published the entire unreviewed technical catalogue through a route nobody changed and a DTO nobody widened — the most dangerous shape a leak can take, because no diff shows it.

The public predicate is now **`reviewStatus = APPROVED AND deletedAt IS NULL`**, applied in `where` at the query boundary so PostgreSQL never returns an unapproved row to the process. Both halves are required and neither implies the other: `reviewStatus` is a decision a human recorded, `deletedAt` is whether the row is still current, and an approved row later retired is not public. `APPROVED` is named **positively** rather than by listing what to hide, so a status added to the enum later is non-public by default.

Three read paths reach `specifications`, and all three carry it:

1. the Product-detail select;
2. `findSpecificationsBySlug`, the partial-refresh route — a second door to the same rows;
3. the `?q=` search predicate. This one is not obvious and matters most: a search that matched an unapproved value would answer "does the platform hold a specification saying 173?" for data nobody published. **Confirming a value is a way of reading it.** On the current catalogue the branch matches nothing either way, so the list contract is observably unchanged; after an import it is the difference between a filter and an oracle.

"The grade belongs to this product" is deliberately **not** re-checked in code: `specifications_product_grade_id_product_id_fkey` is a composite foreign key on `(product_grade_id, product_id)`, so a Specification citing another Product's grade cannot exist to be selected. The predicate mirrors `v_specification_public` (ADR-014), which remains the sanctioned read model; the same rule is now stated in both places a reader can arrive from.

**Nothing was approved to make this work.** Measured on the imported disposable database: 1,398 rows stored, 0 approved, and all 100 Product detail responses return an empty specification array while the Products themselves stay publicly discoverable. Withholding unreviewed data is not the same as hiding the catalogue. The DTO, the routes and the list contract are untouched.

### 19. The verification script had to survive the import

`scripts/verify-catalog-technical-data.sh` passed 180/180 on a pristine database and failed 5 on an imported one. Both causes were assumptions that only held while the catalogue was empty:

1. **It borrowed a real identity.** Its probe assigned `SAMCAT-W1-R003` — a ratified `sourceRef` belonging to an actual Product once the import runs. The assignment then failed on `products_source_ref_key`, and the two immutability cases that depended on it silently tested nothing: a probe row with a NULL `source_ref` accepts a change, so "CHANGING a non-null source_ref is rejected" reported **accepted**. A false negative on an immutability guard is the worst kind. The probes now use `SAMCAT-VERIFY-P1/P2/P9`, reserved for verification, outside the ratified `SAMCAT-W1-R003 … R300` space, and within the `products_source_ref_shape` CHECK. Two new assertions state the reservation rather than trusting it: that no real Product carries one, and that they satisfy the length and trim constraints.
2. **It counted absolutely.** Case 18 asserted `count(*) = 4 FROM specification_evidence`, and the post-run residue check summed whole tables and expected zero. Both are statements about the entire catalogue; the probes only ever make a statement about their own rows. A transaction-local baseline is now captured after `BEGIN`, and `pg_temp.delta(table)` measures what **this transaction** added. The residue check became two: no row carrying a probe MARKER survives, and — stronger — a census taken before and after the run must be identical, which proves the rollback restored the database whatever was in it rather than proving the tables are empty.

No assertion was deleted or weakened; the count went 180 → **183**. Verified on four database states — live DEV, a freshly migrated database, a restored backup with ownership and privileges preserved, and a fully imported catalogue — with an **identical assertion set** and 0 failures on all four, and the imported catalogue's counts unchanged by the run.

### 20. Running the database integration tests

The disposable-database suites need `--experimental-vm-modules`: Prisma 7's driver adapter loads through a dynamic import, which Jest's CommonJS runtime refuses without it. `NODE_OPTIONS` is read by node at process start, so **no Jest config option can supply it** — `jest.config.js` is loaded after that decision has been made. It is therefore an explicit command and not a package script, so the flag never applies to the ordinary unit-test run:

```
NODE_OPTIONS=--experimental-vm-modules \
CATALOG_APPLY_TEST_ADMIN_URL=postgresql://<user>:<pw>@localhost:5432/postgres \
CATALOG_WORKBOOK=<path to the approved master workbook> \
pnpm --filter @sam-group/api exec jest \
  src/modules/catalog/import/apply \
  src/modules/catalog/public-specification-security.spec.ts
```

Every suite it runs SKIPS BY NAME when its environment variables are absent, so `pnpm test` stays green on a machine with no PostgreSQL and no workbook — the workbook is not in version control and CI has never had a copy. The public Specification security suite needs only the database, not the workbook: it builds its own rows, and requiring a workbook would skip a security check for a reason that has nothing to do with security.

## Amendment — PRODUCT-DATA-2C-B2A-H1: the production CLI is connected to the writer

Added 24 August 2026. A defect correction. Sections 1-20 above are unchanged except §17, which is superseded in one respect and restated in §21. No migration, no schema change, no import, and the execution flag is still `false`.

### 21. §17 was true about the constant and wrong about the consequence

§17 said flipping `APPLY_EXECUTION_ENABLED` was "a separate reviewed change". It was — but flipping it would have done **nothing**, and the ADR did not say so because nobody had checked.

The constant was exported and never read. The `--apply` branch in `cli.ts` ran every confirmation, every guard and every preflight, and then ended in an **unconditional** `throw new ApplyNotEnabledError`. There was no conditional to flip. `cli.ts` imported no executor, opened no transaction and held no reference to the writer at all; `executeCatalogApply` had exactly one caller in the repository — the disposable test harness, which by design refuses `sam_platform`. The only test watching the constant asserted it was `false`, which stayed true whether or not anything was wired.

So the writer was complete, reviewed, and unreachable from the command an operator would actually run. The gate that was supposed to be "one constant away from live" was in fact a wiring change away, and the manifest, the ledger, the nine confirmations and the 183-assertion verification all passed while that was the case. **A guard nobody can reach is not a guard, and a switch that turns nothing on is worse than no switch: it invites a one-line commit that appears to have enabled something.**

### 22. The production boundary

`cli.ts` decides. `catalog-import.run.ts` connects. Nothing else may do either.

```
main(argv, database, log, execution)
  → parse args · parse workbook · load ledger · verify custody · build plan
  → assertApplyConfirmations   (all nine, against observed values)
  → assertNothingApproved · assertReferenceDataSafe
  → assertPlanApplicable · buildWritePlan · assertWritePlanIdentitiesDistinct
  → dispatchApply(APPLY_EXECUTION_ENABLED, runner, request)
       └─ enabled → runner(request)          [catalog-import.run.ts]
            └─ client.$transaction(…, { isolationLevel: "Serializable" })
                 └─ executeCatalogApply(tx, options)
  → renderApplyResult(result)
```

The runner is **injected, never constructed in `cli.ts`**. That keeps the CLI independently testable with no database and no global Prisma state, and it means the only code that can open a write transaction against the live catalogue is the executable the operator actually ran. The production runner owns nothing but the connection: transaction ordering, the advisory lock, the isolation assertion, the demo guard, the row builders, the deterministic identities and the post-write verification all remain `executeCatalogApply`'s, called once and unwrapped never.

**The disposable harness is not imported by the production entry point.** It is a test dependency, and a production executable that could reach it would be a second, quieter way into a write — the exact shape §17 claimed to have prevented.

### 23. The committed constant is still the only enablement mechanism

`APPLY_EXECUTION_ENABLED` remains `false`. What changed is that it is now **read**: it is the sole input to `dispatchApply`, and the path behind that branch is wired end to end. Changing that one value to `true` now genuinely enables the import, with no other edit.

Nothing else can enable it. There is no environment variable, no hidden flag, no test-only CLI argument, no `--force`, no `--yes` and no dynamic import; `assertDryRunOnly` still refuses every shortcut by name, and the enabled/disabled decision is not reachable from `argv` or `process.env` at all.

The integration suites reach the enabled path by passing `{ enabled: true }` to `main` — a parameter of an exported function, reachable only from code that imports it, which `catalog-import.run.ts` never passes. This is deliberate and it is the lesser evil: the alternative is to ship the flip untested, which is what §21 is about. A test asserts that the production entry point does not set it.

### 24. Disabled behaviour, and the confirmation-before-runner guarantee

Disabled, `--apply` is unchanged from §17's description as an operator sees it: every confirmation and preflight runs, `dispatchApply` returns null, and the command stops with `ApplyNotEnabledError` and `NOTHING WAS WRITTEN`. Measured against a disposable clone: **runner invocations 0, transactions opened 0, rows changed 0.**

The runner is assembled only after all nine confirmations and every preflight have passed, so an unvalidated plan cannot reach it by construction. Seventeen confirmation failures — each of the nine missing, and each falsifiable one wrong — plus `--apply --dry-run` and six refused shortcuts were each measured to reach the runner **zero** times and to leave the clone byte-identical.

Enabled but with no runner supplied is an explicit `ApplyRunnerMissingError`, not a silent no-op. A run that wrote nothing must never be reportable as a success.

### 25. The database name is checked twice, by two different mechanisms

`--target-database` is a **confirmation, not a destination chooser.**

1. In `cli.ts`, `assertApplyConfirmations` compares it to `SELECT current_database()` on the live connection and refuses a mismatch before anything is built.
2. In `executeCatalogApply`, `expectedDatabaseName` is compared to `current_database()` **again, inside the transaction**, so a connection that changed underneath is still refused.
3. In `catalog-import.run.ts`, `PRODUCTION_TARGET_DATABASE` pins this executable to `sam_platform`. This is what stops the confirmation from quietly becoming an arbitrary-database escape hatch: `sam_cms` is Payload's and is never written by this importer (ADR-002), and a disposable clone is reached by the integration suites through their own runner, never through here.

### 26. What was proved, and where

`apply-wiring.spec.ts` — no database, no workbook, always runs — covers the dispatcher directly (enabled/disabled × runner present/missing, exactly-once invocation, typed result, error propagation) and asserts the wiring at source level, including that `cli.ts` constructs no Prisma client and that `catalog-import.run.ts` imports the executor, sets no `enabled`, and imports no harness.

`apply-cli-integration.spec.ts` — skips by name without `CATALOG_APPLY_TEST_ADMIN_URL` and `CATALOG_WORKBOOK` — drives `main(argv, …)` against `sam_platform_disposable_*` clones and proves the whole chain: the disabled stop, the seventeen confirmation refusals, a first apply committing all approved counts, an identical replay inserting nothing and recording no second successful `ImportRun`, an injected mid-transaction failure restoring the ten demo Products and every baseline count, and the in-transaction name guard. It is matched by the §20 command, whose `src/modules/catalog/import/apply` pattern covers both new files.
