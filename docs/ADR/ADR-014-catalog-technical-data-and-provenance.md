# ADR-014: Catalog Technical Data — Grades, Normalized Specifications, Immutable Provenance and Approval-Gated Publication

## Status

Accepted, 22 August 2026

Covers the Prisma-owned schema foundation delivered by PRODUCT-DATA-2A: migrations `20260822120000_add_catalog_technical_data` and `20260822140000_harden_catalog_technical_audit`.

**No ADR is modified by this one.** ADR-007 through ADR-011 (taxonomy, canonical identifier, slug namespace and its enforcement) are untouched, and §5 below records why this schema cannot affect them. ADR-012's user-deletion rule is preserved, and §7 records how.

**This ADR authorizes no import and no service.** Nothing here creates a Product, a Grade, or a technical value. The approval-transition service it names is explicitly deferred — see §8.

## Context

### The problem the old shape could not express

`specifications(id, product_id, key, value, unit)` has been in the schema since `0_init`. It is served publicly today by `GET /products/:slug`. It is also incapable of stating four things the catalog actually needs, and each gap is a publication risk rather than an inconvenience:

1. **What a number is.** A string cannot distinguish a typical value from a specification limit. Publishing the first as though it were the second is a commercial claim nobody made.
2. **Which grade a number belongs to.** A multi-grade product has one viscosity per grade. One `key` repeated with no grade column means the reader cannot tell which is which, and neither can the platform.
3. **Where a number came from.** No source, no page, no extraction method, no hash.
4. **Whether anyone at SAM agreed it is true.** No review state at all — so every row is equally publishable, which in practice means unreviewed data reaches a public page.

### What the source material is

The authoritative material is a workbook of 100 SAM Group products with a ratified grade distribution of 56 zero-grade, 5 single-grade and 39 multi-grade products, giving 134 expected `ProductGrade` rows. `Quenching` is not a grade; `TC` is a performance classification, not a grade. Supporting material includes third-party TDS documents whose licensing statements this platform has no right to republish.

Two facts about that material decide parts of the design. The workbook **has no URL** — it is an uploaded attachment — so any source model requiring one would have been unable to cite the project's own primary source. And the TDS files must never be published or imported as content, so provenance has to record a document's _identity_ without storing its _bytes_.

## Decision

### 1. Product-level and Grade-level specifications, with no synthetic Grade

`Specification.productGradeId` is nullable and carries the whole distinction:

- **NULL** — a Product-level fact, applying to the product as a whole
- **non-NULL** — a Grade-level fact, belonging to a grade **of the same Product**

A zero-grade product has **no `ProductGrade` row at all**. Absence is the representation. No synthetic, default or placeholder grade is ever created, because a grade nobody stated is a fact nobody stated, and 56 of the 100 products would otherwise acquire one.

`ProductGrade.label` stores the **exact source label**, verbatim and unparsed. `gradeSystem` is nullable, and NULL means _not yet safely classified_ — a real state rather than a gap to be filled by inference. The vocabulary is `SAE`, `ISO_VG`, `NLGI` only; `PRODUCT_SPECIFIC` is deliberately absent, because a label belonging to no published system is already fully expressed by a verbatim label with a NULL system.

### 2. Grade/Product integrity is a composite foreign key, not a trigger

"The grade must belong to the same product" is enforced by referencing `product_grades(id, product_id)` from `(product_grade_id, product_id)`, reusing the row's own `product_id` as the second column. `product_grades` carries `@@unique([id, productId])` purely to be a legal foreign-key target.

This works because a multi-column foreign key defaults to **`MATCH SIMPLE`**, which skips the check entirely when any column is NULL. A Product-level fact is therefore unconstrained by it and a Grade-level fact is fully constrained by it — one mechanism, both cases, no trigger and no service validation.

**Verified against the installed Prisma 7.9.1 and PostgreSQL 18 before adoption**, in a disposable reproduction: the composite relation validates, generates a client, and rejects a cross-product grade at the database. A hand-written trigger was the documented fallback and proved unnecessary.

