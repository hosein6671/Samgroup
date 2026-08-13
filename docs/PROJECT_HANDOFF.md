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

### Exists

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

### Runs today

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

### Does not exist

- **`apps/web` and `apps/cms` contain only `.gitkeep`.** No Next.js scaffold, no Payload config. The design system has therefore **never been rendered in a browser** — it is verified by compiled-CSS inspection and a measured contrast audit, not by looking at it.
- **No authentication.** No `auth` module, no JWT issuance, no RBAC guards. Every endpoint above is an unauthenticated public read.
- **No form submission endpoints, no admin endpoints, and no Content module** fronting Payload.
- No application Dockerfiles, no CI Phases 2–3, no `docker-compose.prod.yml`, no TLS configuration (only a `.example` template).
- Root `README.md` is still a zero-byte placeholder.

### Git state

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

### Bootstrap phase status

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

## 5. Implementation Order

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
13. **Product Family and Product Detail share one `products/` slug namespace** _(ADR-010)_. `/{locale}/products/{slug}` serves both, through one route with one discriminator; no `/products/categories/` and no `/products/p/`. **Product Family wins**, and colliding data is **invalid** — the namespace is the symmetric union of base and translated `Category` and `Product` slugs, `finder`/`segments`/`types` are reserved in it, and durable enforcement is required before the first Product write, Product reference data, or Category/Product translated-slug row (mechanism deliberately undecided). **Infrastructure failure must never be converted into a canonical-content 404.** None of it is implemented.

---

## 7. Remaining Blockers

Only genuinely unresolved items.

### Architectural

1. ~~Payload admin authentication~~ — **resolved 7 August 2026.** Payload Admin uses **separate authentication**: its own admin users in `sam_cms`, reached at `cms.<domain>/admin`. NestJS does not manage Payload sessions, **no SSO bridge** will be built, no accounts are synced from `User`, and cookies are never shared between the two hosts. Payload maintains its own role model (minimum `Admin`, `Content Manager`) mirroring the CMS-facing RBAC rules, including the Admin-only certification publish gate. Recorded as [ADR-006](./ADR/ADR-006-payload-admin-authentication.md); [ARCHITECTURE.md](./ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md#payload-admin-access) amended. **Step 6 unblocked.** Two consequences carried forward: staff sign in twice, and **Payload account lifecycle is manual** — disabling a platform user does not revoke CMS access, so account creation/removal is now a mandatory part of onboarding and offboarding.
2. **Draft preview.** Editors have no way to view unpublished content — they publish blind. Cheap now, awkward once caching assumes published-only. Decide before frontend page work.
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

**Infrastructure, database and the backend read layer are built** — monorepo, tooling, CI Phase 1, the Docker stack with the ADR-002 boundary verified, the Prisma schema and initial migration, and a NestJS application serving public reads for health, locales, catalog and SEO. The **frontend design system foundation** is built too, in `packages/ui`/`packages/config`.

**The next implementation boundary is the frontend design proof, step A-3** (§5 step 8): scaffold `apps/web` (Next.js 15, App Router, Tailwind) and render the design system. This matters more than it sounds — the design system has never been displayed in a browser, so its rhythm, glass, gradients, midnight sections and scroll reveals are verified only by inspecting compiled CSS.

Two things remain available out of order and depend on nothing above: the **form submission endpoints** (§5 step 4's remainder) and **authentication** (§5 step 5). Otherwise follow §5's order. Do not skip ahead to page work — building UI against endpoints that don't exist produces throwaway work. Verify §4 against the repository before trusting it; status in this project has gone stale before.

### Working conventions established here

- **Documentation and code are separate approval gates.** Approval to write docs or produce a plan is not approval to write code. Get an explicit, separate go-ahead.
- **Verify third-party claims before they inform a decision.** ADR-002 exists because a design was checked against Payload's actual issue tracker and turned out to depend on an experimental, bug-prone feature. Don't take a library's capability on faith.
- **Architecture-affecting proposals get an ADR**, not a prose edit.
- **Work incrementally and stop for review.** The bootstrap was deliberately executed in small, reviewable steps. Continue that way.
- **Don't build speculative future-phase infrastructure.** Customer Portal, CRM, Workflow, ERP, and RAG each have a documented anchor point. That's deliberate — design happens when the phase starts.

### One caution

Several documents contain `[TO CONFIRM]` and `[ESTIMATE — CONFIRM]` markers copied from the source spreadsheet — company statistics, certifications, milestones, contact details. **These are placeholders, not facts.** Do not treat them as real data, do not seed them into a database, and do not let them reach a page that could go live.
