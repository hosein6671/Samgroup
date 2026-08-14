# Roadmap

Priority order within Phase 1 (see [PROJECT_VISION.md](./PROJECT_VISION.md) for full scope). No calendar dates yet — milestones are ordered by dependency, not a committed schedule.

---

## Current Status

**M1 complete; M2 advanced along the catalog and frontend axes. The next boundary is a Database implementation gate — see "Next" below.** Architecture Frozen (all 7 categories confirmed — see [ADR/README.md](./ADR/README.md)); Frontend Technology Stack, SEO, i18n, and RAG architecture all finalized. [ADR-007](./ADR/ADR-007-product-taxonomy-v2.md) through [ADR-011](./ADR/ADR-011-products-slug-namespace-enforcement.md) have since been accepted.

**Complete and verified:**

- ✅ **Monorepo foundation** — git, `.gitignore`, `.gitattributes`, `pnpm-workspace.yaml`, root `package.json` (pnpm@11.20.0, Node ≥24), `turbo.json` (v2 `tasks`).
- ✅ **Shared packages** — `packages/types`, `ui`, `config`, `eslint-config`, `tsconfig`.
- ✅ **Workspace install** — `pnpm install` has been run; `pnpm-lock.yaml` is committed and `node_modules` resolves.
- ✅ **Developer tooling** — ESLint 10 flat config, Prettier, Husky + lint-staged pre-commit hook.
- ✅ **CI Phase 1 (Validate)** — `.github/workflows/ci.yml`: install → lint → type-check → format check. Phases 2 and 3 are deliberately absent until app Dockerfiles exist ([DEVOPS.md](./DEVOPS.md)).
- ✅ **Docker development infrastructure** — `docker-compose.yml` (`postgres`, `minio`, `minio-init`, `nginx`), `docker-compose.override.yml`, Nginx templates, and the Postgres init script creating `sam_platform` and `sam_cms` as independent databases.
- ✅ **ADR-002 isolation proven, not assumed** — `scripts/verify-db-isolation.sh` passes 4/4, including both negative cases (neither application role can reach the other's database).
- ✅ **Prisma schema and initial migration** — `prisma/schema.prisma` translated from [DATA_MODEL.md](./DATA_MODEL.md) §1, first migration applied against `sam_platform`, and an idempotent `Locale` seed for `en`/`fa`/`ar`.
- ✅ **Backend API foundation** — `apps/api` scaffolded (NestJS), with the global `{ data, meta }` / `{ error }` response envelope, exception handling, environment validation, and locale resolution.
- ✅ **Catalog APIs** — `GET /categories`, `/categories/:slug`, `/products`, `/products/:slug`, locale-aware via the shared `ContentTranslation` service. Plus `GET /health` and `GET /locales`.
- ✅ **SEO foundation** — `GET /seo/redirects` and `GET /seo/sitemap-entries`, per [seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md).
- ✅ **Frontend design system foundation** (step A-2) — design tokens authored in TypeScript and generated into a Tailwind v4 theme layer, 13 Server-Component primitives, a twelve-column editorial grid, a specification primitive, and four scroll-driven CSS reveal patterns with no animation library. Palette contrast audited at 46 checks, 0 failures. Recorded in [design/DESIGN_SYSTEM.md](./design/DESIGN_SYSTEM.md).
- ✅ **Product Taxonomy v2 schema** — models `Segment`, `ProductType`, `ProductSegment`, `SegmentProductType` plus nullable `Product.productTypeId`, by migration `20260812160853_add_product_taxonomy_v2` ([ADR-007](./ADR/ADR-007-product-taxonomy-v2.md)).
- ✅ **Segment reference data** — the dedicated idempotent seed `prisma/seed-catalog.ts`, run explicitly as `pnpm seed:catalog` and never wired into `prisma db seed`. The eight approved `Segment` rows are populated in local DEV `sam_platform` ([ADR-008](./ADR/ADR-008-b2-filter-contract-and-segment-vocabulary.md)).
- ✅ **Product Detail API (B1)** — `GET /products/:slug` serves `segments[]` and `productType`.
- ✅ **B2 product list taxonomy filters** — `GET /products` accepts `segment` and `productType`; `type` remains unsupported and is rejected. The list response shape is unchanged.
- ✅ **Category reference data** — the dedicated idempotent seed `prisma/seed-categories.ts`, run explicitly as `pnpm seed:categories`. Upserts by `slug`, never deletes, refuses to run unless `current_database()` is `sam_platform`, and is **not** wired into `prisma db seed`, which stays locale-only. The six approved Product Family `Category` rows are populated in local DEV `sam_platform`, all as roots (`parentId = null`).
- ✅ **`apps/web` scaffolded and rendering** — Next.js 15 App Router, with the design system rendered by the design proof tree at `/design-proof/**`. That tree remains live during the transition described in [ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §9.
- ✅ **Locale routing foundation** — the `[locale]` segment, locale-detection middleware, and a locale contract generated from the `Locale` table rather than from code. Public URLs are now `/{locale}/…`. This makes the Locale API a **build hard dependency** for `apps/web`: `API_INTERNAL_URL` must be set for any build.
- ✅ **Canonical route promotion** — Products landing (`/{locale}/products`), the six Product Family routes (`/{locale}/products/{slug}`), and the About Us, Customized Solutions and Quality Certifications corporate pages. The six Product Family proof routes now redirect to their canonical URLs.
- ✅ **Category API integration into Product Family pages** — the server-side API client and the Product Family resolver. `Category` in `sam_platform` owns existence, canonical slug and name; the fixture owns editorial content until Payload arrives. API failure is fail-open by decision and reported server-side, and can never produce a canonical 404 ([ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7).
- ✅ **Canonical Product Family identifier frozen** — one string is simultaneously the default-locale `Category.slug`, the route segment, Payload's `categoryKey` and the frontend `ProductFamily.id` ([ADR-009](./ADR/ADR-009-product-family-canonical-identifier.md)).
- ✅ **Shared `products/` slug namespace defined** — Product Family and Product Detail occupy one namespace under one dynamic route, with Family precedence, reserved structural slugs and a symmetric collision rule ([ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md)).
- ✅ **Slug-collision enforcement mechanism selected** — a shared, database-maintained `ProductSlugClaim` registry whose normalized `slugKey` unique key is the race-safe authority ([ADR-011](./ADR/ADR-011-products-slug-namespace-enforcement.md)). It also records a factual correction to ADR-010's Context: the partial index `content_translations_unique_slug` has existed since the first migration, so translated slug values were never wholly unconstrained. ADR-010's Decision is unaffected and ADR-010 is unmodified.
- ✅ **Slug-collision enforcement implemented** — migration `20260814120000_add_product_slug_namespace_registry` installs, in one transaction, the `product_slug_claims` table and owner index, the `slug_key()` / `product_slug_*()` functions, and the nine statement-level `AFTER` triggers on `categories`, `products` and `content_translations`, with a generic backfill over every existing base slug and `Category`/`Product` slug translation. `ProductSlugClaim` is modelled in `prisma/schema.prisma`; everything that maintains it is SQL that lives only in that migration. **The registry is trigger-maintained and is never written from application code — not from `apps/api`, not from a seed, not from an import.**
- ✅ **DEMO / PLACEHOLDER Product data** — the dedicated seed `prisma/seed-products-demo.ts`, run explicitly as `pnpm seed:products:demo` and armed only by the process-scoped `SAM_ALLOW_DEMO_PRODUCT_SEED=true`. Ten demo `Product` rows across all six Product Families with eighteen `ProductSegment` memberships across all eight Segments are populated in local DEV `sam_platform`. **This data is NON-AUTHORITATIVE presentation and testing data — it is not SAM Group catalog content, it makes no specification, approval, packaging or availability claim, and it must be replaced with approved commercial product data before launch. A production deployment must never treat these rows as approved catalog content.** Every row carries the `SAM Demo` name prefix and the `sam-demo-` slug prefix. No `Specification`, `ProductType`, `ContentTranslation`, `SeoMeta` or `Media` row was created, and `Product.productTypeId` stays null.

**Verified end-to-end in local DEV `sam_platform` on 14 August 2026** — a statement about one development database on one date, not a production claim, and not a durable property of the system:

- the six approved `Category` rows are present and are all roots;
- `GET /api/v1/categories/:slug` returned 200 for all six, with ids matching the database;
- all six `/{locale}/products/{slug}` pages returned 200;
- the pages resolved through the **API-success path rather than fixture fallback** — no resolver fallback was reported, and each page render drove exactly one `categories` index read at the database.

**Also verified in local DEV `sam_platform` on 14 August 2026**, after the demo Product seed — same scope, one development database on one date:

- the ten demo `Product` rows and their eighteen `ProductSegment` memberships are present; `products` = 10, `product_segments` = 18, `product_types` = 0, `specifications` = 0, `content_translations` = 0;
- `product_slug_claims` holds 16 rows — the six pre-existing `Category` claims plus one `Product` claim per demo slug, each owned by that `Product`'s id, none reserved and none orphaned. **The seed writes no claim; every one of them was produced by the ADR-011 triggers on insert**;
- rerunning the seed reported `created 0, updated 0, unchanged 10`, changed no `Product.id`, and left all three counts identical;
- three rolled-back probe inserts were rejected by the database: a `Product` slug equal to the Family slug `base-oils` (`23505`), the reserved slug `finder` (`23514`), and a case-variant duplicate of an existing demo slug (`23505`);
- `GET /api/v1/products` served all ten, with `category`, `segment`, conjunctive `category`+`segment`, pagination, sorting and `q` all behaving as contracted, and unknown `category` / `segment` / `productType` values and the unsupported `type` parameter all still answering 400;
- `GET /api/v1/products/:slug` served the correct Product, Category, ordered `segments[]` and `productType: null` for three demo slugs, with `localeFallback: true` for `fa`/`ar` as expected while no translation rows exist.

**Next gate is not yet chosen.** ADR-010 §6's precondition is now met — the ADR-011 enforcement is installed — so the `products/` namespace is no longer closed to writes. What remains open around it: the Product Detail frontend branch, a `ProductType` vocabulary (still unapproved), and the replacement of the demo data above with approved commercial product content.

Explicitly **not** the next gate: frontend scaffolding, Category seeding and slug-namespace enforcement are all complete.

**Not yet implemented or deferred:** no approved commercial `Product` data — the only `Product` rows that exist are the DEMO / PLACEHOLDER set described above, and they are not catalog content; no Product Detail frontend branch (the shared namespace segment exists, the branch does not); no Product Finder backed by a real API; no `ProductType` vocabulary or reference data, and therefore no `SegmentProductType` membership rows and no non-null `Product.productTypeId` (the only `ProductSegment` rows are the demo memberships above); `apps/cms` holds only `.gitkeep`, so no Payload, no Content module fronting it, and no CMS-owned editorial content; no blog; no inquiry or form submission endpoints; no authentication or RBAC; no Admin Dashboard; no `ContentTranslation` or `SeoMeta` rows for any Category; no application Dockerfiles and no CI Phases 2–3; no production deployment or hardening. Root `README.md` is still empty.

Update this section as each further step lands — this is the one fact in `docs/` most likely to go stale.

---

## M1 — Foundation

- Monorepo scaffold ([PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md))
- Docker Compose stack (Postgres, MinIO, api, web, cms)
- Prisma schema for core entities ([DATA_MODEL.md](./DATA_MODEL.md)), including `Locale` seeded with the confirmed launch set — `en` (default), `fa`, `ar` ([docs/i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md))
- Auth (JWT + RBAC) in NestJS
- CI pipeline (lint, type-check, test, build)

## M2 — Content & Catalog

- Payload CMS setup (separate `sam_cms` database, Pages/Menus/Footer/Settings), localization config driven by the `Locale` table, plus Payload's **own admin authentication and role model** — minimum `Admin`/`Content Manager`, certification publish gate enforced in Payload's access control, no SSO bridge and no syncing from `User` ([ADR-006](./ADR/ADR-006-payload-admin-authentication.md))
- NestJS Content module fronting Payload
- Product Catalog + Categories + Specifications, with `ContentTranslation` wired for localized fields ([docs/i18n/INTERNATIONALIZATION_STRATEGY.md §3](./i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization))
- Media upload pipeline (MinIO)

## M3 — Public Site

Pages built in this order, per [SITE_STRUCTURE.md](./SITE_STRUCTURE.md):

1. Home Page
2. About Us
3. Products (category listing + product detail)
4. Customized Solutions
5. Export & Logistics
6. Contact Us

All six built with locale-prefixed routing from the start, in all three confirmed launch locales — `en`, `fa`, `ar` — together, not phased ([docs/i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md)).

Plus, in parallel:

- Blog (posts, categories, tags)
- SEO fields wired into pages per the full reusable model in [docs/seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md) (meta, Open Graph, Twitter Cards, schema.org, redirects) — not just meta/OG/schema as originally scoped here

## M4 — Forms & Admin

- Custom Product Request form ([SITE_STRUCTURE.md §4](./SITE_STRUCTURE.md#4-customized-solutions) → `CustomFormulationRequest`)
- Main Inquiry form ([SITE_STRUCTURE.md §6](./SITE_STRUCTURE.md#6-contact-us) → `Inquiry`, covering all 6 inquiry types)
- "Request Sample" CTAs — **no separate form**; they open the Inquiry form pre-filled with the product ([SITE_STRUCTURE.md](./SITE_STRUCTURE.md#request-sample-form--resolved))
- Distributor Application form → `DistributorApplication`
- Download gating form (Company Catalogue + Product Catalogue only, never TDS/SDS) → `DownloadRequest`
- Newsletter sign-up (footer + Insights) → `NewsletterSubscription`, double opt-in
- Job Application form → `JobApplication` (**Admin-only**; Careers is optional at launch)
- Admin Dashboard (manage products, blog, forms, users)

## M5 — Launch Readiness

- Content readiness: professional facility/product photography completed (open dependency per [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-content-dependencies)) — real assets in place before go-live, no placeholder imagery
- SEO validation against [docs/seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md): `sitemap.xml`/`robots.txt` verified in the target environment, structured data validated (Google's Rich Results Test or equivalent), Core Web Vitals budget met
- i18n/RTL validation against [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md): `hreflang` correctness checked for `en`/`fa`/`ar`, RTL layout verified for Persian/Arabic against the confirmed typeface pairing (still open — see that doc), all required-review translations (per the hybrid workflow) confirmed `human_reviewed` before launch
- Security pass against [SECURITY.md](./SECURITY.md) checklist
- E2E test coverage for critical journeys ([TESTING_STRATEGY.md](./TESTING_STRATEGY.md))
- Production deployment + monitoring/backups ([DEVOPS.md](./DEVOPS.md))

---

## Future Phases

Tracked at a high level only until Phase 1 ships — see [PROJECT_VISION.md](./PROJECT_VISION.md#future-phases): Customer Portal, CRM, Workflow Management, Notifications, File Management, Mobile Application, ERP Integration, AI Features (architecture anchored, not scheduled — [docs/ai/RAG_ARCHITECTURE.md](./ai/RAG_ARCHITECTURE.md)).
