# Project Handoff — SAM Group Platform

**Prepared:** 7 August 2026 · **Phase:** Architecture complete, bootstrap partially executed, no application code written.

This document exists so someone with **zero conversation history** can pick this project up and continue correctly. It is a map and a status report, not a substitute for the documents it points to.

---

## 1. Project Overview

### Purpose

**SAM Group Platform** is a custom B2B web platform for a petroleum, lubricants, and petrochemical manufacturer — explicitly **not** a brochure website. Phase 1 delivers a company site, product catalog, CMS, lead-generation forms, and an admin dashboard; the architecture is designed to grow into Customer Portal, CRM, Workflow, ERP integration, and AI features over several years.

The business is a **direct manufacturer, not a trader** — that distinction drives much of the content strategy. Buyers are international: primary export markets are Africa, neighbouring regional markets, India, and Turkiye (noted as regulatorily strict). **WhatsApp is the primary contact channel** for international customers, which is why it appears as a persistent site-wide element rather than one contact option among many.

Full detail: [PROJECT_VISION.md](./PROJECT_VISION.md).

### Current architecture status

**Architecture is frozen and complete.** Every major area has been designed, reviewed, and approved: frontend, CMS content model, data model, i18n, SEO, security, RAG, and the full API contract. Five ADRs record the contested decisions.

**Implementation has barely started.** The monorepo shell exists (workspace config, shared package scaffolds). No framework has been scaffolded, no dependency has been installed, no application code exists.

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

