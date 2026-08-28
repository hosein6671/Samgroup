# Project Handoff — SAM Group Platform

**Prepared:** 7 August 2026 · **Updated:** 9 August 2026 · **Phase:** Architecture complete; backend API foundation and catalog/SEO read endpoints built; frontend design system foundation built; `apps/web` not yet scaffolded.

This document exists so someone with **zero conversation history** can pick this project up and continue correctly. It is a map and a status report, not a substitute for the documents it points to.

---

## 1. Project Overview

### Purpose

**SAM Group Platform** is a custom B2B web platform for a petroleum, lubricants, and petrochemical manufacturer — explicitly **not** a brochure website. Phase 1 delivers a company site, product catalog, CMS, lead-generation forms, and an admin dashboard; the architecture is designed to grow into Customer Portal, CRM, Workflow, ERP integration, and AI features over several years.

The business is a **direct manufacturer, not a trader** — that distinction drives much of the content strategy. Buyers are international: primary export markets are Africa, neighbouring regional markets, India, and Turkiye (noted as regulatorily strict). **WhatsApp is the primary contact channel** for international customers, which is why it appears as a persistent site-wide element rather than one contact option among many.

Full detail: [PROJECT_VISION.md](./PROJECT_VISION.md).

### Current architecture status

**Architecture is frozen and complete.** Every major area has been designed, reviewed, and approved: frontend, CMS content model, data model, i18n, SEO, security, RAG, and the full API contract. Six ADRs record the contested decisions.

**Implementation is underway on two fronts.** The infrastructure layer (monorepo, workspace install, tooling, CI Phase 1, Docker development stack) exists and runs. On top of it: the Prisma schema and initial migration are applied to `sam_platform`, the NestJS application is scaffolded with its response envelope and exception handling, and the public read endpoints for locales, catalog, and SEO are implemented. Separately, the frontend **design system foundation** is built in `packages/ui`/`packages/config`.

**`apps/web` and `apps/cms` are still `.gitkeep`-only.** The next boundary is the frontend design proof (step A-3) — scaffolding `apps/web` and rendering the design system so it can be verified in a browser for the first time.

### Main technology decisions

| Layer    | Choice                                                               |
| -------- | -------------------------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo                                          |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind                           |
| Backend  | NestJS — the only API surface anything calls                         |
| Database | PostgreSQL ×2 (`sam_platform` via Prisma, `sam_cms` via Payload)     |
| CMS      | Payload CMS                                                          |
| Auth     | JWT issued only by NestJS, argon2id, RBAC                            |
| Storage  | MinIO (S3-compatible)                                                |
| i18n     | next-intl — `en` (default), `fa`, `ar`                               |
| Deploy   | Docker + Docker Compose + Nginx on a single Linux VPS (all services) |

---

## 2. Completed Architecture Decisions

### Monorepo — pnpm workspaces + Turborepo _(ADR-001)_

One repository, three apps plus shared packages. Multi-repo rejected (shared types drift immediately); Nx rejected as heavier than this project needs.

### Frontend — Next.js 15 + React 19 + TypeScript

App Router, Server Components by default. Also approved: Tailwind, Framer Motion, GSAP + ScrollTrigger, Three.js/R3F/Drei, Mapbox GL JS, next-intl. Design direction is "luxury industrial" — magazine-style editorial layouts, explicitly not generic SaaS. Details: [technology/FRONTEND_STACK.md](./technology/FRONTEND_STACK.md), [frontend/FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md).

### Backend — NestJS as sole API gateway _(ADR-003)_

`apps/web` calls **only** NestJS. NestJS fronts Payload internally, server-to-server. The frontend has no awareness Payload exists. One API surface, one auth scheme, one error shape.

### CMS — Payload only

Bespoke company/brand pages are **Payload Globals**; legal pages are a **`Pages` collection**. No generic page builder — layout is code, editorial content is CMS. Repeating content (cards, timelines, FAQs) is always a CMS array/repeater, never hardcoded. Details: [content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md).

### Database separation _(ADR-002)_

**Two independent PostgreSQL databases on one server:** `sam_platform` (Prisma) and `sam_cms` (Payload). Separate credentials — neither user can log into the other's database. Chosen over a shared database with separate schemas because Payload's `schemaName` option is documented as experimental and has a history of migration bugs. This decision shapes almost everything downstream: SEO, i18n, and RAG each implement one capability twice, unified at the NestJS layer.

### Authentication

JWT issued only by NestJS. Access token 15 min, refresh token 7 days in an httpOnly cookie. **argon2id** hashing _(ADR-004)_. RBAC matrix with four roles; two deliberate carve-outs: **Certifications require Admin to publish**, and **Job Applications are Admin-only** (CVs never enter a Sales queue). Details: [SECURITY.md](./SECURITY.md).

### Internationalization

`en` default; `en`/`fa`/`ar` all ship at launch. **The locale list is data, not code** — a `Locale` table drives routing config, so adding a language is a database row plus translated content, never a code change. Payload uses native field localization; Prisma-owned content uses a `ContentTranslation` table. Hybrid translation workflow: machine drafts allowed, human review required for product specs, company/legal content, and lead-generating form copy. Details: [i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md).

### SEO

One reusable `SeoFields` contract implemented twice (Prisma `SeoMeta` table + Payload field group), normalized by NestJS. Covers meta, Open Graph, Twitter Cards, robots directives, JSON-LD, canonical URLs, redirects. Core Web Vitals budget: LCP < 2.5s, INP < 200ms, CLS < 0.1. Details: [seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md).

### RAG _(future phase — designed, not built)_

An independent module consuming **only** the public API — never a database connection, with its own isolated vector store. Indexing operates on an **allow-list**, never a deny-list, because a deny-list fails open and this database contains CVs and customer confidential specifications. Details: [ai/RAG_IMPLEMENTATION_ARCHITECTURE.md](./ai/RAG_IMPLEMENTATION_ARCHITECTURE.md).

---

## 3. Documentation Completed

**33 markdown documents + 2 source spreadsheets.** Read in roughly this order.

### Start here

| Document                                   | Purpose                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [/CLAUDE.md](../CLAUDE.md)                 | Entry point — project map, reading order, frozen decisions                                        |
| [/AI_CONTEXT.md](../AI_CONTEXT.md)         | **Behavioral rules, workflow conventions, live open threads.** Read before any non-trivial change |
| [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) | This document                                                                                     |

### Vision & scope

| Document                                 | Purpose                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| [PROJECT_VISION.md](./PROJECT_VISION.md) | Why the project exists, Phase 1 scope, future phases                       |
| [SITE_STRUCTURE.md](./SITE_STRUCTURE.md) | **27-page sitemap and per-page content spec.** The content source of truth |
| [ROADMAP.md](./ROADMAP.md)               | Milestones M1–M5 and current status                                        |

### Architecture

| Document                                       | Purpose                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)           | Style, applications, modules, CMS integration, auth, admin dashboard, i18n |
| [ADR/README.md](./ADR/README.md)               | Decision log — ADR-001 through ADR-006                                     |
| [TECH_STACK.md](./TECH_STACK.md)               | Concrete tools                                                             |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Monorepo layout                                                            |
| [DEVOPS.md](./DEVOPS.md)                       | Environments, CI/CD, two-database setup                                    |

