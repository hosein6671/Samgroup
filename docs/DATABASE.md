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

`Segment` and `Product Type` are **implemented in `prisma/schema.prisma`**: accepted architecture from [ADR-007](./ADR/ADR-007-product-taxonomy-v2.md), translated into the models `Segment`, `ProductType`, `ProductSegment` and `SegmentProductType` plus nullable `Product.productTypeId`, by migration `20260812160853_add_product_taxonomy_v2`. The approved Segment reference data is applied by a **dedicated, idempotent, explicitly-invoked catalog seed** — `prisma/seed-catalog.ts`, run as `pnpm seed:catalog` and never wired into `prisma db seed`. The eight approved Segment rows were populated in the local DEV `sam_platform` during that gate. **`Product Type` reference data and both membership joins remain unpopulated**, since no Product Type vocabulary is approved. `Category` is the Product Family axis and is unchanged. Field-level shapes, cardinalities and delete behaviour are in [DATA_MODEL.md](./DATA_MODEL.md). No Segment slug, no Product Type row and no Segment-to-Product-Type membership is approved.

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

Still absent, and not created by that seed: any `Product` row, any `ProductType` row or membership, any `ContentTranslation` or `SeoMeta` record for a Category, and any Payload `ProductCategoryContent` entry. Frontend fetch integration for the Product Family pages is likewise not implemented.

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
