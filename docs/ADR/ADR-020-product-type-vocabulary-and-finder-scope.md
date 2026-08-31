# ADR-020: Product Type Vocabulary and Public Finder Scope

## Status

**Accepted, 31 August 2026.** A new owner decision taken on that date.

Closes the Deferred entry [ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md) opened and
deliberately left open: _"**Product Type names and slugs** — not one is approved, and none may be
inferred from a family sub-range."_ This is the decision that closes it.

**ADR-007, ADR-008, ADR-009 and ADR-015 are not modified.** Their text, their dated context and
their recorded state stand exactly as written. This ADR closes one named deferral by decision, in
the way [ADR-011](./ADR-011-products-slug-namespace-enforcement.md) closed ADR-010 §6's.

### What this ADR does **not** claim

**This ADR neither asserts nor denies that an earlier conversation also approved this vocabulary.**
It records an explicit decision now, and it does not backdate that decision into any earlier gate.

What the repository shows is narrower: **the reviewed evidence contains no record closing ADR-008's
deferral.** Absence of a recorded closure is not evidence that no approval was given. The catalog
import gates each recorded something different, and each stays scoped to what it recorded:

- **PRODUCT-DATA-2C-A** ratified 100 catalog **identities** and pinned the approved master workbook
  — [ADR-015](./ADR-015-catalog-import-identity-and-apply.md) Context, and the source-controlled
  `apps/api/src/modules/catalog/import/data/catalog-identity-ledger.json`. That ledger carries no
  Product Type field of any kind.
- The same gate ratified the owner's resolution of **five specific Marine/Gear products**, each
  carrying a `productTypeKey` — `RATIFIED_MARINE_GEAR_DECISIONS` in
  `apps/api/src/modules/catalog/import/taxonomy-mapping.ts`. Five per-product assignments are not a
  vocabulary.
- **PRODUCT-DATA-2C-B2B** approved **running** the ratified import against a manifest hash that
  covers each product's proposed type assignment, and set `APPLY_EXECUTION_ENABLED` to `true` in
  `apps/api/src/modules/catalog/import/cli.ts`. What that record shows is approval of the run.

Those approvals are real and remain valid for what they cover. **None of them records approval of
the eight Product Type names and slugs as vocabulary**, and no other reviewed record does either —
so ADR-008's deferral has no recorded closure before today. Whether one was given outside the
repository is not something this ADR decides. If such a record surfaces, add it here as a
correction; do not re-date this decision.

---

## Context

### The state this ADR resolves

Three facts were true simultaneously, and no reviewed record reconciled them.

1. **The vocabulary was formally deferred, with no recorded closure.** ADR-008's Deferred section is
   explicit that not one Product Type name or slug was approved, and its Non-Goals list forbids
   "inserting any `Segment`, `ProductType` or membership row".
2. **The eight keys are labelled proposals in one file and approved in another.** `taxonomy-mapping.ts`
   declares `PROPOSED_PRODUCT_TYPE_KEYS` — _"The eight proposed ProductType keys"_ — while
   `apps/api/src/modules/catalog/import/apply/reference-data.ts` reads the same constant under the
   heading _"The eight approved ProductType keys"_ and writes all eight to `product_types`. Two
   words for one list, with nothing deciding between them.
3. **The vocabulary is already public.** `apps/web/src/features/products/detail/sections/hero.tsx`
   renders `product.productType.name` in the Product Detail hero, and
   `apps/web/src/app/[locale]/products/[slug]/page.tsx` emits it as JSON-LD `additionalType`. Both
   have been committed since 28 August 2026.

So a vocabulary is published on implemented public-facing surfaces while the decision record shows
an open deferral and two conflicting labels. This ADR settles that by deciding, not by inferring
what an earlier gate might have intended.

### The display names were derived, not drafted

`reference-data.ts` builds each `name` by title-casing its slug (`engine-oils` → `Engine Oils`). No
one authored those strings, and no reviewed document records a review of them. **Today's
decision approves them as they stand**, on their merits as public labels, independently of the
mechanism that produced them. How a candidate name was generated is not what makes it approved; an
owner decision is.

### Dated observations that are not evidence of the current state

Several documents record `product_types = 0`. Each was accurate when written and each is scoped to
one development database on one date — `docs/ROADMAP.md`'s 14 August 2026 verification block says so
in its own words, and [ADR-011](./ADR-011-products-slug-namespace-enforcement.md)'s Context carries
the same fact for the same reason. **Those lines are history and are not edited.** Where the same
claim was copied forward into a standing status statement without its date, that statement is
reconciled — see Consequences.

---

## Decision

### 1. The eight Product Type slugs and display names are approved vocabulary

| Slug                  | Display name        |
| --------------------- | ------------------- |
| `engine-oils`         | Engine Oils         |
| `industrial-oils`     | Industrial Oils     |
| `lubricant-additives` | Lubricant Additives |
| `gear-oils`           | Gear Oils           |
| `marine-oils`         | Marine Oils         |
| `hydraulic-oils`      | Hydraulic Oils      |
| `antifreeze-coolants` | Antifreeze Coolants |
| `greases`             | Greases             |