### Data

| Document                                               | Purpose                                                |
| ------------------------------------------------------ | ------------------------------------------------------ |
| [DATA_MODEL.md](./DATA_MODEL.md)                       | **Field-level ER model.** Authoritative                |
| [DATABASE.md](./DATABASE.md)                           | Entity index                                           |
| [DATA_MODEL_GAP_REVIEW.md](./DATA_MODEL_GAP_REVIEW.md) | Gap analysis and the reasoning behind entity decisions |

### API

| Document                                         | Purpose                                                  |
| ------------------------------------------------ | -------------------------------------------------------- |
| [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) | **Authoritative endpoint list.** Start here for API work |
| [API_DESIGN.md](./API_DESIGN.md)                 | Conventions — envelope, versioning, naming, errors       |

### Frontend & content

| Document                                                                             | Purpose                                                     |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [frontend/FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md)             | Route tree, components, RSC rules, animation, data fetching |
| [technology/FRONTEND_STACK.md](./technology/FRONTEND_STACK.md)                       | Per-library rationale                                       |
| [design/FRONTEND_DESIGN_DIRECTION.md](./design/FRONTEND_DESIGN_DIRECTION.md)         | Visual direction                                            |
| [content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md) | Every Payload collection and Global                         |

### Cross-cutting

| Document                                                                                                                              | Purpose                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [SECURITY.md](./SECURITY.md)                                                                                                          | Auth, RBAC matrix, retention, admin access |
| [i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md)                                                      | Locale routing, content localization, RTL  |
| [seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md)                                                                                  | SEO model, structured data, performance    |
| [ai/RAG_ARCHITECTURE.md](./ai/RAG_ARCHITECTURE.md) · [ai/RAG_IMPLEMENTATION_ARCHITECTURE.md](./ai/RAG_IMPLEMENTATION_ARCHITECTURE.md) | RAG strategy, then implementation plan     |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) · [AI_RULES.md](./AI_RULES.md) · [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)            | Conventions and hygiene                    |

### Source material

`content/Sam Group Website Structure - Completed.xlsx` — **the content source of truth** (23 sheets). `content/Sam Group Website Structure_v2.xlsx` — historical only, do not build against it.

---

## 4. Current Repository State

**Authoritative snapshot: 27 August 2026 on `feature/design-system`.** The implementation and [ROADMAP.md](./ROADMAP.md) Current Status override the historical bootstrap snapshot retained below.

- `apps/api` is a working NestJS application with public catalog/blog/content/SEO reads, two public lead-write flows, email notifications, JWT/RBAC, refresh sessions, lead administration, guarded catalog import and the catalog technical-review API.
- `apps/web` is a working Next.js 15 application with canonical locale routes, Product Family/Product Detail/Product Finder, Insights, CMS-backed company pages, a BFF Admin session shell, lead workflow screens, and catalog technical-review queue/detail screens with explicit decision controls.
- `apps/cms` is a Payload 3 application isolated in `sam_cms`. Media/SEO foundations plus `AboutUs`, `CustomizedSolutions` and `QualityCertifications` Globals are wired end to end through NestJS. The remaining content model is incomplete.
- `sam_platform` includes the taxonomy, slug registry, auth sessions, lead workflow, consent revision, catalog provenance/import/review schema and the ADR-017 review-invalidation machinery.
- ADR-001 through ADR-017 are accepted. The latest delivered boundary is ADR-017: versioned subject-specific review hashes, atomic stale-approval invalidation and immutable source identity.
- Current catalog review state is intentionally empty: no `TechnicalReview`, approved Specification or approved ProductClaim exists in live DEV. The external sources remain uncaptured.
- **Latest completed gates:** Phase C, the technical-review decision UI, followed by the guarded source-capture operator path. Specification and Product Claim details can approve, reject or return eligible subjects through the existing NestJS endpoints, with status/hash concurrency protection and no browser-held API credential. `pnpm catalog:sources:capture` can inspect an explicitly supplied artifact and, after separate database/hash confirmations, attach its immutable identity to an existing uncaptured `SourceDocument`. No source bytes are stored, no locator is fetched or printed, and no approval is created. No live database capture has been executed; the 16 external sources remain uncaptured.
- **Homepage/UI iteration in progress (27 August 2026, not committed at this snapshot):** the flagship homepage has received the approved layout, copy, imagery, inquiry-form and Buyer Path passes. Home metadata now includes a locale-aware canonical plus Open Graph/Twitter fields while the documented tree-wide `noindex, nofollow` launch gate remains in force. The previously unimplemented primary-navigation destination `/{locale}/export-logistics` now renders a dedicated English-master page rather than redirecting or answering 404: shipment-brief inputs, an eight-step requirement-to-delivery path, qualified packaging options, Incoterm context and locale-safe quote/product CTAs. It deliberately publishes no unconfirmed market list, port, MOQ, lead time, payment term or availability claim; non-English routes identify the English fallback and no `hreflang` is emitted before reviewed translations exist. The live desktop/mobile pass found no horizontal overflow or console errors; the web suite stands at 53 files / 1,115 tests passing.
- Still absent or unresolved: approved commercial Product data and Product Type vocabulary; approved legal/contact content; the remaining Payload Globals/collections; several contracted form/Admin surfaces; application Dockerfiles, CI Phases 2–3 and production deployment.

Git at this snapshot: `feature/design-system` and `origin/feature/design-system` both point to `73b3e3622805f348590df09a2ccaa350ab11cdb2`; the branch is 78 commits ahead of `origin/main` (`8fd74d7`) and not behind. The tracked worktree is clean. Local untracked workspace-control files are not project implementation and must not be treated as repository status.

### Historical bootstrap snapshot — superseded

The remainder of this section records the state when the design-system foundation first landed. It is retained for provenance only. Statements below that `apps/web`/`apps/cms` are `.gitkeep` placeholders, that authentication/forms/Admin do not exist, or that only two commits are unpushed are **not current**.

### Exists at the historical snapshot

```
sam-group-platform/
├── .git/                     committed; 2 commits ahead of origin/main (see Git state)
├── .gitignore                real file
├── .gitattributes            repository line-ending policy (LF everywhere)
├── package.json              root manifest, pnpm@11.20.0 pinned, Node >=24, turbo scripts
├── pnpm-lock.yaml            committed; `pnpm install` has been run
├── pnpm-workspace.yaml       apps/*, packages/*
├── turbo.json                v2 "tasks" schema
├── eslint.config.js          ESLint 10 flat config
├── .prettierrc.json .prettierignore .lintstagedrc.json
├── .husky/pre-commit         runs lint-staged
├── .github/workflows/ci.yml  CI Phase 1 — lint, type-check, format check
├── docker-compose.yml        postgres, minio, minio-init, nginx — publishes no host ports
├── docker-compose.override.yml  local development port publishing (127.0.0.1 only)
├── docker/
│   ├── nginx/templates/      proxy config, bind-mounted into the official image
│   └── postgres/init/        first-boot script creating the two ADR-002 databases
├── scripts/verify-db-isolation.sh   asserts the ADR-002 boundary
├── CLAUDE.md, AI_CONTEXT.md
├── docs/                     33 .md + 2 .xlsx — complete
├── prisma/
│   ├── schema.prisma         21 models, translated from DATA_MODEL.md §1
│   ├── migrations/0_init/    initial migration against sam_platform
│   └── seed.ts               Locale seed (en/fa/ar), idempotent
├── apps/
│   ├── api/                  NestJS — scaffolded, see "Runs today"
│   ├── web/                  .gitkeep only
│   └── cms/                  .gitkeep only
└── packages/
    ├── tsconfig/             package.json + base.json
    ├── eslint-config/        package.json + index.js (flat config)
    ├── types/                package.json + tsconfig + SEO field types
    ├── ui/                   design system — tokens, generated theme, 13 primitives
    └── config/               shared Tailwind v4 entry + PostCSS config
```

