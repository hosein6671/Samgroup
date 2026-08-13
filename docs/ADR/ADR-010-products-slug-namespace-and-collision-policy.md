# ADR-010: The Shared `products/` Slug Namespace and Collision Policy

## Status

Accepted, 13 August 2026

Closes the **flat Product vs Product Family URL collision** recorded as unresolved by [ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md) ("Deferred — explicitly NOT closed by this ADR": _"`/{locale}/products/{product-slug}` still shares a prefix with the six Family pages, `/products/finder` and the reserved `segments`/`types` paths, and no reserved-slug rule exists"_) and carried forward unchanged by [ADR-009](./ADR-009-product-family-canonical-identifier.md) ("Still open, and not touched here").

**ADR-007, ADR-008 and ADR-009 are not modified.** All three recorded the collision accurately and all three stated in terms that they did not resolve it; this ADR closes it through the decision chain, exactly as ADR-006 closed an item ADR-005 left open, ADR-008 closed two of ADR-007's, and ADR-009 closed ADR-007's Recorded Conflict 1.

This ADR authorizes **no implementation of any kind** — see Non-Goals.

## Context

Two frozen decisions target the same path shape, and neither is wrong.

- [ADR-007](./ADR-007-product-taxonomy-v2.md) §2 fixes the canonical **Product Detail** URL as `/{locale}/products/{product-slug}` — flat, with Segment and Product Type as navigation and facet relationships rather than URL ancestry. The argument is recorded at length: a Product may belong to several Segments, so a path-embedded scheme would mint one URL per membership combination for a single page; and taxonomy membership must never create a URL or generate a redirect.
- [ADR-009](./ADR-009-product-family-canonical-identifier.md) §1 fixes the **Product Family** identifier as the default-locale `Category.slug` and uses that one value unchanged as the Prisma key, Payload's `categoryKey`, the frontend `ProductFamily.id` / `familyId` / registry key, **and the default-locale route segment `/{locale}/products/{slug}`**.

Both are sound in isolation. Together they place two different entity types in one URL namespace, with nothing deciding which one owns a given slug and nothing preventing the ambiguity from being created.

### The four structural facts

Recorded because they are the argument, and because three of the four are properties of code that exists today rather than of a plan.

1. **Slug uniqueness is per table, and there is no constraint between them.** `prisma/schema.prisma` declares `Category.slug String @unique` on `categories` and `Product.slug String @unique` on `products`. Those are two independent uniqueness surfaces. A `Product` carrying `slug = "base-oils"` is, as the schema stands, valid data.
2. **Translated slugs have no uniqueness on their value at all.** `CONTENT_TRANSLATION` is unique on `(entityType, entityId, locale, field)` — one translation per field per entity per locale. Nothing prevents two Categories, or a Category and a Product, from holding the **same** `fa` slug value.
3. **A duplicate translated slug resolves arbitrarily.** `ContentTranslationService.findEntityIdBySlug` reads with `findFirst`. With two rows carrying one value, which entity answers a URL is not defined by the data — it is decided by whatever the database returns first.
4. **The frontend cannot express the two entities as two routes.** Next.js App Router rejects two differently-named dynamic segments at one path position, so `products/[categorySlug]` and `products/[productSlug]` cannot coexist as siblings. Serving both entity types flat is therefore **one route with one discriminator**, as a framework constraint rather than a stylistic preference.

Alongside those, the namespace already carries structural paths that are neither a Family nor a Product: `/products/finder` is published in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §0, and ADR-007 §3 reserves `/{locale}/products/segments/{slug}` and `/{locale}/products/types/{product-type-slug}`. A static route segment outranks a sibling dynamic one, so those paths are safe **as routes** — but nothing stops a `Category` or `Product` being given the slug `finder`, which would make that row permanently unreachable with no error raised anywhere.

### Current local development state — 13 August 2026, local DEV `sam_platform` only

Scoped deliberately, and true of one database at one moment rather than of the platform:

