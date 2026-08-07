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
- Category
- Specifications
- Images
- Documents

Phase 1 category seed list (source: [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#3-products)):

1. Base Oil
2. Additives
3. Engine Oils / Lubricants
4. Industrial Oils / Lubricants
5. Marine Oils / Lubricants
6. Anti Freeze, Anti Boil

Base Oil has a Virgin vs. Recycled distinction — captured as a `Specification` key/value pair, not a separate column or table.

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
