# ADR-008: Segment Slugs, `Other` as Vocabulary, and the Product Taxonomy Filter Contract

## Status

Accepted, 12 August 2026

Closes seven of the questions [ADR-007](./ADR-007-product-taxonomy-v2.md) deliberately left open, and fixes the `GET /products` filter contract for the two new taxonomy axes. **ADR-007 itself is unchanged** — this ADR closes those threads through the decision chain rather than by amending an accepted record, exactly as [ADR-006](./ADR-006-payload-admin-authentication.md) closed [ADR-005](./ADR-005-vps-docker-deployment.md).

**This ADR authorizes no implementation.** See Non-Goals.

## Context

ADR-007 accepted the taxonomy model and left the vocabulary, the URL-facing names and the filter contract open. Two implementation increments have landed since, both behind their own approval gates:

- **Taxonomy v2 Phase 1 (schema).** `Segment`, `ProductType`, `ProductSegment` and `SegmentProductType` exist in `prisma/schema.prisma`, with a nullable `Product.productTypeId`, and the migration is committed. **No catalog reference data is approved for any of them** — the taxonomy has structure but no vocabulary.
- **API B1 (Product Detail).** `GET /products/:slug` serves `segments: { name, slug }[]` and `productType: { name, slug } | null`, localized through the existing `ContentTranslation` mechanism. `ContentEntityType` gained `Segment` and `ProductType` members for those call sites.

What is still missing is everything a filter needs: no approved slug for any Segment, no answer on whether `Other` is a row, no name for the Product Type query parameter, and no disposition for the three filters `API_CONTRACT_FINAL.md` §2.7's example URL has advertised since before the taxonomy existed (`industry`, `application`, `packaging`). ADR-007 Recorded Conflict 5 states the constraint on that last point directly: any facet added "must be reconciled with §2.7's example URL rather than silently renamed."

Three facts found in the repository shaped the decisions below, and are recorded because they are the argument:

1. **Six of the nine Segment names already have published identifiers.** `apps/web`'s Engine Oils fixture publishes `passenger-cars`, `trucks-buses`, `motorcycle-atv`, `agriculture`, `construction-mining` and `gardening` as sub-range ids, rendered into the DOM as `#range-{id}` anchor targets. They are fragments rather than routes, but they are a published vocabulary, and a second one would have to be kept in sync by hand.
2. **`Segment` has no visibility column, by decision.** It carries no `isActive`, no `isPublic` and no `description` — `DATA_MODEL.md` records that minimalism as deliberate. Any answer to `Other` that requires hiding a persisted row therefore requires a schema change and an ADR of its own.
3. **The existing `?category=` filter already answers every question a new filter raises.** Locale-aware slug resolution, the fallback order, the rejection of an unknown slug with 400 rather than an empty 200, and blank-as-omitted are all decided, implemented and covered by tests. A second filter that answered them differently would be two contracts for one concept.

## Decision

### 1. Segment slugs — eight approved

| Segment name            | Slug                  |
| ----------------------- | --------------------- |
| Passenger Cars          | `passenger-cars`      |
| Trucks and Buses        | `trucks-buses`        |
| Construction and Mining | `construction-mining` |
| Agriculture             | `agriculture`         |
| Gardening               | `gardening`           |
| Motorcycle & ATV        | `motorcycle-atv`      |
| Industry                | `industry`            |
| Marine                  | `marine`              |

Each of the six that already exists as a published sub-range id **takes that id unchanged**, including where the slug drops a conjunction the name carries (`trucks-buses` for "Trucks and Buses", `construction-mining` for "Construction and Mining"). A slug is not a name; adopting the published form is what keeps the DOM anchors and the API vocabulary from diverging.

None of the eight collides with a Product Family slug, with `/products/finder`, or with the three fixture `familyId` values. `Segment.slug` and `Category.slug` are unique on separate tables, so the two axes share no uniqueness surface at all.

### 2. `Other` is vocabulary, not a row

**Nine approved names, eight persisted Segments — `Other` is vocabulary, not a row.**

`Other` gets **no persisted Segment row in this phase, no slug, no Segment page and no SEO record.** A Product that belongs to no real Segment is represented by the **absence of `ProductSegment` membership**, not by membership of a catch-all. `Other` survives as vocabulary for admin and UI copy.

This is the second of the two readings ADR-007 offered ("an administrative/UI fallback bucket"), taken in its strongest form: not persisted at all. The decisive reason is fact 2 above — a persisted-but-hidden `Other` needs a visibility column `Segment` deliberately does not have, which would convert a vocabulary question into a schema change. Absence of membership expresses the same state with no column, no slug, no translation and no filter exception.

**Consequence to carry forward:** ADR-007's "up to nine Segments" sitemap-growth estimate becomes **eight**.

### 3. Product Type query parameter is `productType`