### Ran at the historical snapshot

The infrastructure stack is functional, not just declared:

- `docker compose up -d` brings up `postgres`, `minio` (+ `minio-init`), and `nginx`, all healthy.
- `./scripts/verify-db-isolation.sh` passes **4/4** — both owners reach their own database, and **neither can reach the other's**. ADR-002 is enforced by PostgreSQL, not by convention.
- `pnpm lint`, `pnpm type-check`, `pnpm format:check`, and `pnpm test` all run and pass.

**The NestJS API serves these endpoints**, all public reads, all locale-aware, all returning the `{ data, meta }` / `{ error }` envelope:

| Endpoint                   | Module       |
| -------------------------- | ------------ |
| `GET /health`              | system       |
| `GET /locales`             | localization |
| `GET /categories`          | catalog      |
| `GET /categories/:slug`    | catalog      |
| `GET /products`            | catalog      |
| `GET /products/:slug`      | catalog      |
| `GET /seo/redirects`       | seo          |
| `GET /seo/sitemap-entries` | seo          |

Supporting these: a global response-envelope interceptor and exception filter, locale resolution, a shared `ContentTranslation` service, and a `media` module that is an internal service boundary with no controller of its own.

**The frontend design system exists** in `packages/ui` — design tokens authored in TypeScript and generated into a Tailwind v4 theme layer, plus 13 Server-Component primitives. Consumed through `packages/config`'s shared Tailwind entry. Full record: [design/DESIGN_SYSTEM.md](./design/DESIGN_SYSTEM.md).

### Did not exist at the historical snapshot

- **`apps/web` and `apps/cms` contain only `.gitkeep`.** No Next.js scaffold, no Payload config. The design system has therefore **never been rendered in a browser** — it is verified by compiled-CSS inspection and a measured contrast audit, not by looking at it.
- **No authentication.** No `auth` module, no JWT issuance, no RBAC guards. Every endpoint above is an unauthenticated public read.
- **No form submission endpoints, no admin endpoints, and no Content module** fronting Payload.
- No application Dockerfiles, no CI Phases 2–3, no `docker-compose.prod.yml`, no TLS configuration (only a `.example` template).
- Root `README.md` is still a zero-byte placeholder.

### Git state at the historical snapshot

