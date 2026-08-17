# Technology Stack

Version pins for the frontend (Next.js 15, React 19) are now finalized below. Backend/infrastructure version pins (Node.js, pnpm, NestJS, Payload CMS, Prisma, PostgreSQL) remain intentionally unfixed — decided at Architecture Freeze to pin each to latest-stable at the point the Bootstrap Plan actually scaffolds it, rather than freezing a number now that may already be outdated by then.

## Frontend

Full rationale (purpose, why selected, performance/SEO/accessibility considerations, best practices, future scalability) for every item below: [technology/FRONTEND_STACK.md](./technology/FRONTEND_STACK.md).

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- GSAP (+ ScrollTrigger)
- Three.js
- React Three Fiber
- Drei
- Mapbox GL JS
- next-intl

---

## Backend

- NestJS
- TypeScript
- **`sanitize-html` — pinned to exactly `2.17.5`. Do not upgrade without reading the next paragraph.**

### Why `sanitize-html` is held at 2.17.5

It is the allow-list sanitizer the Content module applies to CMS rich text before serving it
([API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) §2.4a). **The pin is a compatibility constraint,
not caution.**

`sanitize-html` **2.17.6 and later depend on `htmlparser2@12`, which is ESM-only.** `apps/api`
compiles to **CommonJS** — `module: "node16"` with no `"type": "module"`, which is what NestJS's
decorator-and-DI runtime needs — so the `require` chain into `htmlparser2@12` cannot resolve. This
was **tested here, not inferred**: installing 2.17.7 produced `SyntaxError: Cannot use import
statement outside a module` from `htmlparser2/dist/index.js`. It fails at **application boot**, not
merely in Jest, so the whole API goes down rather than one test suite.

2.17.5 depends on `htmlparser2@10`, which ships a dual build with a `require` condition, and works.
The two versions are eight weeks apart with no security fix between them.

**Consequence for maintenance:** a routine "update all dependencies" pass will break the API at
startup. Raising this pin is its own task — it requires either an `htmlparser2` release that restores
CommonJS, or a decision to move `apps/api` to ESM, which is an architecture change and needs its own
approval.

---

## Database

- PostgreSQL
- Prisma ORM

---

## CMS

- Payload CMS **3.88.0** (pinned when `apps/cms` was scaffolded, 16 August 2026)
- **`@payloadcms/storage-s3` 3.88.0** — the official S3-compatible storage adapter, version-matched
  to the core. Editorial media goes to object storage rather than a container disk, which
  [DEVOPS.md](./DEVOPS.md) §Object storage requires; Payload's default `staticDir` handling is
  exactly what that rule forbids. It targets MinIO in development through process-scoped
  configuration and names no production host — the production object store is still an open decision,
  and because public URLs are origin-relative (`/media/<prefix>/<file>`, proxied by nginx) choosing
  one later needs no data migration.

### `apps/cms` runs its own Next.js version — approved, and intentional

Payload 3 **is** a Next.js application, so `apps/cms` has a `next` dependency of its own, and
`@payloadcms/next@3.88.0` supports only a narrow set of Next releases:
`>=15.2.9 <15.3 || >=15.3.9 <15.4 || >=15.4.11 <15.5 || >=16.2.6 <17`. **`apps/web`'s 15.5.x line is
not in it**, so the two applications cannot share a version. `apps/cms` is pinned to **Next 16.2.12**
— the lowest patch of the earliest 16.x line Payload validated.

**This is a CMS package-compatibility requirement, not a platform-wide upgrade.** `apps/web` stays on
its current version and **must not** be moved to match: the two are separate packages with separate
dependency trees, and pnpm's isolated `node_modules` is the boundary that keeps them apart. Each
application resolves its own `next`, and neither can see the other's.

Two consequences to carry forward. Raising the Payload version may move this window again, so the
supported range is checked at each Payload upgrade rather than assumed. And the Docker gate builds
two Next applications with different runtimes — DEVOPS.md's note that `cms` has "the same standalone
runtime shape as `web`" is about build configuration, and remains true; it was never a claim that
they share a version.

---

## Authentication

- JWT
- RBAC

---

## Storage

- MinIO (S3-compatible object storage) — required from Phase 1 for product images/documents and the Media module

---

## Monorepo Tooling

- pnpm workspaces
- Turborepo

---

## Deployment

- **Docker + Docker Compose + Nginx + Linux VPS** — the entire platform: `apps/web`, `apps/api`, `apps/cms`, PostgreSQL, and MinIO.

Single-target model: every service runs as a container on one Linux VPS, orchestrated by Docker Compose behind Nginx. **Confirmed 7 August 2026**, superseding the earlier split-hosting proposal that would have placed `apps/web` on Vercel. No external hosting provider is used for any part of the platform. Full topology, service list, and CI/CD flow: [DEVOPS.md](./DEVOPS.md).

---

## Development

- Git
- GitHub
- Claude Code
- VS Code

---

## Future Technologies

- Redis
- Elasticsearch
- RabbitMQ
