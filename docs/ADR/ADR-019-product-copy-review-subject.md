# ADR-019: Product Copy as a Third Review Subject — Giving Drafted Product Descriptions an Approval Path

## Status

**Accepted, 31 August 2026. Implemented.** Ratified by the Architect on all three questions below:
a third review subject is accepted; `product_copy` is a separate table; and approval requires a
bound source document.

It required an explicit ruling because it **contradicted a line of code that forbade it**:

```ts
/** Which table a review subject lives in. There is no third kind and none may be added here. */
export const REVIEW_SUBJECT_TYPES = ["specification", "product_claim"] as const;
```

That sentence was not incidental — it was the frozen half of [ADR-016](./ADR-016-catalog-technical-review-api.md)'s
subject vocabulary. It has been replaced by one naming this ADR, and by a restatement of the same
bar for a **fourth** kind: its own ADR, its own subject foreign key, its own hash version, and its
own approval gate.

### What was built

| Layer     | What landed                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database  | `20260831140000_add_product_copy_review_subject` — `product_copy`, `copy_evidence`, `product_copy_id` on both audit tables, the two CHECKs widened from two subjects to three on each, `copy_review_hash_version()`, `product_copy_review_hash_v2()`, `product_copy_approval_gate()`, `review_invalidate_product_copy()` and its four statement triggers, and a third arm on `review_tg_source_documents_upd()`. |
| Database  | `20260831150000_add_product_copy_public_view` — `v_product_copy_public`, the sanctioned public read model.                                                                                                                                                                                                                                                                                                       |
| Backend   | The third subject through the queue, detail, decision, eligibility, evidence, history and invalidation paths, plus `ProductCopyReviewController` at `/admin/catalog/review/product-copy`.                                                                                                                                                                                                                        |
| Public    | `ProductsService` overlays approved copy onto `description` in both the list and the detail, requested locale then default, and feeds it to the SEO meta description.                                                                                                                                                                                                                                            |
| Admin     | `/admin/catalog/review/product-copy/[id]`, a queue filter chip, and the locale as the queue's discriminator column.                                                                                                                                                                                                                                                                                              |
| Editorial | `prisma/load-product-copy-drafts.ts`, armed by `SAM_ALLOW_PRODUCT_COPY_LOAD=true`.                                                                                                                                                                                                                                                                                                                               |
| Tests     | `product-copy-review-integration.spec.ts`, 18 assertions on a disposable clone.                                                                                                                                                                                                                                                                                                                                  |

### One thing this ADR got wrong, corrected below

