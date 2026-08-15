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

- ✅ **Product list API integration into Product Family pages** — the first `apps/web` consumption of `GET /products`. Each Product Family page fetches `GET /api/v1/products?category={family-slug}` server-side through the existing API client, keyed on the family's canonical ADR-009 identifier, and renders the rows in a reusable Product card. A Segment filter sits beside the list as plain links carrying `?segment={slug}`, so filter state is URL state and the **backend remains the sole authority on filter semantics** — nothing is filtered in `apps/web`. The section streams inside a `Suspense` boundary, so a slow or unavailable catalog service delays one block rather than the page. **No Product Detail navigation was introduced**: cards carry no link, because the Product branch of the shared `products/` namespace does not exist. **No Product Type UI**, because no Product Type vocabulary is approved. List-API failure renders a restrained "unavailable" state and never a canonical 404 ([ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7).

- ✅ **Product Detail frontend and the shared-namespace discriminator** — `/{locale}/products/{slug}` now serves both entity types from ONE dynamic segment, closing the ADR-010 §2 read path. The discriminator resolves in a fixed order: **reserved** (`finder`/`segments`/`types` → 404, answered locally, no catalog lookup) → **Product Family** (the local content registry; a hit returns without any Product request being issued, which is what Family precedence means operationally) → **Product** (`GET /products/:slug`). Only the API's own definitive NOT_FOUND produces a canonical 404; an unreachable service, a timeout, a 5xx or a malformed payload render a restrained "product unavailable" page instead ([ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7). Product cards on Family pages now link to the flat canonical URL. The page renders only API-backed fields — name, description, family, segments, and the specification/imagery sections only when the record actually carries them — so on the current demo data every product renders as hero plus the shared CTA. **`generateStaticParams` and `dynamicParams` were removed from the `[slug]` segment**: a child's `dynamicParams = true` does not override the parent `[locale]` layout's `dynamicParams = false`, so with the enumeration present every Product URL 404d at the router before any code ran. The six Family pages are consequently server-rendered on demand, which is what they already were in practice — the route reads `searchParams` and every fetch beneath it is `no-store`, and the previous build emitted no HTML for them despite its `●` marker.