- `products` holds **no rows**.
- `content_translations` holds **no `slug` row for any `Category` or `Product`**.
- `categories` holds the six approved Product Family roots, seeded by `prisma/seed-categories.ts`, carrying default-locale values only.

**No collision can exist today**, and this is the whole reason the enforcement mechanism can be timed rather than chosen under pressure (§6). It is a statement about a development database on a date. It is **not** a durable property of the system, it must not be relied on by any later document or task, and it stops being true the first time a Product or a translated slug is written.

## Decision

### 1. One canonical shared namespace

Both frozen URL shapes stand, unchanged:

```
/{locale}/products/{category-slug}     ← Product Family     (ADR-009 §1)
/{locale}/products/{product-slug}      ← Product Detail     (ADR-007 §2)
```

They intentionally occupy **one namespace**:

```
/{locale}/products/{slug}
```

**Explicitly not introduced:**

```
/{locale}/products/categories/{slug}      ← rejected
/{locale}/products/p/{slug}               ← rejected
```

No public URL moves. No `Category.slug` or `Product.slug` value changes. ADR-007 §2 and ADR-009 §1 remain valid as written, and this ADR adds the rule that makes them able to coexist rather than amending either.

### 2. One frontend dynamic route, one discriminator

The eventual frontend route is a single shared dynamic segment:

```
app/[locale]/products/[slug]/page.tsx
```

Sibling `[categorySlug]` and `[productSlug]` routes are **not authorized** and are not expressible (Context, fact 4).

**One shared discriminator is required.** Something has to decide, per request, whether a slug names a Product Family or a Product; that decision is a single, named resolution step, not logic duplicated between the route, the sitemap composition and any link builder. Where it lives and how it is written is an implementation question this ADR does not answer — but the requirement that there be exactly one is architectural, because three copies of a precedence rule is three chances to disagree about which page a URL serves.

**This ADR does not authorize building the route.**

### 3. Product Family precedence — and the stronger rule behind it

**Product Family wins in the shared namespace.** If a slug resolves to a Product Family, `/{locale}/products/{slug}` serves the Family page.

That is the **runtime safety rule**, and it is deliberately the weaker half of this decision. It exists so that an ambiguity which somehow reaches production resolves toward the six pages the site's information architecture is built on, rather than toward whichever row happened to be found first.

The stronger rule is:

> **Colliding data is invalid.**

A Product may not use a Product Family slug. This is not a preference expressed at render time and it is not a tie-break — it is a statement that such a row is **wrong data**, to be rejected where it is written rather than tolerated and worked around where it is read. Precedence is what the reader does if invalid data exists anyway; §6 is what is supposed to make that case unreachable.

### 4. Reserved structural slugs

The following values are **reserved in the products namespace**:

```
finder
segments
types
```

They may not be used by any of:

- base `Category.slug`
- base `Product.slug`
- translated `Category` slug values
- translated `Product` slug values