Both composite relations are **`ON DELETE RESTRICT ON UPDATE RESTRICT`**. The `ON UPDATE` half is not cosmetic: Prisma emits `ON UPDATE CASCADE` by default, and on a composite key that silently re-parents a fact to a product it was never measured on when a grade is moved. The first version of the migration had exactly that defect and a database probe caught it.

### 3. Normalized value shapes, constrained by the database

`SpecValueType` fixes eight shapes — `POINT`, `RANGE`, `MINIMUM`, `MAXIMUM`, `TEXT`, `REPORT_ONLY`, `CODE`, `PAIR` — and the `specifications_value_shape` CHECK makes the numeric columns mean what the type says, including `numericMin <= numericMax` for a range. `specifications_normalized_complete` requires a typed row to carry both a dictionary `propertyKey` and a non-empty `displayValue`.

`displayValue` and the numeric columns are **both** stored and neither is derived from the other: the numerics exist for filtering and comparison, the display string for rendering exactly what a reader should see.

`SpecProperty` is an internal, non-localized controlled dictionary keyed by its own stable key rather than a surrogate id — the key _is_ the identity, and `Specification` references it `ON DELETE RESTRICT`. Uncertain mappings live in `SpecPropertyMapping` with an explicit `confidence` and their own review status, so medium- and low-confidence guesses can be **recorded without becoming approved domain truth**.

`SpecProperty.valueKind` (`NUMERIC`/`TEXTUAL`/`CODED`) stays separate from `SpecValueType` because one property legitimately accepts several value shapes. `TechnicalReviewDecision` stays separate from `TechnicalReviewStatus` because `SOURCE_RECORDED` is the state before any human decision and can therefore never be the outcome of one.

### 4. Result basis is resolved once, with fixed precedence

Three columns, none redundant:

| Column                              | Meaning                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `SourceDocument.defaultResultBasis` | what this document's numbers are                           |
| `SourceFact.resultBasisOverride`    | what _this_ fact is, when the document default is wrong    |
| `Specification.resultBasis`         | the **resolved** value on the normalized, publishable fact |

Precedence is fixed and lives in the database as `source_fact_result_basis(uuid)` so the importer cannot quietly implement a different one:

```text
SourceFact override  →  otherwise SourceDocument default  →  otherwise UNSPECIFIED
```

`Specification.resultBasis` is stored, **not** recomputed at read time: it is the value a reviewer approved, and recomputing it would let a later edit to a source document silently change what was approved. There is no free-text `valueQualifierNote` anywhere in the chain.

### 5. ProductGrade has no slug, no route, and no place in the ADR-011 namespace

A grade is a facet _within_ a Product Detail page, not a page. The canonical URL stays flat at `/{locale}/products/{product-slug}` (ADR-009, ADR-010), and `ProductGrade` carries no slug, url, path, locale or SKU column — none may be added.

ADR-011's participating slug sources are exactly `categories.slug`, `products.slug` and `content_translations` where `field = 'slug'`. `product_grades` is none of them, so **no trigger, function or invariant of ADR-011 changes**, and a grade label identical to a product slug is not a collision. Both facts are asserted by the verification script rather than assumed.

### 6. Provenance is immutable, and categorically non-public

`SourceAsset` records a file's identity — `sha256` (unique), size, media type, page count — and **never its bytes**. TDS content is not stored and external images are not imported.

`SourceDocument` is addressed by `locatorType` + `locatorValue`, not by a URL column, so an HTTP page, a PDF URL, an uploaded workbook with no public URL, and a stable internal reference are all first-class. A revision is the same locator with a different asset hash; uniqueness is `(locatorType, locatorValue, sourceAssetId)` and `supersededBy` links an older row forward. There is **no `isPublishable` flag**, deliberately: source documents are categorically non-public, so there is no question for a caller to ask.

`SourceFact` stores every source value verbatim and unparsed, and is **immutable against UPDATE and DELETE**, enforced by `source_facts_immutable_guard` (`BEFORE UPDATE OR DELETE`, `ENABLE ALWAYS`). INSERT is unrestricted, because a correction _is_ a new fact plus a `SUPERSEDED` evidence role.