**31 markdown documents + 2 source spreadsheets.** Read in roughly this order.

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
| [ADR/README.md](./ADR/README.md)               | Decision log — ADR-001 through ADR-005                                     |
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
├── .git/                     initialized; baseline committed and pushed (see below)
├── .gitignore                real file
├── package.json              root manifest, pnpm@11.20.0 pinned, turbo scripts
├── pnpm-workspace.yaml       apps/*, packages/*
├── turbo.json                v2 "tasks" schema
├── CLAUDE.md, AI_CONTEXT.md
├── docs/                     29 .md + 2 .xlsx — complete
└── packages/
    ├── tsconfig/             package.json + base.json
    ├── eslint-config/        package.json + index.js (flat config)
    ├── types/                package.json + tsconfig + empty barrel
    ├── ui/                   package.json + tsconfig + empty barrel
    └── config/               package.json + README (intentionally near-empty)
```

### Does not exist

- **No application code whatsoever.** `apps/web`, `apps/api`, `apps/cms` contain only `.gitkeep`.
- **`pnpm install` has never been run.** No `node_modules`, no lockfile. Every dependency in every `package.json` is a _declaration_, not an installed package. **Nothing in this repo currently builds or runs.**
- Empty: `docker/`, `scripts/`, `.github/`, and root `README.md` / `docker-compose.yml` (zero-byte placeholders).
- No Prisma schema, no migrations, no Payload config, no Docker Compose, no CI workflow.

### Git state

The repository is initialized, committed, and backed up to a remote.

|                 |                                                                                        |
| --------------- | -------------------------------------------------------------------------------------- |
| Baseline commit | `3fa6f8d` — `chore: initial architecture and documentation baseline`                   |
| Branch          | `main` — matches the branch [DEVOPS.md](./DEVOPS.md) references for CI/deploy triggers |
| Remote          | `origin` → `https://github.com/hosein6671/Samgroup`                                    |
| Sync            | `origin/main` synchronized — nothing unpushed                                          |
| Working tree    | Clean                                                                                  |

The architecture is under version control and clonable by a new engineer.

### Bootstrap phase status

The 15-step Bootstrap Plan is **2 of 15 complete**:

| Step                                                                 | Status         |
| -------------------------------------------------------------------- | -------------- |
| 1. Monorepo init (git, `.gitignore`, folders)                        | ✅ Done        |
| 2. Shared packages (`packages/*`)                                    | ✅ Done        |
| 3. Workspace install (`pnpm install`, lockfile)                      | ⬜ **Next**    |
| 4–15 (app scaffolds, Postgres, Prisma, Docker, env, hooks, lint, CI) | ⬜ Not started |

---

## 5. Implementation Order

Dependency order, not a schedule. Each step assumes the previous ones landed.

### 0. Commit and push — ✅ done

The baseline is committed as `3fa6f8d` on `main` and pushed to `origin`. See §4 "Git state". Keep committing incrementally as each step below lands.

### 1. Finish the monorepo shell

`pnpm install` at the root — the first time this repo will actually resolve dependencies. Then ESLint/Prettier wiring, Husky + lint-staged, and the GitHub Actions CI workflow (lint → type-check → test → build).

### 2. Database and Docker

`docker-compose.yml` with `postgres`, `minio`, and the three app services. Postgres init script creating **two databases and two scoped users** — and verify the negative case: confirm the `sam_platform` user genuinely _cannot_ connect to `sam_cms`. That check is the whole point of ADR-002; skipping it means the isolation is convention, not enforcement.

### 3. Prisma setup

`prisma init` **at the repo root**, not inside `apps/api`. Translate [DATA_MODEL.md](./DATA_MODEL.md) §1 into `schema.prisma` — a literal translation, not a redesign. 20 entities. Seed the `Locale` table with `en`/`fa`/`ar`. First migration against `sam_platform` only.

### 4. NestJS API

Scaffold `apps/api`, then build [API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) outward-in: health/locales → catalog reads → form submissions → SEO endpoints. Modules follow the boundaries in [ARCHITECTURE.md](./ARCHITECTURE.md).

### 5. Authentication

JWT issuance, argon2id hashing, RBAC guards from the [SECURITY.md](./SECURITY.md) matrix. Needed before the admin surface and before any protected endpoint.

### 6. Payload CMS setup

Scaffold `apps/cms` against `sam_cms` using the **default `public` schema** — never the experimental `schemaName` option. Build the Globals and collections from [content/PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md). Payload uses **its own admin authentication and its own role model** — minimum `Admin` and `Content Manager`, with the certification publish gate enforced in Payload's access control ([ADR-006](./ADR/ADR-006-payload-admin-authentication.md)). No SSO bridge, no syncing from `User`. This step is no longer blocked.

### 7. CMS integration

NestJS Content module proxying Payload, plus caching and publish-triggered revalidation. This is where ADR-003 gets proven end-to-end.

### 8. Frontend scaffolding

Scaffold `apps/web` (Next.js 15, App Router, Tailwind), locale routing via next-intl, then build pages in the [ROADMAP.md](./ROADMAP.md) M3 order: Home → About Us → Products → Customized Solutions → Export & Logistics → Contact Us.

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

The project is at **Bootstrap step 3 of 15**. Follow §5's order. Do not skip ahead to feature work — the database, API, and CMS layers are prerequisites, and building UI against endpoints that don't exist produces throwaway work.

### Working conventions established here

- **Documentation and code are separate approval gates.** Approval to write docs or produce a plan is not approval to write code. Get an explicit, separate go-ahead.
- **Verify third-party claims before they inform a decision.** ADR-002 exists because a design was checked against Payload's actual issue tracker and turned out to depend on an experimental, bug-prone feature. Don't take a library's capability on faith.
- **Architecture-affecting proposals get an ADR**, not a prose edit.
- **Work incrementally and stop for review.** The bootstrap was deliberately executed in small, reviewable steps. Continue that way.
- **Don't build speculative future-phase infrastructure.** Customer Portal, CRM, Workflow, ERP, and RAG each have a documented anchor point. That's deliberate — design happens when the phase starts.

### One caution

Several documents contain `[TO CONFIRM]` and `[ESTIMATE — CONFIRM]` markers copied from the source spreadsheet — company statistics, certifications, milestones, contact details. **These are placeholders, not facts.** Do not treat them as real data, do not seed them into a database, and do not let them reach a page that could go live.
