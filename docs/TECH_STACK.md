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
