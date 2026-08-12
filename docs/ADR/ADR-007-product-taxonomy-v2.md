# ADR-007: Product Taxonomy v2 and Product Detail Routes

## Status

Accepted, 12 August 2026

**This ADR reverses a previously confirmed decision.** [FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md) §1 and its decisions list item 2 record — as `[CONFIRMED by SITE_STRUCTURE.md]`, not as a draft — that product category pages are single-level and that **no `[productSlug]` detail route exists**. That decision is superseded here. It is not being corrected as an error: it was the right reading of the source material at the time, and the material has not changed. What changed is the product requirement.

The reversal is recorded through the decision chain rather than by editing the superseded prose in place, which is this project's established practice ([ADR-006](./ADR-006-payload-admin-authentication.md) closed [ADR-005](./ADR-005-vps-docker-deployment.md)'s open thread the same way).

## Context

### What exists today

The catalog is modelled once and represented four times, and the four are not identical.

**Prisma** ([`prisma/schema.prisma`](../../prisma/schema.prisma), translated from [DATA_MODEL.md](../DATA_MODEL.md) §1) holds `Category` — self-referencing through `parentId` — and `Product`, which carries **exactly one required `categoryId`**. There is no many-to-many relation anywhere in the catalog. A product lives at one node of one tree.

**NestJS** serves `GET /categories`, `GET /categories/:slug`, `GET /products`, `GET /products/:slug` and `GET /products/:slug/specifications` per [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.3. `?category=` matches a single slug exactly, with no subtree traversal, and the deferral is stated in the service itself. The `industry`, `application` and `packaging` filters that appear in §2.7's example URL are deliberately **not implemented**, because no column in `sam_platform` backs any of them.

**`apps/web`** publishes the Products landing and all six category pages against fixture modules shaped like the API responses. The shared category template maps sub-ranges to child `Category` rows and grades to `Product` rows, and expresses orthogonal taxonomies through a free-text `axis` label on a sub-range rather than through an entity.

**Payload** owns `ProductCategoryContent`, one entry per Prisma `Category`, joined by the soft key `categoryKey` ↔ `Category.slug` ([PAYLOAD_CONTENT_ARCHITECTURE.md](../content/PAYLOAD_CONTENT_ARCHITECTURE.md) §2). That collection is contracted as "6 today; grows only if a 7th category is ever added, **never per-SKU**."

The no-detail-route decision is not merely documented — it is **implemented**. `SitemapService` excludes products from `/seo/sitemap-entries` with the reason written into the file: a product entry "would name a URL that returns 404."

### Why the model has to change

A segment axis already exists in the frozen material, but only inside one family. [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §4's Engine Oils row reads "Segmented by vehicle type (Passenger Cars, Trucks & Buses, Motorcycle & ATV, Agriculture, Construction & Mining, Gardening) × fluid type", and those six are published today as sub-ranges of that one family — six of the nine segments this ADR approves, trapped one level down inside a single parent.

Three structural facts follow from the current schema, and together they are the reason for this ADR:

1. **A segment cannot be shared.** A sub-range is a child `Category` with one `parentId`. "Passenger Cars" cannot also be an entry point to another family without a duplicate row under a different slug.
2. **A product cannot be multi-homed.** `Product.categoryId` is required and singular, so one product belongs to exactly one node.
3. **A product has no page.** There is no route, no template, no sitemap entry and no canonical URL for an individual catalog item, by decision.

The business requirement that forces the reversal is scalability of the catalog itself: **a new product must become visible from structured data alone.** Adding one must not require a new route file, new CSS, a bespoke component, or an edit to the page template. That requirement is unsatisfiable while the only product surface is six hand-built category pages, each with its own fixture module.

## Decision

### 1. Product Detail pages exist, and are data-driven

**The no-product-detail-route decision is reversed.** `apps/web` gains a single, shared Product Detail template rendering one Product from structured data.

The template is subject to a hard constraint, and it is the reason this ADR exists rather than a page task:

- **One template, one route, one stylesheet, for every Product.** Adding a Product is adding data. It must never require a new route file, new CSS, a new bespoke component, or a change to the template.
- Any field a Product does not carry renders **absent**, never as an empty container, a placeholder value, or a plausible substitute. This project has an established rule against seeding unverified content into a page ([CLAUDE.md](../../CLAUDE.md) §4), and a shared template is where that rule is most easily violated by accident.

### 2. Canonical Product URL

```
/{locale}/products/{product-slug}
```

Conceptually: `/en/products/{product-slug}`, `/fa/products/{localized-product-slug}`, `/ar/products/{localized-product-slug}`.

**Flat, and independent of every taxonomy facet.** The reasons are recorded because they are the whole argument:

- A Product may belong to **multiple Segments**. A path-embedded scheme would mint one URL per membership combination for a single page — the duplicate-content problem this decision exists to avoid.
- **Taxonomy membership must never create a URL.** Moving a Product between Segments, or re-typing it, must leave its canonical URL untouched and generate no redirect.
- `Product.slug` is already globally unique in the schema, so a flat route needs no composite uniqueness rule and no new constraint.
- **Localized slugs remain supported and unchanged.** Only the final slug segment localizes; `products/` stays a fixed English structural segment in every locale, per [FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md) §2 and [INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md) §1.
- **Locale switching resolves by entity identity, not by string replacement** — the rule [INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md) §2 already sets. A flat product URL is the simplest shape for that resolution to satisfy, because the locale switch changes exactly one segment.

**Explicitly not approved as a canonical product URL:**

```
/{locale}/products/{segment}/{product-type}/{product}      ← rejected as canonical
```

Segment and Product Type are **navigation and facet relationships**, not URL ancestry.

### 3. Segment and Product Type URLs

Namespace separation is approved so that a Segment slug can never collide with a Family slug by accident:

```
/{locale}/products/segments/{segment-slug}
/{locale}/products/types/{product-type-slug}      ← only if later approved
```

**This reserves a namespace. It does not authorize pages.** Neither Segment pages nor Product Type pages are implemented by this ADR — see Non-Goals.

**Product Type landing pages are not required by this ADR.** Whether they exist at all, and whether they are indexable, is a later decision (see Deferred Decisions).

### 4. The taxonomy

Three axes over one central catalog entity:

```
Product Family
  ├── Segment
  ├── Product Type
  └──▶ Product
```

**Read this as axes, not as a hierarchy.** Product Family, Segment and Product Type are **orthogonal classification axes over Product**. Segment and Product Type are **not** children of Product Family — a Segment spans several Families, and a Product Type is shared across Segments. See §7 for the relationship model and the cardinalities.

**Product Family**

- **Remains.** The existing six families are not replaced by the nine Segments and are not deprecated by this ADR.
- **Single-valued for a Product**, and required. Family is the production and portfolio axis.
- The approved set is unchanged: Base Oils · Lubricant Additives & Components · Engine Oils & Automotive Lubricants · Industrial Oils & Lubricants · Marine Oils & Lubricants · Antifreeze & Coolants.

**Segment** — a first-class entity, and a separate application/use axis.

- **Many-to-many with Product.** One Product may appear in several Segments.
- The approved set: Passenger Cars · Trucks and Buses · Construction and Mining · Agriculture · Gardening · Motorcycle & ATV · Industry · Marine · Other.

**Product Type** — a first-class, reusable entity.

- **Never duplicated per Segment.** One "Engine Oils" Product Type row is visible from every Segment that uses it. Duplication would produce N copies with N slugs, N SEO records and N translation sets, and would make "which Segments use this Product Type" unanswerable.
- **A Product has one primary Product Type.** The relationship is:

  ```
  ProductType  1 ── N  Product
  ```

  One Product Type classifies many Products; each Product carries **exactly one** primary Product Type in v2. This is deliberately the simpler direction.

- **`Product ↔ Product Type` many-to-many is explicitly deferred**, not adopted — see Deferred Decisions. It may be added later if real catalog data proves dual-type Products exist.

**Segment ↔ Product Type**

- **Many-to-many**, and **ordered** where navigation or display requires a defined sequence. A Segment publishes its own ordered subset of the shared type set.

**The per-Segment Product Type lists are not approved and are not defined here.** No document in this repository enumerates the Product Types belonging to any Segment; the closest available lists are per-_Product Family_ sub-ranges, and treating those as Segment membership would be an inference about product coverage that no source makes. Every one of the nine lists is pending.

### 5. Product, and what a Product is not

For the first implementation, **`Product` is the data-sheet-bearing catalog item** — the entity a slug, a TDS, an SDS and a specification set belong to.

**Terminology.** This ADR uses **Grade / Variant** throughout for the deferred catalog-level modelling question. **SKU** is the commercial and inventory synonym for the same idea; it is named here once and not used as a modelling term thereafter, so that a single deferred decision is never referred to by two different names.

- **No separate Grade / Variant entity is introduced by this ADR.**
- Grade / Variant modelling is an **explicit deferred decision**, not an omission.
- The repository currently contains two conflicting readings. `prisma/schema.prisma` notes that a Product may repeat a `Specification` key, "e.g. one row per grade", which implies a Product _contains_ grades; the frontend category contract maps a `Grade` entry onto a Prisma `Product` row, which implies a Product _is_ one. This ADR resolves neither permanently; it fixes only what the first implementation treats as a Product.
- **Real catalog data must settle it.** Whether `Product` _is_ the Grade / Variant or _contains_ several is answerable from a real product list and from nothing else. No speculative Grade / Variant schema is introduced ([AI_CONTEXT.md](../../AI_CONTEXT.md), absolute constraints: no speculative infrastructure).

**`productCode`** is recorded as structurally useful — a stable, human-facing identifier a buyer can quote — but **its existence and its uniqueness are not frozen here**, pending confirmation from real catalog data.

### 6. Ownership boundaries — unchanged

This ADR moves no ownership across any existing boundary.

- **Structured catalog entities are Prisma-owned and NestJS-served**: Product Family (today's `Category`), Segment, Product Type, Product, Specification.
- **Payload remains responsible for editorial content only**, where already approved.
- **NestJS remains the sole API gateway.** `apps/web` never calls Payload and never calls a database — the Product Detail page included ([ADR-003](./ADR-003-api-gateway.md)).
- **No cross-database foreign keys.** Any bridge between `sam_platform` and `sam_cms` is a soft key resolved by NestJS, as `ProductCategoryContent.categoryKey` already is ([ADR-002](./ADR-002-two-databases.md)).

### 7. Migration principle — additive

The intended database evolution is **additive**. This is a decision, not a description of convenience.

- **The existing Product/Family relationship is not removed.** `Product.categoryId` remains the single Product Family owner in the initial v2 migration.
- No column is dropped and no existing relation is rewritten.

Conceptual shape of the likely additions — a reference model, not implementation code:

```
ProductFamily (= today's Category)
   1 ──── N   Product

Product
   N ──── M   Segment            via ProductSegment join
   N ──── 1   ProductType        primary type, single-valued (this ADR)
   1 ──── N   Specification
   1 ──── N   Media (polymorphic ownerType/ownerId)

Segment
   M ──── M   ProductType        via SegmentProductType join, ordered

Polymorphic, attaching by (entityType, entityId), as they already do:
   SeoMeta · ContentTranslation · Media
```

Likely new entities and relationships, conceptually: `Segment`, `ProductType`, a `ProductSegment` join, a `SegmentProductType` ordered join, and a primary-type relationship on `Product`. **No Prisma schema, no migration and no field-level design is authorized by this ADR** — those are a separate task with a separate approval gate ([CLAUDE.md](../../CLAUDE.md) §4).

### 8. UI scalability is an architectural requirement

Recorded here because it is the requirement the reversal exists to serve, and because it constrains every later UI task.

**The frontend must not depend on fixed counts.** It must render correctly and without code changes for a Segment carrying 1, 5 or 20+ Product Types, and for a Product Type carrying 1, 10 or 50+ Products.

The eventual UI must handle, as ordinary cases rather than exceptions:

- variable counts at every level of the taxonomy
- long names, in three locales and two writing directions
- missing media
- optional fields that are absent for some Products and present for others
- missing documents
- genuine empty states — a Segment or Product Type with no Products yet
- pagination or progressive loading wherever a list can grow unbounded

**Adding Product data must never require a UI code change.** No component may hardcode a count, and no layout may depend on one.

**No UI is implemented by this ADR.**

### 9. The six Product Family pages remain

The six existing Product Family pages are **valid, unaffected, and not removed by this ADR**. Segment navigation is an **additional discovery axis** placed alongside them, not a replacement for them.

**Product Family pages are not redesigned as part of this ADR.**

### 10. Product Finder — conceptual only

Future Product Finder facets may draw on: Product Family · Segment · Product Type · supported technical attributes.

- **No technical facet name or value is approved here** unless already backed by real, approved data. The property tables published today are marked `[ESTIMATE — CONFIRM]` at source and ship deliberately unpopulated.
- **Packaging remains a separate, pending question** — no entity backs it.
- The Finder is **not redesigned** by this ADR.

## Non-Goals

Accepting this ADR authorizes a **model and a set of URL decisions**. It authorizes **no implementation work of any kind**. Every item below remains a separate task requiring its own approval, per [CLAUDE.md](../../CLAUDE.md) §4's rule that a documentation approval is never a code approval.

**ADR-007 does NOT authorize:**

- defining per-Segment Product Type lists
- adding real Products
- defining technical values
- defining certifications
- deciding Grade / Variant schema
- redesigning the Product Finder
- redesigning the mega menu
- implementing Segment pages
- implementing Product Type pages
- implementing Product Detail UI
- modifying the database schema
- modifying API contracts
- modifying Payload schemas

**The Segment URL namespace is reserved by this ADR, but Segment pages are not authorized for implementation by this ADR.** §3 fixes where such pages would live so that a Segment slug can never collide with a Product Family slug; it does not approve building them, and it does not decide whether they are indexable.

The same distinction applies throughout: §2 fixes the canonical Product URL without authorizing the Product Detail template; §7 states a migration _principle_ without authorizing a migration; §8 states a UI _requirement_ without authorizing UI; §10 names candidate Finder facets without approving one.

## Recorded Conflicts

Recorded so they are not rediscovered, and so no later task treats one as a bug introduced by this work. **This ADR fixes none of them.**

1. **`familyId` / `Category.slug` mismatch.** Three of the six frontend fixtures use family ids (`engine-oils`, `industrial-oils`, `marine-oils`) that differ from their published route slugs (`engine-oils-automotive-lubricants`, `industrial-oils-lubricants`, `marine-oils-lubricants`), while the category contract states that `familyId` matches `Category.slug`. Both `?category=` filtering and Payload's `categoryKey` join key on `Category.slug`. Predates this ADR; must be resolved before fixtures become fetches.
2. **Hardcoded mega-menu slicing.** The header splits the category list into two fixed groups of three. Nine Segments plus six Families cannot be expressed by that structure, and [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §13 specifies the three-column menu, so changing it is a change to a frozen spec.
3. **Products are excluded from the sitemap by design.** `SitemapService` emits root categories only, with the exclusion of products written into the file as deliberate. That exclusion becomes wrong the moment product detail routes ship, and correcting it is part of the implementation task, not a defect.
4. **SEO documentation conflict.** [SEO_ARCHITECTURE.md](../seo/SEO_ARCHITECTURE.md) §8 assigns `Product` schema.org markup to "Product detail pages"; [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §14 assigns `Product` + `FAQPage` to the six category pages; FRONTEND_ARCHITECTURE said detail pages do not exist. The three could not all hold. This ADR removes the third contradiction; the remaining overlap between §8 and §14 still needs an SEO-focused reconciliation pass.
5. **The API has no Segment or Product Type filter.** `GET /products` accepts `category`, `q`, `page`, `limit`, `sort` and nothing else, and rejects `industry`/`application`/`packaging` with a 400 because no column backs them. Any facet added must be reconciled with [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.7's example URL rather than silently renamed.
6. **Stale status documentation.** [AI_CONTEXT.md](../../AI_CONTEXT.md) still describes `apps/web` as a `.gitkeep`-only skeleton. It is not — the design proof, the Products landing and all six category pages are built. `apps/cms` genuinely is empty. Status text needs a correction pass; nothing architectural turns on it.
7. **Unsupported certification and footer claims are unrelated to this ADR** and remain outside its scope.

## Deferred Decisions

Each is deliberately left open. None may be closed by implementation choice — closing one is a decision in its own right.

- **Grade / Variant modelling.** Whether a `Product` _is_ the Grade / Variant or _contains_ several. **Blocked on real product data**, which the repository does not contain: no product designations exist anywhere except SN 150/350/500/650 and BS 150 under Base Oils.
- **`Product ↔ Product Type` many-to-many.** May be added later **if real catalog data proves dual-type Products exist.** Until then, one primary Product Type per Product (`ProductType 1 ── N Product`). This keeps the first migration simpler and avoids speculative infrastructure.
- **The relationship between the existing family `subRanges` and the new `ProductType` entity.** Unresolved, and deliberately so. The six Product Family pages publish their taxonomies today as `subRanges` in the frontend category contract; whether those become Product Type rows is not decided here. Three outcomes are open:
  - a sub-range maps onto a Product Type;
  - a sub-range remains family-local presentation structure, with Product Type a separate concept;
  - some sub-ranges map and others do not.

  **The six existing Product Family pages remain valid under any of the three** (§9). This must not be settled by whoever writes the migration.

- **`productCode`** — whether it exists as a column, and whether it is unique.
- **The `Other` Segment.** It stays in the approved set because the product owner supplied it. Whether it is a **real published and indexable Segment** or an **administrative/UI fallback bucket** for unassigned products is a follow-up decision. The two answers differ in whether it gets a row, a page, a slug and an SEO record.
- **The Industry / Marine naming collision.** The data model permits both readings because Family and Segment are orthogonal — a marine cylinder oil is Family `Marine Oils & Lubricants` **and** Segment `Marine`, correctly and simultaneously. But the site would then carry two similarly-named entry points on two axes (`Industrial Oils & Lubricants` / `Industry`, `Marine Oils & Lubricants` / `Marine`). That is an information-architecture and presentation problem, not a modelling one. **Nothing is renamed by this ADR.**
- **Per-Segment Product Type lists** — all nine.
- **Product Type landing pages** — whether they exist, and whether they are indexable.
- **Editorial layer for product pages** — whether a product detail page carries Payload editorial copy alongside its Prisma data, or is served purely from Prisma. `ProductCategoryContent`'s "never per-SKU" contract is the constraint any answer has to address.
- **Indexability of thin Segment pages at launch**, given that every per-Segment type list is pending.

## Consequences

**Positive**

- **A product becomes addable from data.** The requirement that motivated the reversal is met structurally: one template, one route, one stylesheet, and a new product is a row.
- **Taxonomy edits cost nothing in URLs.** Because canonical product URLs carry no facet, re-segmenting or re-typing a product changes no URL, generates no redirect, and loses no accumulated search equity.
- **No duplicate-content surface is created**, which the path-embedded alternative would have created by construction.
- **The migration is additive.** `Product.categoryId` is untouched, no column is dropped, and the existing catalog endpoints keep working unchanged during the transition.
- **The six family pages, their shared template and their ten section components survive intact.** This ADR adds an axis; it removes nothing that is built.
- **Product Types stop being prose.** Today they are strings inside per-family fixtures; as a shared entity they become filterable, translatable, addressable and countable.
- **Every frozen boundary holds.** ADR-001 through ADR-006 are untouched: same monorepo, same two databases, same single gateway, same Payload ownership split, same deployment topology, same admin authentication.

**Negative**

- **A confirmed decision is reversed, and three documents plus one shipped service encode it.** [FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md) §1/§2, [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §4 and its Data Model Gaps item 7, [AI_CONTEXT.md](../../AI_CONTEXT.md)'s open threads, and `SitemapService`'s exclusion logic all state the old position. Each needs its own update pass with its own approval, and until those land the repository asserts both positions.
- **The header's information architecture must change**, and it is specified in a frozen document (Recorded Conflict 2).
- **The sitemap grows substantially and can grow thin.** Products, **up to nine** Segments — the count depends on the unresolved `Other` decision — and an unknown number of Product Types all become candidates for indexing while per-Segment content is pending. Thin-content exposure is real and is a launch-quality question, not a technical one.
- **Two similarly-named navigation entry points exist by construction** until the Industry/Marine IA decision is taken.
- **A single primary Product Type may need widening to many-to-many later.** Accepted deliberately: an additive join table added when real data justifies it costs less than many-to-many infrastructure built now for a case nobody has demonstrated.
- **The number of first-class catalog entities roughly doubles.** Segment and Product Type each need translation, SEO, sitemap and admin treatment, and each is another surface where the "no invented content" rule has to be enforced.
- **The Payload editorial boundary needs re-examination.** `ProductCategoryContent`'s per-family model does not extend to Segments or to products without a decision.

## Alternatives Considered

- **Keep the no-detail-route decision; grow the six category pages instead.** Rejected. It is the status quo, and it fails the requirement outright: a new product would remain a fixture edit inside a hand-built page, which is precisely a code change per product. It also gives an individual product no canonical URL, no `Product` structured data of its own, and no way to be linked to from a blog article or an enquiry.
- **Path-embedded canonical URLs, `/{locale}/products/{segment}/{product-type}/{product}`.** Rejected as canonical. It reads well and expresses the hierarchy in the address bar, but a product in three Segments produces one page at several addresses, each needing a canonical tag; and every taxonomy edit becomes a redirect-generating event. The scheme optimizes for a URL's legibility at the cost of the catalog's mutability, which is the wrong trade for a catalog expected to grow. It remains available as a **non-canonical navigational path** if a later IA decision wants it.
- **Model Segment and Product Type as more `Category` rows, using the existing self-referencing tree.** Rejected. It requires no new tables, which is genuinely attractive, but three consequences follow from code that exists today: `findSitemapCandidates()` emits every root category as an indexable URL, so Segments would enter the sitemap silently; `GET /categories` returns roots and feeds the mega menu, which would then receive fifteen "families"; and every `Category` row shares one translation and SEO namespace, so a Segment and a Family could collide on a translated slug. Separate entities make each of those a decision instead of an accident. The cost is honestly larger: new entity types, new translation and SEO wiring, new sitemap sources.
- **Replace the six Families with the nine Segments.** Rejected, and explicitly so. The two are orthogonal axes, not competing versions of one axis — Family is what the business produces, Segment is what a buyer runs. Six of the nine Segments already exist inside a single Family, which demonstrates the axes are independent rather than alternative. Replacement would also discard six built pages and the frozen structure behind them.
- **Duplicate Product Type per Segment.** Rejected. It removes one join table and adds a maintenance problem that compounds: N copies of the same type, each with its own slug, SEO record and translations, no way to answer "which Segments use this type", and no way to rename a type once.
- **Introduce Grade / Variant now, alongside the taxonomy.** Rejected. The repository contains two contradictory readings and no real product data to arbitrate between them. Choosing one now is a guess that becomes a migration.

## Future Options

Deferred, not closed. Each requires its own ADR or its own approved decision; none may be adopted by implementation drift.

- **`Product ↔ Product Type` many-to-many**, if real catalog data shows genuine dual-type Products.
- **A Grade / Variant entity**, once real product data settles whether a Product contains several.
- **Product Type landing pages**, with their own indexability decision.
- **Subtree filtering on the catalog endpoints** — a recursive CTE or a materialized path — which the current exact-match `?category=` filter defers by name.
- **Packaging as a first-class facet**, once an entity backs it.