`finder` is reserved because [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §0 already publishes `/products/finder`. `segments` and `types` are reserved because ADR-007 §3 reserved those namespaces, and a row carrying one of those slugs would be permanently unreachable behind the static path.

Reserving a value does not create a page. ADR-007 §3's namespaces remain reserved-without-pages, exactly as it left them.

### 5. The namespace is symmetric

State the rule in both directions. It is **not** a restriction on Product writes.

The products slug namespace is the **union** of:

- base `Category` slugs
- base `Product` slugs
- translated `Category` slug values
- translated `Product` slug values

**Any new slug value introduced by either entity, in any locale, must not already exist anywhere else in this union where it would create ambiguity.** Adding a `Category` that collides with an existing `Product` is exactly as invalid as adding a `Product` that collides with an existing `Category`, and adding a `fa` slug translation that collides with another entity's `fa` slug is invalid on the same rule.

**Ambiguous translated slug resolution is invalid data.** Two rows in one locale answering to one slug value is not a case for a tie-break, a preference order or a `findFirst`; it is a state the data must not be allowed to reach.

Two consequences worth stating plainly, because they are where this rule is most likely to be misread:

- The rule spans **entities**, so it is not satisfied by either table's own `@unique`.
- The rule spans **locales**, so it is not satisfied by checking only the base columns.

### 6. Durable enforcement is required before writes

**This ADR does not select the enforcement mechanism.** Choosing one is its own decision, with its own approval.

Durable enforcement of §3, §4 and §5 **must exist before any of the following**:

- the first real Product write path is enabled
- Product reference data is populated
- the first `Category` translated-slug row is created
- the first `Product` translated-slug row is created
- admin or CMS tooling becomes capable of writing any of these slugs

Whichever of those happens first is the deadline. They are listed separately rather than as "before Products exist" because three of the five can arrive without a single Product row.

Candidate mechanisms, recorded without selection:

| Candidate                            | Enforces the invariant in the database? | Note                                                                                                                                      |
| ------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A shared slug registry table         | Yes                                     | One row per claimed slug per locale, with a unique key; both entities claim through it. Costs a table, a write path and a migration.      |
| A PostgreSQL constraint trigger      | Yes                                     | No new table; the check spans `categories`, `products` and `content_translations`. Costs a hand-written trigger and its own test surface. |
| Application / admin-layer validation | **No**                                  | Cheapest, and the only one that a seed script or an import can bypass entirely.                                                           |

**Application validation alone is not equivalent to a database-enforced invariant.** It holds only for writes that pass through the validating code path, and this repository already contains writes that do not — the seed scripts talk to Prisma directly, and a future import or an admin fix applied in `psql` would too. Application validation may be adopted **in addition to** a database-enforced invariant, as a source of a better error message; it may not be adopted **instead of** one and then described as enforcement.

Deferral is available now only because of the scoped state recorded in Context. It expires on the first item in the list above, not on a date.

### 7. Canonical failure semantics

Freeze this invariant:

> **Infrastructure failure must never be converted into a canonical-content 404.**

A 404 is a statement about content — that this URL names nothing. An unreachable API, a timeout, a connection refused or a 5xx is a statement about the platform. Serving the first when the second is true tells a crawler a live page has been removed, and it does so at exactly the moment nobody is watching.

**Product Family branch**, while the six-family fixture registry remains authoritative for a family's existence:

| Condition                                        | Behaviour                                                    |
| ------------------------------------------------ | ------------------------------------------------------------ |
| Category API unavailable, timed out, or errored  | Fixture fallback allowed                                     |
| Category API returns 404 for a registered Family | Fixture fallback **plus a loud drift warning** — never a 404 |

The second row is the one that needs saying: a registered Family whose `Category` row has gone missing is a data fault worth shouting about, and it is still not a reason to take down a page whose approved content is sitting in a fixture. This preserves the fail-open behaviour already approved for the design-proof routes, and scopes it explicitly to the period in which the fixture registry is authoritative.

**Product Detail branch**, when it is eventually built:

| Condition                                                  | Behaviour                           |
| ---------------------------------------------------------- | ----------------------------------- |
| Product API returns 404                                    | Canonical 404                       |
| API unavailable, infrastructure failure, or server failure | Server failure path — **never 404** |

The asymmetry is deliberate and is a property of what each branch can know. A Family's existence is knowable without the network, so a failed fetch costs the page nothing. A Product's existence is knowable **only** from the API, so a failed fetch means the answer is unknown — and "unknown" is a server failure, not "absent".

**Product Detail remains not implemented.** This decision fixes the semantics its implementation must satisfy; it does not authorize the implementation.

### 8. The initial `fa` / `ar` position

**No `fa` or `ar` `Category` slug vocabulary is approved today.** Initial localized Product Family URLs may therefore be served at the **default-locale English slug**:

```
/fa/products/base-oils
/ar/products/base-oils
```

**These are not localized slugs, and must not be described as such** in any document, comment, commit message or report. They are the default-locale slug appearing under a non-default locale prefix, which is precisely the fallback `GET /categories/:slug` already implements: the requested locale's translated slug is tried first, and the entity's own column answers when no translation exists.

Localized slugs remain **future request and URL vocabulary, resolved server-side** — ADR-009 §3 unchanged, including its qualifier that "the qualifier _default-locale_ is load-bearing in every statement of this contract". Frontend fixture keys remain the default-locale `Category.slug`, and a localized slug never becomes one.

This is a stated launch position, not a finished localization. It is recorded here so that the absence of translated slugs at launch reads as a decision rather than as an oversight discovered afterwards.

### 9. Proof-route transition principle

The design-proof Product Family routes transition in this order, and no other:

1. the canonical route is implemented
2. the canonical route is validated
3. proof routes redirect to their canonical default-locale routes
4. the proof route implementation is removed in a later gate

**Duplicate proof pages do not stay live long-term.** Two URLs rendering the same page, one of them held out of the index by a directive somebody has to remember to keep, is a configuration that survives by attention rather than by structure. The redirect in step 3 is what makes step 4 a deletion instead of a decision.

This ADR fixes the order. It does not authorize any of the four steps.

## Non-Goals

Accepting this ADR authorizes **no implementation work of any kind**. Every item below remains a separate task with its own approval, per [CLAUDE.md](../../CLAUDE.md) §4's rule that a documentation approval is never a code approval.

**ADR-010 does NOT authorize:**

- locale routing, or any `[locale]` segment
- the shared `[slug]` route
- Product Detail — route, template, component, or fetching
- Product data, Product reference data, or any Product write path
- the collision enforcement mechanism, in any of its three candidate forms
- middleware
- installing `next-intl` or any other dependency
- sitemap changes, including the Product exclusion ADR-007 recorded as Conflict 3
- SEO metadata, canonical tags, or `hreflang`
- redirects, including the proof-route redirects §9 sequences
- navigation or link generation
- any schema change, migration, or seed

It also does not decide **where** the §2 discriminator lives, **which** enforcement mechanism §6 requires, or **when** `fa`/`ar` slug vocabulary is approved.

## Consequences

**Positive**

- **Both frozen URL decisions survive intact.** ADR-007 §2 and ADR-009 §1 are compatible rather than merely coexisting, and neither had to be reopened to get there. No published URL, route or backend slug changes.
- **The collision becomes a loud data error instead of a silent shadowing.** Today a colliding Product would take over — or lose — a URL with nothing reported. Under §3 and §5 it is invalid data, and under §6 it is invalid at the point of writing.
- **Product Family resolution needs no network call.** Because the registry is authoritative for a family's existence, the Family branch is decidable offline, which is what makes the fail-open half of §7 defensible rather than merely convenient.
- **The reserved paths are protected as data, not only as routes.** `finder`, `segments` and `types` were already safe from being _routed_ over; §4 is what stops a row being created that can never be reached.
- **A deferral with a defined expiry.** §6 does not postpone the enforcement question indefinitely; it names the five events that end the deferral, none of which can happen quietly.

**Negative / trade-off**

- **A coordinated enforcement decision is now owed**, and it is owed before work that is otherwise ready to start. Populating Products or writing the first translated slug is blocked behind a mechanism choice that touches the database.
- **The §2 discriminator is a rule that must stay consistent in more than one place** — the route resolves it, the sitemap composes URLs from it, and any future link builder depends on it. Consolidating it into one named step is the mitigation, not a guarantee.
- **The `fa`/`ar` English-slug position is a visible compromise.** Two of three launch locales will carry English URL segments for Product Families, and the `hreflang` alternate set will contain only the default locale until translated slugs exist.
- **Family precedence has a cost if invalid data ever exists**: the colliding Product is unreachable at its canonical URL. That is the intended trade — the six Family pages are the higher-value surface — but it is a real loss, and it is why §6 exists rather than precedence alone.
- **This ADR does not shorten any URL.** ADR-009 recorded that `engine-oils-automotive-lubricants` has a real SEO argument against it and left the question open; sharing a namespace with Products does not change that, and does not settle it.

## Alternatives Considered

- **A reserved namespace for Families — `/{locale}/products/categories/{slug}`.** Rejected. It closes the collision structurally and needs no precedence rule ever, which is genuinely attractive. But it contradicts ADR-009 §1, which names `/{locale}/products/{slug}` as the family route segment; it contradicts [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §0/§4/§14, which publishes those six URLs; it would move six live public URLs and Payload's join key's public counterpart; and it inserts a path segment that means nothing to a reader. Solving an internal ambiguity by changing the site's most valuable public URLs is the wrong direction.
- **A reserved namespace for Products — `/{locale}/products/p/{slug}`.** Rejected. It contradicts ADR-007 §2 directly, and ADR-007 argued the flat product URL at length against a specific alternative. Reopening the more heavily reasoned of the two decisions to avoid writing a precedence rule is a poor trade.
- **Product precedence instead of Family precedence.** Rejected on failure mode. It is mechanically identical, but a mis-seeded Product would shadow a Product Family page — the site's primary commercial surface — silently and at exactly the moment a catalog import goes wrong. Family precedence fails toward the page that is always supposed to exist.
- **Runtime precedence with no data rule.** Rejected. Precedence alone makes ambiguous data _survivable_, which removes the pressure to make it impossible; the collision then lives permanently as a resolution order that every future consumer has to know about. §3's stronger rule is what keeps precedence a safety net rather than a design.
- **Selecting the enforcement mechanism now.** Rejected, and this is a close call. A shared slug registry table is probably the right answer, and deciding it here would remove a future gate. But it is a schema decision — a table, a write path, a migration and a claim/release lifecycle — and choosing it as a side effect of a URL policy is exactly the pattern CLAUDE.md §4 warns against. The invariant is what needs freezing now; the mechanism needs its own design, and nothing is blocked by deferring it because nothing can currently violate the invariant.
- **Middleware or a rewrite layer disambiguating into two internal routes.** Rejected as more machinery for the same decision. It moves the discriminator to the edge, adds a lookup before render on every product-namespace request, and still needs §3 and §5 to say what the lookup should conclude.
- **Leaving it open until the Product Detail implementation.** Rejected. That is the status quo ADR-008 and ADR-009 both recorded, and it puts an identifier-namespace decision inside an implementation task — the situation ADR-007 recorded its conflicts specifically to avoid, and the one ADR-009 was written to end.

## Relation to ADR-007, ADR-008 and ADR-009

- **[ADR-007](./ADR-007-product-taxonomy-v2.md) is unmodified.** §2's canonical Product URL, §3's reserved Segment and Product Type namespaces, and its Non-Goals all stand exactly as written. This ADR adds what §2 did not address: what happens when that URL shape meets a Product Family's. ADR-007's Recorded Conflict 3 (products excluded from the sitemap by design) is untouched and remains part of the eventual Product Detail implementation task.
- **[ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md) is unmodified.** Its Deferred entry — the flat Product vs Product Family URL collision, and the absence of a reserved-slug rule — was accurate when written and is **superseded by this ADR**. Its B2 filter contract, its eight approved Segment slugs, and its resolution of `Other` as vocabulary rather than a row are all untouched.
- **[ADR-009](./ADR-009-product-family-canonical-identifier.md) is unmodified.** The one canonical identifier per Product Family, its use as the default-locale route segment, and §3's rule that localized slugs are request and URL vocabulary rather than fixture keys are all preserved verbatim — §5 and §8 above depend on that rule rather than relaxing it. ADR-009's "Still open, and not touched here" list loses one item, the flat URL collision and reserved-slug rule; the rest stay open.
- **Still open, and not touched here:** the sub-range ↔ `ProductType` mapping, the Product Type vocabulary, Segment and Product Type page indexability, Grade / Variant modelling, `productCode`, the `Other` Segment's status as a page, the Industry / Marine information-architecture naming question, the per-Segment Product Type lists, the editorial layer for product pages, the SEO documentation conflict between [SEO_ARCHITECTURE.md](../seo/SEO_ARCHITECTURE.md) §8 and [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §14, and whether Product Family URLs should be shortened.
