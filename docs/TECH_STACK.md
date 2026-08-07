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

---

## Database

- PostgreSQL
- Prisma ORM

---

## CMS

- Payload CMS

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

- **Vercel** — Frontend (`apps/web`) only. Rationale: [technology/FRONTEND_STACK.md §Deployment](./technology/FRONTEND_STACK.md#deployment).
- **Docker + Nginx + Linux VPS** — Backend (`apps/api`), Payload CMS (`apps/cms`), PostgreSQL.

This is a split-hosting model: `apps/web` deploys to Vercel while `apps/api`/`apps/cms`/PostgreSQL deploy to the VPS as before. `ARCHITECTURE.md` and `DEVOPS.md` still describe a single, undifferentiated Docker/Nginx/VPS deployment for all three apps — that hasn't been updated to reflect this split yet (see the architecture note flagged alongside this change).

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
