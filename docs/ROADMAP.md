# Roadmap

Priority order within Phase 1 (see [PROJECT_VISION.md](./PROJECT_VISION.md) for full scope). No calendar dates yet — milestones are ordered by dependency, not a committed schedule.

---

## Current Status

**M1 in progress.** Architecture Frozen (all 7 categories confirmed — see [ADR/README.md](./ADR/README.md)); Frontend Technology Stack, SEO, i18n, and RAG architecture all finalized. Bootstrap executing incrementally, step by step, with approval between each:

- ✅ Step 1 — Monorepo foundation: git initialized, real `.gitignore`, `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, empty `apps/web`/`apps/api`/`apps/cms` skeletons. Baseline committed as `3fa6f8d` on branch `main` and pushed to `origin` (`https://github.com/hosein6671/Samgroup`); `origin/main` synchronized, working tree clean.
- ✅ Step 2 — Shared package foundation: `packages/types`, `packages/ui`, `packages/config`, `packages/eslint-config`, `packages/tsconfig` created as minimal config-only scaffolds.
- ⬜ **Step 3 — next:** workspace install (`pnpm install` at the root, producing the first lockfile).
- ⬜ Not yet done beyond that: no Next.js/NestJS/Payload scaffolding; no Docker Compose stack; no Prisma schema; no CI. `docker/`, `scripts/`, `.github/`, root `README.md`/`docker-compose.yml` are still empty.

Update this line as each further step lands — this is the one fact in `docs/` most likely to go stale.

---

## M1 — Foundation

- Monorepo scaffold ([PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md))
- Docker Compose stack (Postgres, MinIO, api, web, cms)
- Prisma schema for core entities ([DATA_MODEL.md](./DATA_MODEL.md)), including `Locale` seeded with the confirmed launch set — `en` (default), `fa`, `ar` ([docs/i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md))
- Auth (JWT + RBAC) in NestJS
- CI pipeline (lint, type-check, test, build)

## M2 — Content & Catalog

- Payload CMS setup (separate `sam_cms` database, Pages/Menus/Footer/Settings), localization config driven by the `Locale` table
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
