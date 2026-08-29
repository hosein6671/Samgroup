# ADR-018: Bounded Incremental Catalog Patches

## Status

Accepted, 29 August 2026, with explicit Product Owner authorization to begin the incremental catalog update.

This ADR extends the catalog operating model without weakening [ADR-015](./ADR-015-catalog-import-identity-and-apply.md). The ratified workbook importer still admits only `FIRST_APPLY` and `IDENTICAL_REPLAY`; it does not become a repair or reconciliation engine.

## Context

The first catalog import deliberately refuses partial state. That is correct for a reviewed 100-product manifest, but it leaves no safe path for a later, narrowly reviewed normalization that reuses existing immutable source readings. The immediate case is four coolant readings already stored as `SourceFact` rows: reserve alkalinity and pH for `SAMCAT-W1-R294` and `SAMCAT-W1-R297`.

The alternatives were:

1. broaden the original importer into a generic updater;
2. edit catalog rows manually;
3. create a named, code-reviewed, exact patch with its own preconditions, audit record and replay contract.

The first option would make a reviewed manifest capable of repairing unreviewed partial state. The second would be unauditable and difficult to rehearse. The third preserves the existing safety boundary.

## Decision

### 1. Incremental work is a registry of exact patches, not a generic updater

Each patch is a committed manifest with a stable id and SHA-256. It names every immutable `SourceFact`, Product source identity, expected source document, raw property, raw unit, raw value and raw method it may use. It also names every dictionary row, mapping change, Specification and evidence link it may write.

The executor accepts only two complete states:

- **APPLICABLE** — all source preconditions match, legacy mappings match exactly, and none of the new target rows exists;
- **ALREADY_APPLIED** — every target row and the finished `ImportRun` match exactly.

Anything partial or different is **CONFLICT**. The executor never fills gaps, overwrites unexpected content, deletes by omission or offers `--force`.

### 2. The write remains inside the existing catalog apply boundary

All SQL writes live under `apps/api/src/modules/catalog/import/apply/`. The operator CLI and immutable patch definition may live under `incremental/`, but they reach persistence only through that writer. The existing repository guard that forbids catalog writes outside `apply/` therefore covers this path too.

An apply uses the same transaction-scoped advisory lock and timeout policy as the ratified importer, inside one `SERIALIZABLE` transaction. Source preconditions are re-read after the lock. Post-write verification runs before `finished_at` is set, and any failure rolls back the `ImportRun`, dictionary rows, mapping changes, Specifications and evidence links together.

### 3. Source facts and provenance stay immutable and internal

An incremental patch may cite existing `SourceFact` rows. It may not update or delete them, store source bytes, fetch a locator, expose a locator, or copy provenance into a public response. Every new Specification must have an explicit evidence link to an exact existing fact.

The `ImportRun` records that a patch was applied even when it created zero SourceFacts. Its manifest hash is the patch manifest hash, not a review hash.

### 4. Import is not technical approval

Every Specification written by this mechanism is `NEEDS_REVIEW`. The patch writes no `TechnicalReview`, never writes `APPROVED`, and must verify that none of its subjects appears in `v_specification_public`.

Review hashes remain defined only by PostgreSQL under ADR-017. The writer calls the existing thin review-hash wrapper after insertion and verifies four valid v2 hashes; it does not implement or restate the review-hash algorithm in TypeScript.

Mapping improvements remain `SOURCE_RECORDED`, even when their confidence becomes HIGH. HIGH makes a normalized subject eligible to be assessed; it does not constitute approval.

### 5. Operator confirmation and backup

`pnpm catalog:increment` requires exactly one of `--dry-run` or `--apply` and exactly one registered patch id. Apply additionally requires:

- the independently copied patch SHA-256;
- the literal target database `sam_platform`;
- a non-empty verified-backup attestation;
- the exact phrase `APPLY CATALOG INCREMENT TO SAM_PLATFORM`.

Dry-run calls no writer. A live apply may proceed only after the patch has passed its disposable-clone apply, identical-replay and injected-rollback tests and a restorable backup has been produced.

### 6. First registered patch

`coolant-source-layout-v1` is bounded to:

- 2 new `SpecProperty` rows;
- 2 exact legacy `SpecPropertyMapping` updates;
- 4 Product-level Specifications, all `NEEDS_REVIEW`;
- 4 PRIMARY evidence links to the four named existing SourceFacts;
- 0 SourceFact mutations, 0 approvals and 0 public Specifications.

It records reserve alkalinity in `mL 0.100 N HCl` and pH as dimensionless, retaining each source value and ASTM method exactly. This is normalization of source layout, not a formulation change and not a claim that the values have been approved.

## Consequences

- Later incremental changes require another named patch (or a new ADR if the mechanism itself changes); this executor is not parameterized into a general reconciliation API.
- A partially applied or manually edited target blocks the patch and requires investigation rather than automatic repair.
- An identical replay writes nothing and creates no second successful `ImportRun`.
- The four new subjects become visible to the internal review workflow but remain absent from every public catalog response until separately approved through ADR-016/017.
- No schema, migration, endpoint, public DTO or frozen deployment boundary changes in this decision.

## Verification

The implementation is covered by unit tests for the manifest and CLI boundaries, the repository-wide catalog write-surface and review-hash guards, and an opt-in PostgreSQL integration suite that proves exact apply counts, zero SourceFact/TechnicalReview mutation, zero public rows, valid v2 hashes, write-free replay and complete rollback after an injected late failure.