The Context table said the 66 drafts were exactly the 66 `official_web_verified` products. They are
not, and the loader's first run against a clone is what said so. The corrected counts are in
[Context](#the-measured-problem). Nothing in the Decision depended on the split.

**Amends, if accepted:** ADR-016 §6 (approval eligibility gains a third subject), ADR-016 §9
(immutable review history gains a third foreign key), ADR-017 (the versioned review hash gains a
third subject variant). Amends nothing in ADR-001 through ADR-015 or ADR-018.

---

## Context

### The measured problem

`docs/content/PRODUCT_RESEARCH_REGISTER.json`, generated 27 August 2026, covers all 100 catalogue
products:

| `researchStatus`        | Carries `copyDraft` | No `copyDraft` | Total |
| ----------------------- | ------------------- | -------------- | ----- |
| `official_web_verified` | 36                  | 30             | 66    |
| `supplied_catalogue`    | 30                  | 4              | 34    |
| **Total**               | **66**              | **34**         | 100   |

**Corrected 31 August 2026.** This table previously read "66 `official_web_verified`, all carrying a
draft; 34 `supplied_catalogue`, none carrying one". That was wrong: the 66 drafts and the 66
web-verified products are two different sets of 66 that happen to be the same size. Thirty
web-verified products carry no draft, and thirty catalogue-sourced products do.

It changes nothing in the Decision — the drafts face the same gate whichever status produced them —
but it does change what the loader accepts, and refusing the catalogue-sourced half would have been
an arbitrary line rather than a safer one. Register rule 4 governs where those products' facts are
SOURCED, not whether they may be described.

Those 66 drafts were produced by `scripts/research-catalog-products.ts` under the twelve rules in
`docs/content/PRODUCT_RESEARCH_REGISTER.md` and the owner's 28 August equivalence statement. They
are conservative by construction: each restates an official descriptor, adds a selection note and
two CTAs, and carries `prohibitedClaimsAdded: false`.

**Every one of them is unreachable.** Measured on 31 August 2026:

- **No code reads the register.** A repository-wide search for `PRODUCT_RESEARCH_REGISTER` across
  `apps/`, `prisma/` and `scripts/` returns the generator and nothing else. It is a write-only
  artifact.
- **Product copy is not a reviewable subject.** `REVIEW_SUBJECT_TYPES` holds two values, the review
  queue enumerates those two, and `technical_reviews` has exactly two subject foreign keys —
  `specification_id` and `product_claim_id`.
- **So `products.description` is NULL on all 100 rows**, and a product detail page renders a name
  and a product type and nothing else.

The register's own rule 7 states `publicationBlockedUntilTechnicalApproval` is always true. It is —
permanently, because no mechanism to grant that approval exists. A draft that can never be approved
is not a draft; it is a dead file.

### What this is not

It is **not** a proposal to publish the 66 drafts, to relax any sourcing rule, or to let copy skip
review. It proposes only that the approval gate the platform already has be made capable of
answering the question, so a human can approve or reject each draft the same way they approve or
reject a specification.

It is also not a way to fill the 34 `supplied_catalogue` products. Register rule 4 keeps those
sourced from the supplied catalogue rather than the open web, and nothing here changes that.

---

## Decision

### 1. `product_copy` becomes the third review subject

`REVIEW_SUBJECT_TYPES` becomes `["specification", "product_claim", "product_copy"]`, and the comment
forbidding a third kind is replaced by one naming this ADR as the amendment.

The wire vocabulary follows the existing precedent: the physical enum label `product_copy`, never a
display form.

### 2. Copy lives in its own table, not on `products`

**Rejected alternative — columns on `products`.** `products.description` already exists and is what
the public reads. Putting review state beside it would make one row both the published artifact and
the workflow record, which is what `Specification.review_status` deliberately avoids being: a
specification is reviewed in place because it _is_ the technical fact, whereas copy has a draft, a
reviewed version and a published version that are not the same string.

**Decision — a `product_copy` table**, one row per (product, locale), carrying the draft text, its
review status, and the source binding that justifies it. `products.description` becomes a
projection of the approved row rather than an independently editable field.

Localisation is in the key from the start rather than retrofitted: register rule 9 already holds
`fa`/`ar` at `not_started` precisely so three versions cannot drift, and a schema without `locale`
would force exactly that drift later.

### 3. Approval requires a source binding, like every other subject

Register rule 11 is the substantive rule this must enforce in the database rather than in prose:

> composition or formulation wording may only be transcribed from that product's bound source
> document; it is never synthesized from the name, category, neighbouring product, or general
> industry knowledge.

So `product_copy` carries an evidence link to the `source_document` the draft was transcribed from,
and the approval gate refuses a row without one — the `SOURCE_ASSET_ABSENT` and `EVIDENCE_ABSENT`
blockers, applied to a third subject. A draft with no bound source is reviewable and rejectable, and
never approvable.

### 4. The audit table gains a third nullable foreign key

`technical_reviews` becomes `specification_id | product_claim_id | product_copy_id`, with the
existing "exactly one is non-null" constraint widened to three. **The immutability guarantees are
not touched**: the same `BEFORE UPDATE` trigger, the same append-only sequence, the same
`reviewer_email_snapshot`.

This is the part with real migration risk and it is why this is an ADR rather than a patch. The
table holds the platform's audit evidence; widening a constraint on it is not reversible by editing
a file.

### 5. The public transition is one direction only

An approved `product_copy` row for the default locale becomes the product's served description. A
rejected or unreviewed row serves nothing — a product with no approved copy renders exactly as it
does today, which is the current behaviour and therefore a safe default for all 100 products on the
day this ships.

### 6. Nothing is imported, and the register stays non-public

The 66 drafts are **loaded once** into `product_copy` at `source_recorded`, by an explicitly armed
editorial script in the shape of `publish-legal-pages.ts` — validated before the database is opened,
refusing anything that carries a placeholder marker. Register rules 6 and 12 hold: no external URL
or provenance locator reaches `product_copy` or any public payload.

---

## Consequences

**What improves.** 66 conservative drafts become reviewable. A reviewer working the existing queue
sees them beside the specifications for the same product, decides with the same controls, and the
decision is recorded with the same immutability. `products.description` stops being permanently
NULL for reasons no one can act on.

**What it costs.** A migration on the audit table; a third branch in the eligibility SQL, the queue,
the detail view and the Admin UI; and a third variant of the ADR-017 review hash. This is the
largest change to the review subsystem since ADR-016.

**What stays exactly as it is.** Sourcing rules, the two allow-listed research hosts, the owner's
equivalence statement, the prohibition on synthesising copy from general industry knowledge, and the
fact that approval is a named human's act. This ADR adds a gate; it opens nothing.

**What it does not fix.** The 34 `supplied_catalogue` products still have no draft. Base Oils still
has no products and no captured source documents. Segment coverage is unchanged. Persian and Arabic
copy remains `not_started`.

---

## The decision required — answered

Three questions, in order. **All three were answered yes on 31 August 2026**, and the
implementation follows each as ratified.

1. **Is a third review subject accepted at all**, amending ADR-016's "there is no third kind"?
   → **Yes.** `REVIEW_SUBJECT_TYPES` now carries three, and the comment forbidding a third names
   this ADR and restates the same bar for a fourth.
2. **Is `product_copy` a separate table** (§2), or should copy be reviewed in place on `products`?
   → **Yes, a separate table**, one row per (product, locale), with `products.description` served as
   a projection of the approved row.
3. **Does approval require a bound source document** (§3), or is a reviewer's decision alone
   sufficient for copy? → **Yes, a bound source is required**, and it is enforced in
   `product_copy_approval_gate` rather than only in the eligibility layer. This makes copy
   **stricter** than the other two subjects, which check evidence as advice the decision path
   consults. The asymmetry is deliberate: a wrong specification number contradicts a datasheet,
   whereas invented prose contradicts nothing and reads perfectly well.

## Where this stands after implementation

The 66 drafts are loaded and reviewable. **None of them is approvable yet**, and that is the design
rather than an unfinished edge: no `copy_evidence` link exists, because the drafts were written from
official web metadata and catalogue metadata rather than from a captured `source_document`. A
reviewer opening one today can read it, reject it, or return it — and the gate refuses an approval.

Publishing any of them therefore needs one more thing that is not a code change: a captured source
document for that product, bound to the draft through `copy_evidence`. Until then, all 100 products
serve exactly the description they served before this ADR, which is none.