The consequence is accepted deliberately: **reverting an ImportRun can never delete the SourceFacts it produced.** A bad import is retired by superseding its facts. An audit trail that can be tidied up on a bad day is not an audit trail.

Evidence is many-to-many in both directions — several facts can corroborate one normalized value, and one workbook cell can support both a value and a claim — through `SpecificationEvidence` and `ClaimEvidence`, with roles `PRIMARY`, `CORROBORATING`, `SUPERSEDED`. Every foreign key in the evidence and review chain is `ON DELETE RESTRICT`, so hard-deleting a reviewed subject is refused while **soft deletion via `deletedAt` remains available**. Catalogue facts are retired, never erased.

### 7. TechnicalReview: one subject, one reviewer, one evidence fingerprint

A review targets a `Specification` **or** a `ProductClaim`, enforced by `technical_reviews_exactly_one_target`. There is deliberately **no declared subject enum column**: the subject _is_ which foreign key is set, so "the subject says Specification but the target is a Claim" is not a representable state — there is no second source of truth for the foreign keys to disagree with. This is stronger than a subject enum plus a consistency check, not weaker.

`evidenceSetHash` fingerprints exactly what the reviewer looked at, computed by database functions so two callers cannot disagree about it:

1. every evidence link for the subject
2. per link, `<sourceFactId>:<sha256 of the SourceAsset behind that fact's SourceDocument>`, empty string where no asset was captured
3. sorted by byte value ascending, so insertion order cannot change it
4. joined with newline, encoded UTF-8, SHA-256, lowercase hex

An empty evidence set hashes the empty string — a real, stable value, so "approved on no evidence" is recorded distinguishably rather than as NULL. Recomputing the hash later and getting a different answer means the evidence changed after the approval and the approval no longer describes the facts in front of it.

`reviewerId` is **`ON DELETE SET NULL`** with a `NOT NULL` `reviewerEmailSnapshot`, matching `StatusHistory.changedById`. `RESTRICT` here would make an approved specification block an off-boarding, contradicting ADR-012's rule that deleting a user is this platform's strongest credential revocation. The snapshot is what keeps the record true afterwards: the foreign key goes, the name does not, and **review history remains intact**.

### 8. Publication is gated by read models — and the approval _transition_ is deferred

`v_specification_public` and `v_product_claim_public` are the only sanctioned public read surface. Each is an explicit column allow-list over `review_status = 'approved' AND deleted_at IS NULL`; the claim view additionally excludes `LICENSED_BY` and `REFERENCE_ONLY`, duplicating the table CHECK as a second lock on the door that publishes. Neither view exposes a review-status, timestamp, legacy `key`/`value`, or **any** provenance column, and neither joins any provenance table.

Two claim kinds can never reach `APPROVED`, by CHECK: **`LICENSED_BY`**, because third-party licensing statements are not ours to republish, and **`REFERENCE_ONLY`**, which exists precisely to hold what is never shown — including the unnamed automaker claim. `APPROVED_BY` requires a non-empty `standardBody`; an approval by nobody in particular is not an approval.

**The views are read models, enforced by privilege.** `WITH CASCADED CHECK OPTION` is _not_ a read-only boundary — it rejects only writes that would land outside the predicate, and a probe confirmed that UPDATE and DELETE of an already-approved row through the view both succeeded. `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` are therefore revoked on both views from `PUBLIC` and from each view's owner, leaving `SELECT`.

This is stated precisely because it is a **guard rail, not a privilege boundary**. This repository defines three roles — `postgres`, `sam_cms_user`, `sam_platform_user` (ADR-002) — and `sam_platform_user` is the single application role for `sam_platform`, serving public reads and, later, admin writes. The owner can re-grant to itself and a superuser bypasses ACLs. A true boundary needs a distinct read-only runtime role; inventing one is a production-credential decision that needs its own ADR and is **not** taken here.