|                 |                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Baseline commit | `3fa6f8d` — `chore: initial architecture and documentation baseline`                                       |
| Default branch  | `main` — matches the branch [DEVOPS.md](./DEVOPS.md) references for CI/deploy triggers                     |
| Current branch  | `feature/design-system` — per the branching rule in [CODING_STANDARDS.md](./CODING_STANDARDS.md#branching) |
| Remote          | `origin` → `https://github.com/hosein6671/Samgroup`                                                        |
| Sync            | `main` is level with `origin/main` (`8fd74d7`); the feature branch is **2 commits ahead, unpushed**        |
| Working tree    | Clean                                                                                                      |

Unpushed on `feature/design-system`: `75d6d23` (design system foundation) and `dad7ccd` (design system documentation).

**Note on branching.** Every commit before `75d6d23` was made directly on `main`, which contradicts [CODING_STANDARDS.md](./CODING_STANDARDS.md#branching)'s `feature/<short-name>` rule. The A-2 work is the first to follow the documented convention. If direct-to-main is actually the intent for a solo build, `CODING_STANDARDS.md` should say so rather than leaving the two to disagree.

### Bootstrap phase status at the historical snapshot

**Infrastructure and tooling bootstrap is complete**, and implementation has moved past it. The original 15-step plan's numbering no longer maps cleanly onto what was actually executed — several later steps (tooling, CI, Docker) landed before the app scaffolds. Track by capability instead:

| Capability                                                           | Status                    |
| -------------------------------------------------------------------- | ------------------------- |
| Monorepo init, shared packages, workspace install                    | ✅ Done                   |
| Lint / format / pre-commit tooling                                   | ✅ Done                   |
| CI Phase 1 (validate)                                                | ✅ Done                   |
| Docker infrastructure (postgres, minio, nginx) + ADR-002 check       | ✅ Done, verified         |
| Prisma schema, migrations, `Locale` seed                             | ✅ Done                   |
| NestJS scaffold, response envelope, exception handling               | ✅ Done                   |
| Public read APIs — locales, catalog, SEO                             | ✅ Done                   |
| Frontend design system foundation (`packages/ui`, `packages/config`) | ✅ Done, not yet rendered |
| **`apps/web` scaffold + design proof (A-3)**                         | ⬜ **Next**               |
| Auth, form submissions, Payload, CMS integration, Admin Dashboard    | ⬜ Not started            |

---

## 5. Historical Implementation Order — superseded

This dependency plan is retained to explain how the repository reached its present state. Its “Next” markers are historical and must not be used for current planning. Phase C, formerly the current next gate, is now implemented as described in §4; a subsequent product gate has not yet been selected.

Dependency order, not a schedule. Each step assumes the previous ones landed.

### 0. Version control — ✅ done

Baseline committed as `3fa6f8d` on `main`, remote `origin` configured. Keep committing incrementally as each step below lands. **Note:** two commits are currently unpushed — see §4 "Git state".

### 1. Monorepo shell — ✅ done

`pnpm install` has been run and `pnpm-lock.yaml` is committed. ESLint 10 flat config, Prettier, and Husky + lint-staged are wired. The GitHub Actions CI workflow exists as **Phase 1 only** — lint → type-check → format check. `test` and `build` are deliberately omitted until a package actually defines those scripts; Phases 2 and 3 wait on the application Dockerfiles ([DEVOPS.md](./DEVOPS.md)).

### 2. Database and Docker — ✅ done

`docker-compose.yml` runs `postgres`, `minio` (+ `minio-init`) and `nginx`; the three app services are deliberately absent, since the approved development model runs them on the host ([ADR-005](./ADR/ADR-005-vps-docker-deployment.md), approved implementation decision 4). The Postgres init script creates **two databases and two scoped users**, and the negative case is verified rather than assumed: `scripts/verify-db-isolation.sh` passes 4/4, confirming the `sam_platform` user genuinely _cannot_ connect to `sam_cms`. That check is the whole point of ADR-002 — re-run it after any change to the init script or the Postgres volume.

**Development note:** host-run applications reach PostgreSQL through `docker-compose.override.yml`, which publishes `127.0.0.1:5432` and attaches `postgres` to a development-only network. Publishing the port alone is not sufficient — the `data` network is `internal: true`, and Docker creates no host binding for a container whose networks are all internal.

### 3. Prisma setup — ✅ done

`prisma init` **at the repo root**, not inside `apps/api`. Translate [DATA_MODEL.md](./DATA_MODEL.md) §1 into `schema.prisma` — a literal translation, not a redesign. Seed the `Locale` table with `en`/`fa`/`ar`. First migration against `sam_platform` only.

Landed as `7f35929` (schema + initial migration) and `46a3667` (Prisma integration in the API). `prisma/seed.ts` is idempotent and upserts by `code`.

### 4. NestJS API — partially done

Scaffold `apps/api`, then build [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) outward-in: health/locales → catalog reads → form submissions → SEO endpoints. Modules follow the boundaries in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Done:** scaffold, response envelope and exception handling, health, locales, category and product reads with locale resolution, SEO redirects and sitemap entries, and the `media` module boundary. See §4 for the endpoint list.

**Remaining in this step:** the form submission endpoints. They depend on nothing above and could be built before or after the frontend design proof.

### 5. Authentication

JWT issuance, argon2id hashing, RBAC guards from the [SECURITY.md](./SECURITY.md) matrix. Needed before the admin surface and before any protected endpoint.

### 6. Payload CMS setup

Scaffold `apps/cms` against `sam_cms` using the **default `public` schema** — never the experimental `schemaName` option. Build the Globals and collections from [content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md). Payload uses **its own admin authentication and its own role model** — minimum `Admin` and `Content Manager`, with the certification publish gate enforced in Payload's access control ([ADR-006](./ADR/ADR-006-payload-admin-authentication.md)). No SSO bridge, no syncing from `User`. This step is no longer blocked.

### 7. CMS integration

NestJS Content module proxying Payload, plus caching and publish-triggered revalidation. This is where ADR-003 gets proven end-to-end.

### 8. Frontend scaffolding — design system done, app scaffold next

**Done (step A-2):** the design system foundation in `packages/ui` and `packages/config` — tokens authored in TypeScript and generated into a Tailwind v4 theme, 13 Server-Component primitives, a twelve-column editorial grid, a specification primitive, and four scroll-driven CSS reveal patterns with no animation library. Recorded in [design/DESIGN_SYSTEM.md](./design/DESIGN_SYSTEM.md).

**Next (step A-3):** scaffold `apps/web` (Next.js 15, App Router, Tailwind) and render a design-proof route. This is the first time the design system is seen in a browser — until then its rhythm, glass, gradients, midnight sections and reveals are verified only by compiled-CSS inspection.

**Then:** the remaining pages in the [ROADMAP.md](./ROADMAP.md) M3 order — About Us → Products → Customized Solutions → Export & Logistics → Contact Us. Locale routing and the homepage are done; see below.

**Locale routing (P1) — SHIPPED 13 August 2026.** `next-intl` remains **deferred and not installed**; P1 uses native App Router locale routing plus a hand-written middleware at `apps/web/src/middleware.ts`, and `next-intl` gets its own dependency approval at the gate that first introduces translated UI message catalogs. `app/layout.tsx` was deleted in favour of **two true root layouts** — `app/[locale]/layout.tsx` owning the locale-correct `<html lang dir>`, and `app/design-proof/layout.tsx` preserving `lang="en" dir="ltr"` and `noindex`/`nofollow` — because the App Router's root layout is positional, so a nested `[locale]` layout could not own `<html>` while `app/layout.tsx` existed. P1 promoted **only the homepage**, `/{locale}`, as the verification route: `/en`, `/fa` and `/ar` render, all three still `noindex,nofollow`. No Product Family page was promoted, the shared `products/[slug]` route was not created, and Product Detail remains unimplemented. The eleven `/design-proof` routes are unchanged.

**One operational consequence: `apps/web` no longer builds without configuration.** `GET /api/v1/locales` is the sole routing locale source — `generateStaticParams` reads it and there is **no fallback** to hardcoded locales, to an empty set, or to the presentational `LOCALES` fixture in `site-routes.ts`. A missing or invalid `API_INTERNAL_URL`, an unreachable or non-2xx locale endpoint, or a payload that is empty, malformed, carries a duplicate code, or has zero-or-many defaults **fails the web build, deliberately**. This does not change the Category fetch, which still fails open to its fixture where approved — a fixture can stand in for a page's content, and nothing can stand in for the list of which pages exist. Full detail: [frontend/FRONTEND_ARCHITECTURE.md §2](./frontend/FRONTEND_ARCHITECTURE.md), and [apps/web/.env.example](../apps/web/.env.example) for the variable itself.

### 9. Forms and Admin Dashboard

The six submission flows, then the Admin Dashboard at `app/(admin)/admin/*`.

### 10. RAG _(future phase — not Phase 1)_

Only after real content exists. Add `GET /api/v1/rag/export`, then the isolated vector store, permission-aware retrieval, and product search as the first capability.

---

## 6. Frozen Decisions

**Do not change these without a new ADR and explicit sign-off.**

1. **Payload CMS is the only CMS.** Never introduce or reference another (e.g. Sanity).
2. **NestJS is the only backend and the only API surface the frontend calls** _(ADR-003)_. Applies to the Admin Dashboard too — no exception.
3. **Two independent PostgreSQL databases** _(ADR-002)_. Never merge them; never use Payload's `schemaName` option.
4. **pnpm workspaces + Turborepo** _(ADR-001)_. No fourth application — the Admin Dashboard lives inside `apps/web`.
5. **argon2id** for password hashing _(ADR-004)_.
6. **`apps/web` never calls Payload or a database directly.**
7. **Layout is code, editorial content is CMS.** No generic page builder; no hardcoded lists, cards, timelines, or FAQs.
8. **Media ownership**: Payload Media for Payload content, Prisma `Media` for Prisma entities.
9. **Locale list is data, not code.** Adding a language must never require a code change.
10. **RAG indexes on an allow-list, never a deny-list**, and never touches a database directly. `JobApplication`/CVs/personal submissions are never indexed at any tier.
11. **Job Applications are Admin-only**; **Certifications require Admin to publish.**
12. **Structural page URLs stay fixed English across locales**; localized slugs only for products, categories, and blog articles.
13. **Product Family and Product Detail share one `products/` slug namespace** _(ADR-010)_. `/{locale}/products/{slug}` serves both, through one route with one discriminator; no `/products/categories/` and no `/products/p/`. **Product Family wins**, and colliding data is **invalid** — the namespace is the symmetric union of base and translated `Category` and `Product` slugs, `finder`/`segments`/`types` are reserved in it, and durable enforcement is required before the first Product write, Product reference data, or Category/Product translated-slug row. **Infrastructure failure must never be converted into a canonical-content 404.** The mechanism was decided by _(ADR-011)_ — a trigger-maintained `ProductSlugClaim` registry — and is **installed**, by migration `20260814120000_add_product_slug_namespace_registry`. The frontend half is not: the shared route segment exists, the Product Detail branch does not. The only `Product` rows written since are **DEMO / PLACEHOLDER, NON-AUTHORITATIVE data that is not approved SAM Group catalog content, must be replaced with approved commercial product data before launch, and must never be treated as approved catalog content by a production deployment** ([DATABASE.md](./DATABASE.md) §Products).

---

## 7. Remaining Blockers

Only genuinely unresolved items.

### Architectural

1. ~~Payload admin authentication~~ — **resolved 7 August 2026.** Payload Admin uses **separate authentication**: its own admin users in `sam_cms`, reached at `cms.<domain>/admin`. NestJS does not manage Payload sessions, **no SSO bridge** will be built, no accounts are synced from `User`, and cookies are never shared between the two hosts. Payload maintains its own role model (minimum `Admin`, `Content Manager`) mirroring the CMS-facing RBAC rules, including the Admin-only certification publish gate. Recorded as [ADR-006](./ADR/ADR-006-payload-admin-authentication.md); [ARCHITECTURE.md](./ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md#payload-admin-access) amended. **Step 6 unblocked.** Two consequences carried forward: staff sign in twice, and **Payload account lifecycle is manual** — disabling a platform user does not revoke CMS access, so account creation/removal is now a mandatory part of onboarding and offboarding.
2. ~~Draft preview~~ — **decided 20 August 2026: DEFERRED for Phase 1.** No preview mechanism is built — no Next.js draft mode, no preview token, no `draft=true` browser path, no editor preview link. Published public reads are the only public content path. The accepted cost: an editor reviews unpublished work in Payload's own admin UI and confirms on the live site after publishing. Recorded in [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) Remaining Blockers 2.
3. **RTL typeface pairing.** The chosen Latin faces have no Arabic/Persian glyph coverage. Candidates proposed; needs design sign-off. Blocks `fa`/`ar` visual parity.

### Operational

4. **Email delivery is entirely unspecified** — no provider, sender domain, or deliverability plan. Four flows depend on it: newsletter double opt-in, form acknowledgements, download links, admin notifications.
5. ~~Vercel/VPS split~~ — **resolved 7 August 2026.** The whole platform deploys to a single Linux VPS via Docker Compose behind Nginx; the Vercel split-hosting proposal is dropped. Reconciled across [TECH_STACK.md](./TECH_STACK.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DEVOPS.md](./DEVOPS.md), and [technology/FRONTEND_STACK.md](./technology/FRONTEND_STACK.md). The CORS concern is resolved with it — `web` and `api` now share one origin behind Nginx. Recorded as [ADR-005](./ADR/ADR-005-vps-docker-deployment.md). **Still to build:** the Docker and GitHub Actions files themselves.
6. **The VPS does not exist, and its purchase is deferred until the application is complete.** The deployment target is decided (ADR-005) but nothing is provisioned: no server, no DNS, no certificates. **Hosting provider, machine sizing, and provisioning method are all undecided** and are not to be chosen or assumed before purchase. Consequences to plan around: CI/CD Phases 2 and 3 cannot be finished, no production URL exists for testing, and TLS cannot be issued. Nothing in the current work depends on the host — the local Docker stack is self-contained. See the status note under [DEVOPS.md § Deployment Target](./DEVOPS.md#deployment-target).

### Legal

7. **Privacy Policy** — every form's consent checkbox is legally inert without it. Blocks form launch.
8. **Retention periods** — approved as a requirement; concrete durations need legal input. Deliberately not guessed at.

### Content _(blocks launch, not development)_

9. Photography (facility, products, team), audited company statistics, **real certifications** (the Admin-approval workflow currently has nothing to approve), contact details, MOQs, lead times, and the final export market list. All tracked in [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed).

### Housekeeping

10. ~~Nothing is pushed to a remote~~ — **resolved.** Baseline committed (`3fa6f8d`), remote `origin` configured (`https://github.com/hosein6671/Samgroup`), `origin/main` synchronized. The branch-name mismatch is resolved with it: the branch is `main`, matching what [DEVOPS.md](./DEVOPS.md) references for CI/deploy triggers.
11. ~~`docs/Design/` casing mismatch~~ — **resolved.** Directory renamed to lowercase `docs/design/`, matching the other subdirectories and all references.

---

## 8. Instructions for the Next AI Engineer

### Read first, in this order

1. [/CLAUDE.md](../CLAUDE.md) — the map.
2. [/AI_CONTEXT.md](../AI_CONTEXT.md) — behavioral rules and live open threads. **Non-negotiable.**
3. This document.
4. [ADR/README.md](./ADR/README.md) — before proposing anything touching monorepo tooling, database topology, API integration, or CMS boundaries. Those four already have settled answers.
5. Then the specific documents for whatever you're working on.

### Do not change the architecture

The twelve frozen decisions in §6 are settled and were each argued through. If a request appears to conflict with one, **say so and ask** — don't quietly comply and don't quietly refuse. Surfacing the tension is the expected behavior here; it's how several of these decisions got improved.

### Do not generate code before reviewing documentation

This project has an unusually complete specification. Nearly every implementation question already has a documented answer, and code written without reading it will contradict something. Specifically: check [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) before writing an endpoint, [DATA_MODEL.md](./DATA_MODEL.md) before a schema, and [content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md) before a collection.

### Continue from the current phase

The bootstrap, frontend design proof, canonical public routes, Payload foundation, three CMS-backed company Globals, public lead writes, authentication/session lifecycle, lead Admin workflow, catalog import and the read-only technical-review surface are implemented. ADR-014 through ADR-017 now govern the active catalog work.

**The latest completed UI implementation boundary is Phase C: the technical-review decision UI.** `apps/web/src/features/admin/catalog/review/phase-boundary.spec.ts` now enforces the write boundary rather than forbidding it: one server-only decision POST path, one Server Action, explicit status/hash concurrency inputs, no generic status mutation, no bulk or superseded-subject decision, display-only provenance and no browser-held credential. Specification and Product Claim detail screens expose approve, reject and return-to-review without combining this gate with catalog content approval, source capture, Product Type vocabulary or unrelated Admin work. Choose and approve the next product gate separately.

**The following gate adds source capture without broadening the public or Admin API.** Its executable is `pnpm catalog:sources:capture`; it takes `--document-id`, `--file`, `--media-type` and optional `--page-count`. Exactly one mode is required:

- `--dry-run` reads the local artifact in memory, computes its lowercase SHA-256 and metadata, verifies the `SourceDocument` exists, prints no locator or file path, and performs no write.
- `--apply` additionally requires `--target-database sam_platform` and `--confirm-sha256 <digest>`. The connected database is checked independently. Inside one SERIALIZABLE transaction the writer locks the document, reuses an identical immutable `SourceAsset` or creates it, and applies only `sourceAssetId: NULL → asset id`. ADR-017's database triggers own any `SOURCE_CAPTURE_CHANGED` invalidation.
- Identical replay is a no-op. A different hash or different immutable metadata is refused; that situation is a new `SourceDocument` revision, never an in-place rewrite.
- The CLI does not download URLs, retain source bytes, write object storage, expose locators, create evidence, change review status directly or approve anything. Real source artifacts and explicit per-run apply authorization are still required, so all 16 external sources remain uncaptured.

Verification at this handoff: root lint passed; root type-check passed (5/5 tasks); the full workspace test run passed — all 80 active API suites with 1,687 tests, all 51 web suites with 1,109 tests, and all 113 CMS tests. The five database-backed API suites remain skipped under their existing environment gates. The focused source-capture set also passed 11/11, including transaction writer coverage.

### Product content research — 27 August 2026

The 100-name catalog manifest is now paired with an internal research artifact at [`content/PRODUCT_RESEARCH_REGISTER.json`](./content/PRODUCT_RESEARCH_REGISTER.json), documented by [`content/PRODUCT_RESEARCH_REGISTER.md`](./content/PRODUCT_RESEARCH_REGISTER.md). The allow-listed collector in `scripts/research-catalog-products.ts` checked 66 records against official King Power or Addilex pages and retained 34 HSB records on the supplied printed-catalog basis. It does not change the canonical workbook name, formulation, specification or claim; it separates official series/API/SAE/feature metadata from identity and copies no external locator into the artifact.

This is a **copy-research gate, not publication**. Sixty-six records have no conflict or withheld fact and can proceed to a copy draft; 34 require data review before copy. Every record explicitly remains blocked until the existing technical-review workflow approves its Specification and Product Claim data. No database write and no public-site content change occurred in this research pass.

The 66 eligible research records now include conservative English copy drafts. Each draft contains one factual summary derived only from official feature metadata or the existing family/type/grade classification, a selection note directing the buyer to approved technical data, and the CTAs “Request product information” / “Discuss supply requirements”. The 34 data-review records carry no draft. Persian and Arabic remain explicitly `not_started`; translation begins only after the English source copy is reviewed.

Before starting it, read ADR-014 through ADR-017 and the relevant Admin/API contracts, identify every file involved, report the implementation plan, and obtain the separate code approval required by `CLAUDE.md`.

### Working conventions established here

- **Documentation and code are separate approval gates.** Approval to write docs or produce a plan is not approval to write code. Get an explicit, separate go-ahead.
- **Verify third-party claims before they inform a decision.** ADR-002 exists because a design was checked against Payload's actual issue tracker and turned out to depend on an experimental, bug-prone feature. Don't take a library's capability on faith.
- **Architecture-affecting proposals get an ADR**, not a prose edit.
- **Work incrementally and stop for review.** The bootstrap was deliberately executed in small, reviewable steps. Continue that way.
- **Don't build speculative future-phase infrastructure.** Customer Portal, CRM, Workflow, ERP, and RAG each have a documented anchor point. That's deliberate — design happens when the phase starts.

### One caution

Several documents contain `[TO CONFIRM]` and `[ESTIMATE — CONFIRM]` markers copied from the source spreadsheet — company statistics, certifications, milestones, contact details. **These are placeholders, not facts.** Do not treat them as real data, do not seed them into a database, and do not let them reach a page that could go live.

### Content workstream update — 27 August 2026

- Added the claim-controlled English website content system under `docs/content/site-copy/`.
- Defined SAM Group's website voice, messaging hierarchy, terminology, and CTA system.
- Drafted English master copy for the full public sitemap, shared product surfaces, forms, global components, system states, and cookie interface.
- Created an approval register separating editorially usable copy from technical, commercial, corporate, certification, and legal facts that still require evidence.
- No CMS/database write was performed. No legal policy was invented. Persian and Arabic translation is intentionally gated behind approval of the English semantic master and verified facts.
- The existing Home demonstration fixture still contains unapproved numeric claims. It is documented as unsafe for production publication and was not silently rewritten in this content-only gate.
- Added brand-aligned English copy for all 100 catalog products: card summary, page introduction, selection and document guidance, CTAs, and SEO metadata. All records remain publication-blocked; 66 require technical approval and 34 first require data-conflict review.
- Added claim-controlled English SEO titles and descriptions for the public sitemap. Product metadata is capped at 160 characters and generated reproducibly by `scripts/generate-branded-product-copy.ts`.
- Product-copy ownership clarification: all 100 entries are base catalog products; `publicProductName` must remain exact. Composition or formulation language may only be transcribed from the source already bound to that product (official product source or supplied catalogue), never inferred or reformulated. Provenance stays internal and technical approval remains mandatory.

### Public UI completion pass — in progress, 27 August 2026

- Work is isolated on `feature/design-system`; `origin/main` has not been changed. A recoverable pre-pass reference exists at `codex/backup-home-before-ui-2026-08-27` (`916cd08`).
- The homepage has received the approved Hero, CTA, Story, Why, Network, Lab and Journey copy/layout pass, alignment repairs, navigation updates, internal links, and locale-aware canonical/social metadata. New imagery under `apps/web/public/images/home/` is local branded artwork, not an external asset claim.
- `/en/export-logistics` is now a dedicated page rather than a redirect: requirement brief, eight-step delivery path, packaging formats, Incoterm guidance and enquiry CTA. Copy avoids unapproved market, MOQ, lead-time and certification claims.
- Contact and Request a Quote now share a compact, route-aware enquiry experience with a split hero and a responsive light/dark form composition. The existing API and persistence contract were not changed.
- Products landing metadata now has a locale-aware canonical plus Open Graph/Twitter copy. Product Finder now exposes the API's existing free-text `q` capability, preserves Family and Segment selections in the URL, and searches published names, slugs and public specification values. Landing and Finder copy now describe the controls that actually exist instead of promising unsupported industry/application/packaging filters.
- About Us remains CMS-owned. On 27 August 2026 the user explicitly approved adding editorial content, and the English masters for About Us, Customized Solutions, and Quality & Certifications were published through Payload's Local API by `apps/cms/src/editorial/publish-company-pages.ts`. Each Global was read back with `_status: published`; no frontend copy fallback and no direct SQL write was introduced. The Quality content deliberately publishes no certificate, accreditation, test method, in-house capability, equipment, or numeric claim. The formerly empty local `PAYLOAD_API_KEY` was closed on 27 August with `apps/cms/src/editorial/rotate-content-service-key.ts`: the explicitly armed command generates a 288-bit credential, rotates the single Payload `service` identity, writes the same value only to ignored `apps/api/.env`, verifies the REST credential, and never prints it. NestJS now serves the published Global successfully. Full local media verification must use the approved Nginx entry point at `http://localhost:8080`; direct port 3000 does not proxy `/media/*` by design.
- The About Us Team section was approved and added across Payload schema, shared wire types, NestJS projection, and the responsive frontend. It describes Product & Technical, Commercial, Supply & Logistics, and Customer Coordination functions; it does not invent employee names, titles, biographies, tenure, or results. The generated editorial photograph is stored as an optimized WebP at `apps/web/public/images/about-team-collaboration.webp`, registered idempotently in Payload Media as `sam-group-team-collaboration.webp`, and rendered with the official SAM mark overlaid by the UI.
- The complete English About Us narrative was rewritten against `docs/content/site-copy/BRAND_VOICE_AND_MESSAGING.md`: Hero, Who We Are, positioning principles, expertise, Team, Quality & Standards, closing routes, CTA labels, supporting UI labels, and SEO metadata now share one product-led B2B message. The copy uses buyer decision inputs such as grade, application, specification, documentation, quantity, packaging, destination, and Incoterm; it deliberately adds no unverified history, figures, markets, facilities, certification, capacity, customer, or performance claims. The updated Global was published and read back as `_status: published` on 27 August 2026.
- Live QA at 1146 px and 390 px confirmed zero horizontal overflow, valid Team media dimensions (1672 × 941), and no browser-console errors. A specificity conflict that kept the image-free Who We Are layout in narrow columns was fixed by restating the one-column CMS-state contract below 1180 px. The editorial publisher also used obsolete `title`/`description` keys inside the shared SEO group; these were corrected to `metaTitle`/`metaDescription` for all three company Globals and verified in rendered `<title>` and description output. The inspected page is `http://localhost:8080/en/about-us`.
- A follow-up whole-page alignment audit at 1440 px, the live 1235 px viewport, and 390 px placed every About section on the same `fs-wrap` content edge. The Team heading is no longer sticky and now starts exactly level with its photograph; the image-free Who We Are section collapses onto the common single rail at compact widths; Product Families uses the available measure as a responsive 3/2/1-column list; and image-free Quality uses a balanced heading/detail split on desktop before collapsing to one column below 980 px. All checked widths had zero horizontal overflow and no element outside the viewport.
- Verification after the Finder change: web TypeScript passes; all 53 web test files pass (1,115 tests); live `/en/products` and `/en/products/finder` render with no horizontal overflow, and the query URL retains the entered search.
- About Us link and SEO pass: the shared Company footer navigation now includes the locale-aware `/[locale]/about-us` route, and every About/internal destination checked through the local Nginx entry point returned HTTP 200. The page now emits a locale-aware canonical URL, website Open Graph fields, CMS-managed Open Graph/Twitter imagery, and one minimal `Organization` + `AboutPage` JSON-LD graph without adding unverified corporate facts. The global pre-launch `noindex, nofollow` gate remains intact, and hreflang is still withheld because Persian and Arabic content is currently served through the documented fallback path rather than reviewed translations. Live DOM verification at `http://localhost:8080/en/about-us` confirmed the canonical `https://samgp.com/en/about-us`, the social image, both JSON-LD entities, and the footer link. CMS/API/web type-checks pass; all 53 web test files pass (1,117 tests).
- Image delivery optimization: the six generated public photographs were converted from PNG to WebP at quality 82 with their source dimensions preserved. Their combined repository and transfer weight fell from 11,327,675 bytes to 578,732 bytes (94.9% smaller). All page, metadata and CMS publisher references now use WebP; the six obsolete PNG copies were removed after a zero-reference check. The Nginx entry point returned HTTP 200 with `image/webp` for every optimized asset, including the CMS-managed About social/team image.
- Customized Solutions completion pass: a recoverable pre-pass branch exists at `codex/backup-customized-solutions-before-ui-2026-08-27` (`5f67087`). The page now treats the buyer's requirement brief as its visual and editorial thesis: a natural generated review photograph with a separate official SAM overlay, a compact six-stage hero navigator, an approved five-item requirement-scope section, and detailed process steps that explain information flow without promising timing, availability or an outcome. The process section was subsequently upgraded from a light bordered table to a midnight technical workflow with independent glass cards, directional connectors, status markers, controlled hover elevation and a mobile vertical path; its content and order did not change. The request form now presents the unchanged 14-field/API contract as three progressive steps—company/contact, product requirement, and destination/supply—with per-step native validation, preserved values, Back/Continue navigation, server-error routing to the first affected step, final-step consent and a shortened attachment limitation. Hidden steps stay mounted so values survive navigation, but forward progress cannot skip required inputs. The Payload Global, generated types, shared wire contract, NestJS allow-list projection and frontend all carry `whatCanWeCustomize` plus optional step descriptions; private-label programme and case-study fields remain deliberately absent because no approved commercial programme or customer case material exists. CMS social imagery, locale-aware canonical/Open Graph metadata and a minimal `WebPage` JSON-LD graph were added while the global `noindex, nofollow` launch gate and hreflang translation gate remain intact. Live QA at 1220 px and 390 px found zero horizontal overflow, valid responsive image delivery, aligned 5-item/6-step grids, a functioning three-step form and the expected canonical/social/schema output. Verification: 113 CMS tests, the 16 focused API tests, all 53 web files / 1,117 tests, root type-check and root lint pass.
- Products landing visual pass started on 28 August 2026 from the recoverable local branch `codex/backup-products-before-ui-2026-08-28` (`d739b5e`). The Hero now leads with a requirement-oriented product-discovery message, a generated natural portfolio photograph, and the official SAM mark rendered separately by the UI; the image itself carries no logo, text, facility, capacity, certification or performance claim. The former six-row Hero diagram remains a semantic navigation landmark but is now a compact catalogue register below the image/copy pair. A whole-page UI follow-up turned that register into a consistently bounded 3×2 matrix with equal cells and explicit hover/focus feedback. The range introduction was rewritten against the approved brand voice without changing category taxonomy, canonical links, Finder behaviour or catalog data. The obsolete disabled catalogue form and internal `design proof / not connected` message were removed; until the dedicated `DownloadRequest` endpoint exists, catalogue access uses the working locale-aware enquiry route and states what information the buyer should provide. The new image also drives `summary_large_image` Open Graph/Twitter output, and the landing page emits a claim-free `CollectionPage` + six-item `ItemList` JSON-LD graph. Live checks at 1569 px desktop and the 390 px mobile override found equal architecture-cell geometry, aligned section rails and zero horizontal overflow; the mobile override was reset after QA. Verification: web TypeScript, all 53 web test files / 1,116 tests, root lint and `git diff --check` pass.
- Base Oils editorial and technical-source pass started on 28 August 2026 from recoverable local branch `codex/backup-base-oils-before-content-ui-2026-08-28` (`a0265c6`) and was committed as `4d66b04`. The complete English page now follows one B2B decision path: classification → range/designation → available product records → property review → quality evidence → formulation destinations → packaging/delivery basis → document roles → enquiry. The existing product names and formulation scope are unchanged. API classification axes (saturates, sulfur and viscosity index), the Group III VI boundary, Group IV/PAO and Group V context, and the distinction between manufacturing route and analysed group were researched from API 1509; general application language was corroborated against primary Aramco and Nynas material. The former empty grade/property matrix is suppressed until approved SAM values exist; six equal guidance cards now explain what each property contributes to technical review and distinguish grade-level TDS information from batch-level COA evidence. Quality, Thin Film Polishing, applications, supply, documentation and FAQ copy was rewritten to remove internal wording, clarify the buyer's next action and avoid unverified capability claims. Family routes now emit locale-aware canonical, Open Graph/Twitter metadata and shared-renderer `Product` + `FAQPage` JSON-LD. The public page carries no external-source links and no competitor data. `docs/content/BASE_OILS_CONTENT_SOURCES.md` records the sources, permitted use and exclusions; SAM property values remain pending reviewed SAM TDS/COA data. A natural, claim-safe laboratory hero photograph was generated specifically for the family and stored as the optimised 1536×1024 WebP `apps/web/public/images/base-oils-lab-samples.webp` (about 104 KB); it contains unlabelled pale-gold and amber samples in a generic laboratory, while the official SAM mark remains a separate HTML overlay. The hero now uses a responsive copy/photo composition, a full-width family index, entry and restrained ambient photo motion, and hover/focus elevation for index and specification cards; `prefers-reduced-motion` removes non-essential motion. The family image is also the route's Open Graph/Twitter image and appears in Product JSON-LD. Live QA at 1569 px desktop and 390 px mobile found complete heading order, no duplicate IDs, no empty property table, a responsive 3×2→2×3→1×6 property grid, a two-column mobile family index, a loaded and correctly described hero image, and zero horizontal overflow; the temporary viewport override was reset after QA. Verification: web TypeScript, all 53 web test files / 1,116 tests, lint and `git diff --check` pass.
- Remaining product-family completion pass on 28 August 2026: Lubricant Additives, Engine Oils & Automotive Lubricants, Industrial Oils & Lubricants, Marine Oils & Lubricants, and Antifreeze & Coolants now share the approved product-page visual system while keeping their own decision logic. Additives begins with finished-fluid application; Automotive with vehicle/duty followed by grade and specification; Industrial with equipment/duty and operating conditions; Marine with shipboard system, service and port context; Coolants with base fluid, inhibitor technology, system requirement and supply form. Existing family names, sub-ranges and formulation scope were not changed. Internal research records `docs/content/LUBRICANT_ADDITIVES_CONTENT_SOURCES.md` and `docs/content/PRODUCT_FAMILY_CONTENT_SOURCES.md` capture the primary API, Lubrizol, Afton, Chevron, MAN/Everllence, Wärtsilä and BASF context used, plus explicit exclusions. No competitor link, numerical property, treat rate, compatibility, approval, certification, capacity, MOQ or lead-time claim was added to a public page. Five claim-safe natural photographs were generated, optimised as 1536×1024 WebP assets (approximately 88–120 KB each), and paired with separate official SAM HTML overlays; each now drives its family's hero, Open Graph/Twitter image and Product JSON-LD. Shared entry motion, restrained photo drift, hover/focus states and reduced-motion support apply consistently. Recoverable pre-pass refs exist for Additives, Automotive, Industrial, Marine and Coolants at commit `4d66b04`. Live QA across all five routes and at 390×844 found loaded images with descriptive alt text, correct page/social titles, two-column mobile family indexes and zero horizontal overflow; the temporary viewport override was reset. Verification: web TypeScript, all 53 web test files / 1,116 tests, root lint and `git diff --check` pass.
- Product Detail completion pass on 28 August 2026: the one shared `/{locale}/products/{slug}` Product branch now gives all 100 API-published catalog records a complete, claim-controlled B2B page. The manifest currently contains 45 automotive, 26 industrial, 15 additive, 12 marine and 2 antifreeze/coolant products; it contains no Base Oil Product records, so SN 150/350/500/650 remain family-range designations rather than fabricated Product pages. Each detail page adds a family-specific selection brief, four enquiry criteria, a representative laboratory photograph with an explicit “not product packaging” caption and a separate official SAM HTML mark, plus a document-role section for TDS, SDS and COA. Product names, descriptions, taxonomy, specifications and product media still come only from the NestJS API; empty technical values are not inferred, formulation is not changed, and the publication-blocked draft register was not copied into public pages. SEO now consumes the API `SeoFields` contract with safe content fallback, locale-aware canonical/real translation alternates, robots, Open Graph/Twitter fields and validated manual structured-data override support. Automatic output is a Product + BreadcrumbList JSON-LD graph; only API-published specifications enter `additionalProperty`. Existing family-list cards already provide the canonical links, and product-scoped sample/quote CTAs continue to carry only `?product={slug}` into the existing server-resolved inquiry flow. A recoverable pre-pass branch exists at `codex/backup-product-details-before-ui-2026-08-28` (`3edc990`). Automated live-route QA through local Nginx returned HTTP 200 for all 100 English product URLs and representative Persian/Arabic fallback routes. Live desktop/mobile inspection of an Antifreeze product confirmed the full landmark/heading structure, loaded representative media, correct scoped CTA URLs and zero horizontal overflow at the 390 px override; the override was reset and the inspected page was left open. Verification: web TypeScript, all 54 web test files / 1,122 tests, root lint and `git diff --check` pass.
- The 34-record supplied-catalogue review was triaged on 28 August 2026 in `docs/content/PRODUCT_DATA_REVIEW_TRIAGE.md`. Thirty records have no conflict or withheld fact and can enter the existing Specification/Product Claim review; this is not publication approval. Four records initially entered the source-blocked lane: `SN Grade` (`SAMCAT-W1-R069`, unnamed manufacturer requirement), `Racing Grade` (`SAMCAT-W1-R093`, two unitless density facts), `Refrigerator compressor oil-KD` (`SAMCAT-W1-R162`, ambiguous 40/100 °C viscosity heading plus refrigerant scope), and `Grease Based on Calcium` (`SAMCAT-W1-R300`, twelve unit-dependent facts plus two distinct suitability claims). Later owner-provided equivalence context and official corroborating sources narrowed this lane as recorded below; contradictory or product-table-specific omissions still require explicit review. No public content, product identity, formulation, database row or technical-review status changed in this triage.
- HSB source verification continued on 28 August 2026 against the user-supplied `HSB products.pdf`. The existing `Hirmand Shimi Baharan product catalogue` SourceDocument is already attached to an immutable SourceAsset with the same SHA-256 (`5ccd403859d793c5160216a9c5a391babb85bd180dadfa17fb9d83c85c502ee9`), byte size (7,487,031), media type (`application/pdf`) and page count (45); the capture CLI dry-run returned `already captured; no write needed`. The source currently supports 551 SourceFacts, 494 Specifications (437 `source_recorded`, 57 `needs_review`) and 40 normalized Product Claims (38 `source_recorded`, 2 `needs_review`). All 57 held Specifications lack a printed unit—56 density values and one 100 °C viscosity value—and units remain uninferred. The held claims are the unnamed manufacturer-requirement statement for `SN Grade` and the `API TC` classification for `TWO-Stroke Engine Oil`. No source apply, approval, database mutation or public-content change occurred.
- On 28 August 2026 the product owner confirmed that the HSB-listed products are non-proprietary equivalents with the same formulations and directed that source identities remain internal rather than appearing on public pages. `docs/content/PRODUCT_DATA_REVIEW_TRIAGE.md` now records the resulting corroboration policy: official ASTM/NLGI/API material and equivalent manufacturer data sheets may support individual technical-review decisions without changing product names or formulations. ASTM D4052 supports density units, ASTM D445 supports kinematic-viscosity units but not a missing temperature, NLGI/ASTM D217 supports worked-penetration units and ranges, and an official FUCHS POE refrigeration-oil family supports R134a/HFC formulation context. The catalogue's grease dropping-point method `ASTM D-556` conflicts with the official ASTM D566 designation and remains an explicit discrepancy. No database status, product fact, public citation or public page changed in this research pass.
- The first controlled coolant normalization increment was prepared on 28 August 2026 for the `Cool Tech` and `High-Performance` records. Their captured King Power TDS prints `ml 0.1 N.` beside Reserve Alkalinity and places `HCL` in the following pH unit cell. The importer now preserves both printed cells verbatim in immutable `SourceFact` rows while producing reviewable Specifications with the ASTM D1121 result basis `mL 0.100 N HCl` for Reserve Alkalinity and a dimensionless value for the ASTM D1287 pH reading. Product names, formulas and raw evidence are unchanged; source identity remains internal and no source link is added to public content. This adds two controlled properties and four candidate Specifications across the two products, changing the ratified plan from 26 to 28 SpecProperties, 1,398 to 1,402 Specifications, and 130 to 126 withheld facts. All four candidates remain non-public until an individual technical-review decision; no bulk approval or automatic publication was introduced.