Eight, and only these eight. The set is closed by this decision: a ninth Product Type — including
any `Other` or `others` value, which `taxonomy-mapping.ts` has excluded by decision since it was
written — needs its own approval.

These are the values that already exist. **No slug and no display name is created, renamed, or
altered by this ADR**, and none may be inferred from a Product Family sub-range — ADR-008's
prohibition on that inference is unaffected and still binding.

### 2. Showing the eight as filters in the public Product Finder is approved

The public Product Finder at `/{locale}/products/finder` may present these eight as a filter axis
alongside the existing Product Family and Segment axes.

This is a **scope** approval for that surface. It is not a review of the implementation: whether the
filter control as built is correct, accessible and verified is a separate question that this ADR
does not answer and does not pre-empt.

[ADR-007](./ADR-007-product-taxonomy-v2.md) §10 anticipated that a Finder facet "may draw on …
Product Type" but was conceptual and disclaimed redesigning the Finder; ADR-008's Non-Goals excluded
any frontend change. **This ADR supplies the approval both withheld**, for the Finder facet only.

### 3. Product Type remains a separate classification axis

Product Type **does not replace or rename the six Product Families**, and it is not a hierarchy
above or below them. ADR-007 §7's reading is restated rather than changed: Product Family, Segment
and Product Type are **orthogonal axes over Product**.

- The six Product Families keep their names, their canonical identifiers ([ADR-009](./ADR-009-product-family-canonical-identifier.md)) and their pages, unchanged.
- A Product Type whose slug resembles a Family slug — `lubricant-additives` and `antifreeze-coolants`
  each exist in both vocabularies — is still a different entity on a different axis. That
  coincidence is not a merge, and neither vocabulary may be derived from the other.
- Nothing here changes the canonical `/{locale}/products/{slug}` namespace, its reserved values, or
  ADR-010 / ADR-011's enforcement. Product Type pages remain unauthorized.

---

## Non-Goals

Accepting this ADR authorizes **a vocabulary and one filter surface**. It authorizes nothing else,
and specifically **not**:

- any technical claim, specification, formulation or performance statement about any product
- any translation of a Product Type name or slug into `fa`, `ar` or any other locale — translated
  taxonomy vocabulary remains unapproved
- any new or changed per-product Product Type assignment; the existing assignments were made by the
  ratified import and are not re-opened, re-approved or extended here
- `Product ↔ ProductType` many-to-many, which ADR-007 defers
- the nine per-Segment Product Type lists, which ADR-007 and ADR-008 both leave open
- the sub-range ↔ `ProductType` mapping, whose three ADR-007 outcomes all remain available
- Product Type pages, sitemap entries, SEO records or indexability
- `GET /product-types` or any other endpoint
- any schema change, migration, seed, import, data write or UI behaviour change
- certification that the Finder implementation has passed technical or accessibility review

---

## Consequences

**The contradiction between "proposed" and "approved" is resolved in favour of approved**, as of
today and by this decision — not retroactively.

**`PROPOSED_PRODUCT_TYPE_KEYS` keeps its name.** Renaming an exported identifier is a code change
with no decision behind it, and the constant's name is now part of the historical record of how the
vocabulary arrived. Its comment states what it holds today and cites this ADR; the identifier itself
is left alone.

**Standing status statements are reconciled, dated ones are not.** `CLAUDE.md`, `AGENTS.md`,
`AI_CONTEXT.md` and `docs/ROADMAP.md`'s Current Status each carried a copy of "no ProductType row /
the vocabulary is unapproved" without a date. Those are corrected to cite this ADR. Every dated
verification block, and every ADR Context recording what was true on its own date, is left exactly
as written.

**There is now an explicit recorded decision where the evidence showed none.** A vocabulary is
published on implemented public-facing surfaces, and until today no reviewed record closed ADR-008's
deferral. Cite this ADR for that authority rather than an import approval, which recorded something
else.

**Adding a ninth Product Type is now a decision, not an edit.** The set is closed, so a new type
needs an owner approval of the same kind as this one.

---

## Alternatives Considered

**Treat the import approvals as having already approved the vocabulary.** Rejected, and it is the
alternative that matters. It would have needed no new decision — by asserting that PRODUCT-DATA-2C-A
or 2C-B2B decided something the reviewed evidence does not record either of them deciding. Asserting
an approval the record does not show is the same class of error as denying one it does not show, and
an explicit decision today costs less than either.

**Withdraw the eight from implemented public-facing surfaces pending approval.** Rejected. The
vocabulary is accurate, it is already published on the Product Detail route, and the owner's
decision today is to approve it — so removing it would trade a documentation gap for a regression.

**Approve the slugs and defer the display names.** Rejected. The names are what the public reads;
approving a filter axis whose labels are unapproved would move the same gap one level down.

**Approve the vocabulary and defer the Finder facet.** Rejected by the owner's decision, which
covers both. Recorded because they are genuinely separable: §1 could have stood without §2, and a
later surface will still need its own scope check against §2's boundary.