> **LIMITATION, recorded deliberately — the database does not enforce how a row reaches `APPROVED`.**
>
> Audited and confirmed: a caller with base-table write access can set `review_status = 'approved'` with **zero** `TechnicalReview` rows and no evidence-set-hash verification, and the row becomes publicly visible immediately. The database gates **what is read**, not **who decided**.
>
> This is deferred to **PRODUCT-DATA-2B** rather than patched with a trigger now. A transition guard must encode which transitions are legal, who may make them, and what re-verification means — that is review-service workflow, and writing it before the service exists would be speculative infrastructure of exactly the kind this project forbids. It would also be brittle: the importer, corrections, supersession and rejection all move this column, and a guard written blind to those callers would be relaxed the first time it blocked one.
>
> PRODUCT-DATA-2B must therefore provide, as mandatory requirements:
>
> - approval transitions performed **only** by the review service, never by a generic update path
> - RBAC on that service, per `SECURITY.md`
> - recomputation and comparison of the evidence-set hash **inside the same transaction** as the transition
> - **no generic update endpoint may ever expose `review_status`**
>
> The limitation is recorded as a `COMMENT` on `specifications.review_status` and `product_claims.review_status` so it travels with the schema into every dump and introspection, and the verification script asserts it as a failing-open condition — closing it in 2B will make that test fail and force this ADR to be updated.

### 9. Additive migrations only

Both migrations are strictly additive. `specifications.key`, `.value` and `.unit` are **not** dropped, renamed or retyped, and the shipped catalog API that reads them is unaffected; every new column is nullable or carries a database default, so any pre-existing row keeps its values and becomes `review_status = 'source_recorded'` — unapproved and non-public. Retiring the legacy columns needs evidence this gate does not have and is a later migration's decision.

The applied first migration is never edited in place — that would change its checksum and put every environment's `_prisma_migrations` history out of agreement with the files — so all hardening lives in the second.

## Consequences

- A multi-grade product's facts are unambiguous, and a cross-product grade is impossible rather than merely discouraged.
- Nothing is publishable by default. Every technical row is born `SOURCE_RECORDED`.
- Source evidence is permanent. Reverting an import cannot erase history, and a mis-import is corrected by superseding rather than deleting.
- Hard-deleting a reviewed Specification, ProductClaim, evidence link or SourceDocument is refused; soft deletion is the supported path.
- A Product with grades cannot be hard-deleted. Given catalogue facts are soft-deleted by design, this is intended.
- The approval decision is **not** yet trustworthy at the database level, and no surface may treat `review_status = 'approved'` as proof that a review happened until 2B lands.
- 134 `ProductGrade` rows and 100 Products remain unimported; the schema is ready for them and asserts nothing about them.

## Alternatives Considered

**A trigger enforcing Grade/Product membership.** The documented fallback if Prisma could not express a composite reference. Rejected because Prisma 7.9.1 can, and a declarative foreign key is cheaper, faster and impossible to forget to arm.

**Service-only validation of Grade/Product membership.** Rejected outright. ADR-011 already established this repository's position: durable invariants are enforced by the database, and application validation is permitted only for message quality. The only write paths that exist today are direct-Prisma scripts that would bypass a service entirely.

**A synthetic default Grade for zero-grade products.** Rejected. It would fabricate a grade for 56 of 100 products, and every downstream surface would then have to know which grades are real.

**One `Specification` row per grade with the grade as free text.** Rejected: unjoinable, unfilterable, and it makes the grade vocabulary unenforceable.

**A `subjectType` enum on `TechnicalReview` alongside the two foreign keys.** Rejected as a second source of truth that can disagree with the keys. XOR over the keys alone makes a mismatch unrepresentable.

**Storing TDS bytes, or an `isPublishable` flag on `SourceDocument`.** Rejected. Sources are categorically non-public, so the flag encodes a question that must never be asked, and storing bytes creates a republication risk the platform has no right to take.

**A database trigger enforcing the approval transition now.** Rejected in favour of the deferral in §8, on the Architect's stated preference and because the callers it would have to accommodate do not exist yet.

**A distinct read-only Postgres role for the public views.** The correct long-term answer and the only true privilege boundary. Not taken here because it introduces a production credential, which is an architecture decision requiring its own ADR and a deployment story the VPS-less project does not yet have.