`GET /products` takes **`productType`**, not `type`.

`type` is already spoken for twice in this data model — `Media.type` distinguishes image/file/document, and `Inquiry.inquiryType` classifies submissions — so a bare `type` on a product endpoint is ambiguous on arrival and blocks every later type-shaped facet (packaging type, document type) from its natural name. The existing convention is also explicit once stated: `?category=` is named for the `Category` entity, so `ProductType` yields `productType`. The paired Segment parameter is **`segment`**, singular, for the same reason.

This is a public `/api/v1` contract. Renaming it later costs a version prefix under `API_DESIGN.md`'s versioning rule, which is why it is decided here rather than at implementation.

### 4. Filter contract semantics

**Combination is AND.** Every filter present narrows the result set: `category` + `segment`, `category` + `productType`, `segment` + `productType`, and all three together. `q` keeps its internal OR across name, slug and specification values and joins the rest as a single AND term. `locale` is orthogonal — it selects which slug vocabulary is accepted and which language is returned, never which rows match. Filtering is applied before pagination, so `meta.total` counts the filtered set. `sort` is unaffected.

**Multi-value filters (`?segment=a,b`) are unsupported and deferred.**

**Slug resolution mirrors `?category=` exactly**, because it is the same problem: the requested locale's translated slug first, the entity's own slug second, and a value matching neither is **400 `VALIDATION_ERROR`** with `details[].field` set to `segment` or `productType`. The rejected slug is never echoed into `message`. A blank or whitespace-only value is treated as omitted. A valid slug matching no products is **200 with an empty list**.

The 400-over-empty-200 rule is inherited deliberately: an empty list for a typo'd slug is indistinguishable from a genuinely empty Segment, which is the silent failure that survives to production.

**Localized Segment and Product Type slugs are supported from the first implementation**, through the existing `ContentTranslation` infrastructure. `content_translations` is unique on `(entityType, entityId, locale, field)` and every lookup filters on `entityType`, so a translated Segment slug can never resolve to a Product Type or a Category even if the strings are identical. **No change to `ContentTranslationService` or to the table is required.**

### 5. `industry` is retired — and it is not a rename

The `industry` filter is **retired** from the API contract, superseded by the `segment` axis.

**This is not a rename and authorizes no mapping.** §2.7's example value `industry=automotive` corresponds to **no approved Segment**: "automotive" sits closer to the Product Family "Engine Oils & Automotive Lubricants", or to the union of five vehicle Segments, than to any single row. No automatic mapping from any `industry` value to any Segment is authorized, now or later.

Separately, and unrelated: `apps/web`'s "Industries Served" is **market coverage** — which markets the business serves — omitted by every fixture and blocked on an open confirmation. It is not a product-classification axis and is untouched by this decision.

### 6. Rollout sequencing

The filter and the rows it filters on ship together conceptually, because a filter with an empty table can only return 400 and can never be exercised. **But they must not be one task**: `CLAUDE.md` §5 confines a task to a single area, and reference data is Database work while the filter is Backend work.

Two gates, in order:

1. **Database / reference-data gate** — the eight approved Segment rows.
2. **Backend filter gate** — `segment` and `productType` on `GET /products`.

Neither is authorized by this ADR.

### 7. Initial catalog reference-data mechanism

The approved initial mechanism is a **dedicated, idempotent, explicitly invoked catalog seed script**, upserting by `slug`.

Explicitly rejected as the initial mechanism:

- **`prisma/seed.ts`** — that file states its own scope: "Locale only. Product categories are NOT seeded here: they are Catalog content and belong with the Catalog module, not with database bootstrap." Adding Segments would contradict a decision written into the file.
- **Migration `INSERT`s** — no migration in this repository contains one. Data inside a migration welds reference rows to schema history, turns a rename into a new migration, and lets `prisma migrate` insert catalog content as a side effect.
- **Payload** — structured catalog entities are Prisma-owned and NestJS-served (ADR-007 §6). Payload owns editorial content only.
- **Admin/API writes** — the correct long-term home, but no catalog write endpoint exists, and adding one means new routes plus RBAC entries in `SECURITY.md`'s matrix. Deferred, not rejected on principle.

The script must not be wired into `prisma.config.ts`'s `migrations.seed`, so that no migration command can insert catalog data implicitly.

## Non-Goals

Accepting this ADR authorizes **a vocabulary and a contract**. It authorizes **no implementation of any kind**, per `CLAUDE.md` §4's rule that a documentation approval is never a code approval.

**ADR-008 does NOT authorize:**

- creating the catalog seed script
- inserting any `Segment`, `ProductType` or membership row
- adding `segment` or `productType` to `ProductListQuery`
- implementing either filter in `ProductsService`
- any Prisma schema change or migration
- `GET /segments` or `GET /product-types`
- Segment or Product Type pages, sitemap entries or SEO records
- any frontend or Payload change