- ✅ **Product Finder frontend** — `/{locale}/products/finder` is now a real page, served by the static route `app/[locale]/products/finder/page.tsx`. A static segment outranks its dynamic sibling in the App Router, so the finder is reached without the shared `[slug]` discriminator running at all; **the reserved-slug guard in `[slug]` is unchanged**, still lists all three values, and still 404s `segments` and `types` — its `finder` entry is now unreachable through routing rather than removed, because the database's `product_slug_reserved()` remains the authority ([ADR-011](./ADR/ADR-011-products-slug-namespace-enforcement.md)) and still reserves all three against `Category` and `Product` alike. Two filter axes, both backed by existing vocabulary and neither newly invented: **Product Family** from the canonical [ADR-009](./ADR/ADR-009-product-family-canonical-identifier.md) registry (`ProductFamily.id` is the default-locale `Category.slug`, sent as `?category=`) and **Segment** from the same temporary eight-row mirror the Family pages already use — no third vocabulary was created. Both are rows of plain links carrying `?category=`/`?segment=`, so filter state is URL state: refresh, Back/Forward, bookmarking and sharing work by construction, and selecting one axis preserves the other. **Filtering is entirely the backend's** — one `GET /products` per render, no client-side narrowing, no local slug validation, and the result count is `meta.total`. Six result states are kept distinct: loading (a `Suspense` boundary, so the hero and both filter rows render while the list is in flight), results, nothing published, nothing matching the filters, an unrecognised filter (the API's own 400 `VALIDATION_ERROR`, rendered with a control that clears the named axis), and list unavailable. **No branch substitutes a fixture**, and no API failure becomes a 404 ([ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7). Product cards are the existing `ProductCard`, linking to the flat canonical `/{locale}/products/{product-slug}`. **No Product Type control**, because no Product Type vocabulary is approved; **no free-text search**, which is outside this gate; **no translated filter labels**, because no `Segment` or `Category` translation row exists and writing them here would be inventing approved vocabulary.

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

**Also verified in local DEV on 15 August 2026**, after the Product list integration — same scope, one development database on one date, against both `next dev` and a production `next build` + `next start`:

- all six `/{locale}/products/{slug}` pages returned 200 and listed the demo Products their family holds — base-oils 2, lubricant-additives 1, engine-oils-automotive-lubricants 3, industrial-oils-lubricants 2, marine-oils-lubricants 1, antifreeze-coolants 1 — matching `GET /api/v1/products?category=…` and the database exactly;
- Segment filtering narrowed through the API on every combination tried, including a zero-result one (`base-oils?segment=gardening` → the empty-filtered state), and the URL survived refresh, sharing and browser back/forward;
- an unknown `?segment=` produced the backend's 400 `VALIDATION_ERROR` and rendered as its own "not recognised" state with a reset link — never a 404, and never an empty list presented as a real result;
- with the API stopped, every family page still returned 200 with its editorial content intact and a "Product list unavailable" notice in place of the list, in the production build as well as in dev, and recovered on the next request once the API returned;
- `/fa` and `/ar` family pages rendered without error, serving the default-locale product names the API falls back to;
- no Product card carries a link, and `/en/products/sam-demo-base-oil-a` still answers 404 — the Product Detail branch remains unimplemented.

**Also verified in local DEV on 15 August 2026**, after the Product Detail gate — same scope, one development database on one date, against `next dev` and a production `next build` + `next start`:

- **Family precedence**: all six `/{locale}/products/{family-slug}` still render the Family page, with no Product lookup issued for any of them;
- **Product Detail**: all ten demo Products return 200 at `/en/products/{product-slug}`, with the correct name, owning Family and Segment set — `sam-demo-base-oil-a` one Segment, `sam-demo-engine-oil-c` two, `sam-demo-antifreeze-coolant-a` four — and with the Product Type row, the specifications section and the gallery all absent, matching `productType: null`, `specifications: []` and `images: []` on the wire;
- **Breadcrumb** resolves Products → Family → Product using `Product.category`, and composes no nested Product URL;
- **404**: `/en/products/does-not-exist` and the three reserved slugs `finder`, `segments`, `types` all 404, and no reserved slug reaches a Product lookup;
- **Infrastructure failure**: with the API stopped, a valid Product URL returned **200 with the unavailable state, not a 404** — as did a genuinely non-existent slug, which is the correct behaviour because absence cannot be established while the service is down — while the Family page continued to fail open to its fixture. Both conditions were reported server-side, and the page recovered on the next request after the API restarted, with no restart of `apps/web`;
- **Locales**: the same Product renders under `/en`, `/fa` and `/ar` with the correct `lang`/`dir`, and `fa`/`ar` additionally show the "not yet translated" notice driven by the API's `meta.localeFallback`. `/xx/...` still 404s at the router;
- **Product cards** on Family pages link to `/{locale}/products/{product-slug}`, preserve the locale, and point at no Family or reserved slug.

**Also verified in local DEV on 15 August 2026**, after the Product Finder gate — same scope, one development database on one date, against `next dev` and a production `next build` + `next start`, with identical results on both:

- **Route precedence**: `/{locale}/products/finder` returns 200 and renders the finder. `next build` emits `/[locale]/products/finder` and `/[locale]/products/[slug]` as separate routes, and no `GET /products/finder` reached the API — the shared discriminator never ran. `segments` and `types` still 404;
- **Counts**, matching `GET /api/v1/products` and the database exactly: unfiltered 10; `category=base-oils` 2; `category=engine-oils-automotive-lubricants` 3; `segment=industry` 5; `segment=passenger-cars` 3; `base-oils`+`marine` 1; `engine-oils-automotive-lubricants`+`passenger-cars` 2; `base-oils`+`passenger-cars` 0, rendered as the empty-filtered state rather than as an error;
- **Query state**: a direct URL load and a refresh both reproduce the filtered view; the active chip on each axis is marked from the URL; selecting one axis preserves the other in every emitted link; blank (`?category=&segment=`), repeated (`?segment=a&segment=b`) and unrecognised parameters all render the unfiltered list rather than failing;
- **Invalid filters**: `?category=not-a-family` and `?segment=not-a-segment` each produced the backend's 400 `VALIDATION_ERROR` naming that field, and rendered as their own "not recognised" state with a control clearing only that axis — never a 404 and never an empty list presented as a real result;
- **Infrastructure failure**: with the API stopped, the finder still returned 200 with the hero and both filter rows intact and a "Product list unavailable" notice in place of the list, no product fabricated, and recovered on the next request once the API returned;
- **Locales**: `/en`, `/fa` and `/ar` all render with the correct `lang`/`dir`, the same counts, and locale-preserving product links; filter labels are English in all three, as intended while no translation row exists. `/xx/products/finder` still 404s at the router;
- **No regression**: all six Family pages and a Product Detail page still render, with their own counts unchanged.

**Next gate is not yet chosen.** ADR-010 §6's precondition is now met — the ADR-011 enforcement is installed — so the `products/` namespace is no longer closed to writes. What remains open around it: a `ProductType` vocabulary (still unapproved) and the replacement of the demo data above with approved commercial product content. **The Product Detail frontend branch is no longer among them** — this sentence listed it as open until the Product Finder gate, having gone stale when the Product Detail gate landed; the shared `products/` read path is complete for both entity types, and the Product Finder now occupies the third route in that namespace.

Explicitly **not** the next gate: frontend scaffolding, Category seeding and slug-namespace enforcement are all complete.

**Not yet implemented or deferred:** no approved commercial `Product` data — the only `Product` rows that exist are the DEMO / PLACEHOLDER set described above, and they are not catalog content; no Product Type filter or free-text search on the Product Finder, and no translated filter labels — the finder itself is built, on two backend-authoritative axes; no SEO consumption on the Product Detail route (`ProductDetailResponse.seo` is on the wire and deliberately unread; `generateMetadata` uses the product's own name and description); no `ProductType` vocabulary or reference data, and therefore no `SegmentProductType` membership rows and no non-null `Product.productTypeId` (the only `ProductSegment` rows are the demo memberships above); `apps/cms` holds only `.gitkeep`, so no Payload, no Content module fronting it, and no CMS-owned editorial content; no blog; no inquiry or form submission endpoints; no authentication or RBAC; no Admin Dashboard; no `ContentTranslation` or `SeoMeta` rows for any Category; no application Dockerfiles and no CI Phases 2–3; no production deployment or hardening. Root `README.md` is still empty.

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
