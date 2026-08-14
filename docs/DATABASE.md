# Database Design

For field-level definitions and relationships, see [DATA_MODEL.md](./DATA_MODEL.md).

## Database

PostgreSQL

ORM: Prisma

Two independent databases on one Postgres server (see [ARCHITECTURE.md](./ARCHITECTURE.md#cms-integration) and [DEVOPS.md](./DEVOPS.md#postgres-databases)):

- `sam_platform` — everything below on this page, managed by Prisma
- `sam_cms` — Payload-managed (Pages, Menus, Footer, Settings), never touched by Prisma

Prisma never connects to `sam_cms`. Payload never connects to `sam_platform`.

---

## Main Entities

### Users

- Admin
- Content Manager
- Sales Expert
- Customer

Role → permission mapping lives in [SECURITY.md](./SECURITY.md).

---

### Organizations

- Organization (customer company — a Customer `User` belongs to one; internal staff belong to none)

---

### Status History

- Generic status-change audit trail, attached to Inquiry, Custom Formulation Request, Distributor Application, and Job Application; the anchor point for the future Workflow module

---

### Products

- Product
- Category / Product Family
- Segment
- Product Type
- Specifications
- Images
- Documents
- Product Slug Claim — the `/{locale}/products/{slug}` namespace registry ([ADR-011](./ADR/ADR-011-products-slug-namespace-enforcement.md)); **trigger-maintained, never written from application code**

`Segment` and `Product Type` are **implemented in `prisma/schema.prisma`**: accepted architecture from [ADR-007](./ADR/ADR-007-product-taxonomy-v2.md), translated into the models `Segment`, `ProductType`, `ProductSegment` and `SegmentProductType` plus nullable `Product.productTypeId`, by migration `20260812160853_add_product_taxonomy_v2`. The approved Segment reference data is applied by a **dedicated, idempotent, explicitly-invoked catalog seed** — `prisma/seed-catalog.ts`, run as `pnpm seed:catalog` and never wired into `prisma db seed`. The eight approved Segment rows were populated in the local DEV `sam_platform` during that gate. **`Product Type` reference data and `SegmentProductType` remain unpopulated**, since no Product Type vocabulary is approved; the only `ProductSegment` rows in existence are the DEMO memberships described below. `Category` is the Product Family axis and is unchanged. Field-level shapes, cardinalities and delete behaviour are in [DATA_MODEL.md](./DATA_MODEL.md). No Segment slug, no Product Type row and no Segment-to-Product-Type membership is approved.

The six Product Family Categories (names and URLs from [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#3-products) §0/§4; the identifier rule is frozen by [ADR-009](./ADR/ADR-009-product-family-canonical-identifier.md)):

| Product Family                      | `Category.slug` (default locale)    |
| ----------------------------------- | ----------------------------------- |
| Base Oils                           | `base-oils`                         |
| Lubricant Additives & Components    | `lubricant-additives`               |
| Engine Oils & Automotive Lubricants | `engine-oils-automotive-lubricants` |
| Industrial Oils & Lubricants        | `industrial-oils-lubricants`        |
| Marine Oils & Lubricants            | `marine-oils-lubricants`            |
| Antifreeze & Coolants               | `antifreeze-coolants`               |

`Category` reference data has its own implemented mechanism, separate from the Segment one above: the **dedicated Category seed** `prisma/seed-categories.ts`, run as `pnpm seed:categories`. It is idempotent (upsert by `slug`, name-only updates, no deletes), refuses to run unless `current_database()` is `sam_platform`, and is **explicit-only — never wired into `prisma db seed`**, which stays locale-only. These six rows were populated in the local DEV `sam_platform` during that gate, all as **root categories (`parentId = null`)**; no claim is made about any other environment.

Still absent, and not created by that seed: any `ProductType` row or `SegmentProductType` membership, any `ContentTranslation` or `SeoMeta` record for a Category, and any Payload `ProductCategoryContent` entry.

### Product rows — DEMO / PLACEHOLDER only

`products` in the local DEV `sam_platform` holds **ten DEMO / PLACEHOLDER rows and nothing else**. They are **NON-AUTHORITATIVE** presentation and testing data, written so the catalog API and a future Product Detail route have something to serve during a client demonstration. **They are not SAM Group catalog content**, they carry no specification, approval, packaging, quantity or availability claim, and **they must be replaced with approved commercial product data before launch**. A production deployment must never treat them as approved catalog content.

They come from a **third dedicated seed**, `prisma/seed-products-demo.ts`, run as `pnpm seed:products:demo`. It is separate from both seeds above precisely because those write APPROVED reference vocabulary and this writes acknowledged placeholder data; one command must not be capable of both. It is guarded four ways: `current_database()` must be `sam_platform`; the acknowledgement `SAM_ALLOW_DEMO_PRODUCT_SEED=true` must be present; that acknowledgement is read **before** `.env` is loaded, so parking it in a file cannot arm the seed; and it is **never wired into `prisma db seed`**. It is idempotent — upsert by `slug`, so `Product.id` survives a rerun — and it deletes nothing except the Product↔Segment memberships of the demo Products it declares.

Every demo row carries the `SAM Demo` name prefix and the `sam-demo-` slug prefix, which is what marks it as demo-owned from any surface. Ten Products span all six Product Families; eighteen `ProductSegment` memberships span all eight Segments. `Product.productTypeId` is null on every one — no Product Type vocabulary is approved — and the seed creates no `ProductType`, `Specification`, `ContentTranslation`, `SeoMeta` or `Media` row.

The seed **never writes `product_slug_claims`**. Each demo Product's namespace claim was produced by the ADR-011 triggers on insert, which is what makes the claim registry evidence rather than assertion.

Frontend fetch integration for the Product Family pages does not read `GET /products`, so these rows appear on no page today.

Base Oils has a Virgin vs. Recycled distinction — captured as a `Specification` key/value pair, not a separate column or table.

---

### Blog

- Posts
- Categories
- Tags

---

### CMS

- Pages
- Menus
- Footer
- Settings

---

### SEO

- Meta Title
- Meta Description
- Canonical URL
- Open Graph
- Twitter/X Card
- Robots Directives (index/follow)
- Keywords (optional)
- Structured Data (Schema.org / JSON-LD)
- Social Image
- Slug (lives on the owning entity, not the SEO record itself)

Full SEO strategy, the reusable-model design, and why the same contract is implemented once in Prisma and once as a Payload field group: [docs/seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md).

---

### Redirects

- Redirect (`fromPath` → `toPath`, status code, optional locale) — see [docs/seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md#redirect-management)

---

### Internationalization

- Locale (the active-language registry — code, name, direction, active/default flags)
- Content Translation (generic per-field translation for Product/Category/BlogPost)

Full strategy: [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md). Payload-owned content (Pages, Settings) uses Payload's own native localization instead — no new entity needed there.

---

### Forms & Submissions

- **Inquiry** — the single general-submission entity. Covers Product Inquiry, Request a Quote, Customized Solution, Export & Logistics, Distribution Partnership, General Inquiry, **and Sample Request**. There is no separate `SampleRequest` entity: "Request Sample" CTAs submit an Inquiry with the product recorded on `relatedProductId` (approved decision — see [DATA_MODEL_GAP_REVIEW.md](./DATA_MODEL_GAP_REVIEW.md))
- **Custom Formulation Request** — the detailed specification form on Customized Solutions
- **Distributor Application** — partner/distributor qualification form
- **Job Application** — vacancy responses and speculative CVs. **Admin-only access** (see [SECURITY.md](./SECURITY.md)) — never routed to Sales roles
- **Download Request** — lead capture gating the Company Catalogue and Product Catalogue only; TDS/SDS downloads are deliberately ungated
- **Newsletter Subscription** — footer and Insights sign-up; double opt-in (`pending`/`confirmed`/`unsubscribed`)

Field-level detail for all six: [DATA_MODEL.md](./DATA_MODEL.md). All carry `consentGiven` and fall under the retention requirement in [SECURITY.md](./SECURITY.md#personal-data-retention).

---

### Media

- Images
- Files
- Videos
- Every record carries alt text (Image SEO + accessibility requirement)

---

## Future Modules

- CRM
- Customer Portal
- Notifications
- Workflow
- ERP Integration

Planned entities for each and how they anchor to the entities above: [DATA_MODEL.md](./DATA_MODEL.md#2-future-modules--planned-entities-not-implemented-in-phase-1).
