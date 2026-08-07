# System Architecture

This document defines architectural decisions and boundaries. For the concrete list of tools and versions, see [TECH_STACK.md](./TECH_STACK.md).

## Architecture Style

Modular Monolith

The system must be designed in a way that every module is independent.

Future migration to Microservices should be possible without rewriting the whole project.

---

## Applications

Three deployable applications, one repository (see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for layout):

- **web** (Next.js) — presentation only. No business logic beyond UI/view state. Calls the API app only. Contains **two application areas**: the public site and the Admin Dashboard (below).
- **api** (NestJS) — owns all business logic, the REST API, JWT issuance, and RBAC enforcement.
- **cms** (Payload) — content editing only. Never contains business logic. Never called directly by `web`.

---

## Admin Dashboard

**Approved: the Admin Dashboard is an application area inside `apps/web`, not a fourth application.**

It exists because Payload's admin UI structurally cannot serve it — ADR-002 forbids Payload from touching `sam_platform`, which is where products, blog content, form submissions, and users all live. Something has to administer that data, and Payload cannot.

- **Not a fourth app.** A separate `apps/admin` would duplicate the entire toolchain (build config, design tokens, API client, auth handling, i18n setup) for a surface that shares all of it. Keeping it in `apps/web` reuses `packages/ui`, `packages/types`, and the existing API client — one deployment, one build pipeline.
- **A separate _area_, not merely more pages.** It has its own route segment, its own layout, its own authentication boundary, and no SEO surface at all. It shares the codebase, not the page architecture.
- **Same API rule, no exception.** It calls only NestJS, at `/api/v1/admin/*` ([API_CONTRACT_FINAL.md §2.10](./API_CONTRACT_FINAL.md)). It never queries a database and never calls Payload — ADR-003 holds for the admin surface exactly as it does for the public one.
- **The Payload/Prisma split defines who edits what**: Prisma-owned data (catalog, blog, submissions, users, locales, redirects) → Admin Dashboard; Payload-owned editorial content → Payload's admin UI. Full table in [API_CONTRACT_FINAL.md §2.11](./API_CONTRACT_FINAL.md).
- **Two admin surfaces, two hosts.** The Admin Dashboard is served at `/admin/*` on the main domain. Payload's own admin UI is served from a **separate subdomain, `cms.<domain>`**, because Payload's admin route also defaults to `/admin` and the two would collide behind one origin. The split also keeps their sessions in separate cookie scopes — relevant to the still-open question of how CMS editors authenticate. Confirmed 7 August 2026; see [ADR-005](./ADR/ADR-005-vps-docker-deployment.md) and [DEVOPS.md](./DEVOPS.md#public-routing).

Route structure, authentication boundary, and RBAC integration: [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md#admin-dashboard-access).

---

## Modules (Modular Monolith boundaries)

Each module below is a self-contained NestJS module with its own service/controller/repository layer, so it can be extracted into its own microservice later without a rewrite:

- **Identity & Access** — users, roles, JWT, RBAC
- **Catalog** — products, categories, specifications
- **Content** — proxies/aggregates Payload CMS data (pages, menus, footer, settings)
- **Blog** — posts, categories, tags
- **Forms** — sample requests, custom formulation requests, contact form
- **Media** — images, files, videos
- **SEO** — meta fields, Open Graph, Twitter Cards, schema.org, slugs, canonical URLs, redirect management. Normalizes the same SEO contract from both Prisma-owned and Payload-owned content into one shape for the frontend — full design in [seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md)

Modules must not import each other's repositories/database models directly — cross-module access goes through the other module's service interface.

---

## CMS Integration

- Payload CMS runs against its **own separate Postgres database** (`sam_cms`), on the same Postgres server/container as the main application database (`sam_platform`), but as an independent database — not a schema within `sam_platform`.
- Prisma connects only to `sam_platform` and must never access `sam_cms`. Payload connects only to `sam_cms` and must never access `sam_platform`. Enforced via separate connection strings/credentials per database, not just convention.
- **Why a separate database instead of a separate schema in the same database:** Payload's Postgres adapter supports a custom `schemaName` for schema-level isolation, but that option is explicitly documented by Payload as _experimental_, and has a history of migration bugs (schema not auto-created, collection changes not applying correctly to non-default schemas). A separate database uses each tool's default, fully-supported configuration — Payload gets `public` in its own database, Prisma gets `public` in its own database — so isolation is achieved with zero experimental features and no shared failure surface for migrations. See [DEVOPS.md](./DEVOPS.md#postgres-databases) for how both databases run on one server, and [ADR-002](./ADR/ADR-002-two-databases.md) for the full rationale.
- **NestJS fronts Payload.** The `web` app never calls Payload's API directly. NestJS's Content module calls Payload internally and re-exposes what the frontend needs through the main API. This gives the frontend a single API surface and keeps auth, caching, and rate-limiting in one place. Full rationale: [ADR-003](./ADR/ADR-003-api-gateway.md).

---

## Authentication & Authorization

- JWT is issued **only by NestJS** — the single identity system for platform users (Admin, Content Manager, Sales Expert, Customer; see [DATABASE.md](./DATABASE.md)).
- Payload's built-in auth is used internally only, for NestJS's service-level access to the CMS. CMS editors authenticate through the platform's normal login (Admin/Content Manager roles), not a separate Payload account.
- Role → permission mapping (RBAC matrix) is defined in [SECURITY.md](./SECURITY.md), not here.

---

## Storage

Media files are stored separately from the application database, using an S3-compatible object store (MinIO). This is required starting Phase 1 — Product Images/Documents and the Media module are Phase 1 scope, so object storage cannot be deferred.

---

## Internationalization

- URL-based locale routing (`/en`, `/fa`, `/ar`, ...) via `next-intl`; the active locale list is data (a `Locale` table in `sam_platform`), not code — adding a language never requires changing `apps/web`, `apps/api`, or `apps/cms` source.
- Payload-owned content (Pages, Settings) uses Payload's native field-level localization. Prisma-owned content (Product, Category, BlogPost) uses a new generic `ContentTranslation` table, consistent with the polymorphic pattern `Specification`/`SeoMeta`/`StatusHistory` already use — two implementations of the same capability, split for the same reason CMS integration is split (ADR-002).
- Full strategy: [i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md).

---

## Deployment

Every service — `apps/web`, `apps/api`, `apps/cms`, PostgreSQL, and MinIO — runs as a Docker container on a **single Linux VPS**, orchestrated with Docker Compose behind Nginx (reverse proxy + TLS termination). No part of the platform is hosted on an external provider.

Because `web` and `api` are served from one origin behind Nginx, browser traffic between them is same-origin and requires no cross-origin CORS configuration.

Full topology, service list, environments, and CI/CD flow: [DEVOPS.md](./DEVOPS.md).

---

## Design Principles

- Clean Architecture
- SOLID
- DRY
- KISS
- Modular Design
- Security First
- Performance First