**This documentation decision creates no Segment rows or seed data. Catalog reference-data population is deferred to a separately approved Database/reference-data gate.**

## Deferred — explicitly NOT closed by this ADR

Recorded so that no later task treats this ADR as having settled more than it did. Each remains open exactly as before:

- **the nine per-Segment Product Type lists**
- **the sub-range ↔ `ProductType` mapping** — all three ADR-007 outcomes remain available
- **Product Type names and slugs** — not one is approved, and none may be inferred from a family sub-range
- **`productCode`** — whether it exists, and whether it is unique
- **Grade / Variant modelling** — blocked on real catalog data
- **the Industry / Marine information-architecture naming collision** — approving the slugs `industry` and `marine` decides their spelling, not the IA question
- **Segment and Product Type page indexability** — the namespace ADR-007 §3 reserves is still not authorized for pages
- **the flat Product vs Product Family URL collision** — `/{locale}/products/{product-slug}` still shares a prefix with the six Family pages, `/products/finder` and the reserved `segments`/`types` paths, and no reserved-slug rule exists
- **the `familyId` / `Category.slug` mismatch** — still a prerequisite for frontend fetch integration, and still unresolved
- **`packaging` as an entity** — it stays a separate pending facet, not superseded by either axis
- **the `application` facet** — mapped to neither Segment nor Product Type, and blocked on the sub-range ↔ `ProductType` decision above

## Consequences

**Positive**

- **The filter contract is decided before it is built**, so the implementation task has no design latitude and no room to close a deferred decision by accident.
- **One slug vocabulary, not two.** Adopting the six published sub-range ids means the DOM anchors and the API agree without a synchronization step.
- **`Other` costs nothing.** No row, no slug, no translation set, no SEO record, no filter exception, and no visibility column added to a deliberately minimal entity.
- **No new infrastructure.** Localized taxonomy slugs reuse `ContentTranslation` unchanged; the filters reuse the `?category=` resolution rules unchanged.
- **`industry` stops being advertised.** A parameter that has been in the published example URL while returning 400 is removed rather than quietly redefined.

**Negative**

- **A nine-name vocabulary now yields eight rows**, and every document stating a count has to carry that distinction rather than a single number.
- **Two slugs diverge from their names** (`trucks-buses`, `construction-mining`). Defensible, but a reader generating slugs from names mechanically will produce the wrong string.
- **`industry` and `marine` are approved as slugs while the Industry/Marine IA collision is still open.** The spelling is fixed; whether the site should present two similarly-named entry points on two axes is not.
- **Between this ADR and the backend gate, `API_CONTRACT_FINAL.md` documents two parameters that do not exist.** Mitigated by the explicit "Approved — not implemented" marker, but the window is real.
- **Splitting rollout into two gates means the first gate ships rows nothing reads yet.** Accepted as the cost of the single-area task rule.

## Alternatives Considered

- **`Other` as a real, public, indexable Segment.** Rejected. It puts a non-descriptive `/segments/other` into a sitemap ADR-007 already flags as at risk of thin content, needs a translated name and slug for a word that means nothing to a buyer, and presents an unfinished catalog as navigation.
- **`Other` persisted but hidden from the public surface.** Rejected as not implementable as specified: `Segment` carries no visibility column, so this answer silently requires a schema change plus its own ADR. It also makes `?segment=other` an exception inside an otherwise uniform resolver.
- **`type` as the query parameter.** Rejected — ambiguous against `Media.type` and `Inquiry.inquiryType`, inconsistent with the entity-derived `?category=`, and it consumes the natural name for every later type-shaped facet. Cheap now, a `/api/v2` bump later.
- **Slugs generated mechanically from the approved names** (`trucks-and-buses`, `construction-and-mining`). Rejected. It is more predictable in isolation and produces two vocabularies for the same six concepts in practice — one in the DOM, one in the API — with nothing keeping them aligned.
- **Renaming `industry` to `segment` and carrying its values across.** Rejected, and the most dangerous option considered: `automotive` maps to no Segment, so the rename would bake a fabricated product-coverage claim into the public contract.
- **Mapping `application` onto `productType`.** Rejected. It is the obvious reading, which is exactly why it is dangerous: it would close ADR-007's open sub-range ↔ `ProductType` decision by implementation, which that ADR forbids in terms.
- **Implementing the filters before any Segment reference data is approved.** Rejected. Every non-blank request would 400 either way — before this work because the parameter is unknown, after it because the slug is — so the increment adds no capability while shipping a path no test can exercise against real data.
- **Seeding the Segment rows from `prisma/seed.ts`.** Rejected. That file's own comment excludes catalog content from database bootstrap, and widening it would contradict a written decision rather than extend one.
