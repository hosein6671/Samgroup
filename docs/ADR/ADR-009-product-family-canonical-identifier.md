# ADR-009: The Product Family Canonical Identifier

## Status

Accepted, 13 August 2026

Resolves [ADR-007](./ADR-007-product-taxonomy-v2.md) Recorded Conflict 1 — the `familyId` / `Category.slug` mismatch — and the same item as it is carried in [ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md)'s Deferred list. **Neither ADR is modified.** Both recorded the conflict accurately at the time they were written and both stated in terms that they did not fix it; this ADR closes it through the decision chain, exactly as ADR-006 closed ADR-005 and ADR-008 closed two of ADR-007's open items.

Unlike its two predecessors, this ADR records a decision that is **already implemented on the frontend side** — see Implementation Status. It authorizes no further implementation.

## Context

The six Product Families carried **three** identifier namespaces in `apps/web`, not two, and the drift was in exactly one of them.

- **`ProductFamily.id`** in `features/products/products-data.ts` — the fixture key, and the value every `familyId` in the category content fixtures pointed at.
- **The route slug** — the tail of `PRODUCT_CATEGORIES[].href` in `features/site/site-routes.ts`, which is also the key in the category content registry (`features/products/category/data/index.ts`) and the proof-route folder name.
- **`Category.slug`** in `sam_platform`, as specified by [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §0/§4.

**The route slug and the specified backend slug agreed for all six families.** Both are transcriptions of the same SITE_STRUCTURE rows, so there was no drift between frontend routing and backend vocabulary. The mismatch was **frontend-internal**: three `ProductFamily.id` values were hand-written short forms of their own routes.

| Family                              | `ProductFamily.id` (before) | Route slug = `Category.slug`        |
| ----------------------------------- | --------------------------- | ----------------------------------- |
| Base Oils                           | `base-oils`                 | `base-oils`                         |
| Lubricant Additives & Components    | `lubricant-additives`       | `lubricant-additives`               |
| Engine Oils & Automotive Lubricants | **`engine-oils`**           | `engine-oils-automotive-lubricants` |
| Industrial Oils & Lubricants        | **`industrial-oils`**       | `industrial-oils-lubricants`        |
| Marine Oils & Lubricants            | **`marine-oils`**           | `marine-oils-lubricants`            |
| Antifreeze & Coolants               | `antifreeze-coolants`       | `antifreeze-coolants`               |

Four facts found in the repository shaped the decision, and are recorded because they are the argument:

1. **`Category.slug` is already load-bearing in three systems.** It is the Prisma unique key `GET /categories/:slug` and `GET /products?category=` resolve against; it is Payload's `ProductCategoryContent.categoryKey` soft join key ([PAYLOAD_CONTENT_ARCHITECTURE.md](../content/PAYLOAD_CONTENT_ARCHITECTURE.md) §Collections); and it is the segment the public Product Family URL is composed from — `SitemapService` emits a slug and never a path precisely so that `apps/web` composes `/{locale}/products/{slug}` from the route table. A `Category.slug` that is not the route segment makes the sitemap publish URLs that 404.
2. **`ProductFamily.id` was load-bearing in nothing outside `apps/web`.** It resolved the family record for the shared category template, excluded the current family from its sibling list, addressed a cross-family Applications destination, and labelled validation errors. It appeared in no DOM id, no anchor, no query string and no persisted value, and `apps/web` contained no fetch call at all.
3. **Nothing compared the two.** `PRODUCT_CATEGORIES` was bound to `FAMILIES` **by array position**, through the existing `href(index)` guard — which validates order, never the identifier. That is how three ids drifted and three did not: the three that matched did so by coincidence of length, not by rule.
4. **The contract already claimed the equality.** `category-contract.ts` documented `familyId` as matching "`ProductFamily.id` … and `Category.slug` in the API". The claim was false for half the families and enforced by nothing — an assumption stated as a verified fact, which CLAUDE.md §6 forbids.

## Decision

### 1. One identifier per Product Family

**A Product Family has exactly one canonical identifier: its default-locale `Category.slug`.**

That single value is used, unchanged, as every one of the following:

- Prisma `Category.slug` in `sam_platform`
- Payload `ProductCategoryContent.categoryKey`
- the default-locale public Product Family route segment, `/{locale}/products/{slug}`
- frontend `ProductFamily.id`
- frontend `familyId` on every `ProductCategoryContent` and every cross-family `ApplicationEntry`
- the frontend category content registry key

The canonical set is fixed as:

| Family                              | Canonical identifier                |
| ----------------------------------- | ----------------------------------- |
| Base Oils                           | `base-oils`                         |
| Lubricant Additives & Components    | `lubricant-additives`               |
| Engine Oils & Automotive Lubricants | `engine-oils-automotive-lubricants` |
| Industrial Oils & Lubricants        | `industrial-oils-lubricants`        |
| Marine Oils & Lubricants            | `marine-oils-lubricants`            |
| Antifreeze & Coolants               | `antifreeze-coolants`               |

These are the values SITE_STRUCTURE already publishes as URLs. **No public URL, no route and no backend slug changes as a result of this ADR** — the frontend identifier moved to meet them.

### 2. `ProductFamily.id` and `familyId` are aliases, not parallel keys

They are not two values expected to agree; they are one value with more than one name in the type system. A future family is created with its `Category.slug` and nothing else.

### 3. Localized `Category.slug` values are never frontend fixture keys

`Category.slug` is a localized field — `CATEGORY_TRANSLATED_FIELDS` covers `name` and `slug`, and `findBySlug` resolves the requested locale's translated slug before the entity's own column. A category is therefore reachable in `fa` and `ar` at a different URL segment than in `en`.

That is **request and URL vocabulary only**. A localized slug:

- is accepted as input on `/categories/:slug` and `?category=`,
- resolves **server-side** to the same `Category` row,
- is **not** a key on the frontend side, and no fixture is registered under one,
- does **not** replace or shadow `ProductFamily.id`.

The qualifier "default-locale" is load-bearing in every statement of this contract. Dropping it turns a single identifier back into a per-locale set.

### 4. Drift is prevented structurally, not by convention

The invariant `family.href === ${ROUTES.products}/${family.id}` is checked at module load for every family, in the same throw-at-module-load style the file's existing `href(index)` guard and `application-fields.ts`'s range check already use. A family whose id diverges from its route fails the render rather than shipping a page that cannot fetch.

This is the part that makes the decision durable. Correcting three values fixes today; the guard is what makes the incidental alignment of the other three into an enforced one.

## Consequences

**Positive**

- **One identifier spans frontend, backend, CMS and the default-locale URL.** The concept "which Product Family is this" has a single spelling in every system that has to name it.
- **Fetch integration becomes a direct swap.** `getCategoryContent(slug)` and `GET /api/v1/categories/:slug` take the same value, and `?category=` can be built from `familyId` with no translation step. The registry module was always the intended swap point; it now swaps without an adapter.
- **No mapping layer, and none to maintain.** There is no table of exceptions, no lookup function, and no second identifier that a seventh family could be given inconsistently.
- **Recurrence is prevented by a check, not a comment.** Positional binding could not catch this class of drift; the id↔href guard can, and fails loudly.
- **The contract comment is now true.** It previously asserted an equality that held for three of six families.

**Negative / trade-off**

- **Three frontend ids are longer**, and read verbosely inside fixtures (`fields("engine-oils-automotive-lubricants", […])`). Accepted: the short forms were a local convenience with no external consumer, and length is the price of one identifier instead of two.
- **Shortening a public Product Family URL later is now a coordinated change.** It would move `Category.slug`, the route, the Payload `categoryKey`, the sitemap segment and the frontend id together. That is the honest cost of collapsing the identifiers — and it was already true of every value except the frontend one.
- **This ADR does not decide whether those URLs should be shorter.** `engine-oils-automotive-lubricants` is a three-noun slug, and there is a real SEO argument for a shorter one. That is a URL and SEO decision against a frozen SITE_STRUCTURE §0/§4, it requires its own ADR, and it is explicitly **not** settled here. Adopting one identifier does not foreclose it; it makes such a change a single coordinated rename rather than an ambiguous one.
- **`apps/cms` does not exist yet**, so the `categoryKey` half of this contract is recorded rather than exercised.

## Alternatives Considered

- **Keep the short frontend ids and add an explicit `categorySlug` field.** Rejected. The registry key is already the category slug, so this produces **three** identifiers for one entity, two of them always identical, and a hand-maintained mapping whose only content is three exception rows. It preserves the defect as permanent structure and pushes onto every future consumer the question of which key it needs.
- **A mapping layer between family ids and category slugs.** Rejected for the same reason, plus one worse property: a lookup function makes drift invisible instead of loud. The failure mode becomes a wrong fetch rather than a thrown error, and every call site has to remember to route through it.
- **Change the backend and public `Category.slug` values to the short forms.** Rejected as the answer to _this_ question. `Category.slug` is the sitemap URL segment, so it would change three public URLs, contradict SITE_STRUCTURE §0/§4/§14, move Payload's `categoryKey`, and settle a URL/SEO question as a side effect of fixing an internal identifier. The merit of shorter URLs is real and is recorded above as its own future decision — it is not this one.
- **Fix the three values and leave the binding positional.** Rejected. It restores agreement without establishing a rule, leaves the other three families aligned by coincidence, and guarantees the same conflict is rediscovered the next time a family is added or renamed.
- **Do nothing until the fetch integration is written.** Rejected. The mismatch is a prerequisite for that work, and discovering it inside an integration task would force an identifier decision under implementation pressure — which is the situation ADR-007 recorded the conflict specifically to avoid.

## Implementation Status

**Implemented and pushed — frontend only**, in commit `a190688f54f5a895782464f3bd78edc7667f93f0` on `feature/design-system`, under its own approval gate.

Seven files in `apps/web/src/features/products/` changed: the three `ProductFamily.id` values, the three fixtures' own `familyId`, five cross-family Applications references (each carrying the id twice — as `familyId` and as the `fields()` guard argument), the corrected `familyId` contract comment, and the new id↔href module-load guard.

Verified by `tsc --noEmit`, ESLint and Prettier on every touched file, plus a runtime probe that imported the real modules — confirming all six family lookups and all seven cross-family Applications references resolve — and a negative test confirming the guard throws when an id is drifted back to its short form.

**Deliberately unchanged by that commit:** every public route and URL, `PRODUCT_CATEGORIES`, the category registry keys, `apps/api`, `prisma/`, all migrations and seeds, and the API contract. No `Category` row exists in `sam_platform` and no Category seed exists — that remains a separate gate, and any such seed must use the six canonical values above.

## Relation to ADR-007 and ADR-008

- **[ADR-007](./ADR-007-product-taxonomy-v2.md) Recorded Conflict 1 is resolved prospectively.** ADR-007 remains historically correct and **unmodified**: it described the mismatch accurately and stated that it fixed none of its recorded conflicts. Read that entry as the record of the problem and this ADR as its resolution.
- **[ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md)'s Deferred entry** — "the `familyId` / `Category.slug` mismatch … still unresolved" — was accurate when written and is **superseded by this ADR**, which is likewise left unmodified.
- **Nothing else in either ADR is touched.** Product Family, Segment and Product Type remain three orthogonal axes; the canonical Product Detail route stays `/{locale}/products/{product-slug}`; the reserved `segments/` and `types/` namespaces are untouched; the B2 filter contract is unchanged. This ADR decides how a Product Family is _named_, and nothing about what it _is_.
- **Still open, and not touched here:** the flat Product vs Product Family URL collision and the absence of a reserved-slug rule (ADR-008 Deferred), the sub-range ↔ `ProductType` mapping, the Product Type vocabulary, and Segment/Product Type page indexability.
